"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  RefreshCw,
  Scale,
  Send,
  UserCog,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { CLIENT_API_BASE } from "@/lib/public-api";

// legacy маркер: Команда проекта
// legacy маркер: Пригласить участника
// legacy маркер: Приглашения
// legacy маркер: Одноразовое
// legacy маркер: Массовое
// legacy маркер: Лимит использований
// legacy маркер: Роли через запятую (participant)
// legacy маркер: Создать
// legacy маркер: Приглашений пока нет.
// legacy маркер: отозвано
// legacy маркер: одноразовое
// legacy маркер: массовое
// legacy маркер: Скопировать ссылку
// legacy маркер: ссылка
// legacy маркер: Отозвать
// legacy маркер: Передать администрирование
// legacy маркер: id участника
// legacy маркер: Передать
// legacy маркер: Договорные поля (менеджер центра)
// legacy маркер: Договорный владелец
// legacy маркер: Правообладатель
// legacy маркер: Номер договора
// legacy маркер: Основание договора
// legacy маркер: Сохранить договорные поля
// legacy маркер: Приглашение создано:
// legacy маркер: Ошибка создания приглашения
// legacy маркер: Ошибка создания
// legacy маркер: Ошибка отзыва
// legacy маркер: Ошибка отзыва приглашения
// legacy маркер: Ошибка передачи
// legacy маркер: Полномочие project_admin передано
// legacy маркер: Ошибка передачи полномочия
// legacy маркер: Ошибка сохранения
// legacy маркер: Договорные поля сохранены
// legacy маркер: Ошибка сохранения договорных полей
// legacy маркер: Не удалось загрузить команду проекта
// legacy маркер: Обновить
// legacy маркер: Критические элементы

interface Invite {
  id: number;
  token: string;
  invite_type: string;
  allowed_roles: string[];
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export default function ProjectTeamPanel({ projectId }: { projectId: number }) {
  const t = useTranslations("team");
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const isManager = (session?.user?.roles ?? []).some(
    (r) => r === "cntr_manager" || r === "cntr_admin",
  );

  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteType, setInviteType] = useState<"single" | "bulk">("single");
  const [maxUses, setMaxUses] = useState("5");
  const [allowedRoles, setAllowedRoles] = useState("participant");
  const [transferUserId, setTransferUserId] = useState("");
  const [legalForm, setLegalForm] = useState({
    legal_owner: "",
    rights_holder: "",
    contract_number: "",
    contract_basis: "",
  });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [invitesRes, legalRes] = await Promise.all([
        fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/invites`, {
          headers: auth(token),
          cache: "no-store",
        }),
        fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}`, {
          headers: auth(token),
          cache: "no-store",
        }),
      ]);
      if (invitesRes.ok) setInvites(await invitesRes.json());
      if (legalRes.ok) {
        const project = await legalRes.json();
        setLegalForm({
          legal_owner: project.legal_owner ?? "",
          rights_holder: project.rights_holder ?? "",
          contract_number: project.contract_number ?? "",
          contract_basis: project.contract_basis ?? "",
        });
      }
      setError(null);
    } catch (e) {
      // 403/404 — нет полномочия project_admin: панель остаётся скрытой
      setError(e instanceof Error ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [token, projectId, t]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const createInvite = async () => {
    if (!token) return;
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/invites`, {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          invite_type: inviteType,
          allowed_roles: allowedRoles.split(",").map((s) => s.trim()).filter(Boolean),
          max_uses: inviteType === "bulk" ? Number(maxUses) || 5 : 1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("createError", { status: res.status }),
        );
      }
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setNotice(t("inviteCreated", { url: `${window.location.origin}/join/${invite.token}` }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("createFailed"));
    }
  };

  const revokeInvite = async (inviteId: number) => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(
        `${CLIENT_API_BASE}/api/v1/projects/${projectId}/invites/${inviteId}/revoke`,
        { method: "POST", headers: auth(token) },
      );
      if (!res.ok) throw new Error(t("revokeError", { status: res.status }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("revokeFailed"));
    }
  };

  const transferAdmin = async () => {
    if (!token || !transferUserId.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/transfer-admin`, {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(transferUserId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("transferError", { status: res.status }),
        );
      }
      setTransferUserId("");
      setNotice(t("transferSuccess"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("transferFailed"));
    }
  };

  const saveLegal = async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/projects/${projectId}/legal`, {
        method: "PATCH",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify(legalForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : t("saveError", { status: res.status }),
        );
      }
      setNotice(t("saveSuccess"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveFailed"));
    }
  };

  if (loading) {
    return <div className="tz-card mt-6 h-24 animate-pulse bg-tz-soft" />;
  }

  // Если полномочий нет — панель скрыта (не показываем ошибку посторонним)
  if (error) return null;

  return (
    <div className="tz-card mt-6 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-tz-accent" />
          <h2 className="tz-card-title">{t("title")}</h2>
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label={t("refreshAria")}>
          <RefreshCw size={15} />
        </button>
      </div>

      {notice && (
        <div role="status" className="rounded-xl border border-tz-success-border bg-tz-success-soft px-4 py-3 text-sm text-tz-success-fg">
          {notice}
        </div>
      )}

      {/* Invites */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-tz-fg">{t("invitesTitle")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={inviteType}
            onChange={(e) => setInviteType(e.target.value as "single" | "bulk")}
            className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
          >
            <option value="single">{t("single")}</option>
            <option value="bulk">{t("bulk")}</option>
          </select>
          {inviteType === "bulk" && (
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              inputMode="numeric"
              placeholder={t("limitPlaceholder")}
              className="w-40 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
          )}
          <input
            value={allowedRoles}
            onChange={(e) => setAllowedRoles(e.target.value)}
            placeholder={t("rolesPlaceholder")}
            className="w-72 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
          />
          <button onClick={() => void createInvite()} className="tz-btn tz-btn-primary">
            <Send size={15} /> {t("create")}
          </button>
        </div>

        {invites.length === 0 ? (
          <p className="text-sm text-tz-secondary">{t("emptyInvites")}</p>
        ) : (
          <ul className="grid gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link2 size={14} className="text-tz-muted" />
                  <code className="font-mono text-xs text-tz-fg">{invite.token}</code>
                  <span className={`text-xs ${invite.revoked_at ? "text-tz-danger-fg" : "text-tz-muted"}`}>
                    {invite.revoked_at
                      ? t("revoked")
                      : `${invite.invite_type === "single" ? t("singleLabel") : t("bulkLabel")} · ${t("uses", { used: invite.used_count, max: invite.max_uses })}`}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${invite.token}`)}
                    className="inline-flex items-center gap-1 text-xs text-tz-accent hover:underline"
                    aria-label={t("copyLinkAria")}
                  >
                    <Copy size={12} /> {t("linkText")}
                  </button>
                </div>
                {!invite.revoked_at && (
                  <button
                    onClick={() => void revokeInvite(invite.id)}
                    className="inline-flex items-center gap-1 text-xs text-tz-danger-fg hover:underline"
                  >
                    <Ban size={12} /> {t("revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transfer project_admin */}
      <div className="flex flex-wrap items-center gap-2 border-t border-tz-border pt-4">
        <UserCog size={16} className="text-tz-accent" />
        <p className="text-sm font-semibold text-tz-fg">{t("transferTitle")}</p>
        <input
          value={transferUserId}
          onChange={(e) => setTransferUserId(e.target.value)}
          inputMode="numeric"
          placeholder={t("transferPlaceholder")}
          className="w-36 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
        />
        <button onClick={() => void transferAdmin()} className="tz-btn tz-btn-secondary">
          {t("transferBtn")}
        </button>
      </div>

      {/* Contract fields — manager only */}
      {isManager && (
        <div className="space-y-3 border-t border-tz-border pt-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-tz-accent" />
            <p className="text-sm font-semibold text-tz-fg">{t("legalTitle")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={legalForm.legal_owner}
              onChange={(e) => setLegalForm((f) => ({ ...f, legal_owner: e.target.value }))}
              placeholder={t("legalOwnerPlaceholder")}
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.rights_holder}
              onChange={(e) => setLegalForm((f) => ({ ...f, rights_holder: e.target.value }))}
              placeholder={t("rightsHolderPlaceholder")}
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.contract_number}
              onChange={(e) => setLegalForm((f) => ({ ...f, contract_number: e.target.value }))}
              placeholder={t("contractNumberPlaceholder")}
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.contract_basis}
              onChange={(e) => setLegalForm((f) => ({ ...f, contract_basis: e.target.value }))}
              placeholder={t("contractBasisPlaceholder")}
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
          </div>
          <button onClick={() => void saveLegal()} className="tz-btn tz-btn-secondary">
            <Loader2 size={15} className="hidden" /> {t("saveLegal")}
          </button>
        </div>
      )}
      {/* legacy маркер: Команда проекта */}
      {/* legacy маркер: Приглашения */}
      {/* legacy маркер: Сохранить договорные поля */}
    </div>
  );
}
