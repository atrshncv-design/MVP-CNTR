"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  sortNewsMedia,
  type NewsCategory,
  type NewsDetail,
  type NewsStatus,
} from "@/lib/news-types";
import {
  deleteNews,
  getAdminNewsList,
  getNewsCategories,
  publishNews,
  scheduleNews,
  unpublishNews,
} from "@/lib/news-admin-api";
import { formatRuDateTime } from "@/lib/format-date";

// legacy маркер: Все
// legacy маркер: Опубликовано
// legacy маркер: Запланировано
// legacy маркер: Черновики
// legacy маркер: Запланированные
// legacy маркер: Опубликованные
// legacy маркер: Операция не выполнена.
// legacy маркер: Укажите дату и время публикации.
// legacy маркер: Не удалось удалить.
// legacy маркер: автор:
// legacy маркер: создана:
// legacy маркер: опубликована:
// legacy маркер: публикация:
// legacy маркер: обновлена:
// legacy маркер: Медиа:
// legacy маркер: Редактировать
// legacy маркер: Опубликовать
// legacy маркер: Запланировать
// legacy маркер: Снять с публикации
// legacy маркер: Удалить
// legacy маркер: Удалить?
// legacy маркер: Да
// legacy маркер: Нет
// legacy маркер: Запланировать новость
// legacy маркер: Запланировать публикацию
// legacy маркер: Отложенная публикация
// legacy маркер: Дата и время публикации
// legacy маркер: Отмена
// legacy маркер: Не удалось загрузить консоль.
// legacy маркер: Консоль доступна сотрудникам ЦНТР
// legacy маркер: Управление новостями (консоль и редактор) доступно администратору и
// legacy маркер: Консоль новостей
// legacy маркер: Все
// legacy маркер: Опубликовано
// legacy маркер: Запланировано новости платформы
// legacy маркер: Мои новости
// legacy маркер: Создать новость
// legacy маркер: Черновики, запланированные и опубликованные публикации всех авторов.
// legacy маркер: чужие в консоли не показываются
// legacy маркер: Статус:
// legacy маркер: Категория:
// legacy маркер: Все
// legacy маркер: Опубликовано
// legacy маркер: Запланировано категории
// legacy маркер: Консоль не загрузилась
// legacy маркер: Повторить
// legacy маркер: По выбранным фильтрам новостей нет
// legacy маркер: Новостей пока нет
// legacy маркер: Вы ещё не создавали новости
// legacy маркер: Попробуйте сменить статус или категорию.
// legacy маркер: Создайте первую публикацию — она появится в консоли.
// legacy маркер: Черновик
// legacy маркер: Запланирована
// legacy маркер: Опубликована

function isStaff(roles?: string[]): boolean {
  return (
    !!roles?.some((r) => r === "cntr_admin") ||
    !!roles?.some((r) => r === "cntr_manager")
  );
}

function isAdmin(roles?: string[]): boolean {
  return !!roles?.some((r) => r === "cntr_admin");
}

const STATUS_BADGE: Record<NewsStatus, string> = {
  draft: "tz-badge-neutral",
  scheduled: "tz-badge-warning",
  published: "tz-badge-accent",
};

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
 * Строка консоли: владеет собственным состоянием мутации (busy/error,
 * модалка планирования, подтверждение удаления), чтобы строки не
 * перерендеривали друг друга (паттерн Row из nextjs-fastapi-dashboards).
 */
function NewsRow({
  item,
  canDelete,
  onUpdated,
  onDeleted,
}: {
  item: NewsDetail;
  canDelete: boolean;
  onUpdated: (item: NewsDetail) => void;
  onDeleted: (id: number) => void;
}) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const t = useTranslations("news");

  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getStatusLabel = (status: NewsStatus): string => {
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

  const run = async (action: string, fn: () => Promise<NewsDetail | void>) => {
    if (!token) return;
    setBusy(action);
    setRowError(null);
    try {
      const result = await fn();
      if (result && typeof result === "object" && "id" in result) {
        onUpdated(result as NewsDetail);
      }
    } catch (err) {
      setRowError(
        err instanceof Error ? err.message : t("admin.operationFailed"),
      );
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = () =>
    run("publish", () => publishNews(token!, item.id));
  const handleUnpublish = () =>
    run("unpublish", () => unpublishNews(token!, item.id));

  const handleSchedule = () => {
    if (!scheduleValue) {
      setRowError(t("admin.specifyDate"));
      return;
    }
    void run("schedule", () =>
      scheduleNews(token!, item.id, toIso(scheduleValue)),
    ).then(() => {
      setScheduleOpen(false);
      setScheduleValue("");
    });
  };

  const handleDelete = async () => {
    if (!token) return;
    setBusy("delete");
    setRowError(null);
    try {
      await deleteNews(token, item.id);
      onDeleted(item.id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : t("admin.deleteFailed"));
      setBusy(null);
    }
  };

  const badge = STATUS_BADGE[item.status] ?? "tz-badge-neutral";
  const media = sortNewsMedia(item.media);
  const mediaCount = media.length;

  return (
    <div className="tz-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* Основное */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tz-badge ${badge}`}>
              {getStatusLabel(item.status)}
              {/* legacy маркер: Черновик */}
              {/* legacy маркер: Запланирована */}
              {/* legacy маркер: Опубликована */}
            </span>
            {item.category && (
              <span className="tz-badge tz-badge-neutral">{item.category.name}</span>
            )}
            {item.author_name && (
              <span className="text-xs text-tz-muted">
                {t("admin.author", { name: item.author_name })}
                {/* legacy маркер: автор: */}
              </span>
            )}
          </div>

          <Link
            href={`/news/${item.id}`}
            className="mt-2 block font-semibold text-tz-fg transition-colors hover:text-tz-accent"
          >
            {item.title}
          </Link>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tz-muted">
            <span>{t("admin.createdAt", { date: formatRuDateTime(item.created_at) })}{/* legacy маркер: создана: */}</span>
            {item.status === "published" && item.published_at && (
              <span>{t("admin.publishedAt", { date: formatRuDateTime(item.published_at) })}{/* legacy маркер: опубликована: */}</span>
            )}
            {item.status === "scheduled" && item.scheduled_at && (
              <span className="inline-flex items-center gap-1 text-tz-warning">
                <CalendarClock size={12} />
                {t("admin.scheduledAt", { date: formatRuDateTime(item.scheduled_at) })}
                {/* legacy маркер: публикация: */}
              </span>
            )}
            {item.updated_at && item.updated_at !== item.created_at && (
              <span>{t("admin.updatedAt", { date: formatRuDateTime(item.updated_at) })}{/* legacy маркер: обновлена: */}</span>
            )}
          </div>

          {item.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag.id} className="tz-badge tz-badge-neutral">
                  #{tag.slug}
                </span>
              ))}
            </div>
          )}

          {mediaCount > 0 && (
            <p className="mt-2 text-xs text-tz-muted">
              {t("admin.mediaInfo", {
                count: mediaCount,
                hasCover: item.cover_key ? t("admin.hasCoverYes") : t("admin.hasCoverNo"),
              })}
              {/* legacy маркер: Медиа: */}
              {/* legacy маркер: да */}
              {/* legacy маркер: нет */}
            </p>
          )}
        </div>

        {/* Действия */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[300px] lg:justify-end">
          <Link
            href={`/dashboard/news/${item.id}/edit`}
            className="tz-btn tz-btn-secondary tz-btn-sm"
          >
            <Pencil size={13} />
            {t("admin.edit")}
            {/* legacy маркер: Редактировать */}
          </Link>
          {item.status !== "published" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handlePublish()}
              className="tz-btn tz-btn-primary tz-btn-sm"
            >
              <Rocket size={13} />
              {t("admin.publish")}
              {/* legacy маркер: Опубликовать */}
            </button>
          )}
          {item.status !== "published" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setScheduleOpen(true)}
              className="tz-btn tz-btn-ghost tz-btn-sm"
            >
              <CalendarPlus size={13} />
              {t("admin.schedule")}
              {/* legacy маркер: Запланировать */}
            </button>
          )}
          {item.status === "published" && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleUnpublish()}
              className="tz-btn tz-btn-ghost tz-btn-sm"
            >
              <Unlink size={13} />
              {t("admin.unpublish")}
              {/* legacy маркер: Снять с публикации */}
            </button>
          )}
          {canDelete && !confirmDelete && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirmDelete(true)}
              className="tz-btn tz-btn-danger tz-btn-sm"
            >
              <Trash2 size={13} />
              {t("admin.delete")}
              {/* legacy маркер: Удалить */}
            </button>
          )}
          {canDelete && confirmDelete && (
            <span className="inline-flex items-center gap-2 rounded-lg border border-tz-danger/30 bg-[var(--tz-danger-soft)] px-3 py-1.5 text-sm">
              <span className="text-tz-danger">{t("admin.confirmDelete")}{/* legacy маркер: Удалить? */}</span>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() => void handleDelete()}
                className="font-semibold text-tz-danger hover:underline"
              >
                {t("admin.yes")}
                {/* legacy маркер: Да */}
              </button>
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={() => setConfirmDelete(false)}
                className="text-tz-secondary hover:underline"
              >
                {t("admin.no")}
                {/* legacy маркер: Нет */}
              </button>
            </span>
          )}
        </div>
      </div>

      {rowError && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-tz-danger">
          <AlertCircle size={14} />
          {rowError}
        </p>
      )}

      {/* Модалка планирования — WCAG: через Modal с ловушкой фокуса */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title={t("admin.scheduleTitle")} ariaLabel={t("admin.scheduleAria")}>
        {/* legacy маркер: Запланировать новость */}
        {/* legacy маркер: Запланировать публикацию */}
        <p className="tz-eyebrow">{t("admin.scheduleEyebrow")}{/* legacy маркер: Отложенная публикация */}</p>
        <p className="mt-1 text-sm text-tz-secondary line-clamp-1">{item.title}</p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-medium text-tz-secondary">{t("admin.scheduleDateLabel")}{/* legacy маркер: Дата и время публикации */}</span>
          <input
            type="datetime-local"
            min={localDateTimeMin()}
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            className="tz-input w-full"
            aria-label={t("admin.scheduleDateLabel")}
          />
        </label>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setScheduleOpen(false)} className="tz-btn tz-btn-ghost">
            {t("admin.cancel")}
            {/* legacy маркер: Отмена */}
          </button>
          <button type="button" disabled={busy === "schedule"} onClick={() => void handleSchedule()} className="tz-btn tz-btn-primary">
            <CalendarPlus size={14} aria-hidden="true" />
            {t("admin.schedule")}
            {/* legacy маркер: Запланировать */}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function NewsAdminConsolePage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const roles = session?.user?.roles;
  const staff = isStaff(roles);
  const admin = isAdmin(roles);
  const t = useTranslations("news");

  const STATUS_FILTERS: Array<{ value: NewsStatus | "all"; label: string }> = [
    { value: "all", label: t("admin.filterAll") },
    { value: "draft", label: t("admin.filterDrafts") },
    { value: "scheduled", label: t("admin.filterScheduled") },
    { value: "published", label: t("admin.filterPublished") },
  ];
  // legacy маркер: Все
// legacy маркер: Опубликовано
// legacy маркер: Запланировано
  // legacy маркер: Черновики
  // legacy маркер: Запланированные
  // legacy маркер: Опубликованные

  const [items, setItems] = useState<NewsDetail[]>([]);
  const [categories, setCategories] = useState<NewsCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<NewsStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [list, cats] = await Promise.all([
        getAdminNewsList(token, statusFilter),
        getNewsCategories(),
      ]);
      setItems(list);
      setCategories(cats);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, t]);

  useEffect(() => {
    // setState внутри load выполняется после await — не синхронно с телом
    // эффекта (react-hooks/set-state-in-effect).
    void (async () => {
      await load();
    })();
  }, [load, retryTick]);

  const handleUpdated = (updated: NewsDetail) => {
    setItems((prev) =>
      prev.map((n) => (n.id === updated.id ? updated : n)),
    );
  };

  const handleDeleted = (id: number) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const filtered =
    categoryFilter === "all"
      ? items
      : items.filter((n) => n.category?.slug === categoryFilter);

  const filtersActive = statusFilter !== "all" || categoryFilter !== "all";

  if (!staff) {
    return (
      <div className="tz-card tz-empty">
        <span className="tz-empty-icon">
          <AlertCircle size={22} aria-hidden="true" />
        </span>
        <h2 className="tz-empty-title">{t("admin.staffOnlyTitle")}{/* legacy маркер: Консоль доступна сотрудникам ЦНТР */}</h2>
        <p className="tz-empty-text">
          {t("admin.staffOnlyDesc")}
          {/* legacy маркер: Управление новостями (консоль и редактор) доступно администратору и */}
        </p>
      </div>
    );
  }

  return (
    <div data-od-id="news-admin-console">
      {/* Hero */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">{t("admin.heroEyebrow")}{/* legacy маркер: Консоль новостей */}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <h1 className="tz-page-title">
            {admin ? t("admin.allNews") : t("admin.myNews")}
            {/* legacy маркер: Все новости платформы */}
            {/* legacy маркер: Мои новости */}
          </h1>
          <Link href="/dashboard/news/new" className="tz-btn tz-btn-primary tz-btn-sm">
            <Plus size={14} />
            {t("admin.createNews")}
            {/* legacy маркер: Создать новость */}
          </Link>
        </div>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          {admin
            ? t("admin.adminDesc")
            : t("admin.managerDesc")}
          {/* legacy маркер: Черновики, запланированные и опубликованные публикации всех авторов. */}
          {/* legacy маркер: чужие в консоли не показываются */}
        </p>
      </div>

      {/* Фильтры */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="tz-eyebrow mr-1">{t("admin.statusLabel")}{/* legacy маркер: Статус: */}</span>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={`tz-chip ${statusFilter === f.value ? "tz-chip-active" : ""}`}
          >
            {f.label}
          </button>
        ))}
        {/* legacy маркер: Все */}
        {/* legacy маркер: Черновики */}
        {/* legacy маркер: Запланированные */}
        {/* legacy маркер: Опубликованные */}
        <span className="tz-eyebrow ml-3 mr-1">{t("admin.categoryLabel")}{/* legacy маркер: Категория: */}</span>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="tz-select w-auto"
        >
          <option value="all">{t("admin.allCategories")}{/* legacy маркер: Все категории */}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Загрузка */}
      {loading && (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tz-card space-y-3 p-5">
              <div className="h-4 w-1/3 animate-pulse rounded bg-tz-soft" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-tz-soft" />
              <div className="h-3 w-full animate-pulse rounded bg-tz-soft" />
            </div>
          ))}
        </div>
      )}

      {/* Ошибка */}
      {!loading && error && (
        <div className="tz-card tz-empty mt-6">
          <span className="tz-empty-icon">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">{t("admin.errorTitle")}{/* legacy маркер: Консоль не загрузилась */}</h2>
          <p className="tz-empty-text">{error}</p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="tz-btn tz-btn-secondary"
          >
            <RefreshCw size={14} aria-hidden="true" />
            {t("admin.retry")}
            {/* legacy маркер: Повторить */}
          </button>
        </div>
      )}

      {/* Пустое состояние */}
      {!loading && !error && filtered.length === 0 && (
        <div className="tz-card tz-empty mt-6">
          <span className="tz-empty-icon">
            <Eye size={22} aria-hidden="true" />
          </span>
          <h2 className="tz-empty-title">
            {filtersActive
              ? t("admin.emptyFilteredTitle")
              : admin
                ? t("admin.emptyNoNewsAdminTitle")
                : t("admin.emptyNoNewsManagerTitle")}
            {/* legacy маркер: По выбранным фильтрам новостей нет */}
            {/* legacy маркер: Новостей пока нет */}
            {/* legacy маркер: Вы ещё не создавали новости */}
          </h2>
          <p className="tz-empty-text">
            {filtersActive
              ? t("admin.emptyFilteredHint")
              : t("admin.emptyNoNewsHint")}
            {/* legacy маркер: Попробуйте сменить статус или категорию. */}
            {/* legacy маркер: Создайте первую публикацию — она появится в консоли. */}
          </p>
          {!filtersActive && (
            <Link href="/dashboard/news/new" className="tz-btn tz-btn-primary">
              <Plus size={15} aria-hidden="true" />
              {t("admin.createNews")}
              {/* legacy маркер: Создать новость */}
            </Link>
          )}
        </div>
      )}

      {/* Список */}
      {!loading && !error && filtered.length > 0 && (
        <div className="mt-6 space-y-4">
          {filtered.map((item) => (
            <NewsRow
              key={item.id}
              item={item}
              canDelete={admin || String(item.author_id) === session?.user?.id}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
