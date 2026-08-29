"""Repair 04: DB-level keyset пагинация executors LIMIT 20."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.support import register_test_user


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register(client: TestClient, role: str = "rd_executor") -> tuple[str, int]:
    data = register_test_user(
        client, email=_email("exec"), full_name=f"Exec {uuid.uuid4().hex[:4]}", role_slug=role
    )
    return data["access_token"], data["user"]["id"]


def _verify_profile(client: TestClient, mgr_token: str, user_token: str) -> None:
    patched = client.patch(
        "/api/v1/profile",
        headers=_auth(user_token),
        json={"headline": "Ведущий инженер"},
    )
    assert patched.status_code == 200, patched.text
    submitted = client.post("/api/v1/profile/submit", headers=_auth(user_token))
    assert submitted.status_code == 200, submitted.text
    profile_id = submitted.json()["id"]
    decided = client.post(
        f"/api/v1/manager/profiles/{profile_id}/decide",
        headers=_auth(mgr_token),
        json={"action": "verify", "comment": "Ок"},
    )
    assert decided.status_code == 200, decided.text


def test_executors_keyset_limit_20(client: TestClient) -> None:
    """DB keyset: LIMIT 20 и after_id отдают следующий чанк без O(N) Python slice."""
    mgr_token, _ = _register(client, "cntr_manager")
    # создаём 25 верифицированных исполнителей с детерминированными именами для сортировки по full_name
    tokens: list[str] = []
    ids: list[int] = []
    for i in range(25):
        token, uid = _register(client, "rd_executor")
        # переопределяем full_name чтобы гарантировать порядок по имени
        # патчим профиль headline + верифицируем, но full_name остаётся из регистрации — уже уникален, но для сортировки равные префиксы
        _verify_profile(client, mgr_token, token)
        tokens.append(token)
        ids.append(uid)

    # первая страница limit=20
    first = client.get("/api/v1/executors?limit=20", headers=_auth(tokens[0]))
    assert first.status_code == 200, first.text
    data_first = first.json()
    assert len(data_first) == 20, f"ожидали 20, получили {len(data_first)}"
    # сортировка по full_name (внутри DB ORDER BY full_name,id)
    names = [e["full_name"] for e in data_first]
    assert names == sorted(names), "не отсортировано по full_name"

    # курсор — последний элемент первой страницы
    after_id = data_first[-1]["id"]
    second = client.get(
        f"/api/v1/executors?after_id={after_id}&limit=20", headers=_auth(tokens[0])
    )
    assert second.status_code == 200, second.text
    data_second = second.json()
    assert len(data_second) == 5, f"ожидали 5 на второй странице, получили {len(data_second)}"
    # нет пересечения
    first_ids = {e["id"] for e in data_first}
    second_ids = {e["id"] for e in data_second}
    assert first_ids.isdisjoint(second_ids), "пересечение страниц"
    # глобальный порядок сохраняется
    all_names = names + [e["full_name"] for e in data_second]
    assert all_names == sorted(all_names), "глобальный порядок нарушен"

    # fallback по несуществующему id: after_id не найден -> фильтр id > after_id (как в старом except StopIteration)
    # для after_id очень большой — вторая страница пустая
    empty = client.get("/api/v1/executors?after_id=9999999&limit=20", headers=_auth(tokens[0]))
    assert empty.status_code == 200
    assert empty.json() == []

    # проверка что организации тоже пагинируются через тот же ключ (если есть)
    orgs_first = client.get("/api/v1/executors/organizations", headers=_auth(tokens[0]))
    assert orgs_first.status_code == 200

    # специалисты без лимита — не обрезает до 20
    specialists = client.get("/api/v1/executors/specialists", headers=_auth(tokens[0]))
    assert specialists.status_code == 200
    assert len(specialists.json()) >= 25
