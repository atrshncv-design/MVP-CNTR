"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  GraduationCap,
  Search,
  Store,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface Organization {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  competencies: string[];
  projects_count: number;
  region: string | null;
}

const PAGE_SIZE = 50;

/** Русская плюрализация */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

const TYPE_LABELS: Record<string, string> = {
  scientific_org: "Научная организация",
  company: "Компания",
};

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Первичная загрузка + перезагрузка при смене поиска (серверный поиск)
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
        const res = await fetch(`${API_URL}/api/v1/nioktr/organizations?${params}`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: Organization[] = await res.json();
        if (cancelled) return;
        setOrgs(data);
        setHasMore(data.length === PAGE_SIZE);
        setOffset(0);
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
  }, [session?.user?.accessToken, search]);

  // «Показать ещё» — пагинация по offset (вызывается из обработчика)
  const loadMore = async () => {
    if (!session?.user?.accessToken || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset + PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API_URL}/api/v1/nioktr/organizations?${params}`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data: Organization[] = await res.json();
      setOrgs((prev) => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setOffset((prev) => prev + PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#2e5bff] via-[#7c5cff] to-[#00d4c8] shadow-[0_4px_18px_rgba(90,100,255,0.35)]">
              <Building2 className="h-4.5 w-4.5 text-white" size={18} />
            </span>
            <h1 className="text-xl font-bold text-tz-fg sm:text-2xl">
              Каталог организаций
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-tz-secondary">
            Исполнители научно-исследовательских работ из карточек НИОКТР
          </p>
        </div>
        <Link
          href="/dashboard/nioktr"
          className="inline-flex items-center gap-2 rounded-xl border border-tz-border bg-tz-surface px-4 py-2 text-sm font-semibold text-tz-fg transition-colors hover:bg-tz-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Реестр НИОКТР
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-tz-border bg-tz-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tz-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию организации…"
            className="w-full rounded-xl border border-tz-border bg-tz-input px-9 py-2.5 text-sm text-tz-fg placeholder:text-tz-muted focus:border-tz-accent focus:outline-none"
          />
        </div>
        <span className="rounded-xl bg-gradient-to-br from-[#2e5bff] to-[#7c5cff] px-4 py-2.5 text-sm font-semibold text-white">
          Поиск по мере ввода
        </span>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-tz-border bg-tz-surface"
            />
          ))}
        </div>
      )}

      {!loading && orgs.length === 0 && !error && (
        <div className="rounded-2xl border border-tz-border bg-tz-surface p-10 text-center text-tz-secondary">
          Организации не найдены
        </div>
      )}

      {!loading && orgs.length > 0 && (
        <>
          <div className="space-y-3">
            {orgs.map((org, i) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03 }}
              >
                <Link
                  href={
                    org.ogrn
                      ? `/dashboard/organizations/${encodeURIComponent(org.ogrn)}`
                      : "#"
                  }
                  className="group flex items-start gap-4 rounded-2xl border border-tz-border bg-tz-surface p-5 transition-all hover:border-tz-accent/50 hover:bg-tz-hover"
                >
                  <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tz-badge">
                    {org.org_type === "scientific_org" ? (
                      <GraduationCap className="h-5 w-5 text-tz-accent" />
                    ) : (
                      <Store className="h-5 w-5 text-tz-secondary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-tz-fg group-hover:text-tz-accent">
                        {org.name}
                      </h3>
                      <span className="rounded-full bg-tz-badge px-2.5 py-0.5 text-[11px] font-medium text-tz-secondary">
                        {TYPE_LABELS[org.org_type ?? ""] ?? org.org_type ?? "Организация"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-tz-secondary">
                      <span className="font-semibold text-tz-fg">
                        {org.projects_count}{" "}
                        {pluralize(org.projects_count, "работа", "работы", "работ")}
                      </span>
                      {org.ogrn && (
                        <span className="ml-3 font-mono text-tz-muted">
                          ОГРН {org.ogrn}
                        </span>
                      )}
                    </p>
                    {org.competencies.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {org.competencies.slice(0, 6).map((c) => (
                          <span
                            key={c}
                            className="rounded-md border border-tz-border bg-tz-badge/60 px-2 py-0.5 text-[11px] text-tz-secondary"
                          >
                            {c}
                          </span>
                        ))}
                        {org.competencies.length > 6 && (
                          <span className="px-1 py-0.5 text-[11px] text-tz-muted">
                            +{org.competencies.length - 6}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-tz-muted transition-transform group-hover:translate-x-1 group-hover:text-tz-accent" />
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
        </>
      )}
    </div>
  );
}
