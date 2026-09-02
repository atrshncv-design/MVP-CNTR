"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, FileX2, PlusCircle, Send, UserRound } from "lucide-react";

import AchievementsShowcase from "@/components/dashboard/achievements-showcase";
import { CLIENT_API_BASE } from "@/lib/public-api";


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
  draft: { label: "Черновик", cls: "bg-tz-surface-2 text-tz-secondary", icon: FileX2 },
  pending: { label: "На проверке", cls: "bg-tz-warning-soft text-tz-warning-fg", icon: Clock },
  verified: { label: "Подтверждён", cls: "bg-tz-success-soft text-tz-success-fg", icon: CheckCircle2 },
  rejected: { label: "Отклонён", cls: "bg-tz-danger-soft text-tz-danger-fg", icon: FileX2 },
};

function StateBadge({ state }: { state: string }) {
  const meta = STATE_LABELS[state] ?? STATE_LABELS.draft;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.cls}`}>
      <Icon size={13} />
      {meta.label}
    </span>
  );
}

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
      const res = await fetch(`${CLIENT_API_BASE}/api/v1/profile`, {
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
    const res = await fetch(`${CLIENT_API_BASE}/api/v1${path}`, {
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
      <div className="border-b border-tz-border pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">Профиль специалиста</p>
        <h1 className="tz-page-title mt-2 text-tz-fg">Мой профиль</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Основная роль аккаунта определяет профильный реестр, но не проектные полномочия. После проверки
          менеджером центра профиль попадает в публичный реестр специалистов.
        </p>
      </div>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-tz-danger-border bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger-fg">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mt-4 rounded-xl border border-tz-success-border bg-tz-success-soft px-4 py-3 text-sm text-tz-success-fg">
          {notice}
        </div>
      )}

      {profile && (
        <div className="mt-6 rounded-2xl border border-tz-card-border bg-tz-surface p-6">
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

          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="text-sm font-medium text-tz-secondary">Должность (обязательно для отправки)</span>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg disabled:opacity-60"
                placeholder="Например: ведущий инженер-исследователь"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-tz-secondary">Регион</span>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg disabled:opacity-60"
                placeholder="Удмуртская Республика"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-tz-secondary">Компетенции (через запятую)</span>
              <input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                disabled={!editable}
                className="mt-1 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg disabled:opacity-60"
                placeholder="машинное обучение, компьютерное зрение"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-tz-secondary">О себе</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                disabled={!editable}
                rows={3}
                className="mt-1 w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg disabled:opacity-60"
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={saveProfile}
              disabled={!editable}
              className="inline-flex items-center gap-2 rounded-lg bg-tz-accent px-4 py-2 font-semibold text-white transition hover:bg-tz-accent-hover disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Сохранить
            </button>
            <button
              onClick={submitProfile}
              disabled={!editable}
              className="inline-flex items-center gap-2 rounded-lg border border-tz-border px-4 py-2 font-semibold text-tz-fg transition hover:border-tz-accent hover:text-tz-accent disabled:opacity-50"
            >
              <Send size={16} /> Отправить на проверку
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-tz-card-border bg-tz-surface p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tz-accent-soft text-tz-accent">
            <Building2 size={20} />
          </span>
          <div>
            <h2 className="tz-section-title text-tz-fg">Мои организации</h2>
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
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Название *" className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg" />
            <input value={orgOgrn} onChange={(e) => setOrgOgrn(e.target.value)} placeholder="ОГРН" className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg" />
            <input value={orgType} onChange={(e) => setOrgType(e.target.value)} placeholder="Тип (НИИ, ООО…)" className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg" />
            <input value={orgRegion} onChange={(e) => setOrgRegion(e.target.value)} placeholder="Регион" className="rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg" />
          </div>
          <textarea value={orgDesc} onChange={(e) => setOrgDesc(e.target.value)} rows={2} placeholder="Описание" className="w-full rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg" />
          <button
            onClick={createOrg}
            disabled={!orgName.trim()}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-tz-accent px-4 py-2 font-semibold text-white transition hover:bg-tz-accent-hover disabled:opacity-50"
          >
            <PlusCircle size={16} /> Создать
          </button>

          <p className="mt-2 text-sm font-semibold text-tz-fg">Вступить по номеру</p>
          <div className="flex gap-3">
            <input
              value={joinOrgId}
              onChange={(e) => setJoinOrgId(e.target.value)}
              placeholder="id организации"
              inputMode="numeric"
              className="w-48 rounded-lg border border-tz-border bg-tz-bg px-3 py-2 text-tz-fg"
            />
            <button
              onClick={joinOrg}
              disabled={!joinOrgId.trim()}
              className="rounded-lg border border-tz-border px-4 py-2 font-semibold text-tz-fg transition hover:border-tz-accent hover:text-tz-accent disabled:opacity-50"
            >
              Вступить
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <AchievementsShowcase />
      </div>
    </section>
  );
}
