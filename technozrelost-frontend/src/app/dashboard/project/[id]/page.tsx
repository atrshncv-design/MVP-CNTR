'use client';

/* eslint-disable react-hooks/set-state-in-effect */
/**
 * Обвязка карточки проекта — тонкий wrapper <300 строк (тикет 03).
 * Вся логика вынесена в src/features/project/* (UgtLine, ChecklistPanel, CanvasBlocks,
 * DocsPanel, TeamPanel, ActionsPanel, HistoryPanel). Здесь только загрузка проекта
 * и передача данных. Почему так: монолит 1194 строк не тестируем и не переиспользуем.
 */

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, XCircle, RefreshCw } from 'lucide-react';
import { ProjectCard } from '@/features/project';
import { getProject } from '@/lib/api-client';
import { CLIENT_API_BASE } from '@/lib/public-api';
import type { ProjectDetailOut } from '@/lib/types';

export default function ProjectDashboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [detail, setDetail] = useState<ProjectDetailOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.accessToken || !params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getProject(params.id as string, session.user.accessToken);
      // подтянем preliminary_level из assessments/mine для draft (совместимость)
      if ((data.project.status as string) === 'draft') {
        try {
          const base = CLIENT_API_BASE || '';
          const res = await fetch(`${base}/api/v1/assessments/mine`, {
            headers: { Authorization: `Bearer ${session.user.accessToken}` },
            cache: 'no-store',
          });
          if (res.ok) {
            const drafts = (await res.json()) as Array<{ id: number; preliminary_level: number | null }>;
            const draft = drafts.find((item) => item.id === data.project.id);
            if (draft) data.project.preliminary_level = draft.preliminary_level;
          }
        } catch {
          // ignore — fallback не критичен
        }
      }
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить проект');
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [session, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="project-loading">
        <Loader2 className="h-8 w-8 animate-spin text-tz-accent" aria-label="Загрузка" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-8 text-center" data-testid="project-error">
        <XCircle className="mx-auto mb-2 text-tz-danger" size={40} />
        <p className="text-lg font-semibold text-tz-danger">Проект не найден</p>
        {error && <p className="mt-2 text-sm text-tz-danger">{error}</p>}
        <button onClick={() => void load()} className="tz-btn tz-btn-secondary mt-4">
          <RefreshCw size={15} /> Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ProjectCard
        detail={detail}
        onProjectChange={(next) => setDetail(next)}
      />
      {/* скелетон/empty/error уже внутри панелей; retry — кнопка выше */}
    </div>
  );
}
