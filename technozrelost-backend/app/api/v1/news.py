"""Новостной раздел (перенос со старой линии; контракт фронта —
news-types.ts / news-admin-api.ts / api-client.ts).

Публичные GET без токена (``CurrentUserOptional``):
- ``GET /news`` — лента опубликованного: пагинация page/per_page,
  сортировка published_at DESC, фильтры category/tag (slug);
- ``GET /news/{id}`` — полная карточка опубликованного; черновики
  анониму/не-автору — 404;
- ``GET /news/categories`` — справочник категорий.

Авторизованные:
- ``cntr_admin`` — все операции с любыми новостями;
- ``cntr_manager`` — только свои (author_id == user.id, иначе 403);
- остальные роли — чтение ленты/карточки в ЛК.

Статусы: draft → scheduled → published; PATCH опубликованного не меняет
published_at. Весь HTML-контент при записи проходит ``sanitize_html``
(OWASP-базовая линия, F04-11). Media — через file_storage (сигнатурный
MIME, лимит 25 МБ).
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.deps import (
    CurrentUser,
    CurrentUserOptional,
    DBSession,
    ReadDBSession,
    has_role,
    require_role,
)
from app.db.models import NewsCategory, NewsPost, NewsPostMedia, NewsTag, User
from app.schemas import (
    NewsCardOut,
    NewsCategoryOut,
    NewsCreateIn,
    NewsDetailOut,
    NewsFeedOut,
    NewsMediaOut,
    NewsScheduleIn,
    NewsTagOut,
    NewsUpdateIn,
)
from app.services.file_storage import (
    FileSizeExceeded,
    FileStorageError,
    read_upload_limited,
    storage,
    store_news_media,
)
from app.services.html_sanitizer import sanitize_html, strip_tags
from app.services.notifications import notify_news_published

router = APIRouter(prefix="/news", tags=["news"])

# Медиа: обложка/вложение/галерея (kind=cover дополнительно проставляет
# post.cover_key).
MEDIA_KINDS = {"inline", "attachment", "gallery", "cover"}
EXCERPT_LIMIT = 240


def _slugify(name: str) -> str:
    slug = name.strip().lower().replace(" ", "-")
    slug = "".join(ch for ch in slug if ch.isalnum() or ch == "-")
    return slug.strip("-") or "tag"


def _category_out(category: NewsCategory | None) -> NewsCategoryOut | None:
    if category is None:
        return None
    return NewsCategoryOut(id=category.id, slug=category.slug, name=category.name)


def _tag_out(tag: NewsTag) -> NewsTagOut:
    return NewsTagOut(id=tag.id, slug=tag.slug, name=tag.name)


def _media_out(media: NewsPostMedia) -> NewsMediaOut:
    return NewsMediaOut(
        id=media.id,
        storage_key=media.storage_key,
        file_name=media.file_name,
        mime_type=media.mime_type,
        kind=media.kind,
        sort_order=media.sort_order,
        created_at=media.created_at.isoformat() if media.created_at else None,
    )


def _card_out(post: NewsPost) -> NewsCardOut:
    text = strip_tags(post.content)
    excerpt = text[:EXCERPT_LIMIT]
    if len(text) > EXCERPT_LIMIT:
        excerpt += "…"
    return NewsCardOut(
        id=post.id,
        title=post.title,
        excerpt=excerpt,
        cover_key=post.cover_key,
        category=_category_out(post.category),
        tags=[_tag_out(t) for t in post.tags],
        published_at=post.published_at.isoformat() if post.published_at else None,
        created_at=post.created_at.isoformat() if post.created_at else None,
    )


def _detail_out(post: NewsPost, author_name: str | None = None) -> NewsDetailOut:
    return NewsDetailOut(
        **_card_out(post).model_dump(),
        content=post.content,
        author_id=post.author_id,
        author_name=author_name,
        status=post.status,
        scheduled_at=post.scheduled_at.isoformat() if post.scheduled_at else None,
        source=post.source,
        created_automatically=post.created_automatically,
        media=[_media_out(m) for m in post.media],
        updated_at=post.updated_at.isoformat() if post.updated_at else None,
    )


async def _get_category(db: DBSession, category_id: int) -> NewsCategory:
    category = await db.get(NewsCategory, category_id)
    if category is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Категория не найдена"
        )
    return category


async def _ensure_tags(db: DBSession, names: list[str]) -> list[NewsTag]:
    """Мягкие теги: создаются при первом использовании."""
    result: list[NewsTag] = []
    for raw in names:
        name = raw.strip()[:160]
        if not name:
            continue
        slug = _slugify(name)
        tag = await db.scalar(select(NewsTag).where(NewsTag.slug == slug))
        if tag is None:
            tag = NewsTag(slug=slug, name=name)
            db.add(tag)
            await db.flush()
        result.append(tag)
    return result


async def _get_manageable_post(
    db: DBSession, post_id: int, user: User
) -> NewsPost:
    """Новость, доступная пользователю на изменение (автор или cntr_admin)."""
    post = await db.get(NewsPost, post_id)
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Новость не найдена")
    if not (has_role(user, "cntr_admin") or post.author_id == user.id):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Можно управлять только своими новостями",
        )
    return post


async def _author_name(db: DBSession, user_id: int) -> str | None:
    author = await db.get(User, user_id)
    return author.full_name if author else None


# ── Публичные GET (без токена) ──────────────────────────────────────────────


@router.get("", response_model=NewsFeedOut)
async def news_feed(
    db: ReadDBSession,
    user: CurrentUserOptional,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
    category: str | None = Query(None, description="slug категории"),
    tag: str | None = Query(None, description="slug тега"),
) -> NewsFeedOut:
    """Публичная лента: только published, published_at DESC.

    P-16: точечный selectin — только нужные связи (category+tags), не media.
    """
    base = select(NewsPost).where(NewsPost.status == "published")
    if category:
        base = base.join(
            NewsCategory, NewsPost.category_id == NewsCategory.id
        ).where(NewsCategory.slug == category)
    if tag:
        base = base.join(NewsPost.tags).where(NewsTag.slug == tag)
    total = await db.scalar(select(func.count()).select_from(base.subquery()))
    rows = (
        (
            await db.execute(
                # nullslast повторяет форму индекса ix_news_posts_status_published
                # (published_at DESC NULLS LAST): без него планировщик добавляет
                # Sort поверх Index Scan. Колонка nullable (draft/scheduled),
                # поэтому выровнен запрос, а не индекс — как в nioktr.py.
                base.options(
                    selectinload(NewsPost.category), selectinload(NewsPost.tags)
                )
                .order_by(
                    NewsPost.published_at.desc().nullslast(), NewsPost.id.desc()
                )
                .offset((page - 1) * per_page)
                .limit(per_page)
            )
        )
        .scalars()
        .all()
    )
    return NewsFeedOut(
        items=[_card_out(p) for p in rows],
        total=total or 0,
        page=page,
        per_page=per_page,
    )


@router.get("/mine", response_model=list[NewsDetailOut])
async def my_news(db: DBSession, user: CurrentUser) -> list[NewsDetailOut]:
    """Свои новости (все статусы) для консоли автора.

    P-16: точечный selectin для связей, нужных _detail_out.
    """
    rows = (
        (
            await db.execute(
                select(NewsPost)
                .where(NewsPost.author_id == user.id)
                .options(
                    selectinload(NewsPost.category),
                    selectinload(NewsPost.tags),
                    selectinload(NewsPost.media),
                )
                .order_by(NewsPost.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_detail_out(p, user.full_name) for p in rows]


@router.get("/admin-list", response_model=list[NewsDetailOut])
async def admin_news_list(
    db: DBSession,
    user: Annotated[User, Depends(require_role("cntr_admin", "cntr_manager"))],
    status_filter: str | None = Query(
        None, alias="status", description="draft|scheduled|published"
    ),
) -> list[NewsDetailOut]:
    """Консоль новостей: cntr_admin — все новости, cntr_manager — только свои."""
    if (
        status_filter is not None
        and status_filter not in {"draft", "scheduled", "published"}
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "status должен быть draft|scheduled|published",
        )
    base = select(NewsPost)
    if not has_role(user, "cntr_admin"):
        base = base.where(NewsPost.author_id == user.id)
    if status_filter:
        base = base.where(NewsPost.status == status_filter)
    rows = (
        (
            await db.execute(
                base.options(
                    selectinload(NewsPost.category),
                    selectinload(NewsPost.tags),
                    selectinload(NewsPost.media),
                ).order_by(NewsPost.created_at.desc(), NewsPost.id.desc())
            )
        )
        .scalars()
        .all()
    )
    # Один запрос на имена авторов вместо N+1.
    author_ids = {p.author_id for p in rows}
    authors: dict[int, str] = {}
    if author_ids:
        author_rows = (
            (await db.execute(select(User).where(User.id.in_(author_ids))))
            .scalars()
            .all()
        )
        authors = {u.id: u.full_name for u in author_rows if u.full_name}
    return [_detail_out(p, authors.get(p.author_id)) for p in rows]


@router.get("/categories", response_model=list[NewsCategoryOut])
async def news_categories(
    request: Request, response: Response, db: ReadDBSession
) -> list[NewsCategoryOut] | Response:
    """Список категорий для фильтров и редактора (публичный).

    P-09: ETag + Cache-Control — справочник редко меняется, кэш 5 минут.
    """
    rows = (
        (await db.execute(select(NewsCategory).order_by(NewsCategory.sort_order)))
        .scalars()
        .all()
    )
    etag_payload = "|".join(f"{c.id}:{c.slug}:{c.sort_order}" for c in rows)
    etag = f'W/"{hashlib.md5(etag_payload.encode()).hexdigest()}"'
    cache_control = (
        "private, max-age=300" if request.headers.get("authorization") else "public, max-age=300"
    )
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = cache_control
    response.headers["Vary"] = "Accept-Encoding"
    if request.headers.get("if-none-match") == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": cache_control, "Vary": "Accept-Encoding"},
        )
    return [
        NewsCategoryOut(id=c.id, slug=c.slug, name=c.name) for c in rows
    ]


@router.get("/{news_id}", response_model=NewsDetailOut)
async def news_detail(
    news_id: int,
    db: ReadDBSession,
    user: CurrentUserOptional,
) -> NewsDetailOut:
    """Полная карточка: анониму/не-автору — только published, иначе 404.

    P-16: точечный selectin — грузим связи явно при запросе карточки.
    """
    result = await db.execute(
        select(NewsPost)
        .where(NewsPost.id == news_id)
        .options(
            selectinload(NewsPost.category),
            selectinload(NewsPost.tags),
            selectinload(NewsPost.media),
        )
    )
    post = result.scalars().first()
    if post is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Новость не найдена")
    can_view_any = user is not None and (
        has_role(user, "cntr_admin") or post.author_id == user.id
    )
    if post.status != "published" and not can_view_any:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Новость не найдена")
    return _detail_out(post, await _author_name(db, post.author_id))


# ── Авторизованные мутации ──────────────────────────────────────────────────


@router.post(
    "",
    response_model=NewsDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_news(
    payload: NewsCreateIn,
    db: DBSession,
    user: Annotated[User, Depends(require_role("cntr_admin", "cntr_manager"))],
) -> NewsDetailOut:
    """Создать новость (cntr_admin/cntr_manager; source=manual)."""
    if payload.source != "manual":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "source должен быть 'manual': auto/api зарезервированы "
            "для шлюза контент-завода",
        )
    if payload.created_automatically:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "created_automatically выставляется только шлюзом контент-завода",
        )
    category = (
        await _get_category(db, payload.category_id)
        if payload.category_id is not None
        else None
    )
    now = datetime.now(UTC)
    status_value = payload.status
    if status_value == "scheduled":
        if payload.scheduled_at is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "Для статуса scheduled укажите scheduled_at",
            )
        if payload.scheduled_at <= now:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                "scheduled_at должен быть в будущем",
            )
    post = NewsPost(
        title=strip_tags(payload.title),
        content=sanitize_html(payload.content),
        status=status_value,
        category=category,
        author_id=user.id,
        scheduled_at=payload.scheduled_at if status_value == "scheduled" else None,
        published_at=now if status_value == "published" else None,
        source=payload.source,
        created_automatically=False,
    )
    post.tags = await _ensure_tags(db, payload.tags)
    db.add(post)
    await db.commit()
    await db.refresh(post)
    # P-16: после refresh связи не загружены (lazy select) — грузим явно для _detail_out
    await post.awaitable_attrs.tags
    await post.awaitable_attrs.category
    await post.awaitable_attrs.media
    return _detail_out(post, user.full_name)


@router.patch("/{news_id}", response_model=NewsDetailOut)
async def update_news(
    news_id: int,
    payload: NewsUpdateIn,
    db: DBSession,
    user: CurrentUser,
) -> NewsDetailOut:
    """Редактирование (автор/cntr_admin); published_at не меняется."""
    post = await _get_manageable_post(db, news_id, user)
    fields = payload.model_dump(exclude_unset=True)
    if "title" in fields:
        post.title = strip_tags(fields["title"] or "")
    if "content" in fields:
        post.content = sanitize_html(fields["content"] or "")
    if "category_id" in fields:
        category_id = fields["category_id"]
        post.category_id = (
            (await _get_category(db, category_id)).id
            if category_id is not None
            else None
        )
    if "cover_key" in fields:
        post.cover_key = fields["cover_key"]
    if "tags" in fields:
        post.tags = await _ensure_tags(db, fields["tags"] or [])
    await db.commit()
    await db.refresh(post)
    await post.awaitable_attrs.tags
    await post.awaitable_attrs.category
    await post.awaitable_attrs.media
    return _detail_out(post, await _author_name(db, post.author_id))


@router.post("/{news_id}/publish", response_model=NewsDetailOut)
async def publish_news(
    news_id: int,
    db: DBSession,
    user: CurrentUser,
) -> NewsDetailOut:
    """Опубликовать сейчас (автор/cntr_admin); draft/scheduled → published."""
    post = await _get_manageable_post(db, news_id, user)
    if post.status == "published":
        pass  # идемпотентно: published_at не трогаем
    elif post.status in {"draft", "scheduled"}:
        post.status = "published"
        post.published_at = datetime.now(UTC)
        post.scheduled_at = None
        await notify_news_published(db, post.id, post.title)
    else:
        raise HTTPException(status.HTTP_409_CONFLICT, "Некорректный статус")
    await db.commit()
    await db.refresh(post)
    await post.awaitable_attrs.tags
    await post.awaitable_attrs.category
    await post.awaitable_attrs.media
    return _detail_out(post, await _author_name(db, post.author_id))


@router.post("/{news_id}/schedule", response_model=NewsDetailOut)
async def schedule_news(
    news_id: int,
    payload: NewsScheduleIn,
    db: DBSession,
    user: CurrentUser,
) -> NewsDetailOut:
    """Отложить публикацию (автор/cntr_admin); draft/scheduled → scheduled."""
    post = await _get_manageable_post(db, news_id, user)
    if post.status == "published":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Опубликованную новость нельзя запланировать — сначала "
            "снимите с публикации",
        )
    if payload.scheduled_at <= datetime.now(UTC):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "scheduled_at должен быть в будущем",
        )
    post.status = "scheduled"
    post.scheduled_at = payload.scheduled_at
    await db.commit()
    await db.refresh(post)
    await post.awaitable_attrs.tags
    await post.awaitable_attrs.category
    await post.awaitable_attrs.media
    return _detail_out(post, await _author_name(db, post.author_id))


@router.post("/{news_id}/unpublish", response_model=NewsDetailOut)
async def unpublish_news(
    news_id: int,
    db: DBSession,
    user: CurrentUser,
) -> NewsDetailOut:
    """Снять с публикации (cntr_admin любую, автор — свою) → draft."""
    post = await _get_manageable_post(db, news_id, user)
    post.status = "draft"
    post.published_at = None  # следующая публикация ставит новый published_at
    await db.commit()
    await db.refresh(post)
    await post.awaitable_attrs.tags
    await post.awaitable_attrs.category
    await post.awaitable_attrs.media
    return _detail_out(post, await _author_name(db, post.author_id))


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_news(
    news_id: int,
    db: DBSession,
    user: CurrentUser,
) -> None:
    """Удалить (автор свою, cntr_admin любую); чистит media-файлы.

    P-13: удаление файлов из MinIO — строго после commit БД.
    Иначе падение commit оставляет строки-сироты без файлов.
    """
    post = await _get_manageable_post(db, news_id, user)
    # P-13/P-16: media грузим явно (awaitable) до удаления, удаление файлов — после commit
    await post.awaitable_attrs.media
    media_keys = [m.storage_key for m in post.media]
    await db.delete(post)
    await db.commit()
    for key in media_keys:
        with contextlib.suppress(FileStorageError):
            storage.remove(key)


# ── Media (multipart; сигнатурный MIME, лимит 25 МБ) ────────────────────────


@router.post(
    "/{news_id}/media",
    response_model=NewsMediaOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_news_media(
    news_id: int,
    db: DBSession,
    user: CurrentUser,
    file: Annotated[UploadFile, File(description="PDF/DOCX/XLSX/PNG/JPEG до 25 МБ")],
    kind: str = Form("inline"),
) -> NewsMediaOut:
    """Загрузка медиа (обложка/вложение/галерея); авторизация как у PATCH."""
    post = await _get_manageable_post(db, news_id, user)
    if kind not in MEDIA_KINDS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "kind должен быть inline|attachment|gallery|cover",
        )
    try:
        data = await read_upload_limited(file)
    except FileSizeExceeded as exc:
        # Единообразие с files.py: превышение лимита — 413 (Payload Too Large).
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    try:
        # P-02 MinIO put в threadpool — не блокирует event loop (news.py:487)
        stored = await asyncio.to_thread(store_news_media, post.id, file.filename or "media", data)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except FileStorageError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    max_order = await db.scalar(
        select(func.max(NewsPostMedia.sort_order)).where(
            NewsPostMedia.post_id == post.id
        )
    )
    media = NewsPostMedia(
        post_id=post.id,
        storage_key=stored.storage_key,
        file_name=file.filename or "media",
        mime_type=stored.mime_type,
        kind=kind,
        sort_order=(max_order or 0) + 1,
    )
    try:
        db.add(media)
        await db.flush()
        if kind == "cover":
            post.cover_key = stored.storage_key
        await db.commit()
    except Exception:
        # Орфан: объект в хранилище без закоммиченной строки БД.
        with contextlib.suppress(FileStorageError):
            storage.remove(stored.storage_key)
        raise
    await db.refresh(media)
    return _media_out(media)


@router.delete(
    "/{news_id}/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_news_media(
    news_id: int,
    media_id: int,
    db: DBSession,
    user: CurrentUser,
) -> None:
    """Удаление медиа (автор/cntr_admin); файл удаляется из хранилища."""
    post = await _get_manageable_post(db, news_id, user)
    media = await db.get(NewsPostMedia, media_id)
    if media is None or media.post_id != post.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Медиа не найдено")
    with contextlib.suppress(FileStorageError):
        storage.remove(media.storage_key)
    if post.cover_key == media.storage_key:
        post.cover_key = None
    await db.delete(media)
    await db.commit()
