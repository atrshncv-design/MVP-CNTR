'use client';

import { useEffect, useState } from 'react';
import { FileCheck, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';
type Project = { id: number; name: string; current_level: number };

export default function VerificationDocsPanel() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [fileRef, setFileRef] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/v1/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => { if (!res.ok) throw new Error(`Не удалось загрузить проекты (${res.status}).`); return res.json(); })
      .then((data: Project[]) => { setProjects(data.filter((p) => p.id)); setProjectId((current) => current || String(data[0]?.id ?? '')); })
      .catch((e: Error) => { setState('error'); setMessage(e.message); });
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !projectId || !title.trim()) { setState('error'); setMessage('Выберите проект и укажите название документа.'); return; }
    setState('loading'); setMessage('');
    const res = await fetch(`${API_URL}/api/v1/projects/${projectId}/verification-docs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim(), comment: comment.trim() || null, file_ref: fileRef.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setState('error'); setMessage(typeof data?.detail === 'string' ? data.detail : `Ошибка загрузки (${res.status}).`); return; }
    setState('success'); setMessage('Документ добавлен и передан в очередь менеджера ЦНТР.'); setTitle(''); setComment(''); setFileRef('');
  };

  return <section className="tz-card p-6" data-od-id="verification-docs"><div className="flex items-start gap-3"><span className="tz-stat-icon bg-tz-accent-soft text-tz-accent"><FileCheck size={20} /></span><div><p className="tz-eyebrow">Документы подтверждения</p><h2 className="mt-1 text-xl font-bold text-tz-fg">Добавить верифицирующий документ</h2><p className="mt-1 text-sm text-tz-muted">Сначала присоединитесь к карточке проекта по токену TZ. Документ станет доказательством для решения менеджера.</p></div></div>
    <form className="mt-5 space-y-3" onSubmit={submit}><select className="tz-select" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Выберите проект</option>{projects.map((p) => <option key={p.id} value={p.id}>ЦНТР-{p.id} · {p.name} · УГТ {p.current_level}</option>)}</select><input className="tz-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название документа" /><input className="tz-input" value={fileRef} onChange={(e) => setFileRef(e.target.value)} placeholder="Ссылка или идентификатор файла (необязательно)" /><textarea className="tz-input min-h-20" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Комментарий для менеджера" /><button className="tz-btn tz-btn-primary" disabled={state === 'loading'}>{state === 'loading' ? <Loader2 className="animate-spin" size={15} /> : <FileCheck size={15} />} Передать документ менеджеру</button></form>
    {message && <p className={`mt-3 text-sm ${state === 'success' ? 'text-tz-success' : 'text-tz-danger'}`}>{message}</p>}
  </section>;
}
