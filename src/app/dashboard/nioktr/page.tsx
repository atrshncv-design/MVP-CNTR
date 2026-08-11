"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Calendar,
  Filter,
  FlaskConical,
  Search,
  Sparkles,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

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

const PAGE_SIZE = 25;

/** Русская плюрализация */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

export default function NioktrPage() {
  const { data: session } = useSession();
  const [cards, setCards] = useState<NioktrCard[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [customers, setCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [aiOnly, setAiOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Первичная загрузка + перезагрузка при смене фильтров (серверная фильтрация)
  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", "0");
        if (search.trim()) params.set("search", search.trim());
        if (aiOnly) params.set("ai", "true");
        if (typeFilter !== "all") params.set("type", typeFilter);
        if (customerFilter !== "all") params.set("customer", customerFilter);
        const res = await fetch(`${API_URL}/api/v1/nioktr?${params}`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: NioktrCard[] = await res.json();
        if (cancelled) return;
        setCards(data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(0);
        // Опции фильтров — расширяем из приходящих данных
        setTypes((prev) =>
          Array.from(new Set([...prev, ...data.flatMap((c) => c.nioktr_types)])).sort()
        );
        setCustomers((prev) =>
          Array.from(
            new Set([
              ...prev,
              ...data.map((c) => c.customer_name).filter((x): x is string => !!x),
            ])
          ).sort()
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.accessToken, search, aiOnly, typeFilter, customerFilter]);

  // «Показать ещё» — пагинация по offset (вызывается из обработчика)
  const loadMore = async () => {
    if (!session?.user?.accessToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset + PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (aiOnly) params.set("ai", "true");
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (customerFilter !== "all") params.set("customer", customerFilter);
      const res = await fetch(`${API_URL}/api/v1/nioktr?${params}`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: NioktrCard[] = await res.json();
      setCards((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8">
      {/* Заголовок */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl tz-grad-bg shadow-[0_4px_18px_rgba(214,48,49,0.3)]">
              <FlaskConical className="h-4.5 w-4.5 text-white" size={18} />
            </span>
            <h1 className="tz-page-title text-tz-fg">Реестр НИОКТР</h1>
          </div>
          <p className="mt-1.5 text-sm text-tz-secondary">
            Научно-исследовательские работы из федерального реестра — поиск по названию,
            фильтры по направлению и заказчику
          </p>
        </div>
        <Link
          href="/dashboard/organizations"
          className="inline-flex items-center gap-2 rounded-xl border border-tz-border bg-tz-surface px-4 py-2 text-sm font-semibold text-tz-fg transition-colors hover:bg-tz-hover"
        >
          <Building2 className="h-4 w-4" />
          Каталог организаций
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Панель фильтров */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-tz-border bg-tz-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tz-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setSearch(e.currentTarget.value)}
            placeholder="Поиск по названию работы…"
            className="w-full rounded-xl border border-tz-border bg-tz-input px-9 py-2.5 text-sm text-tz-fg placeholder:text-tz-muted focus:border-tz-accent focus:outline-none"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-tz-fg">
          <input
            type="checkbox"
            checked={aiOnly}
            onChange={(e) => setAiOnly(e.target.checked)}
            className="h-4 w-4 accent-tz-accent"
          />
          <Sparkles className="h-4 w-4 text-tz-accent" />
          Только ИИ-направление
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-tz-border bg-tz-input px-3 py-2.5 text-sm text-tz-fg focus:border-tz-accent focus:outline-none"
        >
          <option value="all">Тип: любой</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="max-w-[240px] rounded-xl border border-tz-border bg-tz-input px-3 py-2.5 text-sm text-tz-fg focus:border-tz-accent focus:outline-none"
        >
          <option value="all">Заказчик: любой</option>
          {customers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="tz-grad-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
          <Filter className="h-4 w-4" />
          Фильтры применяются автоматически
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-tz-border bg-tz-surface"
            />
          ))}
        </div>
      )}

      {!loading && cards.length === 0 && !error && (
        <div className="rounded-2xl border border-tz-border bg-tz-surface p-10 text-center text-tz-secondary">
          По заданным фильтрам карточек не найдено
        </div>
      )}

      {!loading && cards.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, i) => (
              <motion.div
                key={card.registration_number}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i % PAGE_SIZE, 6) * 0.03 }}
              >
                <Link
                  href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
                  className="group flex h-full flex-col rounded-2xl border border-tz-border bg-tz-surface p-5 transition-all hover:border-tz-accent/50 hover:bg-tz-hover"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    {card.is_ai_area ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-tz-accent">
                        <Sparkles className="h-3 w-3" /> ИИ-направление
                      </span>
                    ) : (
                      <span className="rounded-full bg-tz-badge px-2.5 py-0.5 text-[11px] font-medium text-tz-secondary">
                        НИОКТР
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-tz-muted">
                      {card.registration_number}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-tz-fg group-hover:text-tz-accent">
                    {card.name}
                  </h3>
                  {card.annotation && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-tz-secondary">
                      {card.annotation}
                    </p>
                  )}
                  <div className="mt-auto pt-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-tz-secondary">
                      {card.executor_short_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {card.executor_short_name}
                        </span>
                      )}
                      {card.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {card.start_date}
                        </span>
                      )}
                      {card.nioktr_types[0] && (
                        <span className="rounded-md bg-tz-badge px-1.5 py-0.5">
                          {card.nioktr_types[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  void loadMore();
                }}
                disabled={loadingMore}
                className="rounded-xl border border-tz-border bg-tz-surface px-6 py-2.5 text-sm font-semibold text-tz-fg transition-colors hover:bg-tz-hover disabled:opacity-50"
              >
                {loadingMore ? "Загрузка…" : "Показать ещё"}
              </button>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-tz-muted">
            {pluralize(
              offset + (hasMore ? PAGE_SIZE : cards.length),
              "карточка",
              "карточки",
              "карточек"
            )}{" "}
            в выборке
          </p>
        </>
      )}
    </div>
  );
}
