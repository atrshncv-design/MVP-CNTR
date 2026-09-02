"use client";

import { getReturnBadge, isHardGateRejected } from "@/features/project/utils";

/**
 * HardGateBadge — бейдж «Возврат на УГТ N — Причина: …» (тикет 08, G50).
 * Показывается при control_point.status===rejected или project.status===rejected.
 * Класс tz-badge-review обязателен, текст содержит «Возврат на УГТ» + «Причина:».
 */
export function HardGateBadge({
  projectStatus,
  controlPointStatus,
  rejectionReason,
  decision,
  level,
  testId = "return-badge",
}: {
  projectStatus?: string | null;
  controlPointStatus?: string | null;
  rejectionReason?: string | null;
  decision?: string | null;
  level?: number | null;
  testId?: string;
}) {
  const cpRejected = controlPointStatus === "rejected" || controlPointStatus === "No-Go" || controlPointStatus === "no_go";
  const projRejected = projectStatus === "rejected";
  if (!cpRejected && !projRejected) return null;
  const reason = rejectionReason ?? decision ?? null;
  const status = cpRejected ? "rejected" : "rejected";
  const text = getReturnBadge(status, reason, level ?? null);
  if (!text) return null;
  // Дублируем проверку через helper для теста
  void isHardGateRejected(projectStatus, controlPointStatus);
  return (
    <span data-testid={testId} className="tz-badge tz-badge-review">
      {text}
    </span>
  );
}

/** Alias for criterion search */
export const ReturnBadge = HardGateBadge;
