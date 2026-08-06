/**
 * T-012. Элемент уведомления в центре уведомлений (STATES.md §5).
 *
 * Показывает: объект, событие, срочность, требуемое действие, срок,
 * состояние «прочитано/не прочитано», прямой переход к объекту (ссылка
 * передаётся вызывающим кодом — компонент не выдумывает маршруты).
 * Фикстуры помечены бейджем «Тестовый пример для проверки интерфейса».
 */

"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Mail, Zap } from "lucide-react";
import type { NotificationEvent } from "@/lib/types";
import { formatDate } from "@/lib/datetime";
import { isFixtureRecord } from "@/lib/types";
import { FixtureBadge } from "@/components/customer/fixture-badge";

/** Срочность: подпись + тональность (маппинг на токены тем). */
const URGENCY_META: Record<
  NotificationEvent["urgency"],
  { label: string; tone: "text-status-danger" | "text-status-warning" | "text-status-info" }
> = {
  high: { label: "Срочно", tone: "text-status-danger" },
  medium: { label: "Обычная", tone: "text-status-warning" },
  low: { label: "Низкая", tone: "text-status-info" },
};

export interface NotificationItemProps {
  notification: NotificationEvent;
  /** Прямой переход к объекту (null — страницы объекта нет в P0). */
  href?: string | null;
  /** Прочитано/не прочитано (эффективное состояние с учётом переопределений). */
  read: boolean;
  onToggleRead: (id: string, read: boolean) => void;
}

export function NotificationItem({
  notification,
  href,
  read,
  onToggleRead,
}: NotificationItemProps) {
  const urgency = URGENCY_META[notification.urgency];
  const isFixture = isFixtureRecord(notification);

  return (
    <li
      className={`rounded-panel border bg-surface p-4 transition-colors ${
        read ? "border-subtle" : "border-border-strong bg-surface-elevated/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Маркер непрочитанного */}
          <span
            aria-hidden
            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
              read ? "bg-status-draft" : "bg-accent-strong"
            }`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-small font-semibold leading-snug text-primary">
                {notification.event}
              </p>
              <span
                className={`inline-flex items-center gap-1 text-meta font-medium ${urgency.tone}`}
              >
                <Zap className="h-3 w-3" aria-hidden />
                {urgency.label}
              </span>
              {isFixture ? <FixtureBadge /> : null}
            </div>

            <dl className="mt-2 space-y-1 text-meta leading-relaxed">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <dt className="sr-only">Событие</dt>
                <dd className="text-secondary">{notification.event}</dd>
              </div>
              {notification.requiredAction ? (
                <div className="flex items-start gap-1.5 text-secondary">
                  <dt className="shrink-0 font-medium text-muted">Действие:</dt>
                  <dd>{notification.requiredAction}</dd>
                </div>
              ) : null}
              {notification.deadline ? (
                <div className="flex items-center gap-1.5 text-secondary">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                  <dt className="sr-only">Срок</dt>
                  <dd>срок: {formatDate(notification.deadline)}</dd>
                </div>
              ) : null}
              <div className="flex items-center gap-1.5 text-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <dt className="sr-only">Куда</dt>
                <dd>входящие · {formatDate(notification.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {href ? (
            <Link
              href={href}
              className="inline-flex h-10 items-center gap-1.5 rounded-control border border-border-strong px-3.5 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              К объекту
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => onToggleRead(notification.id, !read)}
            className={`inline-flex h-10 items-center gap-1.5 rounded-control border px-3.5 text-small font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
              read
                ? "border-subtle text-secondary hover:border-strong hover:text-primary"
                : "border-accent bg-accent-soft text-accent"
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            {read ? "Не прочитано" : "Прочитано"}
          </button>
        </div>
      </div>
    </li>
  );
}
