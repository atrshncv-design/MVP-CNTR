import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-5 py-16">
      <main className="w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="font-mono text-meta text-muted">
            T-001 · дизайн-система и темы
          </p>
          <ThemeToggle />
        </div>

        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Платформа ЦНТР Удмуртской Республики
        </h1>
        <p className="mt-4 text-body leading-relaxed text-secondary">
          Новый frontend-контур. Фундамент тикета T-001: семантические токены,
          типографика, геометрия, фокус и три темы — светлая, тёмная и
          удмуртская — на одной структуре.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/dev/tokens"
            className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-sm font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Демо-страница токенов
          </Link>
          <span className="text-small text-muted">
            Проверка всех трёх тем: карточка, кнопки, статусы, таблица, форма, УГТ-шкала
          </span>
        </div>
      </main>
    </div>
  );
}
