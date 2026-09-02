"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
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
import { CLIENT_API_BASE } from "@/lib/public-api";


interface NioktrCard {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  nioktr_types: string[];
  state_program: string | null;
  federal_program: string | null;
  created_date: string | null;
  start_date: string | null;
  end_date: string | null;
  is_ai_area: boolean;
  is_ai_usage: boolean;
  executor_name: string | null;
  executor_short_name: string | null;
  executor_ogrn: string | null;
  executor_territory: string | null;
  customer_name: string | null;
  budgets: Array<{ funds?: string; budget_type?: string }>;
  organization_id: number | null;
  created_at: string | null;
}

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

export default function NioktrCardPage() {
  const params = useParams<{ registration_number: string }>();
  const reg = params?.registration_number ?? "";
  const { data: session } = useSession();
  const [card, setCard] = useState<NioktrCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.accessToken || !reg) return;
    const fetchCard = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${CLIENT_API_BASE}/api/v1/nioktr/${encodeURIComponent(reg)}`,
          { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
        );
        if (res.status === 404) throw new Error("Карточка не найдена");
        if (!res.ok) throw new Error(`API ${res.status}`);
        setCard(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [session?.user?.accessToken, reg]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
      <Link
        href="/dashboard/nioktr"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-tz-secondary transition-colors hover:text-tz-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к реестру
      </Link>

      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-tz-border bg-tz-surface p-8 text-tz-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка карточки…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {card && !error && (
        <div className="overflow-hidden rounded-2xl border border-tz-border bg-tz-surface">
          {/* Шапка */}
          <div className="border-b border-tz-border bg-gradient-to-br from-[#2a1518] via-[#3a1a1c] to-[#1a1213] p-6 sm:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {card.is_ai_area && (
                <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-3 py-1 text-xs font-semibold text-tz-accent">
                  <Sparkles className="h-3.5 w-3.5" /> ИИ-направление
                </span>
              )}
              {card.nioktr_types.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-tz-badge px-3 py-1 text-xs font-medium text-tz-secondary"
                >
                  {t}
                </span>
              ))}
              <span className="ml-auto font-mono text-xs text-tz-muted">
                {card.registration_number}
              </span>
            </div>
            <h1 className="text-lg font-bold leading-snug text-white sm:text-2xl">
              {card.name}
            </h1>
            {card.state_program && (
              <p className="mt-2 text-sm text-slate-300">
                {card.state_program}
                {card.federal_program && card.federal_program !== card.state_program
                  ? ` · ${card.federal_program}`
                  : ""}
              </p>
            )}
          </div>

          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_320px]">
            {/* Аннотация */}
            <div>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tz-secondary">
                <FlaskConical className="h-4 w-4" />
                Аннотация
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-tz-fg">
                {card.annotation || "Аннотация не предоставлена"}
              </p>

              {card.keywords.length > 0 && (
                <>
                  <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tz-secondary">
                    <Layers className="h-4 w-4" />
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
                </>
              )}

              {card.budgets.length > 0 && (
                <>
                  <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tz-secondary">
                    <Wallet className="h-4 w-4" />
                    Финансирование
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-tz-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-tz-badge text-left text-xs uppercase tracking-wide text-tz-secondary">
                          <th className="px-4 py-2.5 font-semibold">Источник</th>
                          <th className="px-4 py-2.5 text-right font-semibold">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {card.budgets.map((b, i) => (
                          <tr key={i} className="border-t border-tz-border">
                            <td className="px-4 py-2.5 text-tz-fg">
                              {b.budget_type || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-tz-fg">
                              {formatFunds(b.funds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Сайдбар: исполнитель/заказчик/сроки */}
            <aside className="space-y-4">
              <div className="rounded-xl border border-tz-border bg-tz-badge/50 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Building2 className="h-3.5 w-3.5" />
                  Исполнитель
                </h3>
                <p className="text-sm font-semibold leading-snug text-tz-fg">
                  {card.executor_name || card.executor_short_name || "Не указан"}
                </p>
                {card.executor_short_name && (
                  <p className="mt-1 text-xs text-tz-secondary">
                    {card.executor_short_name}
                  </p>
                )}
                {card.executor_ogrn && (
                  <p className="mt-2 font-mono text-[11px] text-tz-muted">
                    ОГРН {card.executor_ogrn}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-tz-border bg-tz-badge/50 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Landmark className="h-3.5 w-3.5" />
                  Заказчик
                </h3>
                <p className="text-sm font-semibold leading-snug text-tz-fg">
                  {card.customer_name || "Не указан"}
                </p>
              </div>

              <div className="rounded-xl border border-tz-border bg-tz-badge/50 p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tz-secondary">
                  <Calendar className="h-3.5 w-3.5" />
                  Сроки
                </h3>
                <div className="space-y-1 text-sm text-tz-fg">
                  {card.start_date && (
                    <p>
                      Начало: <span className="font-medium">{card.start_date}</span>
                    </p>
                  )}
                  {card.end_date && (
                    <p>
                      Окончание: <span className="font-medium">{card.end_date}</span>
                    </p>
                  )}
                  {!card.start_date && !card.end_date && (
                    <p className="text-tz-secondary">Не указаны</p>
                  )}
                </div>
              </div>

              {card.is_ai_usage && (
                <div className="flex items-center gap-2 rounded-xl border border-tz-accent/40 bg-tz-accent-soft px-4 py-3 text-sm text-tz-accent">
                  <Rocket className="h-4 w-4 shrink-0" />
                  В работе используются ИИ-технологии
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
