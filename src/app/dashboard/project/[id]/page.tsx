'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUp,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  Shield,
  Users,
  XCircle,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

interface ProjectData {
  project: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    target_level: number;
    current_level: number;
    status: string;
    budget: number | null;
    created_by: number | null;
  };
  questionnaire_results: Array<{
    id: number;
    level_id: number;
    percentage: number;
    checked_items: string[];
  }>;
  control_points: Array<{
    id: number;
    title: string;
    description: string | null;
    point_type: string;
    status: string;
    decision: string | null;
  }>;
  documents: Array<{
    id: number;
    title: string;
    doc_type: string;
    status: string;
    version: number;
  }>;
  members: Array<{
    id: number;
    user_id: number;
    role_in_project: string;
  }>;
  audit_trail: Array<{
    id: number;
    user_id: number | null;
    action: string;
    details: Record<string, unknown>;
    created_at: string | null;
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  active: '#2E5BFF',
  completed: '#10B981',
  rejected: '#EF4444',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  active: 'Активен',
  completed: 'Завершён',
  rejected: 'Отклонён',
};

const UGT_LEVEL_NAMES = [
  'УГТ 1: Идея',
  'УГТ 2: Концепция',
  'УГТ 3: Эксперимент',
  'УГТ 4: Лаборатория',
  'УГТ 5: Прототип',
  'УГТ 6: Демонстратор',
  'УГТ 7: Опытный образец',
  'УГТ 8: Квалификация',
  'УГТ 9: Внедрение',
];

export default function ProjectDashboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<Array<{ level: string; progress: number; target: number }>>([]);

  useEffect(() => {
    if (!session?.user?.accessToken) return;

    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/projects/${params.id}`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) throw new Error('Failed to fetch');
        const data: ProjectData = await res.json();
        setProject(data);

        setRadarData(
          UGT_LEVEL_NAMES.map((name, i) => {
            const level = i + 1;
            const qr = data.questionnaire_results.find((r) => r.level_id === level);
            return {
              level: name.replace(/УГТ \d+:/, '').trim(),
              progress: qr ? Math.round(qr.percentage) : 0,
              target: level <= data.project.target_level ? 100 : 0,
            };
          }),
        );
      } catch {
        setProject(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [session, params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2E5BFF] border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <XCircle className="mx-auto mb-2 text-red-500" size={40} />
        <p className="text-lg font-semibold text-red-700">Проект не найден</p>
      </div>
    );
  }

  const { project: p } = project;
  const statusColor = STATUS_COLORS[p.status] ?? '#94A3B8';
  const userRoles: string[] = (session?.user?.roles as string[]) ?? [];
  const userRoleSet = new Set(userRoles);
  const canSeeBudget = userRoleSet.has('gk_customer') || userRoleSet.has('cntr_admin') || userRoleSet.has('investor');

  const kt1 = project.control_points.find((cp) => cp.point_type === 'gate' && cp.title.includes('КТ-1'));

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="inline-block rounded-full px-3 py-1 font-mono text-xs font-semibold"
              style={{ background: `${statusColor}20`, color: statusColor }}
            >
              {STATUS_LABELS[p.status] ?? p.status}
            </span>
            {p.category && (
              <span className="rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-500">
                {p.category}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A]">{p.name}</h1>
          {p.description && (
            <p className="mt-2 text-gray-500 max-w-2xl">{p.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Radar chart */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-[#2E5BFF]" />
                <h2 className="text-lg font-bold text-[#0F172A]">УГТ-профиль</h2>
              </div>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E8ECF0" />
                    <PolarAngleAxis
                      dataKey="level"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Цель"
                      dataKey="target"
                      stroke="#E5C840"
                      fill="#E5C840"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <Radar
                      name="Прогресс"
                      dataKey="progress"
                      stroke="#2E5BFF"
                      fill="#2E5BFF"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-6 rounded bg-[#2E5BFF]" />
                  <span className="text-gray-500">Текущий</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-6 rounded border-2 border-dashed border-[#E5C840]" />
                  <span className="text-gray-500">Цель</span>
                </div>
              </div>
            </div>

            {/* UGT Levels progress */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="text-lg font-bold text-[#0F172A] mb-4">Прогресс по уровням УГТ</h2>
              <div className="space-y-3">
                {UGT_LEVEL_NAMES.map((name, i) => {
                  const level = i + 1;
                  const qr = project.questionnaire_results.find((r) => r.level_id === level);
                  const progress = qr ? Math.round(qr.percentage) : 0;
                  const isCurrent = level === p.current_level;
                  const isTarget = level <= p.target_level;

                  return (
                    <div key={level} className="flex items-center gap-4">
                      <span className={`w-8 text-xs font-bold ${isCurrent ? 'text-[#2E5BFF]' : 'text-gray-400'}`}>
                        УГТ {level}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">{name.replace(/УГТ \d+: /, '')}</span>
                          <span className="text-xs text-gray-400">{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: progress >= 80 ? '#10B981' : progress >= 40 ? '#2E5BFF' : '#E5C840',
                            }}
                          />
                        </div>
                      </div>
                      {isCurrent && <ArrowUp size={16} className="text-[#2E5BFF]" />}
                      {!isTarget && <XCircle size={14} className="text-gray-300" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Control Points */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className="text-[#E5C840]" />
                <h2 className="text-lg font-bold text-[#0F172A]">Контрольные точки (КТ)</h2>
              </div>
              {project.control_points.length === 0 ? (
                <p className="text-sm text-gray-400">Контрольные точки не заданы</p>
              ) : (
                <div className="space-y-3">
                  {project.control_points.map((cp) => (
                    <div
                      key={cp.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div>
                        <p className="font-semibold text-[#0F172A]">{cp.title}</p>
                        {cp.description && (
                          <p className="mt-1 text-sm text-gray-500">{cp.description}</p>
                        )}
                        <span className="mt-1 inline-block rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                          {cp.point_type === 'gate' ? 'Ворота' : cp.point_type}
                        </span>
                      </div>
                      <div className="text-right">
                        {cp.status === 'approved' ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-green-600">
                            <CheckCircle size={16} /> Одобрено
                          </span>
                        ) : cp.status === 'rejected' ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-red-600">
                            <XCircle size={16} /> Отклонено
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-semibold text-yellow-600">
                            <Clock size={16} /> Ожидает
                          </span>
                        )}
                        {cp.decision && (
                          <p className="mt-1 text-xs text-gray-500">Решение: {cp.decision}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-[#FF7A2E]" />
                <h2 className="text-lg font-bold text-[#0F172A]">Документы</h2>
              </div>
              {project.documents.length === 0 ? (
                <p className="text-sm text-gray-400">Документы не загружены</p>
              ) : (
                <div className="space-y-2">
                  {project.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-gray-400" />
                        <div>
                          <p className="font-medium text-[#0F172A]">{doc.title}</p>
                          <p className="text-xs text-gray-400">
                            {doc.doc_type} · v{doc.version}
                          </p>
                        </div>
                      </div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: doc.status === 'approved' ? '#10B98120' : doc.status === 'draft' ? '#E5C84020' : '#94A3B820',
                          color: doc.status === 'approved' ? '#10B981' : doc.status === 'draft' ? '#E5C840' : '#94A3B8',
                        }}
                      >
                        {doc.status === 'approved' ? 'Утверждён' : doc.status === 'draft' ? 'Черновик' : doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Audit Trail */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-gray-400" />
                <h2 className="text-lg font-bold text-[#0F172A]">Аудит изменений</h2>
              </div>
              {project.audit_trail.length === 0 ? (
                <p className="text-sm text-gray-400">История изменений пуста</p>
              ) : (
                <div className="space-y-2">
                  {project.audit_trail.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="h-2 w-2 rounded-full bg-[#2E5BFF]" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#0F172A]">{entry.action}</p>
                        {entry.created_at && (
                          <p className="text-xs text-gray-400">
                            {new Date(entry.created_at).toLocaleString('ru-RU')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current level */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <Award size={20} className="text-[#2E5BFF]" />
                <h3 className="font-bold text-[#0F172A]">Уровень УГТ</h3>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-[#2E5BFF]">{p.current_level}</span>
                <span className="text-gray-400">/ {p.target_level}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2E5BFF]"
                  style={{ width: `${(p.current_level / p.target_level) * 100}%` }}
                />
              </div>
            </div>

            {/* KТ-1 Control Point */}
            {kt1 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={20} className="text-[#E5C840]" />
                  <h3 className="font-bold text-[#0F172A]">КТ-1: Старт проекта</h3>
                </div>
                <div
                  className={`rounded-xl p-4 ${
                    kt1.status === 'approved'
                      ? 'bg-green-50 border border-green-200'
                      : kt1.status === 'rejected'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-yellow-50 border border-yellow-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {kt1.status === 'approved' ? (
                      <>
                        <CheckCircle size={20} className="text-green-600" />
                        <span className="font-semibold text-green-700">Go: Проект одобрен</span>
                      </>
                    ) : kt1.status === 'rejected' ? (
                      <>
                        <XCircle size={20} className="text-red-600" />
                        <span className="font-semibold text-red-700">No-Go: Проект отклонён</span>
                      </>
                    ) : (
                      <>
                        <Clock size={20} className="text-yellow-600" />
                        <span className="font-semibold text-yellow-700">Ожидает решения</span>
                      </>
                    )}
                  </div>
                  {kt1.description && (
                    <p className="mt-2 text-sm text-gray-600">{kt1.description}</p>
                  )}
                </div>
              </div>
            )}

            {/* Team */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={20} className="text-[#10B981]" />
                <h3 className="font-bold text-[#0F172A]">Команда</h3>
              </div>
              {project.members.length === 0 ? (
                <p className="text-sm text-gray-400">Участники не назначены</p>
              ) : (
                <div className="space-y-2">
                  {project.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E5BFF] text-sm font-bold text-white">
                        {m.role_in_project[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">
                          {m.role_in_project}
                        </p>
                        <p className="text-xs text-gray-400">ID: {m.user_id}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget */}
            {canSeeBudget && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={20} className="text-[#10B981]" />
                  <h3 className="font-bold text-[#0F172A]">Бюджет</h3>
                </div>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {p.budget != null
                    ? `${p.budget.toLocaleString('ru-RU')} ₽`
                    : 'Не указан'}
                </p>
              </div>
            )}

            {/* Radar mini summary */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={20} className="text-[#E5C840]" />
                <h3 className="font-bold text-[#0F172A]">Общий прогресс</h3>
              </div>
              {project.questionnaire_results.length > 0 ? (
                <div className="space-y-2">
                  {project.questionnaire_results.map((qr) => (
                    <div key={qr.id} className="flex items-center gap-2">
                      <span className="w-16 text-xs text-gray-500">УГТ {qr.level_id}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#10B981]"
                          style={{ width: `${Math.round(qr.percentage)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">{Math.round(qr.percentage)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Нет данных</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
