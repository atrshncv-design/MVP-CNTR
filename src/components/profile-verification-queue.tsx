"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Building2, Check, Inbox, Loader2, RefreshCw, UserRound, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface QueueProfile {
  id: number;
  full_name: string;
  email: string;
  headline: string | null;
  region: string | null;
  skills: string[];
  state: string;
  review_comment: string | null;
  role_slugs: string[];
}

interface QueueOrg {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  region: string | null;
  state: string;
  creator_name: string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function ProfileVerificationQueue() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [profiles, setProfiles] = useState<QueueProfile[]>([]);
  const [orgs, setOrgs] = useState<QueueOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [pRes, oRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/manager/profiles?state=pending`, { headers: auth(token), cache: "no-store" }),
        fetch(`${API_URL}/api/v1/manager/orgs?state=pending`, { headers: auth(token), cache: "no-store" }),
      ]);
      if (!pRes.ok || !oRes.ok) throw new Error(`HTTP ${pRes.status}/${oRes.status}`);
      setProfiles(await pRes.json());
      setOrgs(await oRes.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить очереди проверки");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const decide = async (kind: "profiles" | "orgs", id: number, action: "verify" | "reject") => {
    if (!token) return;
    const comment = comments[`${kind}-${id}`]?.trim();
    if (action === "reject" && !comment) {
      setError("Для отклонения укажите причину и рекомендации");
      return;
    }
    setBusy(`${kind}-${id}`);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/manager/${kind}/${id}/decide`, {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment: comment ?? "Проверено менеджером центра" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data && typeof data === "object" && typeof (data as { detail?: string }).detail === "string"
          ? (data as { detail: string }).detail
          : `Ошибка решения (${res.status})`;
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка решения");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="mt-10 h-24 animate-pulse rounded-2xl bg-tz-soft" />;
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="flex items-center gap-2">
        <h2 className="tz-card-title text-tz-fg">Проверка профилей и организаций</h2>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label="Обновить очереди">
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div role="alert" className="tz-card tz-empty">
          <AlertCircle className="text-tz-danger" size={32} />
          <p className="tz-empty-title">{error}</p>
          <button className="tz-btn tz-btn-secondary" onClick={() => void load()}>
            <RefreshCw size={15} /> Повторить
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-tz-muted">
          <UserRound size={15} /> Профили специалистов
          <span className="tz-tab-count">{profiles.length}</span>
        </h3>
        {profiles.length === 0 ? (
          <div className="tz-card tz-empty">
            <Inbox size={22} />
            <p className="tz-empty-title">Новых профилей нет</p>
            <p className="tz-empty-text">Профили появляются после отправки пользователем на проверку.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className="tz-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-tz-muted">Профиль #{p.id}</span>
                      <span className="tz-badge tz-badge-review">На проверке</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-tz-fg">{p.full_name}</h3>
                    <p className="mt-1 text-sm text-tz-muted">
                      {p.headline ?? "Должность не указана"}
                      {p.region ? ` · ${p.region}` : ""}
                    </p>
                    {p.skills.length > 0 && (
                      <p className="mt-1 text-sm text-tz-secondary">Компетенции: {p.skills.join(", ")}</p>
                    )}
                    <p className="mt-1 text-xs text-tz-muted">
                      {p.email} · роли: {p.role_slugs.join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      value={comments[`profiles-${p.id}`] ?? ""}
                      onChange={(e) => setComments((c) => ({ ...c, [`profiles-${p.id}`]: e.target.value }))}
                      placeholder="Причина отклонения (обязательна)"
                      className="w-64 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
                    />
                    <div className="flex gap-2">
                      <button
                        className="tz-btn tz-btn-primary"
                        disabled={busy === `profiles-${p.id}`}
                        onClick={() => void decide("profiles", p.id, "verify")}
                      >
                        {busy === `profiles-${p.id}` ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Подтвердить
                      </button>
                      <button
                        className="tz-btn tz-btn-danger"
                        disabled={busy === `profiles-${p.id}`}
                        onClick={() => void decide("profiles", p.id, "reject")}
                      >
                        <X size={15} /> Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-tz-muted">
          <Building2 size={15} /> Организации
          <span className="tz-tab-count">{orgs.length}</span>
        </h3>
        {orgs.length === 0 ? (
          <div className="tz-card tz-empty">
            <Inbox size={22} />
            <p className="tz-empty-title">Новых организаций нет</p>
            <p className="tz-empty-text">Организации появляются после отправки администратором на проверку.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orgs.map((o) => (
              <div key={o.id} className="tz-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-tz-muted">Организация #{o.id}</span>
                      <span className="tz-badge tz-badge-review">На проверке</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-tz-fg">{o.name}</h3>
                    <p className="mt-1 text-sm text-tz-muted">
                      {[o.ogrn, o.region, o.short_name].filter(Boolean).join(" · ") || "Реквизиты не указаны"}
                    </p>
                    <p className="mt-1 text-xs text-tz-muted">Создатель: {o.creator_name}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      value={comments[`orgs-${o.id}`] ?? ""}
                      onChange={(e) => setComments((c) => ({ ...c, [`orgs-${o.id}`]: e.target.value }))}
                      placeholder="Причина отклонения (обязательна)"
                      className="w-64 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
                    />
                    <div className="flex gap-2">
                      <button
                        className="tz-btn tz-btn-primary"
                        disabled={busy === `orgs-${o.id}`}
                        onClick={() => void decide("orgs", o.id, "verify")}
                      >
                        {busy === `orgs-${o.id}` ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Подтвердить
                      </button>
                      <button
                        className="tz-btn tz-btn-danger"
                        disabled={busy === `orgs-${o.id}`}
                        onClick={() => void decide("orgs", o.id, "reject")}
                      >
                        <X size={15} /> Отклонить
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
