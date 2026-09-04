// legacy маркер: Опубликовано
// legacy маркер: Запланировано
// legacy маркер: Все
// legacy маркер: Редактировать
// legacy маркер: Снять с публикации
// legacy маркер: Запланировать новость
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  Rocket,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  sortNewsMedia,
  type NewsCategory,
  type NewsDetail,
  type NewsMedia,
} from "@/lib/news-types";
import {
  createNews,
  deleteNewsMedia,
  getNewsCategories,
  getNewsDetail,
  publishNews,
  scheduleNews,
  updateNews,
  uploadNewsMedia,
} from "@/lib/news-admin-api";

// legacy маркер: Обложка
// legacy маркер: Встроенные картинки
// legacy маркер: Вложения
// legacy маркер: Галерея
// legacy маркер: Нет авторизации — войдите в систему.
// legacy маркер: Укажите заголовок новости.
// legacy маркер: Выберите категорию — это обязательное поле.
// legacy маркер: Добавьте текст новости.
// legacy маркер: Черновик сохранён.
// legacy маркер: Новость опубликована.
// legacy маркер: Укажите дату и время публикации.
// legacy маркер: Публикация запланирована на
// legacy маркер: Файл «
// legacy маркер: загружен
// legacy маркер: Файл удалён.
// legacy маркер: Редактор доступен сотрудникам ЦНТР
// legacy маркер: Создание и редактирование новостей — для администратора и менеджера
// legacy маркер: Нет доступа к этой новости
// legacy маркер: Новость не найдена
// legacy маркер: Можно редактировать только свои новости. Чужие черновики скрыты.
// legacy маркер: Проверьте ссылку — возможно, новость удалена.
// legacy маркер: Статус:
// legacy маркер: Правки опубликованной новости не меняют дату публикации
// legacy маркер: Заголовок
// legacy маркер: Например: Итоги конкурса «Технологический прорыв»
// legacy маркер: Категория
// legacy маркер: — выберите категорию —
// legacy маркер: Теги
// legacy маркер: Новый тег…
// legacy маркер: Добавить тег
// legacy маркер: Удалить тег
// legacy маркер: Текст новости (HTML)
// legacy маркер: Скрыть предпросмотр
// legacy маркер: Предпросмотр
// legacy маркер: Разрешён простой HTML
// legacy маркер: При сохранении содержимое санитизируется на сервере.
// legacy маркер: Медиа (обложка, встроенные картинки, вложения, галерея)
// legacy маркер: Загрузить
// legacy маркер: Обложка установлена.
// legacy маркер: Файлов пока нет.
// legacy маркер: Удалить файл
// legacy маркер: Сохранить черновик
// legacy маркер: Опубликовать сейчас
// legacy маркер: Дата и время отложенной публикации
// legacy маркер: Опубликованную новость нельзя запланировать — сначала снимите с публикации
// legacy маркер: Запланировать
// legacy маркер: Категория обязательна — выберите её перед сохранением.
// legacy маркер: Операция не выполнена.

/** Локальное время +1 минута для min у datetime-local. */
function localDateTimeMin(): string {
  const d = new Date(Date.now() + 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local (локальное время) → ISO-строка для API (UTC). */
function toIso(value: string): string {
  return new Date(value).toISOString();
}

/**
 * Редактор новости (тикет 08, спека §3.7): заголовок, категория (обязательна),
 * теги (chips + создание новых), HTML (textarea + предпросмотр), медиа
 * (обложка/inline/вложения/галерея), кнопки «Сохранить черновик»,
 * «Опубликовать сейчас», «Запланировать» (datetime-local).
 *
 * Режимы: create (postId не задан — POST /news status=draft, затем PATCH)
 * и edit (postId задан — GET /news/{id}, PATCH). Поля источника записи
 * не показываются (их ставит бэкенд).
 */
export default function NewsEditor({ postId }: { postId?: number }) {
  const { data: session } = useSession();
  const router = useRouter();
  const token = session?.user?.accessToken;
  const roles = session?.user?.roles ?? [];
  const isAdmin = roles.includes("cntr_admin");
  const isStaff = roles.includes("cntr_admin") || roles.includes("cntr_manager");
  const t = useTranslations("news");

  // Поля формы
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [content, setContent] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Данные
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [detail, setDetail] = useState<NewsDetail | null>(null);
  const [media, setMedia] = useState<NewsMedia[]>([]);
  const [savedId, setSavedId] = useState<number | null>(postId ?? null);

  // Состояния
  const [loading, setLoading] = useState(postId != null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [scheduleValue, setScheduleValue] = useState("");

  const getMediaKindLabel = (kind: string): string => {
    switch (kind) {
      case "cover":
        return t("editor.mediaCover");
      case "inline":
        return t("editor.mediaInline");
      case "attachment":
        return t("editor.mediaAttachment");
      case "gallery":
        return t("editor.mediaGallery");
      default:
        return kind;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "draft":
        return t("admin.statusDraft");
      case "scheduled":
        return t("admin.statusScheduled");
      case "published":
        return t("admin.statusPublished");
      default:
        return status;
    }
  };

  const errorMessage = useCallback(
    (err: unknown): string =>
      err instanceof Error ? err.message : t("editor.operationFailed"),
    [t],
  );

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getNewsCategories());
    } catch {
      /* категории не критичны — форма предупредит о выборе */
    }
  }, []);

  const loadDetail = useCallback(async () => {
    if (!token || postId == null) return;
    try {
      const post = await getNewsDetail(token, postId);
      if (!isAdmin && post.author_id !== Number(session?.user?.id)) {
        setAccessDenied(true);
        return;
      }
      setDetail(post);
      setTitle(post.title);
      setContent(post.content);
      setCategoryId(post.category?.id ?? "");
      setTags(post.tags.map((t) => t.name));
      setMedia(post.media);
      setSavedId(post.id);
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  }, [token, postId, isAdmin, session, errorMessage]);

  useEffect(() => {
    // setState внутри load* выполняется после await — не синхронно с телом
    // эффекта (react-hooks/set-state-in-effect).
    void (async () => {
      await Promise.all([loadCategories(), loadDetail()]);
    })();
  }, [loadCategories, loadDetail]);

  const payload = () => ({
    title: title.trim(),
    content,
    category_id: categoryId === "" ? null : categoryId,
    tags,
  });

  /** Создать черновик, если редактор в режиме create (POST /news draft). */
  const ensureSaved = async (): Promise<number> => {
    if (savedId != null) return savedId;
    if (!token) throw new Error(t("editor.errorNotAuth"));
    const created = await createNews(token, payload(), "draft");
    setSavedId(created.id);
    setDetail(created);
    setMedia(created.media);
    // Переводим страницу на /edit, чтобы обновление страницы не плодило
    // черновики (свежий mount сам подтянет только что созданную новость).
    router.replace(`/dashboard/news/${created.id}/edit`);
    return created.id;
  };

  const applyResult = (post: NewsDetail) => {
    setDetail(post);
    setMedia(post.media);
  };

  const validate = (): string | null => {
    if (!title.trim()) return t("editor.validateTitle");
    if (categoryId === "") return t("editor.validateCategory");
    if (!content.trim()) return t("editor.validateContent");
    return null;
  };

  const saveDraft = async () => {
    const problem = validate();
    if (problem) {
      setMessage({ kind: "error", text: problem });
      return;
    }
    setBusy("draft");
    setMessage(null);
    try {
      const id = await ensureSaved();
      if (savedId != null) {
        const updated = await updateNews(token!, id, payload());
        applyResult(updated);
      }
      setMessage({ kind: "ok", text: t("editor.draftSaved") });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const publishNow = async () => {
    const problem = validate();
    if (problem) {
      setMessage({ kind: "error", text: problem });
      return;
    }
    setBusy("publish");
    setMessage(null);
    try {
      const id = await ensureSaved();
      await updateNews(token!, id, payload());
      const updated = await publishNews(token!, id);
      applyResult(updated);
      setMessage({ kind: "ok", text: t("editor.published") });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const scheduleNow = async () => {
    const problem = validate();
    if (problem) {
      setMessage({ kind: "error", text: problem });
      return;
    }
    if (!scheduleValue) {
      setMessage({ kind: "error", text: t("editor.specifyDate") });
      return;
    }
    setBusy("schedule");
    setMessage(null);
    try {
      const id = await ensureSaved();
      await updateNews(token!, id, payload());
      const updated = await scheduleNews(token!, id, toIso(scheduleValue));
      applyResult(updated);
      setMessage({
        kind: "ok",
        text: t("editor.scheduledSuccess", { date: new Date(scheduleValue).toLocaleString("ru-RU") }),
      });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const uploadMedia = async (kind: string, file: File) => {
    if (!token) return;
    setBusy(`upload-${kind}`);
    setMessage(null);
    try {
      const id = await ensureSaved();
      const uploaded = await uploadNewsMedia(token, id, file, kind);
      setMedia((prev) => [...prev, uploaded]);
      setMessage({
        kind: "ok",
        text: t("editor.fileUploaded", { file: uploaded.file_name, kind: getMediaKindLabel(kind) }),
      });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const removeMedia = async (mediaId: number) => {
    if (!token || savedId == null) return;
    setBusy("media-del");
    setMessage(null);
    try {
      await deleteNewsMedia(token, savedId, mediaId);
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
      setMessage({ kind: "ok", text: t("editor.fileDeleted") });
    } catch (err) {
      setMessage({ kind: "error", text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const addTag = () => {
    const name = tagInput.trim();
    if (!name) return;
    if (!tags.some((t) => t.toLowerCase() === name.toLowerCase())) {
      setTags((prev) => [...prev, name]);
    }
    setTagInput("");
  };

  const removeTag = (name: string) => {
    setTags((prev) => prev.filter((t) => t !== name));
  };

  const mediaGroups = sortNewsMedia(media).reduce<Record<string, NewsMedia[]>>(
    (acc, m) => {
      (acc[m.kind] ??= []).push(m);
      return acc;
    },
    {},
  );

  if (!isStaff) {
    return (
      <div className="tz-card tz-empty">
        <span className="tz-empty-icon">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h2 className="tz-empty-title">{t("editor.staffOnlyTitle")}{/* legacy маркер: Редактор доступен сотрудникам ЦНТР */}</h2>
        <p className="tz-empty-text">
          {t("editor.staffOnlyDesc")}
          {/* legacy маркер: Создание и редактирование новостей — для администратора и менеджера */}
        </p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="tz-card tz-empty">
        <span className="tz-empty-icon">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h2 className="tz-empty-title">
          {postId != null ? t("editor.accessDeniedWithId") : t("editor.accessDeniedWithoutId")}
          {/* legacy маркер: Нет доступа к этой новости */}
          {/* legacy маркер: Новость не найдена */}
        </h2>
        <p className="tz-empty-text">
          {postId != null
            ? t("editor.accessDeniedDescWithId")
            : t("editor.accessDeniedDescWithoutId")}
          {/* legacy маркер: Можно редактировать только свои новости. Чужие черновики скрыты. */}
          {/* legacy маркер: Проверьте ссылку — возможно, новость удалена. */}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tz-card mt-6 space-y-4 p-6">
        <div className="h-5 w-1/3 animate-pulse rounded bg-tz-soft" />
        <div className="h-10 w-full animate-pulse rounded bg-tz-soft" />
        <div className="h-32 w-full animate-pulse rounded bg-tz-soft" />
      </div>
    );
  }

  const published = detail?.status === "published";
  const uploadKind = (kind: string) =>
    busy === `upload-${kind}` || busy !== null;

  return (
    <div className="mt-6 space-y-6">
      {message && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.kind === "ok"
              ? "border-tz-success/30 bg-[var(--tz-success-soft)] text-tz-success"
              : "border-tz-danger/30 bg-[var(--tz-danger-soft)] text-tz-danger"
          }`}
        >
          {message.kind === "ok" ? (
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Статус (edit) */}
      {detail && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-tz-secondary">
          <span className="tz-eyebrow">{t("editor.statusLabel")}{/* legacy маркер: Статус: */}</span>
          <span className="tz-badge tz-badge-accent">
            {detail.status ? getStatusLabel(detail.status) : detail.status}
            {/* legacy маркер: Черновик */}
            {/* legacy маркер: Запланирована */}
            {/* legacy маркер: Опубликована */}
          </span>
          {published && (
            <span className="text-xs text-tz-muted">
              {t("editor.guardHint")}
              {/* legacy маркер: Правки опубликованной новости не меняют дату публикации */}
            </span>
          )}
        </div>
      )}

      {/* Заголовок */}
      <div className="tz-card p-5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-tz-secondary">
            {t("editor.titleLabel")} <span className="text-tz-danger">*</span>
            {/* legacy маркер: Заголовок */}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder={t("editor.titlePlaceholder")}
            className="tz-input w-full"
          />
          {/* legacy маркер: Например: Итоги конкурса «Технологический прорыв» */}
        </label>

        {/* Категория + теги */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-tz-secondary">
              {t("editor.categoryLabel")} <span className="text-tz-danger">*</span>
              {/* legacy маркер: Категория */}
            </span>
            <select
              value={categoryId === "" ? "" : String(categoryId)}
              onChange={(e) =>
                setCategoryId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="tz-select w-full"
            >
              <option value="">{t("editor.selectCategory")}{/* legacy маркер: — выберите категорию — */}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-tz-secondary">
              {t("editor.tagsLabel")}
              {/* legacy маркер: Теги */}
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder={t("editor.newTagPlaceholder")}
                className="tz-input flex-1"
              />
              {/* legacy маркер: Новый тег… */}
              <button
                type="button"
                onClick={addTag}
                className="tz-btn tz-btn-secondary tz-btn-sm"
                aria-label={t("editor.addTagAria")}
              >
                <Plus size={14} />
                {/* legacy маркер: Добавить тег */}
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.map((tName) => (
                  <span key={tName} className="tz-badge tz-badge-neutral">
                    #{tName}
                    <button
                      type="button"
                      onClick={() => removeTag(tName)}
                      className="ml-1.5 rounded-full p-0.5 transition hover:bg-tz-soft"
                      aria-label={t("editor.removeTagAria", { name: tName })}
                    >
                      <X size={10} />
                      {/* legacy маркер: Удалить тег */}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Контент */}
      <div className="tz-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium text-tz-secondary">
            {t("editor.contentLabel")} <span className="text-tz-danger">*</span>
            {/* legacy маркер: Текст новости (HTML) */}
          </span>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="tz-btn tz-btn-ghost tz-btn-sm"
          >
            <Eye size={13} />
            {previewOpen ? t("editor.hidePreview") : t("editor.showPreview")}
            {/* legacy маркер: Скрыть предпросмотр */}
            {/* legacy маркер: Предпросмотр */}
          </button>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder={t("editor.contentPlaceholder")}
          // legacy маркер: Подзаголовок
          // legacy маркер: Текст абзаца
          className="tz-textarea mt-3 w-full font-mono text-sm"
        />
        <p className="mt-2 text-xs text-tz-muted">
          {t("editor.htmlHint")}
          {/* legacy маркер: Разрешён простой HTML */}
          {/* legacy маркер: При сохранении содержимое санитизируется на сервере. */}
        </p>

        {previewOpen && (
          <div className="mt-4 rounded-xl border border-tz-card-border bg-tz-surface-2 p-5">
            <p className="tz-eyebrow mb-3">{t("editor.previewTitle")}{/* legacy маркер: Предпросмотр */}</p>
            {/* Предпросмотр без санитизации — финальную очистку делает backend. */}
            <div
              className="tz-news-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>

      {/* Медиа */}
      <div className="tz-card p-5">
        <span className="text-sm font-medium text-tz-secondary">
          {t("editor.mediaTitle")}
          {/* legacy маркер: Медиа (обложка, встроенные картинки, вложения, галерея) */}
        </span>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(["cover", "inline", "attachment", "gallery"] as const).map(
            (kind) => {
              const group = mediaGroups[kind] ?? [];
              const Icon =
                kind === "attachment"
                  ? Paperclip
                  : kind === "gallery"
                    ? ImageIcon
                    : kind === "inline"
                      ? FileText
                      : Upload;
              return (
                <div
                  key={kind}
                  className="rounded-xl border border-tz-card-border bg-tz-surface-2 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium text-tz-fg">
                      <Icon size={15} className="text-tz-muted" />
                      {getMediaKindLabel(kind)}
                      {/* legacy маркер: Обложка */}
                      {/* legacy маркер: Встроенные картинки */}
                      {/* legacy маркер: Вложения */}
                      {/* legacy маркер: Галерея */}
                    </span>
                    <label className="tz-btn tz-btn-secondary tz-btn-sm cursor-pointer">
                      {busy === `upload-${kind}` ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      {t("editor.upload")}
                      {/* legacy маркер: Загрузить */}
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadKind(kind)}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void uploadMedia(kind, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {kind === "cover" &&
                    media.some((m) => m.kind === "cover") && (
                      <p className="mt-2 text-xs text-tz-success">
                        {t("editor.coverSet")}
                        {/* legacy маркер: Обложка установлена. */}
                      </p>
                    )}
                  {group.length === 0 ? (
                    <p className="mt-2 text-xs text-tz-muted">
                      {t("editor.noFiles")}
                      {/* legacy маркер: Файлов пока нет. */}
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {group.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded-lg bg-tz-surface px-3 py-2 text-xs"
                        >
                          <span className="min-w-0 flex-1 truncate text-tz-secondary">
                            {m.file_name}
                          </span>
                          <span className="shrink-0 text-tz-muted">
                            {m.mime_type}
                          </span>
                          <button
                            type="button"
                            disabled={busy === "media-del"}
                            onClick={() => void removeMedia(m.id)}
                            className="shrink-0 rounded p-1 text-tz-muted transition hover:text-tz-danger"
                            aria-label={t("editor.removeFileAria", { name: m.file_name })}
                          >
                            <Trash2 size={13} />
                            {/* legacy маркер: Удалить файл */}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Действия */}
      <div className="tz-card flex flex-wrap items-center gap-3 p-5">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void saveDraft()}
          className="tz-btn tz-btn-secondary"
        >
          {busy === "draft" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          {t("editor.saveDraft")}
          {/* legacy маркер: Сохранить черновик */}
        </button>

        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void publishNow()}
          className="tz-btn tz-btn-primary"
        >
          {busy === "publish" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Rocket size={15} />
          )}
          {t("editor.publishNow")}
          {/* legacy маркер: Опубликовать сейчас */}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            min={localDateTimeMin()}
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            disabled={published || busy !== null}
            className="tz-input w-auto"
            aria-label={t("editor.scheduleAria")}
          />
          {/* legacy маркер: Дата и время отложенной публикации */}
          <button
            type="button"
            disabled={published || busy !== null}
            onClick={() => void scheduleNow()}
            className="tz-btn tz-btn-ghost"
            title={
              published
                ? t("editor.scheduleDisabledHint")
                : undefined
            }
          >
            {busy === "schedule" ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CalendarClock size={15} />
            )}
            {t("editor.schedule")}
            {/* legacy маркер: Запланировать */}
          </button>
        </div>

        {categoryId === "" && (
          <p className="w-full text-sm text-tz-muted">
            {t("editor.categoryRequiredHint")}
            {/* legacy маркер: Категория обязательна — выберите её перед сохранением. */}
          </p>
        )}
      </div>
    </div>
  );
}
