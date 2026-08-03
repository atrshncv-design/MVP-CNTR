"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, FileClock, FolderKanban, GitPullRequest, Inbox, Loader2, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
type Tab = "new" | "upgrades" | "all";
type Draft = { id: number; name: string; description: string | null; preliminary_level: number | null; current_level: number; target_level: number; status: string; rejection_reason: string | null };
type Project = { id: number; name: string; description: string | null; category: string | null; current_level: number; target_level: number; status: string; budget: number | null };
type Promotion = { id: number; project_id: number; project_name: string; from_level: number; to_level: number; status: string; rejection_reason: string | null; attempt_no: number; evaluation_result: { success?: boolean; missing?: string[]; summary?: string }; verification_docs: Array<{ id: number; title: string }> };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const statusLabels: Record<string, string> = { draft: "Черновик", published: "Опубликован", active: "В работе", rejected: "Отклонён" };
const badge: Record<string, string> = { draft: "tz-badge-review", published: "tz-badge-success", active: "tz-badge-accent", rejected: "tz-badge-danger" };
function budget(value: number | null) { return value == null ? "Бюджет не указан" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value); }
function detail(data: unknown, fallback: string) { return data && typeof data === "object" && typeof (data as { detail?: unknown }).detail === "string" ? (data as { detail: string }).detail : fallback; }

export default function CntrManagerDashboard() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [tab, setTab] = useState<Tab>("new");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const [draftRes, promotionRes, projectRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/manager/queue/drafts`, { headers: auth(token) }),
        fetch(`${API_URL}/api/v1/manager/queue/promotions`, { headers: auth(token) }),
        fetch(`${API_URL}/api/v1/projects`, { headers: auth(token) }),
      ]);
      const responses = [draftRes, promotionRes, projectRes];
      const failed = responses.find((r) => !r.ok);
      if (failed) throw new Error(`Не удалось загрузить очередь (${failed.status}).`);
      setDrafts(await draftRes.json()); setPromotions(await promotionRes.json()); setProjects(await projectRes.json());
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось загрузить очередь."); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const decideDraft = async (id: number, approve: boolean) => {
    if (!token) return;
    const reason = approve ? undefined : window.prompt("Причина отклонения карточки")?.trim();
    if (!approve && !reason) return;
    setBusy(id);
    try { const res = await fetch(`${API_URL}/api/v1/manager/queue/drafts/${id}/decide`, { method: "POST", headers: { ...auth(token), "Content-Type": "application/json" }, body: JSON.stringify({ approve, level: approve ? drafts.find((d) => d.id === id)?.preliminary_level : undefined, reason }) }); if (!res.ok) throw new Error(detail(await res.json().catch(() => null), `Ошибка решения (${res.status}).`)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось обработать карточку."); } finally { setBusy(null); }
  };
  const decidePromotion = async (id: number, approve: boolean) => {
    if (!token) return;
    const reason = approve ? undefined : window.prompt("Причина отклонения заявки")?.trim();
    if (!approve && !reason) return;
    setBusy(id);
    try { const res = await fetch(`${API_URL}/api/v1/manager/queue/promotions/${id}/decide`, { method: "POST", headers: { ...auth(token), "Content-Type": "application/json" }, body: JSON.stringify({ approve, reason }) }); if (!res.ok) throw new Error(detail(await res.json().catch(() => null), `Ошибка решения (${res.status}).`)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось обработать заявку."); } finally { setBusy(null); }
  };

  const active = projects.filter((p) => p.status === "published" || p.status === "active").length;
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  const cards = [{ label: "Все проекты", value: projects.length, icon: FolderKanban }, { label: "Активные", value: active, icon: ShieldCheck }, { label: "Новые проекты", value: drafts.length, icon: FileClock }, { label: "Бюджет портфеля", value: totalBudget ? budget(totalBudget) : "—", icon: Wallet }];
  const visibleProjects = useMemo(() => tab === "all" ? projects : [], [projects, tab]);

  return <section data-od-id="manager-dashboard">
    <div className="border-b border-tz-border pb-6"><p className="tz-eyebrow">Рабочий стол менеджера ЦНТР</p><h1 className="tz-page-title mt-2">Очереди верификации</h1><p className="mt-2 max-w-2xl text-tz-secondary">Проверяйте карточки проектов и заявки на повышение УГТ. Финальное решение по уровню остаётся за менеджером ЦНТР.</p></div>
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <div className="tz-card tz-stat p-5" key={label}><div className="tz-stat-label">{label}<span className="tz-stat-icon bg-tz-accent-soft text-tz-accent"><Icon size={18} /></span></div>{loading ? <div className="h-8 w-16 animate-pulse rounded bg-tz-soft" /> : <p className="tz-stat-value">{value}</p>}</div>)}</div>
    <div className="mt-10"><div className="tz-tabs" role="tablist"><button className={`tz-tab ${tab === "new" ? "tz-tab-active" : ""}`} onClick={() => setTab("new")}>Новые проекты <span className="tz-tab-count">{drafts.length}</span></button><button className={`tz-tab ${tab === "upgrades" ? "tz-tab-active" : ""}`} onClick={() => setTab("upgrades")}>Заявки на повышение УГТ <span className="tz-tab-count">{promotions.length}</span></button><button className={`tz-tab ${tab === "all" ? "tz-tab-active" : ""}`} onClick={() => setTab("all")}>Все проекты <span className="tz-tab-count">{projects.length}</span></button></div>
      <div className="mt-6">{loading ? <div className="tz-card h-32 animate-pulse bg-tz-soft" /> : error ? <div className="tz-card tz-empty"><AlertCircle className="text-tz-danger" size={32} /><p className="tz-empty-title">{error}</p><button className="tz-btn tz-btn-secondary" onClick={() => void load()}><RefreshCw size={15} /> Повторить</button></div> : tab === "new" ? <div className="space-y-4">{drafts.length === 0 ? <Empty icon={<Inbox size={22} />} title="Новых проектов на апрув нет" text="Черновики появляются здесь после экспресс-оценки УГТ. После апрува карточка публикуется в общем реестре." /> : drafts.map((draft) => <div className="tz-card p-5" key={draft.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-tz-muted">ЦНТР-{draft.id}</span><span className={`tz-badge ${badge.draft}`}>{statusLabels.draft}</span></div><h2 className="mt-2 text-lg font-bold text-tz-fg">{draft.name}</h2><p className="mt-1 text-sm text-tz-muted">Предварительный уровень: <span className="font-mono font-semibold">УГТ {draft.preliminary_level ?? "—"}</span></p>{draft.description && <p className="mt-2 text-sm text-tz-secondary">{draft.description}</p>}</div><div className="flex gap-2"><button className="tz-btn tz-btn-primary" disabled={busy === draft.id} onClick={() => void decideDraft(draft.id, true)}>{busy === draft.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Апрувнуть и присвоить УГТ</button><button className="tz-btn tz-btn-danger" disabled={busy === draft.id} onClick={() => void decideDraft(draft.id, false)}><X size={15} /> Отклонить</button></div></div></div>)}</div> : tab === "upgrades" ? <div className="space-y-4">{promotions.length === 0 ? <Empty icon={<GitPullRequest size={22} />} title="Заявок на повышение пока нет" text="Заявка формируется автоматически после полного комплекта документов этапа и успешной предварительной оценки." /> : promotions.map((request) => <div className="tz-card p-5" key={request.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="font-mono text-xs text-tz-muted">Заявка #{request.id} · попытка {request.attempt_no}</span><span className="tz-badge tz-badge-review">На проверке</span></div><h2 className="mt-2 text-lg font-bold text-tz-fg">{request.project_name}</h2><p className="mt-1 text-sm text-tz-secondary">УГТ {request.from_level} <ArrowRight className="mx-1 inline" size={14} /> УГТ {request.to_level}</p><p className="mt-2 text-sm text-tz-muted">{request.evaluation_result.summary || "Предварительная оценка успешно пройдена."}</p>{request.verification_docs.length > 0 && <p className="mt-1 text-xs text-tz-accent">Верифицирующих документов: {request.verification_docs.length}</p>}</div><div className="flex gap-2"><button className="tz-btn tz-btn-primary" disabled={busy === request.id} onClick={() => void decidePromotion(request.id, true)}><Check size={15} /> Подтвердить</button><button className="tz-btn tz-btn-danger" disabled={busy === request.id} onClick={() => void decidePromotion(request.id, false)}><X size={15} /> Отклонить</button></div></div></div>)}</div> : <div className="space-y-4">{visibleProjects.length === 0 ? <Empty icon={<FolderKanban size={22} />} title="Опубликованных проектов пока нет" text="После апрува карточки появятся здесь и в общем реестре." /> : visibleProjects.map((p) => <Link className="tz-card tz-card-hover block p-5" href={`/dashboard/project/${p.id}`} key={p.id}><div className="flex items-center justify-between"><div><span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span><h2 className="mt-1 font-bold text-tz-fg">{p.name}</h2><p className="text-sm text-tz-muted">УГТ {p.current_level} · {budget(p.budget)}</p></div><ArrowRight className="text-tz-muted" size={18} /></div></Link>)}</div>}</div></div>
  </section>;
}
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="tz-card tz-empty"><span className="tz-empty-icon">{icon}</span><h2 className="tz-empty-title">{title}</h2><p className="tz-empty-text">{text}</p></div>; }
