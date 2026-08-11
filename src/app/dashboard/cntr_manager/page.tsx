"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, FileClock, FolderKanban, GitPullRequest, Inbox, Loader2, ShieldCheck, Wallet, X } from "lucide-react";
import ProfileVerificationQueue from "@/components/profile-verification-queue";
import { AssessUgTCard } from "@/components/assess-ugt-card";
import { CardSkeleton, EmptyState, ErrorState } from "@/components/states";
import {
  decideManagerDraft,
  decideManagerPromotion,
  getManagerDraftQueue,
  getManagerPromotions,
  getProjects,
  type DraftProject,
  type PromotionRequest,
  type ProjectSummary,
} from "@/lib/api-client";

type Tab = "new" | "upgrades" | "all";

const statusLabels: Record<string, string> = { draft: "Черновик", auto_confirmed: "Подтверждён автоматически", published: "Опубликован", active: "В работе", rejected: "Отклонён" };
const badge: Record<string, string> = { draft: "tz-badge-review", published: "tz-badge-success", active: "tz-badge-accent", rejected: "tz-badge-danger" };
function budget(value: number | null) { return value == null ? "Бюджет не указан" : new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value); }

export default function CntrManagerDashboard() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [tab, setTab] = useState<Tab>("new");
  const [drafts, setDrafts] = useState<DraftProject[]>([]);
  const [promotions, setPromotions] = useState<PromotionRequest[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [history, setHistory] = useState<Record<number, unknown[]>>({});
  const [historyLoading, setHistoryLoading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      // Реальные очереди менеджера и общий реестр проектов (api-client).
      const [draftQueue, promotionQueue, projectList] = await Promise.all([
        getManagerDraftQueue(token),
        getManagerPromotions(token),
        getProjects(token),
      ]);
      setDrafts(draftQueue); setPromotions(promotionQueue); setProjects(projectList);
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
    try { await decideManagerDraft(token, id, { approve, level: approve ? drafts.find((d) => d.id === id)?.preliminary_level : undefined, reason }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось обработать карточку."); } finally { setBusy(null); }
  };
  const decidePromotion = async (id: number, approve: boolean) => {
    if (!token) return;
    const reason = approve ? undefined : window.prompt("Причина отклонения заявки")?.trim();
    if (!approve && !reason) return;
    const missingText = approve ? undefined : window.prompt("Недостающие материалы (через запятую)")?.trim();
    const missing = missingText ? missingText.split(",").map((s) => s.trim()).filter(Boolean) : [];
    setBusy(id);
    try { await decideManagerPromotion(token, id, { approve, reason, missing }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Не удалось обработать заявку."); } finally { setBusy(null); }
  };

  const active = projects.filter((p) => p.status === "published" || p.status === "active").length;
  const toggleHistory = async (projectId: number) => {
    if (!token) return;
    if (history[projectId]) { setHistory((h) => { const n = { ...h }; delete n[projectId]; return n; }); return; }
    setHistoryLoading(projectId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1/manager/queue/history/${projectId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Ошибка истории (${res.status}).`);
      const items: unknown[] = await res.json();
      setHistory((h) => ({ ...h, [projectId]: items }));
    } catch { setError("Не удалось загрузить историю попыток."); }
    finally { setHistoryLoading(null); }
  };
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
  const cards = [{ label: "Все проекты", value: projects.length, icon: FolderKanban }, { label: "Активные", value: active, icon: ShieldCheck }, { label: "Новые проекты", value: drafts.length, icon: FileClock }, { label: "Бюджет портфеля", value: totalBudget ? budget(totalBudget) : "—", icon: Wallet }];
  const visibleProjects = useMemo(() => tab === "all" ? projects : [], [projects, tab]);

  return <section data-od-id="manager-dashboard">
    <div className="border-b border-tz-border pb-6"><p className="tz-eyebrow">Рабочий стол менеджера ЦНТР</p><h1 className="tz-page-title mt-2">Очереди верификации</h1><p className="mt-2 max-w-2xl text-tz-secondary">Проверяйте карточки проектов и заявки на повышение УГТ. Финальное решение по уровню остаётся за менеджером ЦНТР.</p></div>
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <div className="tz-card tz-stat p-5" key={label}><div className="tz-stat-label">{label}<span className="tz-stat-icon bg-tz-accent-soft text-tz-accent"><Icon size={18} /></span></div>{loading ? <div className="h-8 w-16 animate-pulse rounded bg-tz-soft" /> : <p className="tz-stat-value">{value}</p>}</div>)}</div>
    <div className="mt-10"><div className="tz-tabs" role="tablist"><button className={`tz-tab ${tab === "new" ? "tz-tab-active" : ""}`} onClick={() => setTab("new")}>Новые проекты <span className="tz-tab-count">{drafts.length}</span></button><button className={`tz-tab ${tab === "upgrades" ? "tz-tab-active" : ""}`} onClick={() => setTab("upgrades")}>Заявки на повышение УГТ <span className="tz-tab-count">{promotions.length}</span></button><button className={`tz-tab ${tab === "all" ? "tz-tab-active" : ""}`} onClick={() => setTab("all")}>Все проекты <span className="tz-tab-count">{projects.length}</span></button></div>
      <div className="mt-6">{loading ? <CardSkeleton bodyClassName="h-32" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : tab === "new" ? <div className="space-y-4">{drafts.length === 0 ? <EmptyState icon={<Inbox size={22} />} title="Новых проектов на апрув нет" text="Черновики появляются здесь после экспресс-оценки УГТ. После апрува карточка публикуется в общем реестре." /> : drafts.map((draft) => <div className="tz-card p-5" key={draft.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-tz-muted">ЦНТР-{draft.id}</span><span className={`tz-badge ${badge.draft}`}>{statusLabels.draft}</span></div><h2 className="mt-2 text-lg font-bold text-tz-fg">{draft.name}</h2><p className="mt-1 text-sm text-tz-muted">Предварительный уровень: <span className="font-mono font-semibold">УГТ {draft.preliminary_level ?? "—"}</span></p>{draft.description && <p className="mt-2 text-sm text-tz-secondary">{draft.description}</p>}</div><div className="flex gap-2"><button className="tz-btn tz-btn-primary" disabled={busy === draft.id} onClick={() => void decideDraft(draft.id, true)}>{busy === draft.id ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Апрувнуть и присвоить УГТ</button><button className="tz-btn tz-btn-danger" disabled={busy === draft.id} onClick={() => void decideDraft(draft.id, false)}><X size={15} /> Отклонить</button></div></div></div>)}</div> : tab === "upgrades" ? <div className="space-y-4">{promotions.length === 0 ? <EmptyState icon={<GitPullRequest size={22} />} title="Заявок на повышение пока нет" text="Заявка формируется автоматически после полного комплекта документов этапа и успешной предварительной оценки." /> : promotions.map((request) => <div className="tz-card p-5" key={request.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="font-mono text-xs text-tz-muted">Заявка #{request.id} · попытка {request.attempt_no}</span><span className="tz-badge tz-badge-review">На проверке</span></div><h2 className="mt-2 text-lg font-bold text-tz-fg">{request.project_name}</h2><p className="mt-1 text-sm text-tz-secondary">УГТ {request.from_level} <ArrowRight className="mx-1 inline" size={14} /> УГТ {request.to_level}</p><p className="mt-2 text-sm text-tz-muted">{request.evaluation_result.summary || "Предварительная оценка успешно пройдена."}</p>{request.verification_docs.length > 0 && <p className="mt-1 text-xs text-tz-accent">Верифицирующих документов: {request.verification_docs.length}</p>}<button className="mt-2 text-xs text-tz-accent underline underline-offset-2" onClick={() => void toggleHistory(request.project_id)}>{history[request.project_id] ? "Скрыть историю попыток" : historyLoading === request.project_id ? "Загрузка…" : "История попыток"}</button>{history[request.project_id] && <div className="mt-2 rounded border border-tz-border p-3 text-sm text-tz-secondary">{history[request.project_id].length === 0 ? "Попыток пока не было." : (history[request.project_id] as Array<{ attempt_no: number; status: string; rejection_reason: string | null }>).map((h) => <div className="flex flex-wrap items-center gap-2 py-1" key={h.attempt_no}><span className="font-mono text-xs text-tz-muted">попытка {h.attempt_no}</span><span className={`tz-badge ${h.status === "rejected" ? "tz-badge-danger" : "tz-badge-review"}`}>{h.status}</span>{h.rejection_reason && <span className="text-xs">{h.rejection_reason}</span>}</div>)}</div>}</div><div className="flex gap-2"><button className="tz-btn tz-btn-primary" disabled={busy === request.id} onClick={() => void decidePromotion(request.id, true)}><Check size={15} /> Подтвердить</button><button className="tz-btn tz-btn-danger" disabled={busy === request.id} onClick={() => void decidePromotion(request.id, false)}><X size={15} /> Отклонить</button></div></div></div>)}</div> : <div className="space-y-4">{visibleProjects.length === 0 ? <EmptyState icon={<FolderKanban size={22} />} title="Опубликованных проектов пока нет" text="После апрува карточки появятся здесь и в общем реестре." /> : visibleProjects.map((p) => <Link className="tz-card tz-card-hover block p-5" href={`/dashboard/project/${p.id}`} key={p.id}><div className="flex items-center justify-between"><div><span className="font-mono text-xs text-tz-muted">ЦНТР-{p.id}</span><h2 className="mt-1 font-bold text-tz-fg">{p.name}</h2><p className="text-sm text-tz-muted">УГТ {p.current_level} · {budget(p.budget)}</p></div><ArrowRight className="text-tz-muted" size={18} /></div></Link>)}</div>}</div>
      </div>
      <ProfileVerificationQueue />
      <div className="mt-6"><AssessUgTCard /></div>
  </section>;
}
