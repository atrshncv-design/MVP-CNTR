"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  FileClock,
  FolderKanban,
  GraduationCap,
  Loader2,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import JoinProjectForm from "@/components/join-project-form";
import { AssessUgTCard } from "@/components/assess-ugt-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface Project {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  target_level: number;
  current_level: number;
  status: string;
  budget: number | null;
  created_by: number | null;
  created_at: string | null;
  updated_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  auto_confirmed: "Подтверждён автоматически",
  active: "В работе",
  review: "На проверке",
  completed: "Завершён",
  rejected: "Отклонён",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--tz-neutral)",
  active: "var(--tz-accent)",
  review: "var(--tz-review)",
  completed: "var(--tz-success)",
  rejected: "var(--tz-danger)",
};

/**
 * Рабочий стол научной организации (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета: заголовок, статистика из API, список проектов
 * (данные), боковая колонка — действия и следующий шаг (оценка УГТ +
 * вступление по токену). Без mock-success: честные loading/error/empty.
 */
export default function ScientificOrgDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Научная организация";

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
      setProjects((await res.json()) as Project[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить проекты.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    (async () => {
      await loadProjects();
    })();
  }, [loadProjects]);

  const active = projects.filter((p) => p.status === "active").length;
  const review = projects.filter((p) => p.status === "review" || p.status === "draft").length;
  const completed = projects.filter((p) => p.status === "completed").length;

  const statCards = [
    { label: "Мои проекты", value: projects.length, icon: FolderKanban, color: "var(--tz-accent)" },
    { label: "Активные проекты", value: active, icon: PlayCircle, color: "var(--tz-success)" },
    { label: "На рассмотрении", value: review, icon: FileClock, color: "var(--tz-review)" },
    { label: "Завершённые", value: completed, icon: GraduationCap, color: "var(--tz-ugt-2)" },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол научной организации</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Научные организации участвуют в проектах как партнёры НИОКР: ведут
          исследования, подтверждают уровни УГТ и готовят отчётную документацию.
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

      {/* Данные (проекты) + действия/следующий шаг (боковая колонка) */}
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
              <h2 className="tz-empty-title">Проектов пока нет</h2>
              <p className="tz-empty-text">
                Присоединитесь по токену, выданному заказчиком или менеджером ЦНТР, —
                проект сразу появится в этом списке.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {projects.map((project) => {
                const color = STATUS_COLORS[project.status] ?? "var(--tz-neutral)";
                return (
                  <Link
                    key={project.id}
                    href={`/dashboard/project/${project.id}`}
                    className="tz-card tz-card-hover grid gap-4 p-5 md:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: `${color}15`, color }}
                        >
                          {STATUS_LABELS[project.status] ?? project.status}
                        </span>
                      </div>
                      <h3 className="tz-card-title mt-1">{project.name}</h3>
                      <p className="mt-1 text-sm text-tz-secondary">
                        {project.category ?? "Категория не указана"}
                        {project.description ? ` — ${project.description}` : ""}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <div className="text-xs text-tz-muted">Уровень УГТ</div>
                      <div className="mt-1 font-bold text-tz-accent">
                        УГТ {project.current_level} → {project.target_level}
                      </div>
                    </div>
                    <div className="flex items-center md:min-w-28 md:justify-end">
                      <ArrowRight size={18} className="text-tz-muted" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
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
