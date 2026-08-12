"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  FileCheck,
  FolderKanban,
  Gauge,
  Layers,
  Loader2,
  RefreshCw,
} from "lucide-react";
import JoinProjectForm from "@/components/join-project-form";
import { AssessUgTCard } from "@/components/assess-ugt-card";
import VerificationDocsPanel from "@/components/verification-docs-panel";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface JoinedProject {
  id: number;
  name: string;
  current_level: number;
  target_level: number;
  docs_count: number;
}

/** Достаёт человекочитаемое сообщение об ошибке из ответа FastAPI */
function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === "object") {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === "string") return msg;
    }
  }
  return fallback;
}

/**
 * Рабочий стол регулирующей организации (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета: заголовок, статистика из API, список проектов
 * с документами подтверждения (данные), боковая колонка — действия и
 * следующий шаг. Без mock-success: честные loading/error/empty состояния.
 */
export default function RegulatingOrganizationDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<JoinedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Регулирующая организация";

  const loadProjects = useCallback(async () => {
    if (!session?.user?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        throw new Error(`Не удалось загрузить проекты (${res.status}).`);
      }
      const list = (await res.json()) as Array<{
        id: number;
        name: string;
        current_level: number;
        target_level: number;
        verification_documents_count: number;
      }>;
      // Список проектов включает verification_documents_count (FE-004) — без N+1
      setProjects(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          current_level: p.current_level,
          target_level: p.target_level,
          docs_count: p.verification_documents_count ?? 0,
        })),
      );
    } catch (e) {
      setError(extractError(e, "Не удалось загрузить проекты."));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await loadProjects();
    })();
  }, [loadProjects]);

  /** Честная статистика — производные от данных проектов. */
  const stats = useMemo(() => {
    const totalDocs = projects.reduce((acc, p) => acc + p.docs_count, 0);
    const withDocs = projects.filter((p) => p.docs_count > 0).length;
    const avgLevel =
      projects.length === 0
        ? 0
        : Math.round(projects.reduce((acc, p) => acc + p.current_level, 0) / projects.length);
    return { projects: projects.length, totalDocs, withDocs, avgLevel };
  }, [projects]);

  const statCards = [
    { label: "Проекты", value: stats.projects, icon: FolderKanban, color: "var(--tz-accent)" },
    { label: "Верифицирующие документы", value: stats.totalDocs, icon: FileCheck, color: "var(--tz-success)" },
    { label: "Проекты с документами", value: stats.withDocs, icon: Layers, color: "var(--tz-review)" },
    { label: "Средняя зрелость УГТ", value: stats.projects === 0 ? "—" : `УГТ ${stats.avgLevel}`, icon: Gauge, color: "var(--tz-ugt-2)" },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол регулирующей организации</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Присоединяйтесь к карточке проекта по токену TZ-XXXXXX и добавляйте
          документы подтверждения УГТ — они станут основанием для решения менеджера ЦНТР.
        </p>
      </div>

      {/* Данные: статистика из API */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="tz-card tz-stat p-5"
            >
              <div className="tz-stat-label">
                {card.label}
                <span className="tz-stat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded bg-tz-soft" />
              ) : (
                <p className="tz-stat-value">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button className="tz-btn tz-btn-secondary tz-btn-sm shrink-0" onClick={() => void loadProjects()}>
            <RefreshCw size={13} /> Повторить
          </button>
        </div>
      )}

      {/* Данные (проекты и документы) + действия/следующий шаг (боковая колонка) */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <h2 className="tz-card-title">Мои проекты</h2>

          {loading ? (
            <div className="tz-card mt-4 p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-tz-soft" />
              <div className="mt-4 h-16 animate-pulse rounded bg-tz-soft" />
            </div>
          ) : error ? (
            <div className="tz-card tz-empty mt-4">
              <AlertCircle className="text-tz-danger" size={32} />
              <p className="tz-empty-title">{error}</p>
              <button className="tz-btn tz-btn-secondary mt-6" onClick={() => void loadProjects()}>
                <RefreshCw size={15} /> Повторить
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="tz-card tz-empty mt-4">
              <span className="tz-empty-icon">
                <FolderKanban size={22} />
              </span>
              <h2 className="tz-empty-title">Пока нет проектов</h2>
              <p className="tz-empty-text">
                Присоединитесь к карточке проекта по токену TZ — и она появится
                в этом списке. После вступления вам станет доступна загрузка
                верифицирующих документов.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {projects.map((p) => (
                <div key={p.id} className="tz-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>
                        <span className="rounded-full bg-tz-accent-soft px-2 py-0.5 text-[11px] font-medium text-tz-accent">
                          УГТ {p.current_level} → {p.target_level}
                        </span>
                        <span className="rounded-full bg-tz-success-soft px-2 py-0.5 text-[11px] font-medium text-tz-success">
                          {p.docs_count} доказ.
                        </span>
                      </div>
                      <Link
                        href={`/dashboard/project/${p.id}`}
                        className="tz-card-title mt-1 block transition hover:text-tz-accent"
                      >
                        {p.name}
                      </Link>
                    </div>
                    <Link
                      href={`/dashboard/project/${p.id}`}
                      className="tz-btn tz-btn-primary tz-btn-sm"
                    >
                      <FileCheck size={15} /> Документы проекта
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <VerificationDocsPanel />
          </div>
        </div>

        {/* Действия и следующий шаг */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <AssessUgTCard />
          {loading ? (
            <div className="flex h-40 items-center justify-center tz-card">
              <Loader2 size={22} className="animate-spin text-tz-accent" />
            </div>
          ) : (
            <JoinProjectForm />
          )}
        </aside>
      </div>
    </section>
  );
}
