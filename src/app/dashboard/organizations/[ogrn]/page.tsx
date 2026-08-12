"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  FlaskConical,
  GraduationCap,
  Layers,
  Loader2,
  Sparkles,
  Store,
} from "lucide-react";
import { useBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb";
import type { OrganizationDetail } from "@/lib/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const TYPE_LABELS: Record<string, string> = {
  scientific_org: "Научная организация",
  company: "Компания",
};

/** Русская плюрализация: 1 работа, 2 работы, 5 работ. */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

/**
 * Подробная карточка организации (тикет 05 internal-ux-redesign):
 * светлая тема на токенах --tz-*, единый обязательный breadcrumb
 * (Рабочий стол / Организации / название), карточки-секции без тёмных
 * блоков и наложений. Данные — только из API, честные пустые состояния.
 */
export default function OrganizationDetailPage() {
  const params = useParams<{ ogrn: string }>();
  const ogrn = params?.ogrn ?? "";
  const { data: session } = useSession();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useBreadcrumb([
    { label: "Рабочий стол", href: "/dashboard" },
    { label: "Организации", href: "/dashboard/organizations" },
    { label: org ? org.name : ogrn },
  ]);

  useEffect(() => {
    if (!session?.user?.accessToken || !ogrn) return;
    let cancelled = false;
    const fetchOrg = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/api/v1/nioktr/organizations/${encodeURIComponent(ogrn)}`,
          { headers: { Authorization: `Bearer ${session.user.accessToken}` } },
        );
        if (res.status === 404) throw new Error("Организация не найдена");
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data: OrganizationDetail = await res.json();
        if (cancelled) return;
        setOrg(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOrg();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.accessToken, ogrn]);

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center gap-3 rounded-[14px] border border-tz-border bg-tz-surface p-8 text-tz-secondary">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Загрузка организации…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-tz-danger/30 bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {org && !error && (
        <>
          {/* Шапка карточки — светлая, на токенах */}
          <div className="border-b border-tz-border pb-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-tz-badge">
                {org.org_type === "scientific_org" ? (
                  <GraduationCap size={22} className="text-tz-accent" aria-hidden />
                ) : (
                  <Store size={22} className="text-tz-secondary" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="tz-page-title break-words">{org.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="tz-badge tz-badge-neutral">
                    {TYPE_LABELS[org.org_type ?? ""] ?? org.org_type ?? "Организация"}
                  </span>
                  {org.short_name && org.short_name !== org.name && (
                    <span className="tz-badge tz-badge-neutral">{org.short_name}</span>
                  )}
                  {org.ogrn && (
                    <span className="tz-badge tz-badge-neutral font-mono">ОГРН {org.ogrn}</span>
                  )}
                  <span className="tz-badge tz-badge-accent">
                    {org.projects_count}{" "}
                    {pluralize(org.projects_count, "работа", "работы", "работ")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {org.competencies.length > 0 && (
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="org-competencies">
              <h2 id="org-competencies" className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
                <Layers size={18} className="text-tz-accent" aria-hidden />
                Компетенции
              </h2>
              <div className="flex flex-wrap gap-2">
                {org.competencies.map((c) => (
                  <span
                    key={c}
                    className="rounded-lg border border-tz-border bg-tz-badge px-2.5 py-1 text-xs text-tz-fg"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Работы организации */}
          <section aria-labelledby="org-works">
            <h2 id="org-works" className="tz-card-title mb-4 flex items-center gap-2 text-tz-fg">
              <FlaskConical size={18} className="text-tz-accent" aria-hidden />
              НИОКТР-работы организации
            </h2>
            {org.nioktr_cards.length === 0 ? (
              <div className="rounded-2xl border border-tz-border bg-tz-surface p-8 text-center text-sm text-tz-secondary">
                Работы не найдены
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {org.nioktr_cards.map((card) => (
                  <Link
                    key={card.registration_number}
                    href={`/dashboard/nioktr/${encodeURIComponent(card.registration_number)}`}
                    className="group rounded-2xl border border-tz-border bg-tz-surface p-4 transition hover:border-tz-accent hover:bg-tz-hover"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      {card.is_ai_area && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2 py-0.5 text-[10px] font-semibold text-tz-accent">
                          <Sparkles size={10} aria-hidden /> ИИ
                        </span>
                      )}
                      {card.nioktr_types[0] && (
                        <span className="rounded-md bg-tz-badge px-1.5 py-0.5 text-[10px] text-tz-secondary">
                          {card.nioktr_types[0]}
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[10px] text-tz-muted">
                        {card.registration_number}
                      </span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-tz-fg group-hover:text-tz-accent">
                      {card.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-tz-secondary">
                      {card.customer_name && (
                        <span className="inline-flex min-w-0 items-center gap-1 truncate">
                          <Building2 size={12} className="shrink-0" aria-hidden />
                          <span className="truncate">{card.customer_name}</span>
                        </span>
                      )}
                      {card.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} aria-hidden />
                          {card.start_date}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
