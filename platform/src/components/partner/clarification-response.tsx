/**
 * T-009. Ответ на уточнение Центра (STATES.md §4).
 *
 * Отклонение/уточнение не бывают без причины — и ответ исполнителя тоже
 * фиксируется с пояснением: без него отправка недоступна (field-level
 * валидация объясняет, почему). После отправки ответ закрепляется как
 * комментарий к технологии (addComment), статус вернётся к «На проверке»
 * после решения Центра.
 */

"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, HelpCircle, Send } from "lucide-react";
import { addTechnologyComment } from "@/app/app/partner/actions";

const MIN_RESPONSE = 20;

export interface ClarificationResponseProps {
  dossierId: string;
  /** Что именно запросил проверяющий (честный текст из данных/досье). */
  requested?: string;
  /** Вызывается после успешной отправки ответа. */
  onSent?: () => void;
}

function validateResponse(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Напишите, что изменилось — Центр не принимает пустой ответ на уточнение.";
  if (v.length < MIN_RESPONSE)
    return `Пояснение слишком короткое — минимум ${MIN_RESPONSE} символов: что именно дополнили и как это закрывает замечание.`;
  return null;
}

export function ClarificationResponse({
  dossierId,
  requested,
  onSent,
}: ClarificationResponseProps) {
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const errorMessage = touched ? validateResponse(text) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const invalid = validateResponse(text);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSending(true);
    (async () => {
      try {
        await addTechnologyComment({ objectId: dossierId, text: text.trim() });
        setSent(true);
        onSent?.();
      } catch {
        setError(
          "Не удалось отправить ответ. Проверьте соединение и повторите — текст сохранён в поле.",
        );
      } finally {
        setSending(false);
      }
    })();
  };

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-panel border border-status-success/40 bg-surface p-5"
      >
        <p className="flex items-center gap-2 text-small font-semibold text-primary">
          <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden />
          Ответ отправлен
        </p>
        <p className="mt-2 text-small leading-relaxed text-secondary">
          Ваше пояснение зафиксировано в досье. Статус вернётся к «На проверке»
          после решения Центра — следите за уведомлениями кабинета.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-panel border border-status-warning/50 bg-surface p-5"
    >
      <p className="flex items-center gap-2 text-small font-semibold text-primary">
        <HelpCircle className="h-4 w-4 text-status-warning" aria-hidden />
        Нужны уточнения — ответьте Центру
      </p>
      <p className="mt-2 rounded-control bg-status-warning-soft px-3 py-2.5 text-meta leading-relaxed text-status-warning">
        {requested ??
          "Рецензент запросил дополнительные сведения. Проверьте раздел «Доказательства»: дополните комплект недостающими документами и объясните, что изменилось."}
      </p>
      <label
        htmlFor={`clarification-${dossierId}`}
        className="mt-4 block text-small font-semibold text-primary"
      >
        Ваш ответ
        <span className="font-normal text-muted">
          {" "}
          — пояснение обязательно, без него отправка недоступна
        </span>
      </label>
      <textarea
        id={`clarification-${dossierId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="Например: добавлены протоколы испытаний макета (2 документа) и акт опытной эксплуатации; методика измерений приведена к ГОСТ…"
        className="mt-2 w-full resize-y rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring"
        aria-describedby={errorMessage ? "clarification-error" : undefined}
      />
      {errorMessage ? (
        <p
          id="clarification-error"
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-status-danger"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {errorMessage}
        </p>
      ) : null}
      {error && !errorMessage ? (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-status-danger"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
      <div className="mt-4">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          {sending ? "Отправляем…" : "Отправить ответ"}
        </button>
      </div>
    </form>
  );
}
