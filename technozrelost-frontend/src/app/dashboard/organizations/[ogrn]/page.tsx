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
  GraduationCap,
  Layers,
  Loader2,
  Sparkles,
  Store,
} from "lucide-react";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


interface NioktrCard {
  id: number;
  registration_number: string;
  name: string;
  annotation: string | null;
  keywords: string[];
  nioktr_types: string[];
  start_date: string | null;
  end_date: string | null;
  is_ai_area: boolean;
  executor_name: string | null;
  executor_short_name: string | null;
  customer_name: string | null;
}

interface OrganizationDetail {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  competencies: string[];
  projects_count: number;
  region: string | null;
  nioktr_cards: NioktrCard[];
}

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

export default function OrganizationDetailPage() {
  const params = useParams<{ ogrn: string }>();
  const ogrn = params?.ogrn ?? "";
  const { data: session } = useSession();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.accessToken || !ogrn) return;
    const fetchOrg = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_URL}/api/v1/nioktr/organizations/${encodeURIComponent(ogrn)}`,
          { headers: { Authorization: `Bearer ${session.user.accessToken}` } }
        );
        if (res.status === 404) throw new Error("Организация не найдена");
        if (!res.ok) throw new Error(`API ${res.status}`);
        setOrg(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };
    fetchOrg();
  }, [session?.user?.accessToken, ogrn]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
      <Link
        href="/dashboard/organizations"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-tz-secondary transition-colors hover:text-tz-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад к каталогу
      </Link>

      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-tz-border bg-tz-surface p-8 text-tz-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка организации…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {org && !error && (
        <div className="space-y-6">
          {/* Профиль */}
          <div className="overflow-hidden rounded-2xl border border-tz-border bg-tz-surface">
            <div className="flex items-start gap-4 border-b border-tz-border bg-gradient-to-br from-[#2a1518] via-[#3a1a1c] to-[#1a1213] p-6 sm:p-8">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-tz-badge">
                {org.org_type === "scientific_org" ? (
                  <GraduationCap className="h-7 w-7 text-tz-accent" />
                ) : (
                  <Store className="h-7 w-7 text-slate-300" />
                )}
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-snug text-white sm:text-2xl">
                  {org.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-tz-badge px-3 py-1 font-medium text-slate-300">
                    {TYPE_LABELS[org.org_type ?? ""] ?? org.org_type ?? "Организация"}
                  </span>
                  {org.short_name && (
                    <span className="rounded-full bg-tz-badge px-3 py-1 text-slate-300">
                      {org.short_name}
                    </span>
                  )}
                  {org.ogrn && (
                    <span className="rounded-full bg-tz-badge px-3 py-1 font-mono text-slate-400">
                      ОГРН {org.ogrn}
                    </span>
                  )}
                  <span className="rounded-full bg-tz-accent-soft px-3 py-1 font-semibold text-tz-accent">
                    {org.projects_count}{" "}
                    {pluralize(org.projects_count, "работа", "работы", "работ")}
                  </span>
                </div>
              </div>
            </div>

            {org.competencies.length > 0 && (
              <div className="p-6 sm:p-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tz-secondary">
                  <Layers className="h-4 w-4" />
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
              </div>
            )}
          </div>

          {/* Работы организации */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-tz-secondary">
              <FlaskConical className="h-4 w-4" />
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
                    className="group rounded-2xl border border-tz-border bg-tz-surface p-4 transition-all hover:border-tz-accent/50 hover:bg-tz-hover"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      {card.is_ai_area && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-tz-accent-soft px-2 py-0.5 text-[10px] font-semibold text-tz-accent">
                          <Sparkles className="h-3 w-3" /> ИИ
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
                        <span className="inline-flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{card.customer_name}</span>
                        </span>
                      )}
                      {card.start_date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {card.start_date}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
