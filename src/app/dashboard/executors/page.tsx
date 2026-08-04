'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Filter,
  Search,
  CheckCircle,
  User,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface Executor {
  id: number;
  full_name: string;
  organization: string | null;
  role_slug: string;
  role_name: string;
  competencies: string[];
  completed_projects: number;
}

const ROLE_NAMES: Record<string, string> = {
  rd_executor: 'R&D-исполнитель',
  scientific_org: 'Научная организация',
  serial_manufacturer: 'Серийный производитель',
};

const ROLE_COLORS: Record<string, string> = {
  rd_executor: '#2E5BFF',
  scientific_org: '#10B981',
  serial_manufacturer: '#FF7A2E',
};

/** Русская плюрализация: 1 проект, 2 проекта, 5 проектов */
const pluralize = (n: number, one: string, few: string, many: string) => {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
};

/** Максимум чипов компетенций на карточке */
const MAX_COMPETENCIES = 5;

export default function ExecutorsPage() {
  const { data: session } = useSession();
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    const fetchData = async () => {
      try {
        const url = roleFilter !== 'all'
          ? `${API_URL}/api/v1/executors?role=${roleFilter}`
          : `${API_URL}/api/v1/executors`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (res.ok) setExecutors(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [session, roleFilter]);

  const filtered = executors.filter((e) =>
    !search || e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.organization?.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E5BFF] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-tz-fg">Каталог исполнителей</h1>
        <p className="mt-2 text-tz-muted">
          R&D-стартапы, научные организации и производители
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" />
          <input
            type="text"
            placeholder="Поиск по названию или организации..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-tz-border bg-tz-surface py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#2E5BFF]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-tz-muted" />
          {['all', 'rd_executor', 'scientific_org', 'serial_manufacturer'].map((slug) => (
            <button
              key={slug}
              onClick={() => setRoleFilter(slug)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                roleFilter === slug
                  ? 'bg-[#2E5BFF] text-white'
                  : 'bg-tz-surface-2 text-tz-secondary hover:bg-tz-soft'
              }`}
            >
              {slug === 'all' ? 'Все' : ROLE_NAMES[slug] ?? slug}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-tz-border bg-tz-surface p-12 text-center">
          <Building2 size={48} className="mx-auto mb-3 text-tz-muted" />
          <p className="font-medium text-tz-fg">
            {executors.length === 0 ? 'Исполнители не найдены' : 'Ничего не найдено'}
          </p>
          <p className="mt-1 text-sm text-tz-muted">
            {executors.length === 0
              ? 'В каталоге пока нет исполнителей'
              : 'Попробуйте изменить запрос или фильтр по роли'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exec) => (
            <motion.div
              key={exec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-tz-border bg-tz-surface p-5 transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                  style={{ background: ROLE_COLORS[exec.role_slug] ?? '#2E5BFF' }}
                >
                  {exec.full_name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {/* id<0 — организации НИОКТР, id>0 — пользователи */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      exec.id < 0
                        ? 'bg-tz-accent-soft text-tz-accent'
                        : 'bg-tz-success-soft text-tz-success'
                    }`}
                    title={exec.id < 0 ? 'Карточка организации' : 'Карточка пользователя'}
                  >
                    {exec.id < 0 ? <Building2 size={12} /> : <User size={12} />}
                    {exec.id < 0 ? 'Организация' : 'Пользователь'}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `${ROLE_COLORS[exec.role_slug] ?? '#2E5BFF'}15`,
                      color: ROLE_COLORS[exec.role_slug] ?? '#2E5BFF',
                    }}
                  >
                    {exec.role_name}
                  </span>
                </div>
              </div>
              <h3 className="mt-4 font-bold text-tz-fg">{exec.full_name}</h3>
              {exec.organization && (
                <p className="mt-1 flex items-center gap-1 text-sm text-tz-muted">
                  <Building2 size={14} /> {exec.organization}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4 text-sm text-tz-muted">
                <span className="flex items-center gap-1">
                  <CheckCircle size={14} className="text-[#10B981]" />
                  {exec.completed_projects}{' '}
                  {pluralize(exec.completed_projects, 'проект', 'проекта', 'проектов')}
                </span>
              </div>
              {exec.competencies && exec.competencies.length > 0 && (
                <div className="mt-3 border-t border-tz-border pt-3">
                  <p className="mb-1.5 text-xs text-tz-muted">Компетенции</p>
                  <div className="flex flex-wrap gap-1.5">
                    {exec.competencies.slice(0, MAX_COMPETENCIES).map((c) => (
                      <span
                        key={c}
                        className="rounded-full bg-tz-surface-2 px-2 py-0.5 text-xs text-tz-secondary"
                      >
                        {c}
                      </span>
                    ))}
                    {exec.competencies.length > MAX_COMPETENCIES && (
                      <span className="rounded-full bg-[#2E5BFF]/10 px-2 py-0.5 text-xs font-medium text-[#2E5BFF]">
                        +{exec.competencies.length - MAX_COMPETENCIES}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
