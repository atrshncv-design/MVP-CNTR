'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { KeyRound, Loader2, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CLIENT_API_BASE } from "@/lib/public-api";
import { getJoinRoles } from "@/features/dashboard/i18n";

interface JoinResponse {
  status: 'active' | 'pending';
  project: { id: number; name: string } | null;
}

/** Достаёт человекочитаемое сообщение об ошибке из ответа FastAPI */
function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object') {
      const msg = (detail[0] as { msg?: unknown }).msg;
      if (typeof msg === 'string') return msg;
    }
  }
  return fallback;
}


export default function JoinProjectForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const t = useTranslations('dashboard');

  const [token, setToken] = useState('');
  const [role, setRole] = useState<string>('rd_executor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const joinRoles = getJoinRoles(t);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const normalized = token.trim();
    if (!normalized) {
      setError(t('joinTokenErrorRequired'));
      return;
    }
    if (!session?.user?.accessToken) {
      setError(t('joinErrorNoSession'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ token: normalized, role_in_project: role }),
      });
      const data = (await res.json().catch(() => null)) as JoinResponse | null;

      if (!res.ok) {
        throw new Error(extractError(data, t('joinFormErrorStatus', { status: res.status })));
      }

      if (data?.status === 'active') {
        if (data.project?.id) {
          router.push(`/dashboard/project/${data.project.id}`);
        } else {
          router.push('/dashboard/projects');
        }
        return;
      }

      setInfo(t('joinSuccess'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('joinFormErrorGeneric'));
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
          <h3 className="tz-card-title">{t('joinFormTitle')}</h3>
          <p className="text-sm text-tz-muted">{t('joinFormDesc')}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="TZ-XXXXXX"
          disabled={loading}
          className="w-full rounded-xl border border-tz-border bg-tz-surface px-4 py-2.5 font-mono text-sm text-tz-fg outline-none transition placeholder:text-tz-muted focus:border-tz-accent disabled:opacity-60"
        />
        <div>
          <label htmlFor="join-role" className="mb-1 block text-xs font-medium text-tz-muted">
            {t('joinFormRoleLabel')}
          </label>
          <select
            id="join-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-tz-border bg-tz-surface px-3 py-2.5 text-sm text-tz-fg outline-none transition focus:border-tz-accent disabled:opacity-60"
          >
            {joinRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft px-3 py-2.5 text-sm text-tz-danger">
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
          {loading ? t('joinFormSending') : t('joinFormSubmit')}
        </button>
      </div>
    </form>
  );
}
