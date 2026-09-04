"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Gauge,
  Map,
  Target,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { UGT_LEVELS, type UGTLevel, type RiskItem } from "@/lib/ugt-data";

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];

function getKpiIcon(label: string) {
  if (label.includes("Публикации") || label.toLowerCase().includes("publication")) return FileText;
  if (label.includes("Патенты") || label.toLowerCase().includes("patent")) return Gauge;
  return Target;
}

export default function LevelDetailInteractive({ level }: { level: UGTLevel }) {
  const t = useTranslations("levelDetail");
  const tUgt = useTranslations("ugtData");
  const color = ugtColor(level.id);
  const nextLevel = UGT_LEVELS.find((l) => l.id === level.id + 1) ?? null;

  const getProbabilityConfig = (probability: RiskItem["probability"]) => {
    switch (probability) {
      case "low":
        return { label: t("probLow"), color: "#22C55E", bg: "rgba(34,197,94,0.12)" };
      case "medium":
        return { label: t("probMedium"), color: "#EAB308", bg: "rgba(234,179,8,0.14)" };
      case "high":
        return { label: t("probHigh"), color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
      default:
        return { label: t("probMedium"), color: "#EAB308", bg: "rgba(234,179,8,0.14)" };
    }
  };

  // Чек-лист
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  // Риски-аккордеон
  const [expandedRisks, setExpandedRisks] = useState<Record<number, boolean>>({});

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalRequirements = level.requirements.length;
  const progressPercent = Math.round((checkedCount / totalRequirements) * 100);

  const toggleCheck = (index: number) =>
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  const toggleRisk = (index: number) =>
    setExpandedRisks((prev) => ({ ...prev, [index]: !prev[index] }));

  const translateKpiLabel = (raw: string) => {
    if (raw.includes("Публикации")) return t("publications");
    if (raw.includes("Патенты")) return t("patents");
    if (raw.includes("Прототип")) return t("prototype");
    return raw;
  };

  return (
    <>
      {/* ═══ Mini Timeline (стеклянная панель) ═══ */}
      <div
        className="relative z-10 mx-auto mt-6 max-w-[900px] rounded-2xl border border-tz-border/60 bg-tz-surface/85 p-5 backdrop-blur-xl sm:p-6"
        style={{ boxShadow: "0 8px 32px rgba(11,13,18,0.08)" }}
      >
        <div className="relative flex items-center justify-between">
          {/* Трек */}
          <div className="absolute left-0 right-0 top-[17px] h-[3px] rounded-full bg-tz-border/60" />
          <div
            className="absolute left-0 top-[17px] h-[3px] rounded-full transition-all duration-700"
            style={{
              width: `${((level.id - 1) / 8) * 100}%`,
              background: `linear-gradient(90deg, ${ugtColor(1)}, ${color})`,
            }}
          />
          {/* Ноды */}
          {UGT_LEVELS.map((l) => {
            const isCurrent = l.id === level.id;
            const isCompleted = l.id < level.id;
            let code = l.code;
            try { code = tUgt(`code${l.id}`); } catch {}
            return (
              <Link
                key={l.id}
                href={`/levels/${l.id}`}
                className="relative z-10 flex flex-col items-center gap-1.5 transition-transform duration-200 hover:scale-110"
                title={l.name}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-semibold transition-all duration-300 sm:h-[36px] sm:w-[36px]"
                  style={{
                    backgroundColor: isCurrent
                      ? ugtColor(l.id)
                      : isCompleted
                        ? `${ugtColor(l.id)}99`
                        : "var(--tz-border)",
                    color: isCurrent || isCompleted ? "#FFFFFF" : "var(--tz-muted)",
                    boxShadow: isCurrent
                      ? `0 0 0 3px var(--tz-bg), 0 0 0 6px ${ugtColor(l.id)}40`
                      : isCompleted
                        ? `0 0 0 2px var(--tz-bg), 0 0 0 4px ${ugtColor(l.id)}25`
                        : "none",
                    transform: isCurrent ? "scale(1.15)" : "scale(1)",
                  }}
                >
                  {l.id}
                </div>
                <span
                  className="hidden font-mono text-[10px] font-medium sm:block"
                  style={{ color: isCurrent ? ugtColor(l.id) : "var(--tz-muted)" }}
                >
                  {code}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ═══ Чек-лист критериев ═══ */}
      <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2 className="tz-section-title">{t("checklistTitle")}</h2>
          <p className="tz-lead mt-3 max-w-2xl">
            {t("checklistDesc")}
          </p>
        </motion.div>

        {/* Прогресс */}
        <div className="mt-8 flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-tz-border/60">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: easeOutExpo }}
            />
          </div>
          <span className="shrink-0 font-mono text-sm text-tz-secondary">
            {checkedCount}/{totalRequirements} {t("done")}
          </span>
          <span className="shrink-0 font-mono text-2xl font-semibold" style={{ color }}>
            {progressPercent}%
          </span>
        </div>

        {/* Элементы чек-листа */}
        <div className="mt-8 flex flex-col gap-3">
          {level.requirements.map((req, index) => {
            const isChecked = !!checkedItems[index];
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.96 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.03, ease: easeOutExpo }}
                onClick={() => toggleCheck(index)}
                className="group flex cursor-pointer items-start gap-4 rounded-2xl border bg-tz-surface p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md sm:p-5"
                style={{
                  borderColor: isChecked ? color : "var(--tz-border)",
                  borderLeftWidth: isChecked ? "3px" : "1px",
                  borderLeftColor: isChecked ? color : "var(--tz-border)",
                  backgroundColor: isChecked ? `${color}0a` : "var(--tz-surface)",
                  boxShadow: isChecked
                    ? `0 4px 20px ${color}14`
                    : "0 4px 20px rgba(11,13,18,0.04)",
                }}
              >
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200"
                  style={{
                    borderColor: isChecked ? color : "var(--tz-border)",
                    backgroundColor: isChecked ? color : "transparent",
                    transform: isChecked ? "scale(1.08)" : "scale(1)",
                  }}
                >
                  <AnimatePresence>
                    {isChecked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span
                  className="text-base text-tz-fg transition-opacity duration-200"
                  style={{
                    fontWeight: 500,
                    lineHeight: 1.6,
                    opacity: isChecked ? 0.75 : 1,
                    textDecoration: isChecked ? "line-through" : "none",
                  }}
                >
                  {req}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Сброс */}
        <AnimatePresence>
          {checkedCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => setCheckedItems({})}
              className="mt-6 block rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:scale-[1.03]"
              style={{ color, background: `${color}0d` }}
            >
              {t("resetProgress")}
            </motion.button>
          )}
        </AnimatePresence>
      </section>

      {/* ═══ Переход на следующий уровень ═══ */}
      <section className="border-y border-tz-border/60 bg-tz-surface/40">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20">
          {nextLevel ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.6, ease: easeOutExpo }}
              >
                <h2 className="tz-section-title">{t("transitionTitle")}</h2>
                <p className="tz-lead mt-3 max-w-2xl">{t("transitionDesc", { nextCode: (() => { try { return tUgt(`code${nextLevel.id}`); } catch { return nextLevel.code; } })() })}</p>
              </motion.div>

              <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Текущий уровень */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: easeOutExpo }}
                  className="rounded-2xl border-2 bg-tz-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-7"
                  style={{ borderColor: color }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 font-mono text-sm font-semibold"
                      style={{ background: `${color}18`, color }}
                    >
                      {(() => { try { return tUgt(`code${level.id}`); } catch { return level.code; }})()}
                    </span>
                    <span className="font-semibold text-tz-fg">{(() => { try { return tUgt(`level${level.id}Name`); } catch { return level.name; }})()}</span>
                  </div>
                  <div className="my-4 h-px bg-tz-border/60" />
                  <ul className="flex flex-col gap-2.5">
                    {level.requirements.map((req) => (
                      <li key={req} className="flex items-start gap-2.5 text-tz-secondary">
                        <Check size={18} className="mt-0.5 shrink-0" style={{ color }} />
                        <span className="text-sm leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* Следующий уровень */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
                  className="rounded-2xl border-2 border-dashed bg-tz-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg sm:p-7"
                  style={{ borderColor: `${ugtColor(nextLevel.id)}80` }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 font-mono text-sm font-semibold"
                      style={{
                        background: `${ugtColor(nextLevel.id)}18`,
                        color: ugtColor(nextLevel.id),
                      }}
                    >
                      {(() => { try { return tUgt(`code${nextLevel.id}`); } catch { return nextLevel.code; }})()}
                    </span>
                    <span className="font-semibold text-tz-fg">{(() => { try { return tUgt(`level${nextLevel.id}Name`); } catch { return nextLevel.name; }})()}</span>
                  </div>
                  <div className="my-4 h-px bg-tz-border/60" />
                  <ul className="flex flex-col gap-2.5">
                    {nextLevel.requirements.map((req) => (
                      <li key={req} className="flex items-start gap-2.5 text-tz-secondary">
                        <Target size={18} className="mt-0.5 shrink-0" style={{ color: ugtColor(nextLevel.id) }} />
                        <span className="text-sm leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>

              {/* CTA к roadmap */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
                className="mt-10 flex justify-center"
              >
                <Link
                  href="/roadmap"
                  className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${color} 0%, ${ugtColor(nextLevel.id)} 100%)`,
                    boxShadow: `0 4px 20px ${color}35`,
                  }}
                >
                  <Map size={20} />
                  {t("roadmapCta")}
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </>
          ) : (
            /* УГТ 9 — максимум */
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="text-center"
            >
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #84cc16 0%, #16a34a 100%)", boxShadow: "0 0 30px rgba(132,204,22,0.3)" }}
              >
                <Target size={36} className="text-white" />
              </div>
              <h2 className="tz-page-title mt-6">{t("maxReached")}</h2>
              <p className="mx-auto mt-4 max-w-[560px] tz-lead">
                {t("maxDesc")}
              </p>
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                style={{ background: "var(--tz-accent)", boxShadow: "0 4px 20px var(--tz-accent)40" }}
              >
                <Zap size={20} />
                {t("assessNew")}
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* ═══ KPI и Документы ═══ */}
      <section className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2 className="tz-section-title">{t("kpiTitle")}</h2>
          <p className="tz-lead mt-3 max-w-2xl">{t("kpiDesc")}</p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(level.kpi).map(([label, value]) => {
            const Icon = getKpiIcon(label);
            return (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: easeOutExpo }}
                className="rounded-2xl border border-tz-border/60 bg-tz-surface p-7 transition-all duration-200 hover:-translate-y-1"
                style={{ boxShadow: "0 4px 16px rgba(11,13,18,0.05)" }}
              >
                <Icon size={32} style={{ color }} />
                <div className="mt-4 font-mono text-3xl font-semibold text-tz-fg">{value}</div>
                <p className="mt-2 text-sm text-tz-secondary">{translateKpiLabel(label)}</p>
              </motion.div>
            );
          })}

          {/* Срок разработки */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, ease: easeOutExpo }}
            className="rounded-2xl border border-tz-border/60 bg-tz-surface p-7 transition-all duration-200 hover:-translate-y-1"
            style={{ boxShadow: "0 4px 16px rgba(11,13,18,0.05)" }}
          >
            <Zap size={32} style={{ color }} />
            <div className="mt-4 font-mono text-3xl font-semibold text-tz-fg">
              {level.id <= 3 ? t("devTimeShort") : level.id <= 6 ? t("devTimeMid") : t("devTimeLong")}
            </div>
            <p className="mt-2 text-sm text-tz-secondary">{t("devTime")}</p>
          </motion.div>
        </div>

        {/* Документы уровня */}
        <div className="mt-20">
          <h3 className="tz-card-title">{t("docsTitle")}</h3>
          <p className="mt-3 text-base text-tz-secondary">
            {t("docsDesc")}
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {level.deliverableDocs.map((doc) => (
              <motion.div
                key={doc.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: easeOutExpo }}
                className="group relative overflow-hidden rounded-2xl border border-tz-border/60 bg-tz-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                style={{ boxShadow: "0 4px 20px rgba(11,13,18,0.06)", borderTop: `3px solid ${color}` }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${color}14` }}
                  >
                    <FileText size={24} style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold leading-snug text-tz-fg">{doc.name}</h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-tz-secondary">{doc.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-md bg-tz-soft/60 px-2.5 py-1 font-mono text-xs text-tz-muted">
                    {doc.template}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => alert(t("templateAlert"))}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                  style={{ backgroundColor: color, boxShadow: `0 4px 12px ${color}30` }}
                >
                  <Download size={16} />
                  {t("downloadSample")}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Результаты уровня */}
          <div className="mt-16">
            <h3 className="tz-card-title">{t("resultsTitle")}</h3>
            <p className="mt-3 text-base text-tz-secondary">
              {t("resultsDesc", { code: (() => { try { return tUgt(`code${level.id}`); } catch { return level.code; }})() })}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {level.deliverables.map((item, i) => (
                <motion.div
                  key={item}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: i * 0.05, ease: easeOutExpo }}
                  className="group flex items-center gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  style={{ boxShadow: "0 4px 16px rgba(11,13,18,0.05)" }}
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ background: `${color}14` }}
                  >
                    <CheckCircle2 size={24} style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-tz-fg">{item}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-tz-muted">
                      {t("resultOf", { current: i + 1, total: level.deliverables.length })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Риски ═══ */}
      <section className="border-t border-tz-border/60 bg-tz-surface/40">
        <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
          >
            <h2 className="tz-section-title">{t("risksTitle")}</h2>
            <p className="tz-lead mt-3 max-w-2xl">
              {t("risksDesc")}
            </p>
          </motion.div>

          <div className="mt-10 flex flex-col gap-4">
            {level.risks.map((riskItem, index) => {
              const prob = getProbabilityConfig(riskItem.probability);
              const isExpanded = !!expandedRisks[index];
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, ease: easeOutExpo }}
                  className="overflow-hidden rounded-2xl border border-tz-border/60 bg-tz-surface transition-all duration-200"
                  style={{
                    borderLeftWidth: "3px",
                    borderLeftColor: prob.color,
                    boxShadow: isExpanded
                      ? `0 8px 32px rgba(11,13,18,0.1), 0 4px 16px ${prob.color}18`
                      : "0 4px 20px rgba(11,13,18,0.06)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleRisk(index)}
                    className="flex w-full items-center gap-4 p-5 text-left transition-colors duration-150 hover:bg-tz-soft/40 sm:p-6"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${prob.color}18` }}
                    >
                      <AlertTriangle size={20} style={{ color: prob.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-sm font-medium"
                          style={{ color: prob.color, background: prob.bg, padding: "2px 10px", borderRadius: "9999px" }}
                        >
                          {prob.label}
                        </span>
                      </div>
                      <p className="mt-1.5 text-base font-medium leading-snug text-tz-fg">
                        {riskItem.risk}
                      </p>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: easeOutExpo }}
                      className="shrink-0"
                    >
                      <ChevronDown size={20} className="text-tz-muted" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: easeOutExpo }}
                      >
                        <div className="border-t border-tz-border/60 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: "rgba(34,197,94,0.12)" }}
                            >
                              <CheckCircle2 size={18} style={{ color: "#22C55E" }} />
                            </div>
                            <div>
                              <span className="text-xs font-medium uppercase tracking-[0.06em]" style={{ color: "#22C55E" }}>
                                {t("recommended")}
                              </span>
                              <p className="mt-1.5 text-base leading-relaxed text-tz-secondary">
                                {riskItem.solution}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
