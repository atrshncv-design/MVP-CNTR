'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

type Requirement = { id: number; from_level: number; to_level: number; title: string; description: string; uploaded: boolean };
type Evaluation = { request_id: number | null; success: boolean; missing: string[]; summary: string };

function errorText(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && typeof (data as { detail?: unknown }).detail === 'string') return (data as { detail: string }).detail;
  return fallback;
}

export default function StageProgressPanel({ projectId, currentLevel, status }: { projectId: number; currentLevel: number; status: string }) {
  const { data: session } = useSession();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = session?.user?.accessToken;
  const load = useCallback(async () => {
    if (!token || status !== 'published') { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/stage-requirements`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorText(data, `Не удалось загрузить требования (${res.status}).`));
      const list = data as Requirement[];
      setRequirements(list);
      setSelectedId((current) => current ?? list.find((item) => !item.uploaded)?.id ?? list[0]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить требования.'); }
    finally { setLoading(false); }
  }, [projectId, status, token]);

  useEffect(() => {
    (async () => { await load(); })();
  }, [load]);

  const upload = async () => {
    if (!token || !selectedId || !title.trim() || !content.trim()) { setError('Выберите требование и заполните название и содержание документа.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/stage-documents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage_requirement_id: selectedId, title: title.trim(), content: content.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorText(data, `Не удалось загрузить документ (${res.status}).`));
      setTitle(''); setContent(''); await load();
      if (data?.request_id) {
        const evaluationRes = await fetch(`${API_URL}/api/v1/projects/${projectId}/stage-evaluate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const evaluationData = await evaluationRes.json().catch(() => null);
        if (evaluationRes.ok) setEvaluation(evaluationData as Evaluation);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить документ.'); }
    finally { setBusy(false); }
  };

  const evaluate = async () => {
    if (!token) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/stage-evaluate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorText(data, `Не удалось выполнить оценку (${res.status}).`));
      setEvaluation(data as Evaluation);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выполнить оценку.'); }
    finally { setBusy(false); }
  };

  if (status !== 'published') return null;
  return (
    <section className="tz-card p-6" data-od-id="stage-progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="tz-eyebrow">Доработка проекта</p><h2 className="mt-1 text-xl font-bold text-tz-fg">Этап УГТ {currentLevel} → {currentLevel + 1}</h2><p className="mt-1 text-sm text-tz-muted">Документы проверяются предварительно по ГОСТам. Финальное решение принимает менеджер ЦНТР.</p></div>
        <button className="tz-btn tz-btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Обновить</button>
      </div>
      {loading ? <div className="mt-5 h-20 animate-pulse rounded-xl bg-tz-soft" /> : error ? <div className="mt-5 rounded-xl bg-tz-danger-soft p-4 text-sm text-tz-danger">{error}</div> : <>
        <div className="mt-5 space-y-2">{requirements.map((r) => <div key={r.id} className="flex items-start gap-3 rounded-xl border border-tz-border p-3"><span className={`mt-0.5 ${r.uploaded ? 'text-tz-success' : 'text-tz-muted'}`}>{r.uploaded ? <CheckCircle2 size={18} /> : <FileUp size={18} />}</span><div className="min-w-0"><p className="text-sm font-semibold text-tz-fg">{r.title}</p><p className="text-xs text-tz-muted">{r.description}</p></div><span className="ml-auto shrink-0 text-xs text-tz-muted">{r.uploaded ? 'Загружено' : 'Не загружено'}</span></div>)}</div>
        <div className="mt-5 grid gap-3 md:grid-cols-2"><select className="tz-select" value={selectedId ?? ''} onChange={(e) => setSelectedId(Number(e.target.value))}>{requirements.filter((r) => !r.uploaded).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}</select><input className="tz-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа" /></div>
        <textarea className="tz-input mt-3 min-h-24" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Краткое содержание или ссылка на документ" />
        <div className="mt-3 flex flex-wrap gap-3"><button className="tz-btn tz-btn-primary" onClick={() => void upload()} disabled={busy || requirements.every((r) => r.uploaded)}>{busy ? <Loader2 className="animate-spin" size={15} /> : <FileUp size={15} />} Загрузить документ</button><button className="tz-btn tz-btn-secondary" onClick={() => void evaluate()} disabled={busy}>Повторить предварительную оценку</button></div>
        {evaluation && <div className={`mt-4 rounded-xl p-4 ${evaluation.success ? 'bg-tz-success-soft text-tz-success' : 'bg-tz-danger-soft text-tz-danger'}`}><div className="flex items-center gap-2 font-semibold">{evaluation.success ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {evaluation.success ? 'Предварительная оценка успешно пройдена' : 'Предварительная оценка неуспешна'}</div><p className="mt-1 text-sm">{evaluation.summary || 'Результат сохранён в заявке.'}</p>{evaluation.missing.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{evaluation.missing.map((item) => <li key={item}>{item}</li>)}</ul>}{evaluation.success && <p className="mt-2 text-sm font-medium">Заявка автоматически отправлена менеджеру ЦНТР.</p>}</div>}
      </>}
    </section>
  );
}
