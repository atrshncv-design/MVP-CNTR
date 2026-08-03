"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Briefcase,
  FileClock,
  FolderKanban,
  GitPullRequest,
  Inbox,
  Layers,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Wallet,
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
  active: "В работе",
  review: "На проверке",
  completed: "Завершён",
  rejected: "Отклонён",
};

/** Статусные бейджи в токенах дизайн-системы (DESIGN.md §5) */
const STATUS_BADGE: Record<string, string> = {
  draft: "tz-badge-neutral",
  active: "tz-badge-accent",
  review: "tz-badge-review",
  completed: "tz-badge-success",
  rejected: "tz-badge-danger",
};

/** Статусы карточек, ожидающих апрува менеджера (очередь «Новые проекты») */
const PENDING_STATUSES = new Set(["draft", "review"]);

type QueueTab = "new" | "upgrades" | "all";

function formatBudget(budget: number | null): string {
  if (budget == null) return "Бюджет не указан";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(budget);
}

export default function CntrManagerDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<QueueTab>("new");

  const displayName = session?.user?.name ?? session?.user?.email ?? "Менеджер ЦНТР";

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
  const pending = projects.filter((p) => PENDING_STATUSES.has(p.status)).length;
  const totalBudget = projects.reduce((acc, p) => acc + (p.budget ?? 0), 0);

  // Очередь «Новые проекты»: черновики и проекты на проверке ждут апрува менеджера
  // (присвоение официального УГТ — решение №7). Верификация — тикет 22 (бэкенд).
  const newQueue = projects.filter((p) => PENDING_STATUSES.has(p.status));

  // Очередь «Заявки на повышение УГТ»: формируются автоматически при полноте
  // комплекта документов этапа (решение №15, тикет 23). До бэкенда счётчик честно 0.
  const upgradeQueue: Project[] = [];

  const statCards = [
    { label: "Все проекты", value: projects.length, icon: FolderKanban, color: "#2E5BFF" },
    { label: "Активные", value: active, icon: PlayCircle, color: "#10B981" },
    { label: "Ожидают апрува", value: pending, icon: FileClock, color: "#E5C840" },
    { label: "Бюджет портфеля", value: totalBudget > 0 ? `${Math.round(totalBudget / 1_000_000)} млн ₽` : "—", icon: Wallet, color: "#FF7A2E" },
  ];

  const renderProjectCard = (project: Project, withPendingChip: boolean) => {
    const badge = STATUS_BADGE[project.status] ?? "tz-badge-neutral";
    return (
      <motion.div key={project.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href={`/dashboard/project/${project.id}`}
          className="tz-card tz-card-hover grid gap-4 p-5 md:grid-cols-[1fr_auto_auto]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</span>
              <span className={`tz-badge ${badge}`}>{STATUS_LABELS[project.status] ?? project.status}</span>
              {project.category && (
                <span className="tz-badge tz-badge-accent">{project.category}</span>
              )}
              {withPendingChip && (
                <span className="tz-badge tz-badge-review">
                  <ShieldCheck size={11} aria-hidden="true" />
                  Ожидает верификации
                </span>
              )}
            </div>
            <h3 className="mt-1 text-lg font-bold text-tz-fg">{project.name}</h3>
            {project.description && (
              <p className="mt-1 text-sm text-tz-secondary line-clamp-2">{project.description}</p>
            )}
            <p className="mt-1.5 text-xs text-tz-muted">
              <Briefcase size={12} className="mr-1 inline" aria-hidden="true" />
              {formatBudget(project.budget)}
            </p>
          </div>
          <div className="md:text-right">
            <div className="tz-eyebrow">Уровень УГТ</div>
            <div className="mt-1.5 flex items-center gap-1.5 md:justify-end">
              <span className="tz-ugt">УГТ {project.current_level}</span>
              <ArrowRight size={14} className="text-tz-muted" aria-hidden="true" />
              <span className="tz-ugt">{project.target_level}</span>
            </div>
          </div>
          <div className="flex items-center md:min-w-28 md:justify-end">
            <ArrowRight size={18} className="text-tz-border transition group-hover:translate-x-1" aria-hidden="true" />
          </div>
        </Link>
      </motion.div>
    );
  };

  return (
    <section data-od-id="manager-dashboard">
      {/* Hero */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол менеджера ЦНТР</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Единый авторитет по УГТ: апрув карточек-черновиков с присвоением официального
          уровня и верификация заявок на повышение УГТ.
        </p>
      </div>

      {/* Статистика */}
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
                <span
                  className="tz-stat-icon"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <Icon size={18} aria-hidden="true" />
                </span>
              </div>
              {loading ? (
                <div className="h-8 w-16 animate-pulse rounded-lg bg-tz-soft" />
              ) : (
                <p className="tz-stat-value">{card.value}</p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Очереди верификации — тикет 28 */}
      <div className="mt-10">
        <div className="tz-tabs" role="tablist" aria-label="Очереди верификации">
          <button
            role="tab"
            aria-selected={tab === "new"}
            onClick={() => setTab("new")}
            className={`tz-tab ${tab === "new" ? "tz-tab-active" : ""}`}
          >
            Новые проекты
            <span className="tz-tab-count">{loading ? "…" : newQueue.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "upgrades"}
            onClick={() => setTab("upgrades")}
            className={`tz-tab ${tab === "upgrades" ? "tz-tab-active" : ""}`}
          >
            Заявки на повышение УГТ
            <span className="tz-tab-count">{upgradeQueue.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "all"}
            onClick={() => setTab("all")}
            className={`tz-tab ${tab === "all" ? "tz-tab-active" : ""}`}
          >
            Все проекты
            <span className="tz-tab-count">{loading ? "…" : projects.length}</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            {loading ? (
              <div className="tz-card p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-tz-soft" />
                <div className="mt-4 h-16 animate-pulse rounded bg-tz-bg" />
              </div>
            ) : error ? (
              <div className="tz-card flex flex-col items-center p-8 text-center">
                <AlertCircle className="mx-auto mb-2 text-tz-danger" size={36} aria-hidden="true" />
                <p className="font-semibold text-tz-danger">{error}</p>
                <button
                  onClick={() => loadProjects()}
                  className="tz-btn tz-btn-secondary mt-4"
                >
                  <RefreshCw size={14} aria-hidden="true" /> Повторить
                </button>
              </div>
            ) : tab === "upgrades" ? (
              <div className="tz-card tz-empty">
                <span className="tz-empty-icon">
                  <GitPullRequest size={22} aria-hidden="true" />
                </span>
                <h2 className="tz-empty-title">Заявок на повышение пока нет</h2>
                <p className="tz-empty-text">
                  Заявка формируется автоматически, как только в карточке проекта собран полный
                  комплект документов текущего этапа (N→N+1), и система даёт предварительную
                  оценку по ГОСТам. Здесь вы будете верифицировать эти заявки и подтверждать
                  переход проекта на следующий уровень УГТ.
                </p>
              </div>
            ) : newQueue.length === 0 && tab === "new" ? (
              <div className="tz-card tz-empty">
                <span className="tz-empty-icon">
                  <Inbox size={22} aria-hidden="true" />
                </span>
                <h2 className="tz-empty-title">Новых проектов на апрув нет</h2>
                <p className="tz-empty-text">
                  Карточки-черновики появляются здесь после экспресс-оценки УГТ любым участником
                  платформы. Апрувните карточку, чтобы присвоить проекту официальный уровень УГТ
                  и опубликовать его в общем реестре.
                </p>
              </div>
            ) : projects.length === 0 ? (
              <div className="tz-card tz-empty">
                <span className="tz-empty-icon">
                  <Layers size={22} aria-hidden="true" />
                </span>
                <h2 className="tz-empty-title">Проектов пока нет</h2>
                <p className="tz-empty-text">
                  Новые заявки заказчиков и проекты участников появятся в этом списке
                  автоматически. Присоединитесь по токену, чтобы следить за проектом.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tab === "new"
                  ? newQueue.map((p) => renderProjectCard(p, true))
                  : projects.map((p) => renderProjectCard(p, false))}
              </div>
            )}
          </div>

          {/* Вступление по токену + экспресс-оценка + ассистент */}
          <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
            <AssessUgTCard />
            <JoinProjectForm />
            <Link
              href="/dashboard/ai-assistant"
              className="tz-card tz-card-hover group flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <span className="tz-stat-icon bg-tz-accent-soft text-tz-accent">
                  <Bot size={20} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-tz-fg">ИИ-ассистент</p>
                  <p className="text-sm text-tz-muted">Генерация документов и отчётов</p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="text-tz-border transition group-hover:translate-x-1 group-hover:text-tz-accent"
                aria-hidden="true"
              />
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
