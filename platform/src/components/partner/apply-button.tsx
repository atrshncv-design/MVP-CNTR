/**
 * T-009. Кнопка «Подать заявку» на запрос заказчика / пилот.
 * Клиентский компонент: создаёт PartnerApplicationRecord в localStorage
 * (mock-режим) и показывает результат. Полная интеграция — после адаптера.
 */

"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, SendHorizonal } from "lucide-react";
import { createPartnerApplication } from "@/lib/partner-storage";

export interface ApplyButtonProps {
  targetType: "request" | "pilot";
  targetId: string;
  targetTitle: string;
  customerOrganization: string | null;
}

export function ApplyButton({
  targetType,
  targetId,
  targetTitle,
  customerOrganization,
}: ApplyButtonProps) {
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    startTransition(() => {
      createPartnerApplication({
        targetType,
        targetId,
        targetTitle,
        customerOrganization,
      });
      setApplied(true);
    });
  };

  if (applied) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-control bg-status-success-soft px-3 text-small font-medium text-status-success">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Заявка подана
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={isPending}
      className="inline-flex h-9 items-center gap-1.5 rounded-control bg-accent-strong px-3 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-60"
    >
      <SendHorizonal className="h-3.5 w-3.5" aria-hidden />
      Подать заявку
    </button>
  );
}
