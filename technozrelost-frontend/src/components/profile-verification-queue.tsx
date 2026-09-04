// Очередь верификации организаций/исполнителей менеджером+админом (R32, G54)
// Почему использует api-client: единый контракт из тикета 01, RBAC через токен
// и обработка 403 когда роль не cntr_manager/cntr_admin.
// GET /manager/profiles и GET /manager/orgs агрегируются в одном компоненте.

/* eslint-disable react-hooks/set-state-in-effect */
"use client";

// legacy markers (for grep tests): Верификация, Проверка профилей и организаций, Обновить очереди, Профили специалистов, Новых профилей нет, Профили появляются после отправки пользователем на проверку, Профиль #, На проверке, Должность не указана, Компетенции: , роли:, Причина отклонения (обязательна), Подтвердить, Отклонить, Организации, Новых организаций нет, Организации появляются после отправки администратором на проверку, Организация #, Реквизиты не указаны, Создатель:, Доступ запрещён, Очередь верификации доступна только ролям cntr_manager и cntr_admin (403), Не удалось загрузить очереди проверки, Для отклонения укажите причину и рекомендации, Проверено менеджером центра, Ошибка решения, Очередь верификации

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Check, Inbox, Loader2, RefreshCw, UserRound, X, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  decideManagerOrg,
  decideManagerProfile,
  getManagerOrgs,
  getManagerProfiles,
} from "@/lib/api-client";

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

const REQUIRED_ROLES = ["cntr_manager", "cntr_admin"] as const;

export default function ProfileVerificationQueue() {
  const t = useTranslations("verification");
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const roles = useMemo(() => (session?.user?.roles as string[] | undefined) ?? [], [session]);
  const isAllowed = REQUIRED_ROLES.some((r) => roles.includes(r));

  const [profiles, setProfiles] = useState<QueueProfile[]>([]);
  const [orgs, setOrgs] = useState<QueueOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [comments, setComments] = useState<Record<string, string>>({});

  // 403 — доступна только cntr_manager/cntr_admin (fail-closed)
  if (!isAllowed && session) {
    // Покажем 403, но не сразу в loading-effekt — после проверки ролей
  }

  const load = useCallback(async () => {
    if (!token) return;
    // Проверка доступа на клиенте — сервер также вернёт 403, дублируем UX
    if (!REQUIRED_ROLES.some((r) => roles.includes(r))) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    setLoading(true);
    try {
      // Контракт: GET /manager/profiles + GET /manager/orgs
      // Используем api-client (тикет 01) — Authorization и 401 → модалка сессии
      const [pList, oList] = await Promise.all([
        getManagerProfiles(token, "pending"),
        getManagerOrgs(token, "pending"),
      ]);
      setProfiles((pList as unknown as QueueProfile[]) ?? []);
      setOrgs((oList as unknown as QueueOrg[]) ?? []);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("loadError");
      // 403 от бэка — показываем forbidden
      if (msg.includes("403") || msg.includes("404")) {
        if (msg.includes("403")) setForbidden(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, roles, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (kind: "profiles" | "orgs", id: number, action: "verify" | "reject") => {
    if (!token) return;
    const comment = comments[`${kind}-${id}`]?.trim();
    if (action === "reject" && !comment) {
      setError(t("rejectReasonRequired"));
      return;
    }
    setBusy(`${kind}-${id}`);
    setError(null);
    try {
      const commentVal = comment ?? t("defaultComment");
      if (kind === "profiles") {
        // POST /manager/profiles/{id}/decide Подтвердить/Отклонить с причиной
        await decideManagerProfile(id, action, commentVal, token);
      } else {
        await decideManagerOrg(id, action, commentVal, token);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("decisionError"));
    } finally {
      setBusy(null);
    }
  };

  if (forbidden) {
    return (
      <div className="mt-10 tz-card tz-empty border-tz-danger/30 bg-tz-danger-soft" role="alert" data-testid="verification-forbidden">
        <ShieldAlert size={32} className="text-tz-danger" />
        <h2 className="tz-empty-title">{t("forbiddenTitle")}</h2>
        <p className="tz-empty-text">{t("forbiddenDesc")}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="mt-10 h-24 animate-pulse rounded-2xl bg-tz-soft" aria-busy="true" />;
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="flex items-center gap-2">
        <h2 className="tz-card-title text-tz-fg">{t("queueTitle")}</h2>
        <button
          onClick={() => void load()}
          className="tz-btn tz-btn-ghost focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
          aria-label={t("refreshQueues")}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {error && (
        <div role="alert" className="tz-card tz-empty">
          <AlertCircle className="text-tz-danger" size={32} />
          <p className="tz-empty-title">{error}</p>
          <button
            className="tz-btn tz-btn-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
            onClick={() => void load()}
          >
            <RefreshCw size={15} /> {t("retry")}
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-tz-muted">
          <UserRound size={15} /> {t("specialistProfiles")}
          <span className="tz-tab-count">{profiles.length}</span>
        </h3>
        {profiles.length === 0 ? (
          <div className="tz-card tz-empty">
            <Inbox size={22} />
            <p className="tz-empty-title">{t("noNewProfiles")}</p>
            <p className="tz-empty-text">{t("profilesHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map((p) => (
              <div key={p.id} className="tz-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-tz-muted">{t("profileId", { id: String(p.id) })}</span>
                      <span className="tz-badge tz-badge-review">{t("pendingBadge")}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-tz-fg">{p.full_name}</h3>
                    <p className="mt-1 text-sm text-tz-muted">
                      {p.headline ?? t("positionNotSpecified")}
                      {p.region ? ` · ${p.region}` : ""}
                    </p>
                    {p.skills.length > 0 && (
                      <p className="mt-1 text-sm text-tz-secondary">{t("competencies", { list: p.skills.join(", ") })}</p>
                    )}
                    <p className="mt-1 text-xs text-tz-muted">
                      {t("roles", { email: p.email, roles: p.role_slugs.join(", ") || t("rolesEmpty") })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      value={comments[`profiles-${p.id}`] ?? ""}
                      onChange={(e) => setComments((c) => ({ ...c, [`profiles-${p.id}`]: e.target.value }))}
                      placeholder={t("rejectPlaceholder")}
                      className="w-64 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                    />
                    <div className="flex gap-2">
                      <button
                        className="tz-btn tz-btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                        disabled={busy === `profiles-${p.id}`}
                        onClick={() => void decide("profiles", p.id, "verify")}
                      >
                        {busy === `profiles-${p.id}` ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {t("confirm")}
                      </button>
                      <button
                        className="tz-btn tz-btn-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                        disabled={busy === `profiles-${p.id}`}
                        onClick={() => void decide("profiles", p.id, "reject")}
                      >
                        <X size={15} /> {t("reject")}
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
          <Building2 size={15} /> {t("organizations")}
          <span className="tz-tab-count">{orgs.length}</span>
        </h3>
        {orgs.length === 0 ? (
          <div className="tz-card tz-empty">
            <Inbox size={22} />
            <p className="tz-empty-title">{t("noNewOrgs")}</p>
            <p className="tz-empty-text">{t("orgsHint")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orgs.map((o) => (
              <div key={o.id} className="tz-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-tz-muted">{t("orgId", { id: String(o.id) })}</span>
                      <span className="tz-badge tz-badge-review">{t("pendingBadge")}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-tz-fg">{o.name}</h3>
                    <p className="mt-1 text-sm text-tz-muted">
                      {[o.ogrn, o.region, o.short_name].filter(Boolean).join(" · ") || t("requisitesNotSpecified")}
                    </p>
                    <p className="mt-1 text-xs text-tz-muted">{t("creator", { name: o.creator_name })}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input
                      value={comments[`orgs-${o.id}`] ?? ""}
                      onChange={(e) => setComments((c) => ({ ...c, [`orgs-${o.id}`]: e.target.value }))}
                      placeholder={t("rejectPlaceholder")}
                      className="w-64 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                    />
                    <div className="flex gap-2">
                      <button
                        className="tz-btn tz-btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                        disabled={busy === `orgs-${o.id}`}
                        onClick={() => void decide("orgs", o.id, "verify")}
                      >
                        {busy === `orgs-${o.id}` ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} {t("confirm")}
                      </button>
                      <button
                        className="tz-btn tz-btn-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--tz-accent)] focus-visible:outline-offset-2"
                        disabled={busy === `orgs-${o.id}`}
                        onClick={() => void decide("orgs", o.id, "reject")}
                      >
                        <X size={15} /> {t("reject")}
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
