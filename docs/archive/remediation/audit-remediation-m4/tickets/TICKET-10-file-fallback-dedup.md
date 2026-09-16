# TICKET-10: File fallback dedup (L-02)

- **Спека:** SPEC-05
- **Проблемы:** L-02 (`files.py:147` `fallback = raw.encode("ascii","replace").decode().replace('"',"_"); fallback = re.sub(r'[\r\n\"]', "_", fallback)` — двойная `"` замена)
- **Приоритет:** P2
- **Критичность:** Low
- **Сложность:** S
- **Зависимости:** —
- **Можно параллельно с:** TICKET-09,08

## Проблема
Два шага `replace('"',"_")` затем `re.sub` с `"` избыточны, но не вредят — L-02 minor.

## Требуемый результат
`fallback = re.sub(r'[\r\n\"]', "_", raw_name.encode("ascii","replace").decode())` — одна строка, `grep -c 'replace(\'"\''` 0.

## Объём работ
- `read app/api/v1/files.py:147`.
- Заменить 2 строки на 1 `re.sub`.

## Не входит
`storage.to_thread` (уже), `X-Request-ID` (TICKET-05).

## Компоненты
- Файл: `app/api/v1/files.py:147`

## План
1. `read files.py:140..155`.
2. Edit fallback dedup.
3. `pytest tests/test_header_remediation.py` PASS (CRLF).

## Пограничные случаи
- `file_name=''` → fallback `file`.

## Тесты
- `tests/test_header_remediation.py::test_download_crlf_escaped` без изменения.

## Критерии приёмки
- [ ] `grep 'replace(\'"\''` в `files.py` 0.
- [ ] `grep re.sub.*\\r\\n` 1.

## Команды проверки
- `grep -n "re.sub" technozrelost-backend/app/api/v1/files.py`
- `.venv/bin/pytest tests/test_header_remediation.py -v`

## Риски
- Нет.
