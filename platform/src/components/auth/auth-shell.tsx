/**
 * T-013. Auth-shell: hero слева (identity Центра, обещание платформы),
 * форма справа (Design.md §14, «auth-shell (hero + форма)»). На мобильном —
 * форма на всю ширину, тач-цели ≥44px. Три темы работают через токены;
 * переключатель тем доступен в углу.
 */

"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Landmark, Rocket } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/auth/brand-mark";

const HERO_POINTS = [
  {
    icon: Landmark,
    title: "Проверенные технологии",
    text: "Реестр технологий и исполнителей, подтверждённый Центром научно-технологического развития.",
  },
  {
    icon: Rocket,
    title: "Путь от идеи до серии",
    text: "Оценка готовности по ГОСТ Р 58048-2017, заявки, пилоты и меры поддержки в одном месте.",
  },
  {
    icon: CheckCircle2,
    title: "Прозрачные решения",
    text: "Каждое решение Центра — с обоснованием и историей. Вы всегда видите статус своей заявки.",
  },
];

export interface AuthShellProps {
  /** Заголовок формы (h1). */
  title: string;
  /** Подзаголовок формы. */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Ссылка «назад» под заголовком (например, на главную). */
  backHref?: string;
  backLabel?: string;
}

export function AuthShell({
  title,
  subtitle,
  children,
  backHref = "/",
  backLabel = "На главную",
}: AuthShellProps) {
  return (
    <main className="flex min-h-dvh bg-canvas">
      {/* Hero (desktop) */}
      <aside className="relative hidden w-[44%] max-w-[560px] flex-col justify-between overflow-hidden bg-accent-strong p-10 text-accent-contrast lg:flex">
        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandMark size="lg" />
            <div className="leading-tight">
              <p className="text-small font-semibold">ЦНТР Удмуртии</p>
              <p className="text-meta opacity-80">
                Центр научно-технологического развития
              </p>
            </div>
          </div>

          <h2 className="mt-12 max-w-md text-h2 font-semibold leading-tight tracking-tight">
            Единая цифровая среда, где наука, промышленность и институты
            развития ведут технологию от идеи к серийному производству
          </h2>

          <ul className="mt-10 space-y-5">
            {HERO_POINTS.map((point) => (
              <li key={point.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white/10">
                  <point.icon className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span>
                  <span className="block text-small font-semibold">
                    {point.title}
                  </span>
                  <span className="mt-0.5 block text-meta leading-relaxed opacity-85">
                    {point.text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-meta opacity-75">
          Удмуртская Республика · цифровая платформа технологического развития
        </p>
      </aside>

      {/* Форма */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-5 md:px-8">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center gap-2 rounded-control px-3 text-small font-medium text-secondary transition-colors hover:bg-surface-elevated hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 md:px-8">
          <div className="w-full max-w-md">
            <h1 className="text-h2 font-semibold tracking-tight text-primary">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-2 text-small leading-relaxed text-secondary">
                {subtitle}
              </div>
            ) : null}
            <div className="mt-6 rounded-panel border border-border-subtle bg-surface p-6 md:p-8">
              {children}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
