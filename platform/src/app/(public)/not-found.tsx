import Link from "next/link";
import { Compass } from "lucide-react";

/**
 * T-002. Временная заглушка 404 для публичной группы.
 * Возвращает посетителя к задачам, а не к карте сайта.
 */
export default function PublicNotFound() {
  return (
    <div className="mx-auto max-w-[1280px] px-5 py-24 md:px-8 md:py-32">
      <div className="max-w-xl">
        <p className="font-mono text-meta text-muted">Ошибка 404</p>
        <h1 className="mt-4 text-h2 font-semibold text-primary">
          Такой страницы нет
        </h1>
        <p className="mt-3 text-body leading-relaxed text-secondary">
          Возможно, адрес изменился или запись ещё не опубликована. Начните с
          задач платформы — так проще найти нужное.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/find"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-sm font-medium text-accent-contrast transition-colors hover:opacity-90"
          >
            <Compass className="h-4 w-4" aria-hidden />
            Найти решение
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-control border border-border-strong px-5 text-sm font-medium text-primary transition-colors hover:bg-surface-elevated"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
