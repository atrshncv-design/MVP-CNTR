'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CLIENT_API_BASE } from '@/lib/public-api';

interface MemberOrg {
  id: number;
  name: string;
  state: string;
}

type Phase = 'pending' | 'loading' | 'ready' | 'error';

const KNOWN_STATES = new Set(['draft', 'pending', 'verified', 'rejected']);

/**
 * Подсказка про организацию на странице создания проекта (таск 01, R02.1).
 * Почему отдельный компонент: исполнитель должен видеть, подтверждена ли его
 * организация, и что делать, если нет, — вместо молчаливого отказа.
 * Создание не блокируется: черновик сохраняется всегда, публикация идёт
 * по общим правилам после модерации (см. PublishRulesNote).
 */
export function OrgVerificationHint() {
  const t = useTranslations('dashboard');
  const tp = useTranslations('profile');
  const { data: session, status } = useSession();
  const token = session?.user?.accessToken;
  const [phase, setPhase] = useState<Phase>('pending');
  const [orgs, setOrgs] = useState<MemberOrg[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!token) {
      setPhase('pending');
      return;
    }
    let cancelled = false;
    setPhase('loading');
    fetch(`${CLIENT_API_BASE}/api/v1/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ organizations?: MemberOrg[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        setOrgs(Array.isArray(data.organizations) ? data.organizations : []);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [status, token]);

  // Без сессии подсказывать нечего — визард сам покажет ошибку сессии при сохранении.
  if (phase === 'pending') return null;

  if (phase === 'loading') {
    return (
      <div
        data-testid="org-verification-hint"
        data-state="checking"
        role="status"
        className="flex items-center gap-3 rounded-2xl border border-tz-border bg-tz-surface p-4 text-sm text-tz-muted"
      >
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        {t('orgHintChecking')}
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div
        data-testid="org-verification-hint"
        data-state="error"
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-tz-warning bg-tz-warning-soft p-4"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-tz-warning" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-tz-fg">{t('orgHintTitle')}</p>
          <p className="mt-1 text-tz-secondary">{t('orgHintLoadFailed')}</p>
          <ProfileLink label={t('orgHintProfileLink')} />
        </div>
      </div>
    );
  }

  const verified = orgs.find((org) => org.state === 'verified');
  if (verified) {
    return (
      <div
        data-testid="org-verification-hint"
        data-state="verified"
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-tz-success bg-tz-success-soft p-4"
      >
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-tz-success" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-tz-fg">{t('orgHintTitle')}</p>
          <p className="mt-1 text-tz-secondary">{t('orgHintVerified', { name: verified.name })}</p>
        </div>
      </div>
    );
  }

  if (orgs.length === 0) {
    return (
      <div
        data-testid="org-verification-hint"
        data-state="no-org"
        role="status"
        className="flex items-start gap-3 rounded-2xl border border-tz-border bg-tz-surface p-4"
      >
        <Building2 size={18} className="mt-0.5 shrink-0 text-tz-accent" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-tz-fg">{t('orgHintTitle')}</p>
          <p className="mt-1 text-tz-secondary">{t('orgHintNoOrg')}</p>
          <ProfileLink label={t('orgHintProfileLink')} />
        </div>
      </div>
    );
  }

  const first = orgs[0];
  const stateLabel = KNOWN_STATES.has(first.state) ? tp(first.state) : first.state;
  return (
    <div
      data-testid="org-verification-hint"
      data-state="unverified"
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-tz-warning bg-tz-warning-soft p-4"
    >
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-tz-warning" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold text-tz-fg">{t('orgHintTitle')}</p>
        <p className="mt-1 text-tz-secondary">{t('orgHintUnverified', { name: first.name, state: stateLabel })}</p>
        <ProfileLink label={t('orgHintProfileLink')} />
      </div>
    </div>
  );
}

function ProfileLink({ label }: { label: string }) {
  return (
    <Link
      href="/dashboard/profile"
      className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-tz-accent hover:text-tz-accent-hover"
    >
      {label}
      <ArrowRight size={14} aria-hidden="true" />
    </Link>
  );
}
