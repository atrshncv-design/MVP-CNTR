"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, FileX2, PlusCircle, Send, UserRound } from "lucide-react";
import { TextAreaField, TextField } from "@/components/ui/fields";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

interface Profile {
  id: number;
  headline: string | null;
  bio: string | null;
  region: string | null;
  skills: string[];
  state: string;
  review_comment: string | null;
}

interface Organization {
  id: number;
  name: string;
  short_name: string | null;
  ogrn: string | null;
  org_type: string | null;
  region: string | null;
  description: string | null;
  state: string;
  review_comment: string | null;
  member_role: string;
  is_primary: boolean;
}

const STATE_LABELS: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  draft: { label: "Черновик", cls: "tz-badge-neutral", icon: FileX2 },
  pending: { label: "На проверке", cls: "tz-badge-warning", icon: Clock },
  verified: { label: "Подтверждён", cls: "tz-badge-success", icon: CheckCircle2 },
  rejected: { label: "Отклонён", cls: "tz-badge-danger", icon: FileX2 },
};

/** Честная подсказка следующего шага — по фактическому состоянию профиля. */
const NEXT_STEP_HINTS: Record<string, string> = {
  draft: "Заполните профиль и отправьте его на проверку менеджеру центра.",
  pending: "Профиль находится на проверке у менеджера центра — ожидайте решения.",
  verified: "Профиль подтверждён и доступен в реестре специалистов.",
  rejected: "Профиль отклонён: исправьте замечания проверки и отправьте повторно.",
};

function StateBadge({ state }: { state: string }) {
  const meta = STATE_LABELS[state] ?? STATE_LABELS.draft;
  const Icon = meta.icon;
  return (
    <span className={`tz-badge ${meta.cls}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

/**
 * Профиль пользователя (тикет 06 internal-ux-redesign).
 * Единый паттерн кабинета: заголовок (tz-eyebrow + tz-page-title), карточки
 * на токенах (tz-card/tz-btn/tz-input), данные профиля и организаций,
 * действия (сохранить/отправить/создать) и честный следующий шаг по
 * фактическому состоянию. Без mock-success.
 */
export default function ProfilePage() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [region, setRegion] = useState("");
  const [skills, setSkills] = useState("");

  const [orgName, setOrgName] = useState("");
  const [orgOgrn, setOrgOgrn] = useState("");
  const [orgType, setOrgType] = useState("");
  const [orgRegion, setOrgRegion] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [joinOrgId, setJoinOrgId] = useState("");

  const load = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/profile`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProfile(data.profile);
      setOrgs(data.organizations ?? []);
      setHeadline(data.profile.headline ?? "");
      setBio(data.profile.bio ?? "");
      setRegion(data.profile.region ?? "");
      setSkills((data.profile.skills ?? []).join(", "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить профиль");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const editable = profile !== null && (profile.state === "draft" || profile.state === "rejected");

  const patchProfile = async (body: Record<string, unknown>, method = "PATCH", path = "/profile") => {
    const res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }
    return res.json();
  };

  const saveProfile = async () => {
    setNotice(null);
    setError(null);
    try {
      const saved = await patchProfile({
        headline,
        bio,
        region,
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setProfile(saved);
      setNotice("Профиль сохранён");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  const submitProfile = async () => {
    setError(null);
    try {
      const saved = await patchProfile({}, "POST", "/profile/submit");
      setProfile(saved);
      setNotice("Профиль отправлен на проверку менеджеру центра");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    }
  };

  const createOrg = async () => {
    setError(null);
    try {
      const created = await patchProfile(
        { name: orgName, ogrn: orgOgrn || null, org_type: orgType || null, region: orgRegion || null, description: orgDesc || null },
        "POST",
        "/orgs",
      );
      setOrgs((prev) => [...prev, created]);
      setOrgName("");
      setOrgOgrn("");
      setOrgType("");
      setOrgRegion("");
      setOrgDesc("");
      setNotice("Организация создана");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания организации");
    }
  };

  const joinOrg = async () => {
    setError(null);
    try {
      const org = await patchProfile({}, "POST", `/orgs/${joinOrgId}/join`);
      setOrgs((prev) => [...prev, org]);
      setJoinOrgId("");
      setNotice("Вы вступили в организацию");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка вступления");
    }
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-3xl">
        <div className="h-8 w-64 animate-pulse rounded bg-tz-surface-2" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-tz-surface-2" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl">
      {/* Заголовок страницы */}
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">Профиль пользователя</p>
        <h1 className="tz-page-title mt-2">Мой профиль</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Основная роль аккаунта определяет профильный реестр, но не проектные полномочия. После проверки
          менеджером центра профиль попадает в публичный реестр специалистов.
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-tz-danger/30 bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-4 rounded-xl border border-tz-success/30 bg-tz-success-soft px-4 py-3 text-sm text-tz-success">
          {notice}
        </div>
      )}

      {/* Данные и действия: карточка профиля */}
      {profile && (
        <div className="tz-card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tz-accent-soft text-tz-accent">
                <UserRound size={20} />
              </span>
              <div>
                <p className="font-bold text-tz-fg">{session?.user?.name ?? session?.user?.email}</p>
                <p className="font-mono text-xs text-tz-muted">id {profile.id}</p>
              </div>
            </div>
            <StateBadge state={profile.state} />
          </div>

          {profile.review_comment && (
            <div className="mt-4 rounded-xl border border-tz-border bg-tz-bg px-4 py-3 text-sm text-tz-secondary">
              <span className="font-semibold text-tz-fg">Комментарий проверки: </span>
              {profile.review_comment}
            </div>
          )}

          {/* Следующий шаг — честная подсказка по состоянию */}
          <div className="mt-4 rounded-xl border border-tz-card-border bg-tz-soft px-4 py-3 text-sm text-tz-secondary">
            <span className="font-semibold text-tz-fg">Следующий шаг. </span>
            {NEXT_STEP_HINTS[profile.state] ?? "Проверьте данные профиля."}
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="tz-label">Должность (обязательно для отправки)</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                disabled={!editable}
                className="tz-input disabled:opacity-60"
                placeholder="Например: ведущий инженер-исследователь"
              />
            </label>
            <label className="block">
              <span className="tz-label">Регион</span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={!editable}
                className="tz-input disabled:opacity-60"
                placeholder="Удмуртская Республика"
              />
            </label>
            <label className="block">
              <span className="tz-label">Компетенции (через запятую)</span>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                disabled={!editable}
                className="tz-input disabled:opacity-60"
                placeholder="машинное обучение, компьютерное зрение"
              />
            </label>
            <label className="block">
              <span className="tz-label">О себе</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={!editable}
                rows={3}
                className="tz-textarea disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={saveProfile}
              disabled={!editable}
              className="tz-btn tz-btn-primary disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Сохранить
            </button>
            <button
              onClick={submitProfile}
              disabled={!editable}
              className="tz-btn tz-btn-secondary disabled:opacity-50"
            >
              <Send size={16} /> Отправить на проверку
            </button>
          </div>
        </div>
      )}

      {/* Данные и действия: организации */}
      <div className="tz-card mt-8 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tz-accent-soft text-tz-accent">
            <Building2 size={20} />
          </span>
          <div>
            <h2 className="tz-section-title">Мои организации</h2>
            <p className="text-sm text-tz-muted">Можно состоять в нескольких организациях</p>
          </div>
        </div>

        {orgs.length === 0 ? (
          <p className="mt-4 text-sm text-tz-secondary">Пока нет организаций.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {orgs.map((org) => (
              <li key={org.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-tz-border bg-tz-bg px-4 py-3">
                <div>
                  <p className="font-semibold text-tz-fg">{org.name}</p>
                  <p className="text-xs text-tz-muted">
                    {[org.ogrn, org.region, org.member_role === "admin" ? "администратор" : "участник"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <StateBadge state={org.state} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 grid gap-3 border-t border-tz-border pt-5">
          <p className="text-sm font-semibold text-tz-fg">Создать организацию</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Название организации" placeholder="Например: ООО «Технопром»" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            <TextField label="ОГРН" placeholder="13 цифр" value={orgOgrn} onChange={(e) => setOrgOgrn(e.target.value)} inputMode="numeric" />
            <TextField label="Тип организации" placeholder="НИИ, ООО, АО…" value={orgType} onChange={(e) => setOrgType(e.target.value)} />
            <TextField label="Регион" placeholder="Удмуртская Республика" value={orgRegion} onChange={(e) => setOrgRegion(e.target.value)} />
          </div>
          <TextAreaField label="Описание" placeholder="Краткое описание деятельности организации" value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)} rows={2} />
          <button
            onClick={createOrg}
            disabled={!orgName.trim()}
            className="tz-btn tz-btn-primary w-fit disabled:opacity-50"
          >
            <PlusCircle size={16} /> Создать
          </button>

          <p className="mt-2 text-sm font-semibold text-tz-fg">Вступить по номеру</p>
          <div className="flex gap-3">
            <TextField
              label="ID организации"
              placeholder="id организации"
              inputMode="numeric"
              value={joinOrgId}
              onChange={(e) => setJoinOrgId(e.target.value)}
              className="w-48"
            />
            <button
              onClick={joinOrg}
              disabled={!joinOrgId.trim()}
              className="tz-btn tz-btn-secondary self-end disabled:opacity-50"
            >
              Вступить
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
