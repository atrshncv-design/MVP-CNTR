import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Gauge, ShieldAlert } from "lucide-react";
import { UGT_LEVELS, type UGTLevel } from "@/lib/ugt-data";
import { ugtTone } from "@/components/landing/ugt-card";

export function generateStaticParams() {
  return UGT_LEVELS.map((lvl) => ({ id: String(lvl.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const lvl = UGT_LEVELS.find((l) => String(l.id) === id);
  if (!lvl) return { title: "Уровень не найден — Технозрелость" };
  return {
    title: `УГТ ${lvl.id} — ${lvl.name} — Технозрелость`,
    description: lvl.short,
  };
}

function LevelDetail({ level }: { level: UGTLevel }) {
  const prev = UGT_LEVELS.find((l) => l.id === level.id - 1);
  const next = UGT_LEVELS.find((l) => l.id === level.id + 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <Link
        href="/levels"
        className="inline-flex items-center gap-1.5 text-[13px] text-tz-muted transition-colors hover:text-tz-fg"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Все уровни УГТ
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span
          className="font-mono text-5xl font-extrabold tracking-tight"
          style={{ color: ugtTone(level.id) }}
        >
          {level.id}
        </span>
        <div>
          <p className="tz-eyebrow">
            {level.id <= 3 ? "низкая готовность" : level.id <= 6 ? "средняя готовность" : "высокая готовность"}
          </p>
          <h1 className="mt-1 tz-page-title">{level.name}</h1>
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-tz-secondary">
        {level.description}
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="tz-card p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-tz-accent-hover" />
            <h2 className="tz-section-title">Что должно быть на этом уровне</h2>
          </div>
          <ul className="mt-4 space-y-2.5">
            {level.requirements.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-tz-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ugtTone(level.id) }} />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="tz-card p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-tz-accent-hover" />
            <h2 className="tz-section-title">Документы и доказательства</h2>
          </div>
          <ul className="mt-4 space-y-2.5">
            {level.deliverables.map((d) => (
              <li key={d} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-tz-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ugtTone(level.id) }} />
                {d}
              </li>
            ))}
          </ul>
          {level.deliverableDocs.length > 0 && (
            <div className="mt-5 border-t border-tz-border/60 pt-4">
              <p className="tz-eyebrow">Шаблоны на платформе</p>
              <ul className="mt-2 space-y-1.5">
                {level.deliverableDocs.map((doc) => (
                  <li key={doc.name} className="text-[12.5px] text-tz-muted">
                    {doc.name} · <span className="font-mono text-[11px]">{doc.template}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="tz-card p-6">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-tz-accent-hover" />
            <h2 className="tz-section-title">Ключевые показатели уровня</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(level.kpi).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-tz-border/60 bg-tz-soft/50 p-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">{k}</p>
                <p className="mt-1 font-mono text-sm font-bold text-tz-fg">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tz-card p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-tz-warning" />
            <h2 className="tz-section-title">Типичные риски и как их снимать</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {level.risks.map((r) => (
              <li key={r.risk} className="text-[13px] leading-relaxed">
                <p className="font-medium text-tz-secondary">{r.risk}</p>
                <p className="mt-0.5 text-tz-muted">{r.solution}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <nav className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-between">
        {prev ? (
          <Link href={`/levels/${prev.id}`} className="tz-btn tz-btn-secondary">
            <ArrowLeft className="h-4 w-4" /> УГТ {prev.id} · {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/levels/${next.id}`} className="tz-btn tz-btn-primary">
            УГТ {next.id} · {next.name} <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link href="/register" className="tz-btn tz-btn-primary">
            Оценить свою технологию <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </nav>
    </div>
  );
}

export default async function LevelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const level = UGT_LEVELS.find((l) => String(l.id) === id);
  if (!level) notFound();
  return <LevelDetail level={level} />;
}
