"use client";

import { Check, FileUp, LockKeyhole, Sparkles, PartyPopper, RotateCcw, Clock3 } from "lucide-react";
import { MotionConfig, motion } from "framer-motion";
import { UGT_LEVELS } from "@/lib/ugt-data";


interface UgtTrajectoryProps {
  currentLevel: number;
  targetLevel?: number;
  documentsCompleted?: number;
  documentsTotal?: number;
  status?: "documents" | "review" | "approved" | "rejected";
  onAddDocuments?: () => void;
  onSubmit?: () => void;
}

export default function UgtTrajectory({
  currentLevel,
  targetLevel = Math.min(currentLevel + 1, 9),
  documentsCompleted = 0,
  documentsTotal = 0,
  status = "documents",
  onAddDocuments,
  onSubmit,
}: UgtTrajectoryProps) {
  const level = Math.max(1, Math.min(9, Math.round(currentLevel)));
  const target = Math.max(level, Math.min(9, Math.round(targetLevel)));
  const complete = documentsTotal > 0 && documentsCompleted >= documentsTotal;
  const atFinal = level === 9;
  const ctaLabel = atFinal
    ? "УГТ 9 достигнут"
    : status === "review"
      ? `Заявка на УГТ ${target} на проверке`
        : status === "approved"
        ? `УГТ ${target} подтверждён`
        : status === "rejected"
          ? `Доработать комплект для УГТ ${target}`
        : complete
          ? `Подать заявку на УГТ ${target}`
          : `Добавить документы для УГТ ${target}`;

  return (
    <MotionConfig reducedMotion="user">
      <section className="rounded-2xl border border-tz-border bg-tz-surface p-5" aria-labelledby="ugt-trajectory-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="tz-eyebrow">Прогресс проекта</p>
            <h3 id="ugt-trajectory-title" className="mt-1 text-lg font-bold text-tz-fg">Траектория УГТ</h3>
            <p className="mt-1 text-sm text-tz-muted">Официальный уровень меняется только после верификации менеджером ЦНТР.</p>
          </div>
          <span className="tz-ugt tz-ugt-strong">УГТ {level}</span>
        </div>

        <div className="mt-6 grid grid-cols-9 gap-1.5" role="list" aria-label="Уровни технологической готовности">
          {UGT_LEVELS.map((levelData, index) => {
            const name = levelData.name;
            const number = index + 1;
            const filled = number <= level;
            const next = number === target && number > level;
            return (
              <div key={name} className="min-w-0 text-center" role="listitem">
                <motion.div
                  initial={false}
                  animate={{ scale: filled ? 1 : 0.96, opacity: filled || next ? 1 : 0.65 }}
                  className={`mx-auto flex h-12 items-center justify-center rounded-lg border text-sm font-bold text-white shadow-sm ${filled ? "scale-[1.02]" : next ? "border-2 border-tz-accent bg-tz-surface text-tz-accent ring-2 ring-tz-accent/20" : "border-tz-border bg-tz-soft text-tz-muted"}`}
                  style={filled ? { backgroundColor: `var(--tz-ugt-${number})` } : undefined}
                  title={`УГТ ${number}: ${name}`}
                >
                  {filled ? <Check size={14} /> : next ? <span>{number}</span> : <LockKeyhole size={12} />}
                </motion.div>
                <span className="mt-2 block text-[10px] leading-tight text-tz-secondary sm:text-xs" title={`УГТ ${number}: ${name}`}>{name}</span>
              </div>
            );
          })}
        </div>

        {status === "approved" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-tz-success/30 bg-tz-success-soft p-3 text-tz-success" role="status">
            <PartyPopper size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div><p className="text-sm font-semibold">Переход подтверждён менеджером ЦНТР</p><p className="mt-0.5 text-xs">Команда получила достижение за УГТ {target}. История проекта обновлена.</p></div>
          </div>
        )}
        {status === "rejected" && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-tz-review/30 bg-tz-review-soft p-3 text-tz-review" role="alert">
            <RotateCcw size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div><p className="text-sm font-semibold">Комплект требует доработки</p><p className="mt-0.5 text-xs">Менеджер вернул заявку. Проверьте комментарии и загрузите обновлённые документы.</p></div>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-tz-soft/60 p-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-tz-fg">{ctaLabel}</p>
            {!atFinal && documentsTotal > 0 && <p className="mt-1 text-xs text-tz-muted">Комплект: {documentsCompleted} из {documentsTotal} документов</p>}
          </div>
          {!atFinal && status !== "review" && status !== "approved" && (
            <button className="tz-btn tz-btn-primary shrink-0" onClick={complete ? onSubmit : onAddDocuments}>
              {complete ? <Sparkles size={16} aria-hidden="true" /> : status === "rejected" ? <RotateCcw size={16} aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
              {status === "rejected" ? "Исправить документы" : complete ? `Подать заявку на УГТ ${target}` : "Добавить документы"}
            </button>
          )}
          {status === "review" && <span className="inline-flex items-center gap-2 text-xs text-tz-muted"><Clock3 size={15} aria-hidden="true" /> Ответ появится после проверки менеджером</span>}
        </div>
      </section>
    </MotionConfig>
  );
}
