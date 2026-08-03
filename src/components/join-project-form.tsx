'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { KeyRound, Loader2, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

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
      const res = await fetch(`${API_URL}/api/v1/projects/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ token: normalized, role_in_project: role }),
      });
      const data = (await res.json().catch(() => null)) as JoinResponse | null;

      if (!res.ok) {
        throw new Error(extractError(data, `Не удалось присоединиться к проекту (${res.status}).`));
      }

      if (data?.status === 'active') {
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
      className="rounded-2xl border border-[#E8ECF0] bg-white p-5 sm:p-6"
      style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF0FF] text-[#2E5BFF]">
          <KeyRound size={20} />
        </span>
        <div>
          <h3 className="font-bold text-[#0F172A]">Присоединиться к проекту</h3>
          <p className="text-sm text-slate-500">Введите токен, выданный заказчиком или ЦНТР</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="TZ-XXXXXX"
          disabled={loading}
          className="w-full rounded-xl border border-[#DFE5EC] bg-white px-4 py-2.5 font-mono text-sm text-[#0F172A] outline-none transition placeholder:text-slate-400 focus:border-[#2E5BFF] disabled:opacity-60"
        />
        <div>
          <label htmlFor="join-role" className="mb-1 block text-xs font-medium text-slate-500">
            Роль в проекте
          </label>
          <select
            id="join-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
            className="w-full rounded-xl border border-[#DFE5EC] bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#2E5BFF] disabled:opacity-60"
          >
            {JOIN_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {info && (
          <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            {info}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E5BFF] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#244BD9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E5BFF] disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Отправка…' : 'Присоединиться'}
        </button>
      </div>
    </form>
  );
}
