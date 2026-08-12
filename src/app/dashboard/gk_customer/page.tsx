"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  Database,
  FileClock,
  FolderKanban,
  PlayCircle,
  PlusCircle,
  Users,
} from "lucide-react";
import { AssessUgTCard } from "@/components/assess-ugt-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface ProjectSummary {
  id: number;
  name: string;
  category: string | null;
  current_level: number;
  status: string;
}

interface Stats {
  projects: number;
  active: number;
  draft: number;
  executors: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  auto_confirmed: "Подтверждён автоматически",
  active: "В работе",
  review: "На проверке",
  completed: "Завершён",
};

/**
 * Рабочий стол заказчика (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета роли: заголовок (tz-eyebrow + tz-page-title),
 * статистика из реального API, список проектов (данные), быстрые действия
 * и следующий шаг в боковой колонке. Никаких mock-значений: при недоступном
 * API карточки показывают нули, список — честное пустое состояние.
 */
export default function GkCustomerDashboard() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState<Stats>({ projects: 0, active: 0, draft: 0, executors: 0 });
  const [loading, setLoading] = useState(true);

  const displayName = session?.user?.name ?? session?.user?.email ?? "Представитель организации";

  useEffect(() => {
    if (!session?.user?.accessToken) return;

    const fetchData = async () => {
      try {
        const [projectsRes, executorsRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/projects`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          }),
          fetch(`${API_URL}/api/v1/executors`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
          }),
        ]);

        const projectsData = projectsRes.ok ? ((await projectsRes.json()) as ProjectSummary[]) : [];
        const executorsData = executorsRes.ok ? (await executorsRes.json()) : [];

        setProjects(projectsData);
        setStats({
          projects: projectsData.length,
          active: projectsData.filter((p) => p.status === "active").length,
          draft: projectsData.filter((p) => p.status === "draft").length,
          executors: Array.isArray(executorsData) ? executorsData.length : 0,
        });
      } catch {
        // При ошибке оставляем нули в статистике
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const statCards = [
    { label: "Мои проекты", value: stats.projects, icon: FolderKanban, color: "var(--tz-accent)" },
    { label: "Активные проекты", value: stats.active, icon: PlayCircle, color: "var(--tz-success)" },
    { label: "На согласовании", value: stats.draft, icon: FileClock, color: "var(--tz-review)" },
    { label: "Исполнители", value: stats.executors, icon: Users, color: "var(--tz-ugt-2)" },
  ];

  const quickActions = [
    {
      href: "/dashboard/gk_customer/projects/new",
      icon: PlusCircle,
      title: "Новая заявка",
      text: "Оценить и подать проект",
    },
    {
      href: "/dashboard/executors",
      icon: Building2,
      title: "Каталог исполнителей",
      text: "Найти R&D-партнёра",
    },
    {
      href: "/dashboard/technologies",
      icon: Database,
      title: "Реестр технологий",
      text: "Каталог готовых решений",
    },
  ];

  return (
    <section>
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Рабочий стол заказчика</p>
        <h1 className="tz-page-title mt-2">Добро пожаловать, {displayName}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Здесь появятся проекты вашей организации и их путь от заявки до
          внедрения технологии.
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
          {loading ? (
            <div className="tz-card p-6">
              <div className="h-5 w-48 animate-pulse rounded bg-tz-soft" />
              <div className="mt-4 h-16 animate-pulse rounded bg-tz-soft" />
            </div>
          ) : projects.length === 0 ? (
            <div className="tz-card tz-empty">
              <span className="tz-empty-icon">
                <FolderKanban size={22} />
              </span>
              <h2 className="tz-empty-title">Проектов пока нет</h2>
              <p className="tz-empty-text">
                Начните с фиксированной заявки. После сохранения она станет карточкой
                проекта и будет передана менеджеру ЦНТР на рассмотрение.
              </p>
              <Link
                href="/dashboard/gk_customer/projects/new"
                className="tz-btn tz-btn-primary mt-7"
              >
                <PlusCircle size={16} /> Создать первую заявку
              </Link>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="tz-card-title">Мои проекты</h2>
                <Link
                  href="/dashboard/projects"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-tz-accent transition hover:text-tz-accent-hover"
                >
                  Все проекты <ArrowRight size={15} />
                </Link>
              </div>
              <div className="mt-4 grid gap-4">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/dashboard/project/${project.id}`}
                    className="tz-card tz-card-hover grid gap-4 p-5 md:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <div className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</div>
                      <h3 className="tz-card-title mt-1">{project.name}</h3>
                      <p className="mt-1 text-sm text-tz-secondary">
                        {project.category ?? "Категория не указана"}
                      </p>
                    </div>
                    <div className="md:text-right">
                      <div className="text-xs text-tz-muted">Текущий уровень</div>
                      <div className="mt-1 font-bold text-tz-accent">УГТ {project.current_level}</div>
                    </div>
                    <div className="md:min-w-28 md:text-right">
                      <div className="text-xs text-tz-muted">Статус</div>
                      <div className="mt-1 font-semibold text-tz-fg">
                        {STATUS_LABELS[project.status] ?? project.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Действия и следующий шаг */}
        <aside className="space-y-6 lg:sticky lg:top-20">
          <AssessUgTCard />
          <div className="tz-card p-5">
            <h2 className="tz-card-title">Быстрые действия</h2>
            <p className="mt-1 text-sm text-tz-muted">
              Следующий шаг — подача заявки или поиск партнёров.
            </p>
            <div className="mt-4 space-y-2">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="group flex items-center gap-3 rounded-xl border border-tz-card-border bg-tz-surface p-3.5 transition hover:border-tz-accent"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tz-accent-soft text-tz-accent">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-tz-fg">{action.title}</span>
                      <span className="block truncate text-xs text-tz-muted">{action.text}</span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="shrink-0 text-tz-muted transition group-hover:translate-x-0.5 group-hover:text-tz-accent"
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
