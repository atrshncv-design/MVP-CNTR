/**
 * T-008. Контекстные комментарии к запросу (STATES.md §5).
 *
 * Клиентский компонент dossier: форма комментария → server action
 * addRequestComment (адаптер, scope participant). Список комментариев —
 * локальное состояние; для P0 фикстурных комментариев к запросам нет,
 * поэтому честное пустое состояние «Комментариев пока нет».
 */

"use client";

import { useState, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";
import { addRequestComment } from "@/app/app/customer/actions";
import { formatDateTime } from "@/lib/datetime";
import type { Comment } from "@/lib/types";

export interface CommentBoxProps {
  objectId: string;
}

export function CommentBox({ objectId }: CommentBoxProps) {
  const [text, setText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setError("Комментарий слишком короткий — напишите хотя бы 3 символа.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const comment = await addRequestComment({ objectId, text: trimmed });
        setComments((prev) => [...prev, comment]);
        setText("");
      } catch {
        setError("Не удалось отправить комментарий. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <div className="rounded-panel border border-subtle bg-surface p-5">
      <h3 className="flex items-center gap-2 text-small font-semibold text-primary">
        <MessageSquare className="h-4 w-4 text-accent" aria-hidden />
        Комментарии
      </h3>

      {comments.length === 0 ? (
        <p className="mt-3 text-small leading-relaxed text-secondary">
          Комментариев пока нет. Задайте вопрос Центру или уточните детали
          запроса — комментарий увидят участники проверки.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-control bg-canvas/60 p-4">
              <p className="text-small leading-relaxed text-primary">{c.text}</p>
              <p className="mt-2 text-meta text-muted">
                {c.author} · {formatDateTime(c.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-4" noValidate>
        <label htmlFor={`comment-${objectId}`} className="sr-only">
          Текст комментария
        </label>
        <textarea
          id={`comment-${objectId}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError(null);
          }}
          rows={3}
          placeholder="Например: уточните, какие свидетельства нужны по запросу…"
          className="w-full resize-y rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring"
        />
        {error ? (
          <p role="alert" className="mt-2 text-meta text-status-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={isPending || text.trim().length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            {isPending ? "Отправляем…" : "Отправить комментарий"}
          </button>
        </div>
      </form>
    </div>
  );
}
