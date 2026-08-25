'use client';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
import { AssessUgTCard } from "@/components/assess-ugt-card";

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
  auto_confirmed: "Подтверждён автоматически", active: "В работе",
  review: "На проверке",
  completed: "Завершён",
};

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

  return (
    <section>
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
          Рабочий стол заказчика
        </p>
        <h1 className="tz-page-title mt-2 text-tz-fg">
          Добро пожаловать, {displayName}
        </h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Здесь появятся проекты вашей организации и их путь от заявки до
          внедрения технологии.
        </p>
      </div>

      <nav aria-label="Разделы рабочего стола" className="flex gap-6 border-b border-tz-border">
        <span className="border-b-2 border-[var(--tz-accent)] py-4 font-semibold text-tz-fg">
          Проекты
        </span>
        <Link href="/dashboard/gk_customer/projects/new" className="py-4 text-tz-secondary hover:text-tz-fg">
          Новая заявка
        </Link>
        <Link href="/dashboard/technologies" className="py-4 text-tz-secondary hover:text-tz-fg">
          Реестр технологий
        </Link>
        <Link href="/dashboard/executors" className="py-4 text-tz-secondary hover:text-tz-fg">
          Каталог исполнителей
        </Link>
      </nav>

      {/* Статистика из API */}
      {/* Экспресс-оценка УГТ — тикет 26: доступна любой роли */}
      <div className="mt-6">
        <AssessUgTCard />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx, duration: 0.4 }}
              className="rounded-2xl border border-tz-card-border bg-tz-surface p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-tz-muted">{card.label}</span>
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${card.color}15`, color: card.color }}
                >
                  <Icon size={18} />
                </span>
              </div>
              {loading ? (
                <div className="mt-3 h-8 w-16 animate-pulse rounded-lg bg-tz-surface-2" />
              ) : (
                <p className="mt-2 text-3xl font-bold tracking-[-0.02em] text-tz-fg">
                  {card.value}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Быстрые действия */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/dashboard/gk_customer/projects/new"
          className="group flex items-center justify-between rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]">
              <PlusCircle size={20} />
            </span>
            <div>
              <p className="font-bold text-tz-fg">Новая заявка</p>
              <p className="text-sm text-tz-muted">Оценить и подать проект</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-tz-muted transition group-hover:translate-x-1 group-hover:text-[var(--tz-accent)]" />
        </Link>
        <Link
          href="/dashboard/executors"
          className="group flex items-center justify-between rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]">
              <Building2 size={20} />
            </span>
            <div>
              <p className="font-bold text-tz-fg">Каталог исполнителей</p>
              <p className="text-sm text-tz-muted">Найти R&D-партнёра</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-tz-muted transition group-hover:translate-x-1 group-hover:text-[var(--tz-accent)]" />
        </Link>
        <Link
          href="/dashboard/technologies"
          className="group flex items-center justify-between rounded-2xl border border-tz-card-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tz-accent-soft)] text-[var(--tz-accent)]">
              <Database size={20} />
            </span>
            <div>
              <p className="font-bold text-tz-fg">Реестр технологий</p>
              <p className="text-sm text-tz-muted">Каталог готовых решений</p>
            </div>
          </div>
          <ArrowRight size={18} className="text-tz-muted transition group-hover:translate-x-1 group-hover:text-[var(--tz-accent)]" />
        </Link>
      </div>

      {/* Список проектов */}
      <div className="mt-8">
        {loading ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-tz-surface-2" />
            <div className="mt-4 h-16 animate-pulse rounded bg-tz-soft" />
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-[14px] border border-tz-border bg-tz-surface px-6 py-14 text-center sm:px-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--tz-accent-soft)] font-mono font-bold text-[var(--tz-accent)]">
              01
            </div>
            <h2 className="tz-section-title mt-5 text-tz-fg">
              Проектов пока нет
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-tz-secondary">
              Начните с фиксированной заявки. После сохранения она станет карточкой
              проекта и будет передана менеджеру ЦНТР на рассмотрение.
            </p>
            <Link
              href="/dashboard/gk_customer/projects/new"
              className="mt-7 inline-flex rounded-lg bg-[var(--tz-accent)] px-5 py-3 font-bold text-white transition hover:bg-[var(--tz-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tz-accent)]"
            >
              Создать первую заявку
            </Link>
          </div>
        ) : (
          <div>
            <h2 className="tz-card-title mb-4 text-tz-fg">Мои проекты</h2>
            <div className="grid gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/dashboard/project/${project.id}`}
                  className="grid gap-4 rounded-[14px] border border-tz-border bg-tz-surface p-5 transition hover:border-[var(--tz-accent)] md:grid-cols-[1fr_auto_auto]"
                >
                  <div>
                    <div className="font-mono text-xs text-tz-muted">ЦНТР-{project.id}</div>
                    <h3 className="mt-1 text-lg font-bold text-tz-fg">{project.name}</h3>
                    <p className="mt-1 text-sm text-tz-secondary">
                      {project.category ?? "Категория не указана"}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <div className="text-xs text-tz-muted">Текущий уровень</div>
                    <div className="mt-1 font-bold text-[var(--tz-accent)]">УГТ {project.current_level}</div>
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
    </section>
  );
}
