'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileCheck, FileText, Loader2, ShieldCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import {
  getProjectDetail,
  getProjects,
  uploadVerificationDoc,
  type VerificationDocument,
} from "@/lib/api-client";

type Project = { id: number; name: string; current_level: number };

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function VerificationDocsPanel() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [fileRef, setFileRef] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  /** Загружает верифицирующие документы выбранного проекта из карточки проекта (живой источник). */
  const loadDocs = useCallback(
    async (id: string) => {
      if (!token || !id) {
        setDocs([]);
        return;
      }
      setDocsLoading(true);
      try {
        const detail = await getProjectDetail(token, Number(id));
        setDocs(detail.verification_documents ?? []);
      } catch {
        setDocs([]);
      } finally {
        setDocsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) return;
    getProjects(token)
      .then((data) => {
        const list = data.filter((p) => p.id);
        setProjects(list);
        const target = projectId || String(list[0]?.id ?? '');
        setProjectId(target);
        return loadDocs(target);
      })
      .catch((e: Error) => {
        setState('error');
        setMessage(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !projectId || !title.trim()) {
      setState('error');
      setMessage('Выберите проект и укажите название документа.');
      return;
    }
    setState('loading');
    setMessage('');
    try {
      await uploadVerificationDoc(token, Number(projectId), {
        title: title.trim(),
        comment: comment.trim() || null,
        file_ref: fileRef.trim() || null,
      });
      setState('success');
      setMessage('Документ добавлен и передан в очередь менеджера ЦНТР.');
      setTitle('');
      setComment('');
      setFileRef('');
      await loadDocs(projectId);
    } catch (e) {
      setState('error');
      setMessage(e instanceof Error ? e.message : 'Ошибка загрузки документа.');
    }
  };

  return (
    <section className="tz-card p-6" data-od-id="verification-docs">
      <div className="flex items-start gap-3">
        <span className="tz-stat-icon bg-tz-accent-soft text-tz-accent">
          <FileCheck size={20} />
        </span>
        <div>
          <p className="tz-eyebrow">Документы подтверждения</p>
          <h2 className="tz-card-title mt-1">
            Верифицирующие документы УГТ
          </h2>
          <p className="mt-1 text-sm text-tz-muted">
            Сначала присоединитесь к карточке проекта по токену TZ. Документ станет
            доказательством для решения менеджера ЦНТР.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <select
          className="tz-select"
          aria-label="Проект для загрузки верифицирующих документов"
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            void loadDocs(e.target.value);
          }}
        >
          <option value="">Выберите проект</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              ЦНТР-{p.id} · {p.name} · УГТ {p.current_level}
            </option>
          ))}
        </select>
      </div>

      {/* Список уже загруженных верифицирующих документов (живой источник — карточка проекта) */}
      <div className="mt-5" data-od-id="verification-docs-list">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-tz-muted">
          Загруженные документы
        </p>
        {docsLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-tz-muted">
            <Loader2 size={15} className="animate-spin" /> Загружаем документы…
          </div>
        ) : docs.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-tz-border bg-tz-surface px-4 py-6 text-center">
            <ShieldCheck size={22} className="mx-auto text-tz-muted" />
            <p className="mt-2 text-sm text-tz-muted">
              Пока нет документов подтверждения по этому проекту.
            </p>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start gap-3 rounded-xl border border-tz-border bg-tz-surface px-4 py-3"
              >
                <FileText size={16} className="mt-0.5 shrink-0 text-tz-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-tz-fg">{doc.title}</p>
                  <p className="mt-0.5 text-xs text-tz-muted">
                    {doc.uploader_name ?? 'Пользователь'} · {formatDate(doc.created_at)}
                  </p>
                  {doc.comment && <p className="mt-1 text-xs text-tz-muted">{doc.comment}</p>}
                  {doc.file_ref && (
                    <p className="mt-1 break-all font-mono text-xs text-tz-muted">
                      {doc.file_ref}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="mt-5 space-y-3" onSubmit={submit}>
        <input
          className="tz-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Название документа"
          aria-describedby="verification-docs-message"
          placeholder="Название документа"
        />
        <input
          className="tz-input"
          value={fileRef}
          onChange={(e) => setFileRef(e.target.value)}
          aria-label="Ссылка или идентификатор файла"
          placeholder="Ссылка или идентификатор файла (необязательно)"
        />
        <textarea
          className="tz-input min-h-20"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-label="Комментарий для менеджера"
          placeholder="Комментарий для менеджера"
        />
        <button type="submit" className="tz-btn tz-btn-primary" disabled={state === 'loading'}>
          {state === 'loading' ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <FileCheck size={15} />
          )}
          Передать документ менеджеру
        </button>
      </form>

      {message && (
        <p
          id="verification-docs-message"
          aria-live="polite"
          className={`mt-3 text-sm ${state === 'success' ? 'text-tz-success' : 'text-tz-danger'}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
