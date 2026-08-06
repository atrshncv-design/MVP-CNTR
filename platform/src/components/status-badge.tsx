/**
 * T-005. Канонический бейдж статуса (STATES.md §1 + Design.md §10).
 * Всегда иконка + текстовая подпись — цвет не единственный канал.
 * Подписи берутся из status.ts (СТРОГО по STATES.md), тональность — из
 * маппинга на токены тем (bg-status-*-soft / text-status-*), работает
 * одинаково во всех трёх темах.
 */

import {
  Activity,
  Archive,
  Ban,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  TONE_BADGE,
  getStatusMeta,
  isCanonicalStatus,
  type Status,
  type StatusTone,
} from "@/lib/status";

/** Иконки канонических статусов. */
export const STATUS_ICONS: Record<Status, LucideIcon> = {
  draft: FileText,
  action_required: ClipboardList,
  under_review: Eye,
  clarification: HelpCircle,
  approval: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  published: Globe,
  active: Activity,
  blocked: Ban,
  archived: Archive,
  closed: CheckCheck,
};

/** Бейдж-стиль для произвольной тональности (без канонического статуса). */
export function toneBadgeClasses(tone: StatusTone): string {
  return TONE_BADGE[tone];
}

export interface StatusBadgeProps {
  /** Канонический статус или сырая строка (fallback — нейтральный бейдж). */
  status: Status | string;
  /** Размер бейджа. */
  size?: "sm" | "md";
  /** Дополнительные классы. */
  className?: string;
}

export function StatusBadge({
  status,
  size = "md",
  className = "",
}: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  const Icon = isCanonicalStatus(status) ? STATUS_ICONS[status] : FileText;

  const sizeClasses =
    size === "sm"
      ? "gap-1 rounded-[6px] px-2 py-0.5 text-meta"
      : "gap-1.5 rounded-control px-2.5 py-1 text-small";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center font-medium ${sizeClasses} ${TONE_BADGE[meta.tone]} ${className}`}
    >
      <Icon className={`shrink-0 ${iconSize}`} aria-hidden />
      <span>{meta.label}</span>
    </span>
  );
}
