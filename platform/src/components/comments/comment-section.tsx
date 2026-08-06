/**
 * T-012. Секция комментариев объекта (клиентская).
 * Хранилище — localStorage (src/lib/comments.ts), оптимистичный рендер
 * с флагом pending, SSR-safe. Полная интеграция — через адаптер.
 */

"use client";

import { useEffect, useState } from "react";
import { MessageSquare, SendHorizonal } from "lucide-react";
import {
  appendComment,
  buildComment,
  readComments,
  type NewCommentInput,
} from "@/lib/comments";
import type { Comment } from "@/lib/types";
import type { CommentItem } from "@/lib/comments";
import { formatDateTime } from "@/lib/datetime";

export interface CommentSectionProps {
  objectType: Comment["objectType"];
  objectId: string;
  /** Подпись автора текущего пользователя (демо-режим). */
  author?: string;
}

const TEXTAREA_CLASS =
  "w-full resize-y rounded-control border border-subtle bg-canvas px-3.5 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

export function CommentSection({
  objectType,
  objectId,
  author = "Вы",
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setComments(readComments(objectId));
    })();
  }, [objectId]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const input: NewCommentInput = {
      objectType,
      objectId,
      author,
      text: trimmed,
      visibilityScope: "participant",
    };
    setSending(true);
    setError(null);
    const pending: CommentItem = { ...buildComment(input), pending: true };
    setComments((current) => [...current, pending]);
    setText("");
    (async () => {
      try {
        appendComment(objectId, buildComment(input));
        setComments(readComments(objectId));
      } catch {
        setError("Не удалось отправить комментарий. Попробуйте ещё раз.");
      } finally {
        setSending(false);
      }
    })();
  };

  return (
    <section
      aria-labelledby="comments-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="comments-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <MessageSquare className="h-5 w-5 text-accent" aria-hidden />
        Комментарии
      </h2>

      {comments.length === 0 ? (
        <p className="mt-4 text-small leading-relaxed text-secondary">
          Комментариев пока нет. Обсуждение с Центром и партнёрами появится
          после подключения данных.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="rounded-panel bg-canvas p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-small font-semibold text-primary">
                  {comment.author}
                  {(comment as { pending?: boolean }).pending ? (
                    <span className="ml-2 text-meta text-muted">отправка…</span>
                  ) : null}
                </p>
                <time className="text-meta text-muted">
                  {formatDateTime(comment.createdAt)}
                </time>
              </div>
              <p className="mt-1.5 text-small leading-relaxed text-primary">
                {comment.text}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={`comment-${objectId}`} className="sr-only">
          Новый комментарий
        </label>
        <textarea
          id={`comment-${objectId}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Напишите комментарий…"
          className={TEXTAREA_CLASS}
          rows={3}
        />
        {error ? (
          <p className="mt-2 text-small text-status-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="inline-flex h-10 items-center gap-2 rounded-control bg-accent-strong px-4 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
          >
            <SendHorizonal className="h-4 w-4" aria-hidden />
            Отправить
          </button>
        </div>
      </form>
    </section>
  );
}
