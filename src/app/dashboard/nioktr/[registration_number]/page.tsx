"use client";

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  FlaskConical,
  Landmark,
  Layers,
  Loader2,
  Rocket,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import type { NioktrCard } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const formatFunds = (funds: string | undefined): string => {
  if (!funds) return "—";
  const n = parseFloat(funds);
  if (Number.isNaN(n)) return funds;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
};

const formatDate = (value: string | null): string => value ?? "—";

/**
 * Подробная карточка НИОКТР (тикет 05 internal-ux-redesign):
 * светлая тема на токенах --tz-*, единый обязательный breadcrumb
 * (Рабочий стол / НИОКТР / рег. номер), карточки-секции без тёмных
 * блоков и наложений. Данные — только из API, честные пустые состояния.
 */
export default function NioktrCardPage() {
  const params = useParams<{ registration_number: string }>();
  const reg = params?.registration_number ?? "";
  const { data: session } = useSession();
  const [card, setCard] = useState<NioktrCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumb([
    { label: "Рабочий стол", href: "/dashboard" },
    { label: "НИОКТР", href: "/dashboard/nioktr" },
    { label: card ? card.registration_number : reg },
  ]);

  useEffect(() => {
    if (!session?.user?.accessToken || !reg) return;
    let cancelled = false;
    const fetchCard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/api/v1/nioktr/${encodeURIComponent(reg)}`,
          { headers: { Authorization: `Bearer ${session.user.accessToken}` } },
        );
        if (res.status === 404) throw new Error("Карточка не найдена");
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: NioktrCard = await res.json();
        if (cancelled) return;
        setCard(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchCard();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.accessToken, reg]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-3 rounded-[14px] border border-tz-border bg-tz-surface p-8 text-tz-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Загрузка карточки…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-tz-danger/30 bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {card && !error && (
        <>
          {/* Шапка карточки — светлая, на токенах */}
          <div className="border-b border-tz-border pb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {card.is_ai_area && (
                <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-3 py-1 text-xs font-semibold text-tz-accent">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden /> ИИ-направление
                </span>
              )}
              {card.nioktr_types.map((t) => (
                <span
                  key={t}
                  className="tz-badge tz-badge-neutral"
                >
                  {t}
                </span>
              ))}
              <span className="ml-auto font-mono text-xs text-tz-muted">
                {card.registration_number}
              </span>
            </div>
            <h1 className="tz-page-title break-words">{card.name}</h1>
            {card.state_program && (
              <p className="mt-2 text-tz-secondary">
                {card.state_program}
                {card.federal_program && card.federal_program !== card.state_program
                  ? ` · ${card.federal_program}`
                  : ""}
              </p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            {/* Основная колонка: аннотация, ключевые слова, финансирование */}
            <div className="min-w-0 space-y-6">
              <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="nioktr-annotation">
                <h2 id="nioktr-annotation" className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
                  <FlaskConical size={18} className="text-tz-accent" aria-hidden />
                  Аннотация
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-tz-fg">
                  {card.annotation || "Аннотация не предоставлена"}
                </p>
              </section>

              {card.keywords.length > 0 && (
                <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="nioktr-keywords">
                  <h2 id="nioktr-keywords" className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
                    <Layers size={18} className="text-tz-accent" aria-hidden />
                    Ключевые слова
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {card.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-lg border border-tz-border bg-tz-badge px-2.5 py-1 text-xs text-tz-fg"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {card.budgets.length > 0 && (
                <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="nioktr-budgets">
                  <h2 id="nioktr-budgets" className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
                    <Wallet size={18} className="text-tz-accent" aria-hidden />
                    Финансирование
                  </h2>
                  <div className="overflow-x-auto rounded-xl border border-tz-border">
                    <table className="tz-table w-full text-sm">
                      <thead>
                        <tr className="border-b border-tz-border">
                          <th scope="col" className="px-4 py-2.5">Источник</th>
                          <th scope="col" className="px-4 py-2.5 text-right">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.budgets.map((b, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 text-tz-fg">{b.budget_type || "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-tz-fg">
                              {formatFunds(b.funds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            {/* Сайдбар: исполнитель/заказчик/сроки */}
            <aside className="space-y-4">
              <div className="rounded-2xl border border-tz-border bg-tz-surface p-5">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Building2 size={14} className="text-tz-accent" aria-hidden />
                  Исполнитель
                </h3>
                <p className="text-sm font-semibold leading-snug text-tz-fg">
                  {card.executor_name || card.executor_short_name || "Не указан"}
                </p>
                {card.executor_short_name && card.executor_short_name !== card.executor_name && (
                  <p className="mt-1 text-xs text-tz-secondary">{card.executor_short_name}</p>
                )}
                {card.executor_ogrn && (
                  <p className="mt-2 font-mono text-[11px] text-tz-muted">
                    ОГРН {card.executor_ogrn}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-tz-border bg-tz-surface p-5">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Landmark size={14} className="text-tz-accent" aria-hidden />
                  Заказчик
                </h3>
                <p className="text-sm font-semibold leading-snug text-tz-fg">
                  {card.customer_name || "Не указан"}
                </p>
              </div>

              <div className="rounded-2xl border border-tz-border bg-tz-surface p-5">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Calendar size={14} className="text-tz-accent" aria-hidden />
                  Сроки
                </h3>
                <dl className="space-y-1 text-sm text-tz-fg">
                  <div className="flex justify-between gap-2">
                    <dt className="text-tz-secondary">Начало</dt>
                    <dd className="font-medium">{formatDate(card.start_date)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-tz-secondary">Окончание</dt>
                    <dd className="font-medium">{formatDate(card.end_date)}</dd>
                  </div>
                </dl>
              </div>

              {card.is_ai_usage && (
                <div className="flex items-center gap-2 rounded-xl border border-tz-accent/40 bg-tz-accent-soft px-4 py-3 text-sm text-tz-accent">
                  <Rocket className="h-4 w-4 shrink-0" aria-hidden />
                  В работе используются ИИ-технологии
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
