'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Beaker,
  Building2,
  Filter,
  RotateCcw,
  Search,
  Clock,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface Technology {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  status: string;
  current_level: number;
  target_level: number;
  organization: string | null;
  created_by_name: string | null;
  created_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активен',
  completed: 'Завершён',
  rejected: 'Отклонён',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#2E5BFF',
  completed: '#10B981',
  rejected: '#EF4444',
};

/** Категории из API реестра технологий */
const CATEGORIES = ['AI/ML', 'НИОКТР'];

/** Уровни УГТ по ГОСТ Р 58048-2017 (1–9) */
const UGT_LEVELS = Array.from({ length: 9 }, (_, i) => i + 1);

const levelOptions = (): Array<{ value: string; label: string }> => [
  { value: 'all', label: 'Любой' },
  ...UGT_LEVELS.map((l) => ({ value: String(l), label: `УГТ ${l}` })),
];

export default function TechnologiesPage() {
  const { data: session } = useSession();
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [minLevel, setMinLevel] = useState<string>('all');
  const [maxLevel, setMaxLevel] = useState<string>('all');

  useEffect(() => {
    if (!session?.user?.accessToken) return;
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (categoryFilter !== 'all') params.set('category', categoryFilter);
        if (minLevel !== 'all') params.set('min_level', minLevel);
        if (maxLevel !== 'all') params.set('max_level', maxLevel);
        const res = await fetch(
          `${API_URL}/api/v1/technologies?${params}`,
          { headers: { Authorization: `Bearer ${session.user.accessToken}` } },
        );
        if (res.ok) setTechnologies(await res.json());
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [session, statusFilter, categoryFilter, minLevel, maxLevel]);

  // Клиентская фильтрация поверх серверной: поиск + диапазон УГТ
  const filtered = technologies.filter((t) => {
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (minLevel !== 'all' && t.current_level < Number(minLevel)) return false;
    if (maxLevel !== 'all' && t.current_level > Number(maxLevel)) return false;
    return true;
  });

  const hasFilters = statusFilter !== 'all' || categoryFilter !== 'all' ||
    minLevel !== 'all' || maxLevel !== 'all' || search !== '';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setMinLevel('all');
    setMaxLevel('all');
  };

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
        <h1 className="text-3xl font-bold text-[#0F172A]">Реестр технологий</h1>
        <p className="mt-2 text-gray-500">
          Проекты, прошедшие оценку или находящиеся в разработке
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#2E5BFF]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500 mr-1">Статус:</span>
          {['all', 'draft', 'active', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-[#2E5BFF] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {STATUS_LABELS[s] ?? s}
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500 mr-1">Категория:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs outline-none"
          >
            <option value="all">Все</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="ml-2 text-sm text-gray-500 mr-1">УГТ от:</span>
          <select
            value={minLevel}
            onChange={(e) => setMinLevel(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs outline-none"
          >
            {levelOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 mr-1">до:</span>
          <select
            value={maxLevel}
            onChange={(e) => setMaxLevel(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs outline-none"
          >
            {levelOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              <RotateCcw size={12} />
              Сбросить
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <Beaker size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-[#0F172A]">
            {technologies.length === 0 ? 'Технологии не найдены' : 'Ничего не найдено'}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            {technologies.length === 0
              ? 'В реестре пока нет технологий'
              : 'Попробуйте изменить запрос или фильтры'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((tech) => {
            const sc = STATUS_COLORS[tech.status] ?? '#94A3B8';
            const progress = tech.target_level > 0
              ? Math.min(100, Math.round((tech.current_level / tech.target_level) * 100))
              : 0;
            return (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-bold text-[#0F172A]">{tech.name}</h3>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ background: `${sc}15`, color: sc }}
                  >
                    {STATUS_LABELS[tech.status] ?? tech.status}
                  </span>
                </div>
                {tech.description && (
                  <p className="mb-3 text-sm text-gray-500 line-clamp-2">{tech.description}</p>
                )}
                {tech.organization && (
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500">
                    <Building2 size={14} className="shrink-0 text-[#10B981]" />
                    <span>
                      Исполнитель: <span className="font-medium text-gray-600">{tech.organization}</span>
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Activity size={14} className="text-[#2E5BFF]" />
                    УГТ {tech.current_level} → {tech.target_level}
                  </span>
                  {tech.category && (
                    <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-[#FF7A2E]">
                      <Beaker size={12} />
                      {tech.category}
                    </span>
                  )}
                  {tech.created_by_name && (
                    <span className="flex items-center gap-1">
                      <Clock size={14} className="text-gray-400" />
                      {tech.created_by_name}
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400">Прогресс УГТ</span>
                    <span className="text-xs font-medium text-[#2E5BFF]">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2E5BFF] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
