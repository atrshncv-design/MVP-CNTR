/**
 * T-010. Форма решения по объекту (STATES.md §4 «Decision states»).
 *
 * Одобрить / уточнить / отклонить (+ опубликовать для кандидатов):
 * - уточнение и отклонение ТРЕБУЮТ причину (кнопка недоступна без текста);
 * - одобрение и публикация проходят шаг ПОДТВЕРЖДЕНИЯ;
 * - каждое решение трассируемо: actor, дата/время, решение, причина,
 *   следующий шаг, видимость.
 *
 * P0 — ДЕМО: решение сохраняется в localStorage этого браузера
 * (ключ nfr-operations-records) и не отправляется на сервер; история
 * видна на странице /operations/decisions. Запись помечается явно.
 */

"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Info,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Decision } from "@/lib/types";
import type { VisibilityScope } from "@/lib/adapter/types";
import { formatDateTime } from "@/lib/datetime";
import { getMockSession } from "@/lib/session";
import { StatusBadge } from "@/components/status-badge";

/* ------------------------------------------------------------------ */
/* Демо-хранилище решений и публикаций                                */
/* ------------------------------------------------------------------ */

export type StoredOpsRecordKind = "decision" | "publication";

/** Запись решения/публикации, сохраняемая в браузере (демо). */
export interface StoredOpsRecord {
  kind: StoredOpsRecordKind;
  objectType: Decision["objectType"];
  objectId: string;
  objectTitle: string;
  actor: string;
  dateTime: string;
  decision?: "approved" | "clarification" | "rejected";
  reason?: string;
  nextAction?: string | null;
  visibilityScope: VisibilityScope;
}

export const OPS_RECORDS_STORAGE_KEY = "nfr-operations-records";

/** Прочитать сохранённые записи (демо; на сервере — пустой список). */
export function readStoredOpsRecords(): StoredOpsRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OPS_RECORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is StoredOpsRecord =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as StoredOpsRecord).objectId === "string",
    );
  } catch {
    return [];
  }
}

function appendStoredOpsRecord(record: StoredOpsRecord): void {
  if (typeof window === "undefined") return;
  try {
    const records = readStoredOpsRecords();
    records.push(record);
    window.localStorage.setItem(OPS_RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* недоступное хранилище не роняет форму (демо) */
  }
}

/* ------------------------------------------------------------------ */
/* Форма                                                               */
/* ------------------------------------------------------------------ */

export type DecisionAction = "approved" | "clarification" | "rejected" | "publish";

const ACTION_OPTIONS: readonly {
  value: DecisionAction;
  label: string;
  description: string;
  needsReason: boolean;
  needsConfirm: boolean;
}[] = [
  {
    value: "approved",
    label: "Одобрить",
    description: "Подтвердить готовность объекта к следующему этапу",
    needsReason: false,
    needsConfirm: true,
  },
  {
    value: "clarification",
    label: "Уточнить",
    description: "Запросить недостающие сведения у участника",
    needsReason: true,
    needsConfirm: false,
  },
  {
    value: "rejected",
    label: "Отклонить",
    description: "Отказать с указанием причины",
    needsReason: true,
    needsConfirm: false,
  },
  {
    value: "publish",
    label: "Опубликовать",
    description: "Выпустить запись в публичный реестр",
    needsReason: false,
    needsConfirm: true,
  },
];

export interface DecisionFormProps {
  /** Тип объекта, по которому принимается решение. */
  objectType: Decision["objectType"];
  objectId: string;
  objectTitle: string;
  /** Показать действие «Опубликовать» (для кандидатов на публикацию). */
  allowPublish?: boolean;
  /** Следующий шаг после решения (идёт в запись истории). */
  defaultNextAction?: string | null;
}

export function DecisionForm({
  objectType,
  objectId,
  objectTitle,
  allowPublish = false,
  defaultNextAction = null,
}: DecisionFormProps) {
  const [action, setAction] = useState<DecisionAction | null>(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState<StoredOpsRecord | null>(null);

  const options = ACTION_OPTIONS.filter(
    (option) => option.value !== "publish" || allowPublish,
  );
  const selected = options.find((option) => option.value === action) ?? null;
  const reasonRequired = selected?.needsReason ?? false;

  if (saved) {
    return (
      <div className="rounded-panel border border-status-success/40 bg-surface p-5">
        <p className="flex items-center gap-2 text-small font-semibold text-status-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {saved.kind === "publication"
            ? "Запись опубликована (демо)"
            : "Решение записано"}
        </p>
        <dl className="mt-3 space-y-2 text-small leading-relaxed">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <dt className="sr-only">Решение</dt>
            <dd>
              {saved.decision ? (
                <StatusBadge status={saved.decision} size="sm" />
              ) : (
                <StatusBadge status="published" size="sm" />
              )}
            </dd>
            <dt className="sr-only">Дата</dt>
            <dd className="font-mono text-meta text-muted">
              {formatDateTime(saved.dateTime)}
            </dd>
          </div>
          {saved.reason ? (
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-meta text-muted">Причина</dt>
              <dd className="min-w-0 text-secondary">{saved.reason}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-meta text-muted">Кто</dt>
            <dd className="min-w-0 text-secondary">{saved.actor}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-meta text-muted">Объект</dt>
            <dd className="min-w-0 text-secondary">{saved.objectTitle}</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-start gap-1.5 text-meta text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Демо: запись сохранена в этом браузере и появится в истории решений
          (/operations/decisions). На сервер она не отправляется.
        </p>
        <button
          type="button"
          onClick={() => {
            setSaved(null);
            setAction(null);
            setReason("");
            setConfirming(false);
          }}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-control border border-subtle px-4 text-small font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Записать ещё одно решение
        </button>
      </div>
    );
  }

  const submit = () => {
    if (!action) return;
    const option = options.find((o) => o.value === action);
    if (!option) return;
    if (option.needsReason && reason.trim() === "") return;
    if (option.needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    const session = getMockSession();
    const record: StoredOpsRecord = {
      kind: action === "publish" ? "publication" : "decision",
      objectType,
      objectId,
      objectTitle,
      actor: session?.name ?? "Менеджер Центра (демо)",
      dateTime: new Date().toISOString(),
      decision: action === "publish" ? undefined : action,
      reason: reason.trim() || undefined,
      nextAction: defaultNextAction,
      visibilityScope: "operations",
    };
    appendStoredOpsRecord(record);
    setSaved(record);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-panel border border-subtle bg-surface p-5"
    >
      <h2 className="flex items-center gap-2 text-small font-semibold text-primary">
        <ClipboardCheck className="h-4 w-4 text-accent" aria-hidden />
        Решение по объекту
      </h2>
      <p className="mt-1.5 text-meta text-muted">
        Демо-режим: запись сохраняется локально в этом браузере.
      </p>

      <fieldset className="mt-4">
        <legend className="text-small font-medium text-primary">
          Действие
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {options.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring ${
                action === option.value
                  ? "border-accent bg-accent-soft"
                  : "border-subtle hover:border-strong"
              }`}
            >
              <input
                type="radio"
                name="decision-action"
                value={option.value}
                checked={action === option.value}
                onChange={() => {
                  setAction(option.value);
                  setConfirming(false);
                }}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent-strong)]"
              />
              <span>
                <span className="block text-small font-medium text-primary">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-meta leading-relaxed text-secondary">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {selected && selected.needsReason ? (
        <div className="mt-4">
          <label
            htmlFor="decision-reason"
            className="text-small font-medium text-primary"
          >
            Причина (обязательно)
          </label>
          <textarea
            id="decision-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Опишите, какие сведения нужны или почему запись отклоняется…"
            className="mt-2 w-full rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
          />
          {reason.trim() === "" ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-meta text-status-warning">
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              Укажите причину — без неё решение не отправляется
            </p>
          ) : null}
        </div>
      ) : null}

      {selected && selected.needsReason === false ? (
        <div className="mt-4">
          <label
            htmlFor="decision-reason-optional"
            className="text-small font-medium text-primary"
          >
            Причина или сводка <span className="font-normal text-muted">(необязательно)</span>
          </label>
          <textarea
            id="decision-reason-optional"
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Краткая сводка для истории решения…"
            className="mt-2 w-full rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-focus-ring"
          />
        </div>
      ) : null}

      {confirming && selected ? (
        <div className="mt-4 rounded-control border border-status-warning/40 bg-status-warning-soft p-4">
          <p className="flex items-start gap-2 text-small leading-relaxed text-primary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />
            <span>
              Подтвердите: объект «{objectTitle}» будет{" "}
              {selected.value === "publish" ? "опубликован" : "одобрен"}. Запись
              появится в истории решений с указанием автора и времени.
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              className="inline-flex h-10 items-center gap-2 rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Подтвердить {selected.value === "publish" ? "публикацию" : "одобрение"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex h-10 items-center rounded-control border border-subtle px-4 text-small font-medium text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Назад
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={!action || (reasonRequired && reason.trim() === "")}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {selected?.needsConfirm ? "К подтверждению" : "Отправить решение"}
          </button>
          {action ? (
            <button
              type="button"
              onClick={() => {
                setAction(null);
                setReason("");
                setConfirming(false);
              }}
              className="inline-flex h-11 items-center rounded-control px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Отменить
            </button>
          ) : null}
        </div>
      )}
    </form>
  );
}
