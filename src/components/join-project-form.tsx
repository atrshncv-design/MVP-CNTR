'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { KeyRound, Loader2, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';
import { joinProject } from "@/lib/api-client";

/** Роли, доступные при вступлении в проект по токену */
const JOIN_ROLES = [
  { value: 'rd_executor', label: 'R&D-исполнитель' },
  { value: 'scientific_org', label: 'Научная организация' },
  { value: 'serial_manufacturer', label: 'Серийный производитель' },
  { value: 'regulating_organization', label: 'Регулирующая организация' },
  { value: 'auditor', label: 'Аудитор' },
  { value: 'investor', label: 'Инвестор' },
  { value: 'participant', label: 'Участник проекта' },
] as const;

/**
 * Форма вступления в проект по токену (TZ-XXXXXX).
 * При status='active' редиректит в карточку проекта, при 'pending' —
 * показывает сообщение о заявке, переданной на рассмотрение.
 */
export default function JoinProjectForm() {
  const router = useRouter();
  const { data: session } = useSession();

  const [token, setToken] = useState('');
  const [role, setRole] = useState<string>('rd_executor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const normalized = token.trim();
    if (!normalized) {
      setError('Введите токен доступа.');
      return;
    }
    if (!session?.user?.accessToken) {
      setError('Сессия недоступна — войдите в систему заново.');
      return;
    }

    setLoading(true);
    try {
      const data = await joinProject(session.user.accessToken, {
        token: normalized,
        role_in_project: role,
      });

      if (data.status === 'active') {
        if (data.project?.id) {
          router.push(`/dashboard/project/${data.project.id}`);
        } else {
          router.push('/dashboard/projects');
        }
        return;
      }

      setInfo('Заявка отправлена на рассмотрение. Решение появится в карточке проекта.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось присоединиться к проекту.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-tz-card-border bg-tz-surface p-5 sm:p-6"
      style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
    >
      <div className="flex items-center gap-3">
        <span className="tz-stat-icon bg-tz-accent-soft text-tz-accent">
          <KeyRound size={20} />
        </span>
        <div>
          <h3 className="tz-card-title">Присоединиться к проекту</h3>
          <p className="text-sm text-tz-muted">Введите токен, выданный заказчиком или ЦНТР</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          aria-label="Токен приглашения в проект (TZ-XXXXXX)"
          aria-describedby="join-token-error"
          placeholder="TZ-XXXXXX"
          disabled={loading}
          className="w-full rounded-xl border border-tz-border bg-tz-surface px-4 py-2.5 font-mono text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-tz-accent disabled:opacity-60"
        />
        <div>
          <label htmlFor="join-role" className="mb-1 block text-xs font-medium text-tz-muted">
            Роль в проекте
          </label>
          <select
            id="join-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2.5 text-sm text-tz-fg outline-none transition focus:border-tz-accent disabled:opacity-60"
          >
            {JOIN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p id="join-token-error" className="flex items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft px-3 py-2.5 text-sm text-tz-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {info && (
          <p className="flex items-start gap-2 rounded-xl border border-tz-success bg-tz-success-soft px-3 py-2.5 text-sm text-tz-success">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="tz-btn tz-btn-primary w-full"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Отправка…' : 'Присоединиться'}
        </button>
      </div>
    </form>
  );
}
