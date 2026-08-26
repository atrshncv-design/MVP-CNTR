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
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


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
        fetch(`${API_URL}/api/v1/projects/${projectId}/invites`, {
          headers: auth(token),
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/v1/projects/${projectId}`, {
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
      setError(e instanceof Error ? e.message : "Не удалось загрузить команду проекта");
    } finally {
      setLoading(false);
    }
  }, [token, projectId]);

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
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/invites`, {
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
            : `Ошибка создания (${res.status})`,
        );
      }
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setNotice(`Приглашение создано: ${window.location.origin}/join/${invite.token}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания приглашения");
    }
  };

  const revokeInvite = async (inviteId: number) => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/v1/projects/${projectId}/invites/${inviteId}/revoke`,
        { method: "POST", headers: auth(token) },
      );
      if (!res.ok) throw new Error(`Ошибка отзыва (${res.status})`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отзыва приглашения");
    }
  };

  const transferAdmin = async () => {
    if (!token || !transferUserId.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/transfer-admin`, {
        method: "POST",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: Number(transferUserId) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка передачи (${res.status})`,
        );
      }
      setTransferUserId("");
      setNotice("Полномочие project_admin передано");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка передачи полномочия");
    }
  };

  const saveLegal = async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/legal`, {
        method: "PATCH",
        headers: { ...auth(token), "Content-Type": "application/json" },
        body: JSON.stringify(legalForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data && typeof (data as { detail?: string }).detail === "string"
            ? (data as { detail: string }).detail
            : `Ошибка сохранения (${res.status})`,
        );
      }
      setNotice("Договорные поля сохранены");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения договорных полей");
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
          <h2 className="tz-card-title">Команда проекта</h2>
        </div>
        <button onClick={() => void load()} className="tz-btn tz-btn-ghost" aria-label="Обновить">
          <RefreshCw size={15} />
        </button>
      </div>

      {notice && (
        <div role="status" className="rounded-xl border border-tz-success-border bg-tz-success-soft px-4 py-3 text-sm text-tz-success-fg">
          {notice}
        </div>
      )}

      {/* Приглашения */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-tz-fg">Приглашения</p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={inviteType}
            onChange={(e) => setInviteType(e.target.value as "single" | "bulk")}
            className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
          >
            <option value="single">Одноразовое</option>
            <option value="bulk">Массовое</option>
          </select>
          {inviteType === "bulk" && (
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              inputMode="numeric"
              placeholder="Лимит использований"
              className="w-40 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
          )}
          <input
            value={allowedRoles}
            onChange={(e) => setAllowedRoles(e.target.value)}
            placeholder="Роли через запятую (participant)"
            className="w-72 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
          />
          <button onClick={() => void createInvite()} className="tz-btn tz-btn-primary">
            <Send size={15} /> Создать
          </button>
        </div>

        {invites.length === 0 ? (
          <p className="text-sm text-tz-secondary">Приглашений пока нет.</p>
        ) : (
          <ul className="grid gap-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Link2 size={14} className="text-tz-muted" />
                  <code className="font-mono text-xs text-tz-fg">{invite.token}</code>
                  <span className={`text-xs ${invite.revoked_at ? "text-tz-danger-fg" : "text-tz-muted"}`}>
                    {invite.revoked_at
                      ? "отозвано"
                      : `${invite.invite_type === "single" ? "одноразовое" : "массовое"} · ${invite.used_count}/${invite.max_uses}`}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${invite.token}`)}
                    className="inline-flex items-center gap-1 text-xs text-tz-accent hover:underline"
                    aria-label="Скопировать ссылку"
                  >
                    <Copy size={12} /> ссылка
                  </button>
                </div>
                {!invite.revoked_at && (
                  <button
                    onClick={() => void revokeInvite(invite.id)}
                    className="inline-flex items-center gap-1 text-xs text-tz-danger-fg hover:underline"
                  >
                    <Ban size={12} /> Отозвать
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Передача project_admin */}
      <div className="flex flex-wrap items-center gap-2 border-t border-tz-border pt-4">
        <UserCog size={16} className="text-tz-accent" />
        <p className="text-sm font-semibold text-tz-fg">Передать администрирование</p>
        <input
          value={transferUserId}
          onChange={(e) => setTransferUserId(e.target.value)}
          inputMode="numeric"
          placeholder="id участника"
          className="w-36 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
        />
        <button onClick={() => void transferAdmin()} className="tz-btn tz-btn-secondary">
          Передать
        </button>
      </div>

      {/* Договорные поля — только менеджер */}
      {isManager && (
        <div className="space-y-3 border-t border-tz-border pt-4">
          <div className="flex items-center gap-2">
            <Scale size={16} className="text-tz-accent" />
            <p className="text-sm font-semibold text-tz-fg">Договорные поля (менеджер центра)</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={legalForm.legal_owner}
              onChange={(e) => setLegalForm((f) => ({ ...f, legal_owner: e.target.value }))}
              placeholder="Договорный владелец"
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.rights_holder}
              onChange={(e) => setLegalForm((f) => ({ ...f, rights_holder: e.target.value }))}
              placeholder="Правообладатель"
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.contract_number}
              onChange={(e) => setLegalForm((f) => ({ ...f, contract_number: e.target.value }))}
              placeholder="Номер договора"
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
            <input
              value={legalForm.contract_basis}
              onChange={(e) => setLegalForm((f) => ({ ...f, contract_basis: e.target.value }))}
              placeholder="Основание договора"
              className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-sm text-tz-fg"
            />
          </div>
          <button onClick={() => void saveLegal()} className="tz-btn tz-btn-secondary">
            <Loader2 size={15} className="hidden" /> Сохранить договорные поля
          </button>
        </div>
      )}
    </div>
  );
}
