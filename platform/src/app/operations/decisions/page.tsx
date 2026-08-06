/**
 * T-010. Решения и история публикаций (/operations/decisions).
 * История из локальных записей решений (DecisionForm) + честное пустое
 * состояние, если решений ещё нет.
 */
"use client";

import { ScrollText } from "lucide-react";
import { readStoredOpsRecords } from "@/components/operations/decision-form";
import { DecisionTimeline } from "@/components/decision-timeline";

const CONTAINER = "mx-auto w-full max-w-[1280px] px-5 py-8 md:px-8";

export default function OperationsDecisionsPage() {
  // Серверный рендер: readStoredOpsRecords() возвращает [] (SSR-safe).
  // История решений появится после подключения адаптера (recordDecision).
  const records = readStoredOpsRecords();
  const decisions = records.map((record) => ({
    id: `${record.objectId}-${record.dateTime}`,
    actor: record.actor,
    decidedAt: record.dateTime,
    decision: (record.decision ?? "approved") as "approved" | "clarification" | "rejected",
    reason: record.reason ?? undefined,
    evidence: [],
    nextAction: record.nextAction ?? undefined,
    visibility: (record.visibilityScope === "public" ? "public" : "staff") as
      | "public"
      | "participants"
      | "staff"
      | "internal",
  }));

  return (
    <div className={CONTAINER}>
      <header>
        <h1 className="flex items-center gap-2 text-h2 font-semibold tracking-tight text-primary">
          <ScrollText className="h-6 w-6 text-accent" aria-hidden />
          Решения и история публикаций
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Полная история решений Центра: actor, дата, решение, причина,
          следующий шаг (STATES.md §4).
        </p>
      </header>

      <div className="mt-6 max-w-3xl">
        <DecisionTimeline
          decisions={decisions}
          emptyLabel="Решений пока нет. Первые записи появятся после начала приёмной кампании — отклонение и уточнение всегда с причиной, одобрение с подтверждением."
        />
      </div>
    </div>
  );
}
