'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowRight,
  Beaker,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Factory,
  Info,
  Loader2,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Wrench,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { UGT_LEVELS } from '@/lib/ugt-data';
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


type Dimension = 'scientific' | 'technical' | 'organizational' | 'production';
type AnswerStatus = 'not_started' | 'in_progress' | 'formed' | 'documented' | 'verified' | 'not_applicable';
type EvidenceStatus = 'missing' | 'draft' | 'ready' | 'verified';

interface EvidenceRequirement {
  code: string;
  title: string;
  required: boolean;
}

interface Checkpoint {
  code: string;
  number: number;
  ugt_level: number;
  title: string;
  explanation: string;
  dimensions: Dimension[];
  critical: boolean;
  evidence: EvidenceRequirement[];
}

interface TemplateOption {
  value: string;
  label: string;
  score_pct: number;
}

interface AssessmentTemplate {
  version: string;
  answer_statuses: TemplateOption[];
  evidence_statuses: TemplateOption[];
  checkpoints: Checkpoint[];
}

interface AnswerState {
  status: AnswerStatus;
  applicable: boolean;
  comment: string;
  evidence: Record<string, EvidenceStatus>;
}

interface ProjectInfo {
  name: string;
  description: string;
  category: string;
  targetLevel: number;
}

interface PreviewResult {
  preliminary_ugt: number;
  completion_pct: number;
  evidence_pct: number;
  confidence_pct: number;
  latest_checkpoint: number;
  not_applicable_count: number;
  dimension_scores: Record<Dimension, number>;
  level_scores: Array<{ ugt_level: number; percentage: number; achieved: boolean; checkpoint_codes: string[] }>;
  blockers: Array<{ checkpoint_code: string; title: string; status: AnswerStatus; critical: boolean }>;
}

const STATUS_LABELS: Record<AnswerStatus, string> = {
  not_started: 'Не начато',
  in_progress: 'В работе',
  formed: 'Сформировано',
  documented: 'Выполнено и документировано',
  verified: 'Подтверждено',
  not_applicable: 'Неприменимо',
};

const STATUS_SCORE: Record<AnswerStatus, number> = {
  not_started: 0,
  in_progress: 0.25,
  formed: 0.5,
  documented: 0.75,
  verified: 1,
  not_applicable: 0,
};

const EVIDENCE_SCORE: Record<EvidenceStatus, number> = {
  missing: 0,
  draft: 0.25,
  ready: 0.75,
  verified: 1,
};

const DIMENSION_CONFIG: Record<Dimension, { label: string; color: string; icon: typeof Beaker }> = {
  scientific: { label: 'Научная', color: 'var(--tz-accent-hover)', icon: Beaker },
  technical: { label: 'Техническая', color: 'var(--tz-success)', icon: Wrench },
  organizational: { label: 'Организационная', color: 'var(--tz-review)', icon: ClipboardCheck },
  production: { label: 'Производственная', color: 'var(--tz-ugt-2)', icon: Factory },
};

const TECH_CATEGORIES = [
  'Программное обеспечение',
  'Аппаратные средства',
  'Информационные системы',
  'Промышленные технологии',
  'Биотехнологии',
  'Энергетические технологии',
  'Материаловедение',
  'Робототехника',
  'Другое',
];

function getLevelColor(level: number): string {
  return UGT_LEVELS[level - 1]?.color ?? 'var(--tz-accent)';
}

function emptyAnswer(checkpoint: Checkpoint): AnswerState {
  return {
    status: 'not_started',
    applicable: true,
    comment: '',
    evidence: Object.fromEntries(checkpoint.evidence.map((item) => [item.code, 'missing'])) as Record<string, EvidenceStatus>,
  };
}

function calculatePreview(template: AssessmentTemplate, answers: Record<string, AnswerState>): PreviewResult {
  const applicable = template.checkpoints.filter((checkpoint) => answers[checkpoint.code]?.status !== 'not_applicable');
  const scoreFor = (checkpoint: Checkpoint) => STATUS_SCORE[answers[checkpoint.code]?.status ?? 'not_started'];
  const evidenceFor = (checkpoint: Checkpoint) => {
    if (!checkpoint.evidence.length) return scoreFor(checkpoint);
    return checkpoint.evidence.reduce((sum, requirement) => (
      sum + EVIDENCE_SCORE[answers[checkpoint.code]?.evidence[requirement.code] ?? 'missing']
    ), 0) / checkpoint.evidence.length;
  };
  const average = (items: Checkpoint[], getter: (checkpoint: Checkpoint) => number) => (
    items.length ? items.reduce((sum, item) => sum + getter(item), 0) / items.length : 0
  );
  const levelScores = Array.from({ length: 9 }, (_, index) => {
    const level = index + 1;
    const items = applicable.filter((checkpoint) => checkpoint.ugt_level === level);
    const critical = items.filter((checkpoint) => checkpoint.critical);
    const percentage = Math.round(average(items, scoreFor) * 1000) / 10;
    return {
      ugt_level: level,
      percentage,
      achieved: items.length > 0 && percentage >= 70 && critical.every((checkpoint) => scoreFor(checkpoint) >= 0.75),
      checkpoint_codes: items.map((checkpoint) => checkpoint.code),
    };
  });
  let preliminary_ugt = 0;
  for (const level of levelScores) {
    if (!level.achieved) break;
    preliminary_ugt = level.ugt_level;
  }
  const dimension_scores = Object.fromEntries(
    (Object.keys(DIMENSION_CONFIG) as Dimension[]).map((dimension) => [
      dimension,
      Math.round(average(applicable.filter((checkpoint) => checkpoint.dimensions.includes(dimension)), scoreFor) * 1000) / 10,
    ]),
  ) as Record<Dimension, number>;
  const completion_pct = Math.round(average(applicable, scoreFor) * 1000) / 10;
  const evidence_pct = Math.round(average(applicable, evidenceFor) * 1000) / 10;
  const confidence_pct = Math.round(average(applicable, (checkpoint) => scoreFor(checkpoint) * 0.4 + evidenceFor(checkpoint) * 0.6) * 1000) / 10;
  const nextLevel = Math.min(preliminary_ugt + 1, 9);
  const blockers = template.checkpoints
    .filter((checkpoint) => checkpoint.ugt_level === nextLevel && answers[checkpoint.code]?.status !== 'not_applicable')
    .filter((checkpoint) => scoreFor(checkpoint) < 0.75)
    .map((checkpoint) => ({
      checkpoint_code: checkpoint.code,
      title: checkpoint.title,
      status: answers[checkpoint.code]?.status ?? 'not_started',
      critical: checkpoint.critical,
    }));
  return {
    preliminary_ugt,
    completion_pct,
    evidence_pct,
    confidence_pct,
    latest_checkpoint: Math.max(0, ...applicable.filter((checkpoint) => scoreFor(checkpoint) >= 0.5).map((checkpoint) => checkpoint.number)),
    not_applicable_count: template.checkpoints.length - applicable.length,
    dimension_scores,
    level_scores: levelScores,
    blockers,
  };
}

function MetricCard({ label, value, hint, color }: { label: string; value: string; hint: string; color: string }) {
  return (
    <div className="rounded-2xl border border-tz-border bg-tz-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-tz-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs text-tz-muted">{hint}</p>
    </div>
  );
}

export default function QuestionnaireWizardClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [template, setTemplate] = useState<AssessmentTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: '', description: '', category: '', targetLevel: 9 });
  const [step, setStep] = useState<'info' | number | 'results'>('info');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/v1/assessments/template`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить актуальную версию анкеты.');
        return response.json() as Promise<AssessmentTemplate>;
      })
      .then((data) => {
        if (cancelled) return;
        setTemplate(data);
        setAnswers(Object.fromEntries(data.checkpoints.map((checkpoint) => [checkpoint.code, emptyAnswer(checkpoint)])));
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить анкету.');
      });
    return () => { cancelled = true; };
  }, []);

  const preview = useMemo(() => (template ? calculatePreview(template, answers) : null), [answers, template]);
  const currentCheckpoints = useMemo(
    () => (template && typeof step === 'number' ? template.checkpoints.filter((checkpoint) => checkpoint.ugt_level === step) : []),
    [step, template],
  );
  const answeredCount = useMemo(
    () => (template ? template.checkpoints.filter((checkpoint) => answers[checkpoint.code]?.status !== 'not_started').length : 0),
    [answers, template],
  );

  const updateAnswer = useCallback((code: string, patch: Partial<AnswerState>) => {
    setAnswers((current) => ({ ...current, [code]: { ...current[code], ...patch } }));
  }, []);

  const updateEvidence = useCallback((checkpointCode: string, evidenceCode: string, status: EvidenceStatus) => {
    setAnswers((current) => ({
      ...current,
      [checkpointCode]: {
        ...current[checkpointCode],
        evidence: { ...current[checkpointCode].evidence, [evidenceCode]: status },
      },
    }));
  }, []);

  const resetAssessment = useCallback(() => {
    if (!template) return;
    setAnswers(Object.fromEntries(template.checkpoints.map((checkpoint) => [checkpoint.code, emptyAnswer(checkpoint)])));
    setProjectInfo({ name: '', description: '', category: '', targetLevel: 9 });
    setStep('info');
    setSaveError(null);
  }, [template]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    if (!template) return;
    if (!projectInfo.name.trim()) {
      setSaveError('Укажите название проекта — оно обязательно для сохранения.');
      return;
    }
    if (!session?.user?.accessToken) {
      setSaveError('Сессия не активна. Войдите в систему и повторите попытку.');
      return;
    }
    const missingReasons = template.checkpoints.some((checkpoint) => {
      const answer = answers[checkpoint.code];
      return answer.status === 'not_applicable' && !answer.comment.trim();
    });
    if (missingReasons) {
      setSaveError('Для каждого ответа «Неприменимо» добавьте обоснование.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/assessments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.user.accessToken}` },
        body: JSON.stringify({
          name: projectInfo.name.trim(),
          description: projectInfo.description.trim() || null,
          category: projectInfo.category || null,
          target_level: projectInfo.targetLevel,
          template_version: template.version,
          answers: template.checkpoints.map((checkpoint) => ({
            checkpoint_code: checkpoint.code,
            status: answers[checkpoint.code].status,
            applicable: answers[checkpoint.code].status !== 'not_applicable',
            comment: answers[checkpoint.code].comment.trim() || null,
            evidence: checkpoint.evidence.map((evidence) => ({
              evidence_code: evidence.code,
              status: answers[checkpoint.code].evidence[evidence.code] ?? 'missing',
            })),
          })),
        }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail ? `Не удалось сохранить проект (${response.status}): ${detail.slice(0, 220)}` : `Не удалось сохранить проект (${response.status}).`);
      }
      const data = await response.json() as { id: number };
      router.push(`/dashboard/project/${data.id}`);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Не удалось сохранить проект.');
    } finally {
      setSaving(false);
    }
  }, [answers, projectInfo, router, session, template]);

  if (loadError) {
    return <div className="mx-auto max-w-3xl px-6 py-32"><div className="rounded-2xl border border-tz-danger bg-tz-danger-soft p-6 text-tz-danger"><AlertCircle className="mb-3" />{loadError}</div></div>;
  }
  if (!template) {
    return <div className="flex min-h-[60vh] items-center justify-center gap-3 text-tz-muted"><Loader2 className="animate-spin" />Загрузка актуальной анкеты…</div>;
  }

  const level = typeof step === 'number' ? UGT_LEVELS[step - 1] : null;
  const totalSteps = 9;
  const progress = step === 'info' ? 0 : step === 'results' ? 100 : Math.round((step / totalSteps) * 100);

  return (
    <div className="min-h-screen bg-tz-bg pb-20">
      <header className="px-4 pb-10 pt-28 text-white sm:px-8" style={{ background: "var(--tz-hero-bg)" }}>
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm text-tz-muted">Главная → Оценка проекта</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Экспресс-оценка готовности проекта</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--tz-hero-muted)]">Не просто «да/нет»: оцените 22 контрольных рубежа по степени достижения и готовности подтверждающих материалов.</p>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-tz-surface/10"><div className="h-full rounded-full bg-tz-accent transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <div className="mt-3 flex justify-between text-xs text-tz-muted"><span>{answeredCount} из {template.checkpoints.length} рубежей заполнено</span></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-8 sm:px-8">
        {step === 'info' && (
          <section className="mx-auto max-w-3xl rounded-3xl border border-tz-border bg-tz-surface p-6 shadow-sm sm:p-10">
            <div className="mb-8 flex items-start gap-4"><div className="rounded-2xl bg-tz-accent-soft p-3 text-tz-accent"><Target /></div><div><p className="text-sm font-semibold uppercase tracking-wide text-tz-accent">Шаг 1</p><h2 className="mt-1 text-3xl font-bold text-tz-fg">Расскажите о проекте</h2><p className="mt-2 leading-6 text-tz-muted">Эти данные будут сохранены вместе с результатом и помогут подобрать следующий этап развития.</p></div></div>
            <div className="space-y-5">
              <label className="block"><span className="mb-2 block text-sm font-semibold text-tz-secondary">Название проекта *</span><input value={projectInfo.name} onChange={(event) => setProjectInfo((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-tz-border px-4 py-3 outline-none focus:border-tz-accent focus:ring-2 focus:ring-tz-accent-soft" placeholder="Например, система контроля качества" /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold text-tz-secondary">Описание</span><textarea value={projectInfo.description} onChange={(event) => setProjectInfo((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full resize-none rounded-xl border border-tz-border px-4 py-3 outline-none focus:border-tz-accent focus:ring-2 focus:ring-tz-accent-soft" placeholder="Что создаётся, для кого и какую проблему решает?" /></label>
              <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-semibold text-tz-secondary">Тип технологии</span><select value={projectInfo.category} onChange={(event) => setProjectInfo((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-tz-border bg-tz-surface px-4 py-3 outline-none focus:border-tz-accent"><option value="">Выберите тип</option>{TECH_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-semibold text-tz-secondary">Целевой УГТ</span><select value={projectInfo.targetLevel} onChange={(event) => setProjectInfo((current) => ({ ...current, targetLevel: Number(event.target.value) }))} className="w-full rounded-xl border border-tz-border bg-tz-surface px-4 py-3 outline-none focus:border-tz-accent">{UGT_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label></div>
            </div>
            <div className="mt-8 flex justify-end"><button onClick={() => setStep(1)} className="inline-flex items-center gap-2 rounded-xl bg-tz-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-tz-accent-hover">Начать оценку <ArrowRight size={17} /></button></div>
          </section>
        )}

        {typeof step === 'number' && level && (
          <section>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-wide text-tz-accent">УГТ {step} · контрольные рубежи</p><h2 className="mt-1 text-3xl font-bold text-tz-fg">{level.name}</h2><p className="mt-2 max-w-3xl text-tz-muted">Выберите наиболее точное состояние каждого результата. Не отмечайте «подтверждено», если доказательства ещё не готовы.</p></div><div className="rounded-2xl border border-tz-border bg-tz-surface px-4 py-3 text-right shadow-sm"><p className="text-xs text-tz-muted">Заполнено в блоке</p><p className="font-mono text-2xl font-bold" style={{ color: getLevelColor(step) }}>{currentCheckpoints.filter((checkpoint) => answers[checkpoint.code].status !== 'not_started').length}/{currentCheckpoints.length}</p></div></div>
            <div className="space-y-4">
              {currentCheckpoints.map((checkpoint) => {
                const answer = answers[checkpoint.code];
                const dimensionLabel = checkpoint.dimensions.map((dimension) => DIMENSION_CONFIG[dimension].label).join(' · ');
                return <article key={checkpoint.code} className="overflow-hidden rounded-2xl border border-tz-border bg-tz-surface shadow-sm"><div className="p-5 sm:p-6"><div className="flex items-start gap-4"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-tz-soft font-mono text-sm font-bold text-tz-secondary">{checkpoint.number}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide text-tz-muted">{checkpoint.code}</span>{checkpoint.critical && <span className="rounded-full bg-tz-warning-soft px-2 py-1 text-[11px] font-semibold text-tz-warning">Критический рубеж</span>}<span className="text-xs text-tz-muted">{dimensionLabel}</span></div><h3 className="mt-2 text-lg font-semibold text-tz-fg">{checkpoint.title}</h3><p className="mt-2 leading-6 text-tz-secondary">{checkpoint.explanation}</p></div></div><div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{(['not_started', 'in_progress', 'formed', 'documented', 'verified', 'not_applicable'] as AnswerStatus[]).map((status) => <button key={status} onClick={() => updateAnswer(checkpoint.code, { status })} className={`min-h-12 rounded-xl border px-2 py-2 text-xs font-semibold transition ${answer.status === status ? 'border-tz-accent bg-tz-accent-soft text-tz-accent-hover shadow-sm' : 'border-tz-border bg-tz-surface text-tz-secondary hover:border-tz-accent hover:bg-tz-accent-soft'}`}>{STATUS_LABELS[status]}</button>)}</div>{answer.status === 'not_applicable' && <label className="mt-4 block"><span className="mb-2 flex items-center gap-2 text-sm font-semibold text-tz-warning"><Info size={15} />Почему этот рубеж неприменим?</span><textarea value={answer.comment} onChange={(event) => updateAnswer(checkpoint.code, { comment: event.target.value })} rows={2} className="w-full resize-none rounded-xl border border-tz-warning bg-tz-warning-soft px-4 py-3 text-sm outline-none focus:border-tz-warning" placeholder="Например: проект является программным продуктом и не имеет физической установочной серии." /></label>}{(['formed', 'documented', 'verified'].includes(answer.status)) && <div className="mt-5 rounded-2xl bg-tz-bg p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-tz-secondary"><FileCheck2 size={16} className="text-tz-accent" />Состояние подтверждающих материалов</div><div className="space-y-3">{checkpoint.evidence.map((evidence) => <div key={evidence.code} className="flex flex-col gap-2 rounded-xl border border-tz-border bg-tz-surface p-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-tz-secondary">{evidence.title}{evidence.required && <span className="ml-1 text-tz-danger">*</span>}</span><select value={answer.evidence[evidence.code] ?? 'missing'} onChange={(event) => updateEvidence(checkpoint.code, evidence.code, event.target.value as EvidenceStatus)} className="rounded-lg border border-tz-border bg-tz-surface px-2 py-2 text-xs font-medium text-tz-secondary outline-none focus:border-tz-accent">{(['missing', 'draft', 'ready', 'verified'] as EvidenceStatus[]).map((status) => <option key={status} value={status}>{status === 'missing' ? 'Отсутствует' : status === 'draft' ? 'Черновик' : status === 'ready' ? 'Готово' : 'Проверено'}</option>)}</select></div>)}</div></div>}</div></article>;
              })}
            </div>
            <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row"><button onClick={() => setStep(step === 1 ? 'info' : step - 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-tz-border bg-tz-surface px-5 py-3 font-semibold text-tz-secondary"><ChevronLeft size={17} />Назад</button><button onClick={() => setStep(step === 9 ? 'results' : step + 1)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-tz-accent px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-tz-accent-hover">{step === 9 ? 'Посмотреть результат' : 'Следующий блок'} <ChevronRight size={17} /></button></div>
          </section>
        )}

        {step === 'results' && preview && (
          <section>
            <div className="mb-8 text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-tz-accent-soft text-tz-accent"><Sparkles /></div><p className="text-sm font-semibold uppercase tracking-wide text-tz-accent">Предварительный результат</p><h2 className="mt-2 text-4xl font-bold text-tz-fg">Профиль готовности проекта</h2><p className="mx-auto mt-3 max-w-2xl leading-7 text-tz-muted">Это самооценка для первичной регистрации. Официальное подтверждение появится после проверки доказательств.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Предварительный УГТ" value={preview.preliminary_ugt ? `УГТ ${preview.preliminary_ugt}` : '—'} hint={preview.latest_checkpoint ? `До рубежа ${preview.latest_checkpoint}` : 'Недостаточно данных'} color={getLevelColor(Math.max(1, preview.preliminary_ugt))} /><MetricCard label="Наполненность" value={`${preview.completion_pct}%`} hint="Содержательные критерии" color="var(--tz-accent)" /><MetricCard label="Доказательная база" value={`${preview.evidence_pct}%`} hint="Состояние материалов" color="var(--tz-success)" /><MetricCard label="Уверенность" value={`${preview.confidence_pct}%`} hint="Самооценка + подтверждения" color="var(--tz-review)" /></div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-3xl border border-tz-border bg-tz-surface p-5 shadow-sm sm:p-7"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-xl font-bold text-tz-fg">Четыре направления</h3><p className="mt-1 text-sm text-tz-muted">Профиль наполненности проекта</p></div><ShieldCheck className="text-tz-accent" /></div><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><RadarChart data={(Object.keys(DIMENSION_CONFIG) as Dimension[]).map((dimension) => ({ subject: DIMENSION_CONFIG[dimension].label, value: preview.dimension_scores[dimension] }))}><PolarGrid /><PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: 'var(--tz-secondary)' }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--tz-neutral)' }} /><Radar dataKey="value" stroke="var(--tz-accent)" fill="var(--tz-accent)" fillOpacity={0.22} strokeWidth={2} /><Tooltip formatter={(value) => [`${value ?? 0}%`, 'Наполненность']} /></RadarChart></ResponsiveContainer></div></div><div className="rounded-3xl border border-tz-border bg-tz-surface p-5 shadow-sm sm:p-7"><h3 className="text-xl font-bold text-tz-fg">Рубежи и блокеры</h3><p className="mt-1 text-sm text-tz-muted">Следующий непрерывный этап — УГТ {Math.min(preview.preliminary_ugt + 1, 9)}</p><div className="mt-5 space-y-3">{preview.blockers.length ? preview.blockers.slice(0, 6).map((blocker) => <div key={blocker.checkpoint_code} className="flex items-start gap-3 rounded-xl bg-tz-warning-soft p-3 text-sm text-tz-warning"><AlertCircle size={17} className="mt-0.5 flex-shrink-0" /><span><strong>{blocker.checkpoint_code}</strong> · {blocker.title}<span className="mt-1 block text-xs text-tz-warning">Состояние: {STATUS_LABELS[blocker.status]} → нужно документировать</span></span></div>) : <div className="rounded-xl bg-tz-success-soft p-4 text-sm text-tz-success"><Check className="mb-2" />Критических блокеров до следующего этапа не найдено.</div>}</div></div></div>
            <div className="mt-6 rounded-3xl border border-tz-border bg-tz-surface p-5 shadow-sm sm:p-7"><h3 className="mb-5 text-xl font-bold text-tz-fg">Прогресс по УГТ</h3><div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">{preview.level_scores.map((item) => <div key={item.ugt_level} className="rounded-2xl border border-tz-border p-4"><div className="flex items-center justify-between"><span className="font-mono text-sm font-bold" style={{ color: getLevelColor(item.ugt_level) }}>УГТ {item.ugt_level}</span>{item.achieved && <Check size={16} className="text-tz-success" />}</div><p className="mt-2 font-mono text-2xl font-bold text-tz-fg">{item.percentage}%</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-tz-soft"><div className="h-full rounded-full" style={{ width: `${item.percentage}%`, background: getLevelColor(item.ugt_level) }} /></div><p className="mt-2 text-xs text-tz-muted">{item.achieved ? 'Блок достигнут' : 'Блок не достигнут'}</p></div>)}</div></div>
            <div className="mt-6 rounded-3xl p-6 text-white shadow-sm sm:p-8" style={{ background: "var(--tz-hero-bg)" }}><div className="flex items-start gap-3"><Info className="mt-1 flex-shrink-0 text-tz-accent-hover" /><div><h3 className="text-xl font-bold">Что означает этот результат</h3><p className="mt-2 max-w-3xl leading-7 text-[color:var(--tz-hero-muted)]">Предварительный УГТ определяется самым высоким непрерывным блоком. Средний балл не может компенсировать незакрытый критический рубеж. После сохранения менеджер увидит ответы, комментарии и состояния материалов для последующей проверки.</p></div></div></div>
            <div className="mt-8 text-center"><p className="mb-4 text-sm text-tz-muted">Сохраните результат — проект появится в рабочем столе заказчика.</p>{saveError && <div className="mx-auto mb-4 flex max-w-2xl items-start gap-2 rounded-xl border border-tz-danger bg-tz-danger-soft p-4 text-left text-sm text-tz-danger"><AlertCircle size={18} className="mt-0.5 flex-shrink-0" />{saveError}</div>}<div className="flex flex-col justify-center gap-3 sm:flex-row"><button onClick={handleSave} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-tz-accent px-7 py-3.5 font-semibold text-white shadow-sm transition hover:bg-tz-accent-hover disabled:cursor-not-allowed disabled:opacity-60">{saving ? <><Loader2 className="animate-spin" size={17} />Сохранение…</> : <><Save size={17} />Сохранить проект</>}</button><button onClick={resetAssessment} className="inline-flex items-center justify-center gap-2 rounded-xl border border-tz-border bg-tz-surface px-6 py-3.5 font-semibold text-tz-secondary"><RotateCcw size={17} />Пройти заново</button></div></div>
            <div className="mt-6 flex justify-center"><button onClick={() => setStep(9)} className="inline-flex items-center gap-2 text-sm font-semibold text-tz-accent hover:text-tz-accent-hover"><ChevronLeft size={16} />Вернуться к последнему блоку</button></div>
          </section>
        )}
      </main>
    </div>
  );
}