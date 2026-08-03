"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ArrowRight, Gauge } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/**
 * Карточка «Оценить УГТ» — точка входа экспресс-оценки из любого ЛК (тикет 26).
 * Экспресс-оценка создаёт проект-черновик с предварительным уровнем УГТ;
 * официальный УГТ присваивает менеджер ЦНТР при апруве карточки (решение №7).
 */
export function AssessUgTCard() {
  const { data: session } = useSession();
  const [drafts, setDrafts] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    let cancelled = false;
    fetch(`${API_URL}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${session.user.accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ status: string }>) => {
        if (!cancelled) setDrafts(list.filter((p) => p.status === "draft").length);
      })
      .catch(() => {
        if (!cancelled) setDrafts(0);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <div data-od-id="assess-ugt-card" className="tz-card tz-card-hover p-5">
      <div className="flex items-start gap-3">
        <span className="tz-stat-icon bg-tz-accent-soft text-tz-accent">
          <Gauge size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-tz-fg">Оценка УГТ проекта</p>
          <p className="mt-1 text-sm leading-relaxed text-tz-muted">
            Экспресс-оценка по ГОСТ Р 58048-2017: 4 категории × 9 уровней. Результат —
            черновик проекта с предварительным уровнем УГТ.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Link href="/dashboard/gk_customer/projects/new" className="tz-btn tz-btn-primary">
          Оценить УГТ
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link
          href="/dashboard/projects"
          className="text-sm font-medium text-tz-accent transition hover:text-tz-accent-hover"
        >
          Черновики: {drafts === null ? "…" : drafts}
        </Link>
      </div>
    </div>
  );
}
