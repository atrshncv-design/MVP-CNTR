'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Activity,
  Archive,
  ArrowRight,
  Download,
  Globe,
  ArrowUp,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Eye,
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
import ProjectTeamPanel from '@/components/project-team-panel';
import ProjectFilesPanel from '@/components/project-files-panel';
import RequestCommentsPanel from '@/components/request-comments-panel';
import UgtTrajectory from '@/components/dashboard/ugt-trajectory';
import { AchievementsCollection } from '@/components/achievements-collection';
import { useBreadcrumb } from '@/components/dashboard/dashboard-breadcrumb';
import type { ProjectDetail as ProjectData } from '@/lib/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

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
  draft: 'var(--tz-neutral)',
  auto_confirmed: 'var(--tz-success)',
  published: 'var(--tz-accent)',
  active: 'var(--tz-accent)',
  completed: 'var(--tz-success)',
  rejected: 'var(--tz-danger)',
  archived: 'var(--tz-neutral)',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  auto_confirmed: 'Подтверждён автоматически',
  published: 'Опубликован',
  active: 'Активен',
  completed: 'Завершён',
  rejected: 'Отклонён',
  archived: 'В архиве',
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

  // Просмотр сохранённого контента документа (BE-LOGIC-004)
  const [viewingDoc, setViewingDoc] = useState<{ title: string; content: string } | null>(null);

  // Шаринг join-токена
  const [tokenCopied, setTokenCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Публикация в реестре (тикет 10)
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const togglePublication = async () => {
    if (!session?.user?.accessToken || !project) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${project.project.id}/publish`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session.user.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_public: !project.project.is_public,
          show_preliminary: project.project.show_preliminary ?? false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          typeof data?.detail === 'string' ? data.detail : `Ошибка публикации (${res.status})`,
        );
      }
      const updated = await res.json();
      setProject((prev) =>
        prev ? { ...prev, project: { ...prev.project, is_public: updated.is_public } } : prev,
      );
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : 'Не удалось изменить публикацию');
    } finally {
      setPublishing(false);
    }
  };

  // Архив и экспорт (тикет 13)
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const archiveProject = async () => {
    if (!session?.user?.accessToken || !project) return;
    setArchiving(true);
    setArchiveError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${project.project.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.detail === 'string' ? data.detail : `Ошибка (${res.status})`);
      }
      const updated = await res.json();
      setProject((prev) => (prev ? { ...prev, project: { ...prev.project, status: updated.status } } : prev));
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : 'Не удалось архивировать');
    } finally {
      setArchiving(false);
    }
  };

  const exportProject = async () => {
    if (!session?.user?.accessToken || !project) return;
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${project.project.id}/export`, {
        headers: { Authorization: `Bearer ${session.user.accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.detail === 'string' ? data.detail : `Ошибка (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${project.project.id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : 'Не удалось сформировать экспорт');
    } finally {
      setExporting(false);
    }
  };

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

  /** Хлебные крошки (тикет 03): Рабочий стол / Проекты / <название проекта>. */
  const breadcrumbItems = useMemo(
    () =>
      project
        ? [
            { label: 'Проекты', href: '/dashboard/projects' },
            { label: project.project.name },
          ]
        : null,
    [project],
  );
  useBreadcrumb(breadcrumbItems);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--tz-accent)] border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
        <XCircle className="mx-auto mb-2 text-tz-danger" size={40} />
        <p className="text-lg font-semibold text-tz-danger">Проект не найден</p>
      </div>
    );
  }

  const { project: p } = project;
  const statusColor = STATUS_COLORS[p.status] ?? 'var(--tz-neutral)';
  const userRoles: string[] = (session?.user?.roles as string[]) ?? [];
  const userRoleSet = new Set(userRoles);
  const canSeeBudget = userRoleSet.has('gk_customer') || userRoleSet.has('cntr_admin') || userRoleSet.has('investor');

  const kt1 = project.control_points.find((cp) => cp.point_type === 'gate' && cp.title.includes('КТ-1'));

  /** Форматирование даты для сводки (— если дата отсутствует). */
  const formatDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Шапка (часть «Сводка»): имя, описание, бейджи */}
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.7fr)] lg:items-end">
          <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className="tz-badge font-mono text-xs font-semibold"
              style={{ background: `${statusColor}20`, color: statusColor }}
            >
              {STATUS_LABELS[p.status] ?? p.status}
            </span>
            {p.category && <span className="tz-badge tz-badge-neutral">{p.category}</span>}
            <span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span>
          </div>
          <h1 className="tz-page-title break-words">{p.name}</h1>
          {p.description && <p className="mt-2 max-w-2xl text-tz-muted">{p.description}</p>}
          </div>
          <AchievementsCollection projectId={p.id} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Основная колонка: сводка → статус/УГТ → документы → команда → история → аналитика */}
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <UgtTrajectory currentLevel={p.current_level} targetLevel={Math.min(p.current_level + 1, 9)} onAddDocuments={() => document.querySelector('[data-od-id="stage-progress"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
            {/* 1. Сводка */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-summary">
              <h2 id="project-summary" className="tz-card-title mb-4 text-tz-fg">Сводка</h2>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-tz-muted">Категория</dt>
                  <dd className="mt-1 break-words text-sm font-medium text-tz-fg">{p.category ?? 'Не указана'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-tz-muted">Идентификатор</dt>
                  <dd className="mt-1 font-mono text-sm font-medium text-tz-fg">ЦНТР-{p.id}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-tz-muted">Создан</dt>
                  <dd className="mt-1 text-sm font-medium text-tz-fg">{formatDate(p.created_at)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-tz-muted">Обновлён</dt>
                  <dd className="mt-1 text-sm font-medium text-tz-fg">{formatDate(p.updated_at)}</dd>
                </div>
                {p.created_by != null && (
                  <div className="min-w-0">
                    <dt className="text-xs text-tz-muted">Создатель (ID)</dt>
                    <dd className="mt-1 font-mono text-sm font-medium text-tz-fg">{p.created_by}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* 2. Статус и УГТ */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-status">
              <h2 id="project-status" className="tz-card-title mb-4 text-tz-fg">Статус и УГТ</h2>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="tz-badge font-mono text-xs font-semibold"
                    style={{ background: `${statusColor}20`, color: statusColor }}
                  >
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                  <span className="text-sm text-tz-muted">по ГОСТ Р 58048-2017</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-tz-border bg-tz-soft px-4 py-3">
                    <div className="tz-eyebrow">Уровень УГТ</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="tz-ugt">{`УГТ ${p.current_level}`}</span>
                      <ArrowRight size={14} className="text-tz-muted" aria-hidden="true" />
                      <span className="tz-ugt tz-ugt-strong">{p.target_level}</span>
                    </div>
                    {p.preliminary_level != null && p.preliminary_level !== p.current_level && (
                      <p className="mt-1 text-xs text-tz-muted">Предварительный: УГТ {p.preliminary_level}</p>
                    )}
                  </div>
                  <p className="max-w-xs text-sm text-tz-muted">
                    {UGT_LEVEL_NAMES[p.current_level - 1] ?? `УГТ ${p.current_level}`} →{' '}
                    {UGT_LEVEL_NAMES[p.target_level - 1] ?? `УГТ ${p.target_level}`}
                  </p>
                </div>

                {/* КТ-1: стартовые ворота проекта */}
                {kt1 && (
                  <div
                    className={`rounded-xl p-4 ${
                      kt1.status === 'approved'
                        ? 'bg-tz-success-soft border border-tz-success/30'
                        : kt1.status === 'rejected'
                          ? 'bg-tz-danger-soft border border-tz-danger'
                          : 'bg-tz-warning-soft border border-tz-warning/30'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {kt1.status === 'approved' ? (
                        <>
                          <CheckCircle size={20} className="text-tz-success" />
                          <span className="font-semibold text-tz-success">КТ-1: Go — проект одобрен</span>
                        </>
                      ) : kt1.status === 'rejected' ? (
                        <>
                          <XCircle size={20} className="text-tz-danger" />
                          <span className="font-semibold text-tz-danger">КТ-1: No-Go — проект отклонён</span>
                        </>
                      ) : (
                        <>
                          <Clock size={20} className="text-tz-warning" />
                          <span className="font-semibold text-tz-warning">КТ-1: Ожидает решения</span>
                        </>
                      )}
                    </div>
                    {kt1.description && <p className="mt-2 text-sm text-tz-secondary">{kt1.description}</p>}
                  </div>
                )}

                {/* Контрольные точки (ворота) */}
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-tz-fg">
                    <Shield size={16} className="text-[var(--tz-review)]" />
                    Контрольные точки
                  </h3>
                  {project.control_points.length === 0 ? (
                    <p className="text-sm text-tz-muted">Контрольные точки не заданы</p>
                  ) : (
                    <ul className="space-y-2">
                      {project.control_points.map((cp) => (
                        <li
                          key={cp.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-tz-border bg-tz-soft p-3"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-tz-fg">{cp.title}</p>
                            {cp.description && <p className="mt-0.5 text-sm text-tz-muted">{cp.description}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            {cp.status === 'approved' ? (
                              <span className="flex items-center gap-1 text-sm font-semibold text-tz-success">
                                <CheckCircle size={15} /> Одобрено
                              </span>
                            ) : cp.status === 'rejected' ? (
                              <span className="flex items-center gap-1 text-sm font-semibold text-tz-danger">
                                <XCircle size={15} /> Отклонено
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-sm font-semibold text-tz-warning">
                                <Clock size={15} /> Ожидает
                              </span>
                            )}
                            {cp.decision && <p className="mt-0.5 text-xs text-tz-muted">Решение: {cp.decision}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* Этап доработки (подблок «Статус и УГТ» — продвижение к следующему уровню) */}
            <StageProgressPanel projectId={p.id} currentLevel={p.current_level} status={p.status} />

            {/* 3. Документы */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-documents">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <FileText size={20} className="text-[var(--tz-ugt-2)]" />
                <h2 id="project-documents" className="tz-card-title text-tz-fg">Документы</h2>
              </div>

              {/* Генерация документов — доступна всем участникам */}
              <div className="mb-4 flex flex-wrap gap-2">
                {DOC_TYPES.map((doc) => (
                  <button
                    key={doc.type}
                    onClick={() => generateDocument(doc.type)}
                    disabled={generatingDoc !== null}
                    title={doc.label}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--tz-accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--tz-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
              {genError && <p className="mb-4 text-sm font-medium text-tz-danger">{genError}</p>}

              {project.documents.length === 0 ? (
                <p className="text-sm text-tz-muted">Документы не загружены</p>
              ) : (
                <ul className="space-y-2">
                  {project.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-tz-border p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText size={18} className="shrink-0 text-tz-muted" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-tz-fg">{doc.title}</p>
                          <p className="text-xs text-tz-muted">{doc.doc_type} · v{doc.version}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {doc.file_url && (
                          <button
                            onClick={() => setViewingDoc({ title: doc.title, content: doc.file_url ?? '' })}
                            className="inline-flex items-center gap-1 rounded-lg border border-tz-border bg-tz-bg px-2.5 py-1.5 text-xs font-medium text-tz-secondary transition hover:border-tz-accent hover:text-tz-accent"
                          >
                            <Eye size={14} /> Просмотр
                          </button>
                        )}
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: doc.status === 'approved' ? 'var(--tz-success)20' : doc.status === 'draft' ? 'var(--tz-review)20' : 'var(--tz-neutral)20',
                            color: doc.status === 'approved' ? 'var(--tz-success)' : doc.status === 'draft' ? 'var(--tz-review)' : 'var(--tz-neutral)',
                          }}
                        >
                          {doc.status === 'approved' ? 'Утверждён' : doc.status === 'draft' ? 'Черновик' : doc.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Верифицирующие документы (подтверждение УГТ) */}
              <h3 className="mb-3 mt-6 flex flex-wrap items-center gap-2 text-sm font-semibold text-tz-fg">
                <ShieldCheck size={16} className="text-tz-success" />
                Верифицирующие документы
                {project.verification_documents.length > 0 && (
                  <span className="rounded-full bg-tz-success-soft px-2.5 py-0.5 text-xs font-semibold text-tz-success">
                    {project.verification_documents.length}
                  </span>
                )}
              </h3>
              {project.verification_documents.length === 0 ? (
                <p className="text-sm text-tz-muted">
                  Документы подтверждения УГТ не загружены. Регулирующая организация
                  или участники могут добавить их после вступления в проект.
                </p>
              ) : (
                <ul className="space-y-2">
                  {project.verification_documents.map((v) => (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-tz-success bg-tz-success-soft/40 p-3"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-tz-success" />
                        <div className="min-w-0">
                          <p className="font-medium text-tz-fg">{v.title}</p>
                          <p className="text-xs text-tz-muted">
                            {v.uploader_name ?? 'Пользователь'}
                            {v.created_at ? ` · ${new Date(v.created_at).toLocaleDateString('ru-RU')}` : ''}
                          </p>
                          {v.comment && <p className="mt-1 text-xs text-tz-muted">{v.comment}</p>}
                          {v.file_ref && <p className="mt-1 break-all font-mono text-xs text-tz-muted">{v.file_ref}</p>}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-tz-success-soft px-2 py-0.5 text-xs font-medium text-tz-success">
                        Подтверждение УГТ
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Файлы проекта (подблок «Документы») */}
            <ProjectFilesPanel projectId={p.id} />

            {/* 4. Команда */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-team">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Users size={20} className="text-[var(--tz-success)]" />
                <h2 id="project-team" className="tz-card-title text-tz-fg">Команда</h2>
              </div>
              {project.members.length === 0 ? (
                <p className="text-sm text-tz-muted">Участники не назначены</p>
              ) : (
                <ul className="space-y-2">
                  {project.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-lg border border-tz-border p-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--tz-accent)] text-sm font-bold text-white">
                        {m.role_in_project[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-tz-fg">{m.role_in_project}</p>
                        <p className="text-xs text-tz-muted">ID: {m.user_id}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Заявки на вступление — только приоритетным участникам */}
              {isPriorityUser && (
                <div className="mt-6">
                  <h3 className="mb-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-tz-fg">
                    <UserPlus size={16} className="text-tz-success" />
                    Заявки на вступление
                    {joinRequests.length > 0 && (
                      <span className="rounded-full bg-[var(--tz-accent)] px-2.5 py-0.5 text-xs font-semibold text-white">
                        {joinRequests.length}
                      </span>
                    )}
                  </h3>
                  {requestsError && <p className="mb-3 text-sm font-medium text-tz-danger">{requestsError}</p>}
                  {requestsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={20} className="animate-spin text-[var(--tz-accent)]" />
                    </div>
                  ) : joinRequests.length === 0 ? (
                    <p className="text-sm text-tz-muted">Новых заявок нет</p>
                  ) : (
                    <ul className="space-y-3">
                      {joinRequests.map((req) => (
                        <li
                          key={req.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-tz-border bg-tz-soft p-4"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-tz-fg">{req.user_name}</p>
                            <p className="text-xs text-tz-muted">{req.user_email}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="inline-block rounded bg-tz-soft px-2 py-0.5 text-xs text-tz-secondary">
                                {req.role_in_project}
                              </span>
                              {req.invited_by_name && (
                                <span className="text-xs text-tz-muted">пригласил: {req.invited_by_name}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => decideJoinRequest(req.id, true)}
                              disabled={decidingId === req.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-[var(--tz-success)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--tz-success)] disabled:opacity-50"
                            >
                              <Check size={14} /> Одобрить
                            </button>
                            <button
                              onClick={() => decideJoinRequest(req.id, false)}
                              disabled={decidingId === req.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-tz-danger-soft px-3 py-2 text-xs font-semibold text-tz-danger transition hover:bg-red-600 disabled:opacity-50"
                            >
                              <XCircle size={14} /> Отклонить
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Приглашения в команду (подблок «Команда») */}
            <ProjectTeamPanel projectId={p.id} />

            {/* 5. История */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-history">
              <div className="mb-4 flex items-center gap-2">
                <Clock size={20} className="text-tz-muted" />
                <h2 id="project-history" className="tz-card-title text-tz-fg">История</h2>
              </div>
              {project.audit_trail.length === 0 ? (
                <p className="text-sm text-tz-muted">История изменений пуста</p>
              ) : (
                <ol className="space-y-2">
                  {project.audit_trail.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 rounded-lg border border-tz-border p-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--tz-accent)]" />
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium text-tz-fg">{entry.action}</p>
                        {entry.created_at && (
                          <p className="text-xs text-tz-muted">{new Date(entry.created_at).toLocaleString('ru-RU')}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* Заявки и обсуждение (хронология активности — подблок «История») */}
            <RequestCommentsPanel projectId={p.id} />

            {/* 6. Аналитика */}
            <section className="rounded-2xl border border-tz-border bg-tz-surface p-6" aria-labelledby="project-analytics">
              <div className="mb-4 flex items-center gap-2">
                <Activity size={20} className="text-[var(--tz-accent)]" />
                <h2 id="project-analytics" className="tz-card-title text-tz-fg">Аналитика</h2>
              </div>

              <h3 className="mb-3 text-sm font-semibold text-tz-fg">УГТ-профиль</h3>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--tz-border)" />
                    <PolarAngleAxis dataKey="level" tick={{ fontSize: 11, fill: 'var(--tz-muted)' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Цель"
                      dataKey="target"
                      stroke="var(--tz-review)"
                      fill="var(--tz-review)"
                      fillOpacity={0.1}
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <Radar
                      name="Прогресс"
                      dataKey="progress"
                      stroke="var(--tz-accent)"
                      fill="var(--tz-accent)"
                      fillOpacity={0.15}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-6 rounded bg-[var(--tz-accent)]" />
                  <span className="text-tz-muted">Текущий</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-6 rounded border-2 border-dashed border-[var(--tz-review)]" />
                  <span className="text-tz-muted">Цель</span>
                </div>
              </div>

              <h3 className="mb-3 mt-6 text-sm font-semibold text-tz-fg">Прогресс по уровням УГТ</h3>
              <div className="space-y-3">
                {UGT_LEVEL_NAMES.map((name, i) => {
                  const level = i + 1;
                  const qr = project.questionnaire_results.find((r) => r.level_id === level);
                  const progress = qr ? Math.round(qr.percentage) : 0;
                  const isCurrent = level === p.current_level;
                  const isTarget = level <= p.target_level;
                  return (
                    <div key={level} className="flex items-center gap-4">
                      <span className={`w-9 shrink-0 font-mono text-xs font-bold ${isCurrent ? 'text-tz-accent' : 'text-tz-muted'}`}>
                        УГТ {level}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm text-tz-secondary">{name.replace(/УГТ \d+: /, '')}</span>
                          <span className="shrink-0 text-xs text-tz-muted">{progress}%</span>
                        </div>
                        <div className="tz-progress">
                          <div
                            className="tz-progress-fill"
                            style={{
                              width: `${progress}%`,
                              background: progress >= 80 ? 'var(--tz-success)' : progress >= 40 ? 'var(--tz-accent)' : 'var(--tz-review)',
                            }}
                          />
                        </div>
                      </div>
                      {isCurrent && <ArrowUp size={16} className="shrink-0 text-[var(--tz-accent)]" />}
                      {!isTarget && <XCircle size={14} className="shrink-0 text-tz-muted" />}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Боковая колонка: бюджет и публикация */}
          <aside className="min-w-0 space-y-6">
            {/* Бюджет */}
            {canSeeBudget && (
              <div className="rounded-2xl border border-tz-border bg-tz-surface p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span aria-hidden="true" className="font-mono text-2xl leading-none text-[var(--tz-success)]">₽</span>
                  <h3 className="font-bold text-tz-fg">Бюджет</h3>
                </div>
                <p className="break-words text-2xl font-bold text-tz-fg">
                  {p.budget != null ? `${p.budget.toLocaleString('ru-RU')} ₽` : 'Не указан'}
                </p>
              </div>
            )}

            {/* Публикация в реестре (тикет 10) */}
            <div className="rounded-2xl border border-tz-border bg-tz-surface p-6">
              <div className="mb-3 flex items-center gap-2">
                <Globe size={20} className="text-[var(--tz-accent)]" />
                <h3 className="font-bold text-tz-fg">Публикация в реестре</h3>
              </div>
              <p className="mb-3 text-sm text-tz-muted">
                {p.is_public
                  ? 'Проект виден в общем реестре и реестре технологий.'
                  : 'Проект скрыт из реестров. Публикация доступна после подтверждения УГТ.'}
              </p>
              {publishError && (
                <p role="alert" className="mb-3 text-sm text-tz-danger">{publishError}</p>
              )}
              <button
                onClick={() => void togglePublication()}
                disabled={publishing}
                className={`tz-btn w-full ${p.is_public ? 'tz-btn-secondary' : 'tz-btn-primary'}`}
              >
                {publishing ? <Loader2 size={15} className="animate-spin" /> : null}
                {p.is_public ? 'Скрыть из реестра' : 'Опубликовать'}
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {p.status !== 'archived' ? (
                  <button onClick={() => void archiveProject()} disabled={archiving} className="tz-btn tz-btn-ghost text-sm">
                    {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} В архив
                  </button>
                ) : (
                  <span className="tz-btn tz-btn-ghost text-sm opacity-60">В архиве</span>
                )}
                <button onClick={() => void exportProject()} disabled={exporting} className="tz-btn tz-btn-ghost text-sm">
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Экспорт
                </button>
              </div>
              {archiveError && (
                <p role="alert" className="mt-2 text-sm text-tz-danger">{archiveError}</p>
              )}
            </div>

            {/* Поделиться проектом — только приоритетным участникам */}
            {isPriorityUser && (
              <div className="rounded-2xl border border-tz-border bg-tz-surface p-6">
                <div className="mb-3 flex items-center gap-2">
                  <Share2 size={20} className="text-[var(--tz-accent)]" />
                  <h3 className="font-bold text-tz-fg">Поделиться проектом</h3>
                </div>
                {p.join_token ? (
                  <>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-[var(--tz-accent)]/40 bg-[var(--tz-accent-soft)] px-3 py-2.5">
                      <span className="break-all font-mono text-sm font-bold text-[var(--tz-accent)]">{p.join_token}</span>
                      <button
                        onClick={copyJoinLink}
                        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[var(--tz-accent)] transition hover:bg-[var(--tz-accent)]/10"
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
                    <p className="mt-2 break-all text-xs text-tz-muted">
                      Ссылка для вступления: /join/{p.join_token}
                    </p>
                    <button
                      onClick={regenerateToken}
                      disabled={regenerating}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-tz-border px-3 py-2 text-sm font-medium text-tz-secondary transition hover:bg-tz-soft disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="text-sm text-tz-muted">Токен ещё не выпущен</p>
                )}
                {shareError && <p className="mt-2 text-xs font-medium text-tz-danger">{shareError}</p>}
              </div>
            )}
          </aside>
        </div>
      </motion.div>

      {/* Модалка с текстом сгенерированного документа */}
      {viewingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
          onClick={() => setViewingDoc(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-3xl rounded-2xl bg-tz-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-tz-border p-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-tz-muted">
                  Документ проекта
                </p>
                <h3 className="mt-1 tz-card-title text-tz-fg">{viewingDoc.title}</h3>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-tz-muted transition hover:bg-tz-surface-2 hover:text-tz-secondary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-tz-secondary">
                {viewingDoc.content}
              </pre>
            </div>
            <div className="flex justify-end border-t border-tz-border p-4">
              <button
                onClick={() => setViewingDoc(null)}
                className="rounded-lg bg-[var(--tz-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tz-accent-hover)]"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
            <div className="flex items-start justify-between gap-4 border-b border-tz-border p-5">
              <div>
                <p className="font-mono text-xs uppercase tracking-wide text-tz-muted">
                  Сгенерированный документ
                </p>
                <h3 className="mt-1 tz-card-title text-tz-fg">{generatedDoc.title}</h3>
              </div>
              <button
                onClick={() => setGeneratedDoc(null)}
                aria-label="Закрыть"
                className="rounded-lg p-2 text-tz-muted transition hover:bg-tz-surface-2 hover:text-tz-secondary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-tz-secondary">
                {generatedDoc.content}
              </pre>
            </div>
            <div className="flex justify-end border-t border-tz-border p-4">
              <button
                onClick={() => setGeneratedDoc(null)}
                className="rounded-lg bg-[var(--tz-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--tz-accent-hover)]"
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
