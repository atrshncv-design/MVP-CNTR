'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  Check,
  CheckCircle,
  Clock,
  Copy,
  DollarSign,
  FileText,
  Loader2,
  RefreshCw,
  Share2,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
  X,
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
import StageProgressPanel from '@/components/stage-progress-panel';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

interface ProjectData {
  project: {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    target_level: number;
    current_level: number;
    preliminary_level?: number | null;
    status: string;
    budget: number | null;
    created_by: number | null;
    join_token: string | null;
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
  verification_documents: Array<{
    id: number;
    title: string;
    comment: string | null;
    file_ref: string | null;
    uploader_name: string | null;
    created_at: string | null;
  }>;
  members: Array<{
    id: number;
    user_id: number;
    role_in_project: string;
    is_priority: boolean;
  }>;
  audit_trail: Array<{
    id: number;
    user_id: number | null;
    action: string;
    details: Record<string, unknown>;
    created_at: string | null;
  }>;
}

interface GeneratedDocument {
  doc_type: string;
  title: string;
  content: string;
  template_id: number | null;
  variables: Record<string, string>;
  document_id: number | null;
}

interface JoinRequest {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role_in_project: string;
  status: string;
  invited_by: number | null;
  invited_by_name: string | null;
  is_priority: boolean;
  joined_at: string | null;
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

/** Типы генерируемых документов: ТЗ / Паспорт / ТЭО */
const DOC_TYPES = [
  { type: 'tz', label: 'Техническое задание', shortLabel: 'ТЗ' },
  { type: 'passport', label: 'Паспорт проекта', shortLabel: 'Паспорт' },
  { type: 'teo', label: 'Технико-экономическое обоснование', shortLabel: 'ТЭО' },
];

/** Роли, дающие приоритетный доступ к управлению проектом */
const PRIORITY_ROLES = new Set(['gk_customer', 'cntr_admin', 'cntr_manager']);

export default function ProjectDashboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState<Array<{ level: string; progress: number; target: number }>>([]);

  // Генерация документов
  const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Шаринг join-токена
  const [tokenCopied, setTokenCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Заявки на вступление
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<number | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const loadProject = useCallback(async () => {
    if (!session?.user?.accessToken || !params.id) return;

    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${params.id}`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data: ProjectData = await res.json();
      if (data.project.status === 'draft') {
        const assessmentRes = await fetch(`${API_URL}/api/v1/assessments/mine`, {
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (assessmentRes.ok) {
          const drafts = (await assessmentRes.json()) as Array<{ id: number; preliminary_level: number | null }>;
          const draft = drafts.find((item) => item.id === data.project.id);
          if (draft) data.project.preliminary_level = draft.preliminary_level;
        }
      }
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
  }, [session, params.id]);

  useEffect(() => {
    // setState внутри loadProject выполняется после await — не синхронно с телом эффекта
    (async () => {
      await loadProject();
    })();
  }, [loadProject]);

  const loadJoinRequests = useCallback(async () => {
    if (!session?.user?.accessToken || !params.id) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${params.id}/join-requests`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (res.ok) setJoinRequests((await res.json()) as JoinRequest[]);
    } catch {
      /* игнорируем — очередь просто останется пустой */
    } finally {
      setRequestsLoading(false);
    }
  }, [session, params.id]);

  /**
   * Приоритетный участник: роль gk_customer/cntr_admin/cntr_manager,
   * либо создатель проекта, либо участник с is_priority === true.
   */
  const isPriorityUser = useMemo(() => {
    if (!project || !session?.user?.id) return false;
    const uid = Number(session.user.id);
    const roles: string[] = (session.user.roles as string[]) ?? [];
    const byRole = roles.some((r) => PRIORITY_ROLES.has(r));
    const byCreator = project.project.created_by != null && project.project.created_by === uid;
    const byMember = project.members.some((m) => m.user_id === uid && m.is_priority);
    return byRole || byCreator || byMember;
  }, [project, session]);

  useEffect(() => {
    if (!isPriorityUser) return;
    // setState внутри loadJoinRequests выполняется после await
    (async () => {
      await loadJoinRequests();
    })();
  }, [isPriorityUser, loadJoinRequests]);

  /** Генерация документа (ТЗ / Паспорт / ТЭО) — доступна всем участникам */
  const generateDocument = useCallback(
    async (docType: string) => {
      if (!session?.user?.accessToken || !params.id) return;
      setGeneratingDoc(docType);
      setGenError(null);
      try {
        const res = await fetch(`${API_URL}/api/v1/projects/${params.id}/generate/${docType}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.user.accessToken}` },
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(
            detail
              ? `Ошибка генерации (${res.status}): ${detail.slice(0, 200)}`
              : `Ошибка генерации (${res.status})`,
          );
        }
        const data: GeneratedDocument = await res.json();
        setGeneratedDoc(data);
        // Обновляем список документов проекта
        await loadProject();
      } catch (e) {
        setGenError(e instanceof Error ? e.message : 'Не удалось сгенерировать документ.');
      } finally {
        setGeneratingDoc(null);
      }
    },
    [session, params.id, loadProject],
  );

  /** Регенерация join-токена — только приоритетным участникам */
  const regenerateToken = useCallback(async () => {
    if (!session?.user?.accessToken || !params.id) return;
    setRegenerating(true);
    setShareError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${params.id}/regenerate-token`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) throw new Error(`Ошибка регенерации токена (${res.status})`);
      const data = (await res.json()) as { join_token: string };
      setProject((prev) => (prev ? { ...prev, project: { ...prev.project, join_token: data.join_token } } : prev));
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Не удалось обновить токен.');
    } finally {
      setRegenerating(false);
    }
  }, [session, params.id]);

  /** Копирование ссылки для вступления по join-токену */
  const copyJoinLink = useCallback(async () => {
    const token = project?.project.join_token;
    if (!token) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/join/${token}`);
      setTokenCopied(true);
      window.setTimeout(() => setTokenCopied(false), 2000);
    } catch {
      setShareError('Не удалось скопировать ссылку — скопируйте токен вручную.');
    }
  }, [project]);

  /** Одобрение / отклонение заявки на вступление */
  const decideJoinRequest = useCallback(
    async (memberId: number, approve: boolean) => {
      if (!session?.user?.accessToken || !params.id) return;
      setDecidingId(memberId);
      setRequestsError(null);
      try {
        const res = await fetch(`${API_URL}/api/v1/projects/${params.id}/join-requests/${memberId}/decide`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.user.accessToken}`,
          },
          body: JSON.stringify({ approve }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(
            detail
              ? `Ошибка (${res.status}): ${detail.slice(0, 200)}`
              : `Ошибка обработки заявки (${res.status})`,
          );
        }
        await loadJoinRequests();
      } catch (e) {
        setRequestsError(e instanceof Error ? e.message : 'Не удалось обработать заявку.');
      } finally {
        setDecidingId(null);
      }
    },
    [session, params.id, loadJoinRequests],
  );

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
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className="tz-badge font-mono text-xs font-semibold"
                style={{ background: `${statusColor}20`, color: statusColor }}
              >
                {STATUS_LABELS[p.status] ?? p.status}
              </span>
              {p.category && (
                <span className="tz-badge tz-badge-neutral">{p.category}</span>
              )}
              <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>
            </div>
            <h1 className="tz-page-title">{p.name}</h1>
            {p.description && (
              <p className="mt-2 max-w-2xl text-tz-muted">{p.description}</p>
            )}
          </div>
          <div className="tz-card shrink-0 px-4 py-3">
            <div className="tz-eyebrow">Уровень УГТ</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="tz-ugt">{p.status === 'draft' ? `Предварительный УГТ ${p.preliminary_level ?? '—'}` : `УГТ ${p.current_level}`}</span>
              <ArrowRight size={14} className="text-tz-muted" aria-hidden="true" />
              <span className="tz-ugt tz-ugt-strong">{p.target_level}</span>
            </div>
            <p className="mt-1 text-xs text-tz-muted">по ГОСТ Р 58048-2017</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            <StageProgressPanel projectId={p.id} currentLevel={p.current_level} status={p.status} />
            {/* Radar chart */}
            <div className="tz-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={20} className="text-[#2E5BFF]" />
                <h2 className="text-lg font-bold text-tz-fg">УГТ-профиль</h2>
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
            <div className="tz-card p-6">
              <h2 className="text-lg font-bold text-tz-fg mb-4">Прогресс по уровням УГТ</h2>
              <div className="space-y-3">
                {UGT_LEVEL_NAMES.map((name, i) => {
                  const level = i + 1;
                  const qr = project.questionnaire_results.find((r) => r.level_id === level);
                  const progress = qr ? Math.round(qr.percentage) : 0;
                  const isCurrent = level === p.current_level;
                  const isTarget = level <= p.target_level;

                  return (
                    <div key={level} className="flex items-center gap-4">
                      <span className={`w-9 font-mono text-xs font-bold ${isCurrent ? 'text-tz-accent' : 'text-tz-muted'}`}>
                        УГТ {level}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-600">{name.replace(/УГТ \d+: /, '')}</span>
                          <span className="text-xs text-gray-400">{progress}%</span>
                        </div>
                        <div className="tz-progress">
                          <div
                            className="tz-progress-fill"
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
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={20} className="text-[#E5C840]" />
                <h2 className="text-lg font-bold text-tz-fg">Контрольные точки (КТ)</h2>
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
                        <p className="font-semibold text-tz-fg">{cp.title}</p>
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
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText size={20} className="text-[#FF7A2E]" />
                <h2 className="text-lg font-bold text-tz-fg">Документы</h2>
              </div>

              {/* Генерация документов — доступна всем участникам */}
              <div className="mb-4 flex flex-wrap gap-2">
                {DOC_TYPES.map((doc) => (
                  <button
                    key={doc.type}
                    onClick={() => generateDocument(doc.type)}
                    disabled={generatingDoc !== null}
                    title={doc.label}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2E5BFF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#244BD9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingDoc === doc.type ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <FileText size={15} />
                    )}
                    Сгенерировать {doc.shortLabel}
                  </button>
                ))}
              </div>
              {genError && <p className="mb-4 text-sm font-medium text-red-600">{genError}</p>}

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
                          <p className="font-medium text-tz-fg">{doc.title}</p>
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

            {/* Верифицирующие документы (подтверждение УГТ от регулирующей организации / участников) */}
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck size={20} className="text-[#10B981]" />
                <h2 className="text-lg font-bold text-tz-fg">Верифицирующие документы</h2>
                {project.verification_documents.length > 0 && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                    {project.verification_documents.length}
                  </span>
                )}
              </div>
              {project.verification_documents.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Документы подтверждения УГТ не загружены. Регулирующая организация
                  или участники могут добавить их после вступления в проект.
                </p>
              ) : (
                <div className="space-y-2">
                  {project.verification_documents.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start justify-between gap-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="font-medium text-tz-fg">{v.title}</p>
                          <p className="text-xs text-gray-500">
                            {v.uploader_name ?? 'Пользователь'}
                            {v.created_at ? ` · ${new Date(v.created_at).toLocaleDateString('ru-RU')}` : ''}
                          </p>
                          {v.comment && <p className="mt-1 text-xs text-gray-500">{v.comment}</p>}
                          {v.file_ref && (
                            <p className="mt-1 break-all font-mono text-xs text-gray-400">{v.file_ref}</p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Подтверждение УГТ
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Join requests — только приоритетным участникам */}
            {isPriorityUser && (
              <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus size={20} className="text-[#10B981]" />
                  <h2 className="text-lg font-bold text-tz-fg">Заявки на вступление</h2>
                  {joinRequests.length > 0 && (
                    <span className="ml-auto rounded-full bg-[#2E5BFF] px-2.5 py-0.5 text-xs font-semibold text-white">
                      {joinRequests.length}
                    </span>
                  )}
                </div>
                {requestsError && <p className="mb-3 text-sm font-medium text-red-600">{requestsError}</p>}
                {requestsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={20} className="animate-spin text-[#2E5BFF]" />
                  </div>
                ) : joinRequests.length === 0 ? (
                  <p className="text-sm text-gray-400">Новых заявок нет</p>
                ) : (
                  <div className="space-y-3">
                    {joinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-tz-fg">{req.user_name}</p>
                          <p className="text-xs text-gray-500">{req.user_email}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="inline-block rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                              {req.role_in_project}
                            </span>
                            {req.invited_by_name && (
                              <span className="text-xs text-gray-400">
                                пригласил: {req.invited_by_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => decideJoinRequest(req.id, true)}
                            disabled={decidingId === req.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#10B981] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0EA371] disabled:opacity-50"
                          >
                            <Check size={14} /> Одобрить
                          </button>
                          <button
                            onClick={() => decideJoinRequest(req.id, false)}
                            disabled={decidingId === req.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            <XCircle size={14} /> Отклонить
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Audit Trail */}
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} className="text-gray-400" />
                <h2 className="text-lg font-bold text-tz-fg">Аудит изменений</h2>
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
                        <p className="text-sm font-medium text-tz-fg">{entry.action}</p>
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
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-3">
                <Award size={20} className="text-[#2E5BFF]" />
                <h3 className="font-bold text-tz-fg">Уровень УГТ</h3>
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
              <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={20} className="text-[#E5C840]" />
                  <h3 className="font-bold text-tz-fg">КТ-1: Старт проекта</h3>
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

            {/* Share project — только приоритетным участникам */}
            {isPriorityUser && (
              <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Share2 size={20} className="text-[#2E5BFF]" />
                  <h3 className="font-bold text-tz-fg">Поделиться проектом</h3>
                </div>
                {p.join_token ? (
                  <>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[#2E5BFF]/40 bg-[#EAF0FF] px-3 py-2.5">
                      <span className="font-mono text-sm font-bold text-[#2E5BFF]">{p.join_token}</span>
                      <button
                        onClick={copyJoinLink}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#2E5BFF] transition hover:bg-[#2E5BFF]/10"
                      >
                        {tokenCopied ? (
                          <>
                            <Check size={13} /> Скопировано
                          </>
                        ) : (
                          <>
                            <Copy size={13} /> Копировать
                          </>
                        )}
                      </button>
                    </div>
                    <p className="mt-2 break-all text-xs text-gray-400">
                      Ссылка для вступления: /join/{p.join_token}
                    </p>
                    <button
                      onClick={regenerateToken}
                      disabled={regenerating}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {regenerating ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Сгенерировать новый токен
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Токен ещё не выпущен</p>
                )}
                {shareError && <p className="mt-2 text-xs font-medium text-red-600">{shareError}</p>}
              </div>
            )}

            {/* Team */}
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-3">
                <Users size={20} className="text-[#10B981]" />
                <h3 className="font-bold text-tz-fg">Команда</h3>
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
                        <p className="text-sm font-medium text-tz-fg">
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
              <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={20} className="text-[#10B981]" />
                  <h3 className="font-bold text-tz-fg">Бюджет</h3>
                </div>
                <p className="text-2xl font-bold text-tz-fg">
                  {p.budget != null
                    ? `${p.budget.toLocaleString('ru-RU')} ₽`
                    : 'Не указан'}
                </p>
              </div>
            )}

            {/* Radar mini summary */}
            <div className="rounded-2xl border border-gray-200 bg-tz-surface p-6">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={20} className="text-[#E5C840]" />
                <h3 className="font-bold text-tz-fg">Общий прогресс</h3>
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

      {/* Модалка с текстом сгенерированного документа */}
      {generatedDoc && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          onClick={() => setGeneratedDoc(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl rounded-2xl bg-tz-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-gray-400">
                  Сгенерированный документ
                </p>
                <h3 className="mt-1 text-lg font-bold text-tz-fg">{generatedDoc.title}</h3>
              </div>
              <button
                onClick={() => setGeneratedDoc(null)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-700">
                {generatedDoc.content}
              </pre>
            </div>
            <div className="flex justify-end border-t border-gray-100 p-4">
              <button
                onClick={() => setGeneratedDoc(null)}
                className="rounded-lg bg-[#2E5BFF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244BD9]"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
