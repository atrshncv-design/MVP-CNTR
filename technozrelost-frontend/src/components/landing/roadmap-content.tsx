"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  FileCheck,
  FileText,
  Layers,
  ListTodo,
  Map,
  Route,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { UGT_LEVELS, ROADMAP_TRANSITIONS, type TransitionDoc, type TransitionRisk } from "@/lib/ugt-data";

/* ================================================================== */
/*  Константы и хелперы                                               */
/* ================================================================== */

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];
const easeSmooth = [0.4, 0, 0.2, 1] as [number, number, number, number];

function parseMonths(timeStr: string): number {
  const match = timeStr.match(/(\d+)[-\u2013](\d+)/);
  if (!match) return 0;
  return (parseInt(match[1]) + parseInt(match[2])) / 2;
}

/* ================================================================== */
/*  Hero: селекторы УГТ + пресеты                                     */
/* ================================================================== */

function UgtSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-[0.08em] text-white/50">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[48px] w-full cursor-pointer appearance-none rounded-xl border border-white/15 bg-white/8 px-4 text-base text-white outline-none transition-all focus:ring-2 focus:ring-tz-accent/50 sm:w-[220px]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="text-tz-fg">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function PresetPill({
  preset,
  onClick,
  index,
}: {
  preset: { label: string; from: number; to: number; borderColor: string };
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.9 + index * 0.08, duration: 0.3 }}
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:scale-[1.03]"
      style={{
        background: "transparent",
        border: `1.5px solid ${preset.borderColor.includes("gradient") ? "#fff" : preset.borderColor}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {preset.label}
    </motion.button>
  );
}

/* ================================================================== */
/*  Нода и коннектор таймлайна                                        */
/* ================================================================== */

function RoadmapNode({
  level,
  status,
  index,
}: {
  level: (typeof UGT_LEVELS)[number];
  status: "completed" | "current" | "upcoming";
  index: number;
}) {
  const t = useTranslations("roadmap");
  const isCompleted = status === "completed";
  const isCurrent = status === "current";
  const color = ugtColor(level.id);

  const statusLabel = isCompleted ? t("statusCompleted") : isCurrent ? t("statusCurrent") : t("statusUpcoming");
  const statusBg = isCompleted ? "rgba(22,163,74,0.1)" : isCurrent ? `${color}1A` : "var(--tz-border)";
  const statusText = isCompleted ? "#16a34a" : isCurrent ? color : "var(--tz-muted)";

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.4, ease: easeBounce }}
      className="flex flex-col items-center gap-2"
      style={{ minWidth: 64 }}
    >
      <div className="relative" style={{ width: 64, height: 64 }}>
        {isCurrent && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `3px solid ${color}`, boxShadow: `0 0 20px ${color}66` }}
            animate={{ scale: [1, 1.45, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: isCompleted || isCurrent ? color : "var(--tz-surface)",
            border: isCompleted || isCurrent ? "none" : "3px solid var(--tz-border)",
            opacity: isCompleted || isCurrent ? 1 : 0.7,
            boxShadow: isCompleted || isCurrent ? `0 4px 12px ${color}44` : "none",
          }}
        >
          {isCompleted ? (
            <Check size={28} className="text-white" strokeWidth={3} />
          ) : (
            <span
              className="font-mono text-lg font-bold"
              style={{ color: isCurrent ? "#FFFFFF" : "var(--tz-muted)" }}
            >
              {level.id}
            </span>
          )}
        </div>
      </div>
      <span
        className="whitespace-nowrap font-mono text-xs font-medium"
        style={{ color: isCompleted || isCurrent ? color : "var(--tz-muted)" }}
      >
        {level.code}
      </span>
      <span
        className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{ background: statusBg, color: statusText }}
      >
        {isCompleted && "✓ "}
        {isCurrent && "▶ "}
        {!isCompleted && !isCurrent && "○ "}
        {statusLabel}
      </span>
    </motion.div>
  );
}

function ConnectorSegment({
  fromColor,
  toColor,
  status,
  index,
}: {
  fromColor: string;
  toColor: string;
  status: "completed" | "current" | "upcoming";
  index: number;
}) {
  const isCompleted = status === "completed";
  const isCurrent = status === "current";

  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ delay: 0.4 + index * 0.1, duration: 0.5, ease: easeOutExpo }}
      className="relative h-[6px] flex-1 origin-left"
      style={{
        background:
          isCompleted || isCurrent
            ? `linear-gradient(90deg, ${fromColor} 0%, ${toColor} 100%)`
            : "var(--tz-border)",
        borderRadius: 9999,
      }}
    >
      {isCurrent && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${fromColor}33, ${toColor}, ${fromColor}33)`,
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

/* ================================================================== */
/*  Карточки документов и рисков                                      */
/* ================================================================== */

function DocumentCard({
  doc,
  index,
  accentColor,
}: {
  doc: TransitionDoc;
  index: number;
  accentColor: string;
}) {
  const t = useTranslations("roadmap");
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: easeSmooth }}
      className="flex items-start gap-3 rounded-xl border border-tz-border/60 bg-tz-soft/50 p-4 transition-all hover:-translate-y-0.5"
      style={{ boxShadow: "0 2px 8px rgba(11,13,18,0.05)" }}
    >
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accentColor}1A` }}
      >
        <FileText size={18} style={{ color: accentColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-tz-fg">{doc.name}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-tz-secondary">{doc.description}</div>
      </div>
      <button
        type="button"
        onClick={() => alert(t("templateAlert") ?? "Template will be available in next version")}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:scale-[1.02]"
        style={{ background: `${accentColor}1A`, color: accentColor }}
      >
        <Download size={13} />
        {t("download")}
      </button>
    </motion.div>
  );
}

function RiskCard({ risk, index }: { risk: TransitionRisk; index: number }) {
  const [solutionOpen, setSolutionOpen] = useState(false);
  const t = useTranslations("roadmap");
  const getLabel = (p: TransitionRisk["probability"]) => {
    if (p === "low") return { label: t("probLow"), color: "#16a34a", bg: "rgba(22,163,74,0.12)", border: "rgba(22,163,74,0.35)" };
    if (p === "medium") return { label: t("probMedium"), color: "#ca8a04", bg: "rgba(202,138,4,0.12)", border: "rgba(202,138,4,0.35)" };
    return { label: t("probHigh"), color: "#dc2626", bg: "rgba(220,38,38,0.12)", border: "rgba(220,38,38,0.35)" };
  };
  const config = getLabel(risk.probability);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.45, ease: easeSmooth }}
      className="overflow-hidden rounded-xl border bg-tz-surface transition-all"
      style={{
        borderColor: config.border,
        borderLeftWidth: 4,
        borderLeftColor: config.color,
        boxShadow: "0 2px 8px rgba(11,13,18,0.05)",
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: config.bg }}
            >
              <AlertTriangle size={16} style={{ color: config.color }} />
            </div>
            <span className="text-sm font-medium leading-relaxed text-tz-fg">{risk.risk}</span>
          </div>
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: config.bg, color: config.color }}
          >
            {config.label}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSolutionOpen(!solutionOpen)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: "var(--tz-accent)" }}
        >
          <motion.div animate={{ rotate: solutionOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} />
          </motion.div>
          {solutionOpen ? t("hideSolution") : t("showSolution")}
        </button>

        <AnimatePresence>
          {solutionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: easeSmooth }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 flex items-start gap-3 rounded-lg border p-3"
                style={{ background: "rgba(22,163,74,0.05)", borderColor: "rgba(22,163,74,0.2)" }}
              >
                <CheckCircle size={16} className="mt-0.5 shrink-0" style={{ color: "#16a34a" }} />
                <span className="text-sm leading-relaxed text-tz-fg">{risk.solution}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/*  Карточка перехода N→N+1                                           */
/* ================================================================== */

function TransitionCard({
  transition,
  fromLevel,
  toLevel,
  index,
}: {
  transition: (typeof ROADMAP_TRANSITIONS)[number];
  fromLevel: (typeof UGT_LEVELS)[number];
  toLevel: (typeof UGT_LEVELS)[number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("roadmap");
  const fromColor = ugtColor(fromLevel.id);
  const toColor = ugtColor(toLevel.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: easeOutExpo }}
      className="overflow-hidden rounded-2xl border border-tz-border/60 bg-tz-surface transition-all hover:-translate-y-1"
      style={{ borderLeft: `3px solid ${fromColor}`, boxShadow: "0 4px 16px rgba(11,13,18,0.06)" }}
    >
      {/* Заголовок */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-5 text-left sm:px-7"
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ background: fromColor }}
          >
            {fromLevel.id}
          </div>
          <ArrowRight size={20} className="text-tz-muted" />
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ background: toColor }}
          >
            {toLevel.id}
          </div>
          <div className="ml-2">
            <h4 className="text-lg font-semibold text-tz-fg sm:text-xl">
              {fromLevel.name} → {toLevel.name}
            </h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs font-medium text-tz-muted">
              <span className="flex items-center gap-1">
                <Clock size={13} /> {transition.estimatedTime}
              </span>
              <span className="flex items-center gap-1">
                <ListTodo size={13} /> {t("tasksCount", { count: transition.actions.length })}
              </span>
              <span className="flex items-center gap-1">
                <FileCheck size={13} /> {t("resultsCountShort", { count: toLevel.deliverables.length })}
              </span>
              <span className="flex items-center gap-1">
                <FileText size={13} /> {t("docsCount", { count: transition.documents.length })}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle size={13} /> {t("risksCount", { count: transition.risks.length })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown size={24} className="text-tz-muted" />
          </motion.div>
          <span className="text-[11px] font-medium text-tz-muted">
            {expanded ? t("collapse") : t("expand")}
          </span>
        </div>
      </button>

      {/* Развёрнутый контент */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: easeSmooth }}
            className="overflow-hidden"
          >
            <div className="border-t border-tz-border/60 px-6 pb-8 pt-6 sm:px-7">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Задачи */}
                <div>
                  <h5 className="mb-4 flex items-center gap-2 text-lg font-semibold text-tz-fg">
                    <ClipboardList size={20} className="text-tz-secondary" />
                    {t("tasks")}
                  </h5>
                  <div className="flex flex-col gap-3">
                    {transition.actions.map((task, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4, ease: easeSmooth }}
                        className="flex items-start gap-3 rounded-xl border border-tz-border/60 bg-tz-soft/50 p-4"
                      >
                        <div
                          className="mt-0.5 h-[22px] w-[22px] shrink-0 rounded-md border-2"
                          style={{ borderColor: toColor }}
                        />
                        <span className="text-sm text-tz-fg">{task}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Результаты */}
                <div>
                  <h5 className="mb-4 flex items-center gap-2 text-lg font-semibold text-tz-fg">
                    <Target size={20} className="text-tz-secondary" />
                    {t("results")}
                  </h5>
                  <div className="flex flex-col gap-3">
                    {toLevel.deliverables.map((result, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4, ease: easeSmooth }}
                        className="flex items-center gap-3"
                      >
                        <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: toColor }} />
                        <span className="text-sm text-tz-fg">{result}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div
                    className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    style={{ background: `${toColor}1A`, color: toColor }}
                  >
                    <Clock size={15} />
                    {t("deadline", { time: transition.estimatedTime })}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/levels/${toLevel.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-tz-accent transition-colors hover:underline"
                    >
                      {t("moreAbout", { code: toLevel.code })}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Документы */}
              {transition.documents.length > 0 && (
                <div className="mt-8 border-t border-tz-border/60 pt-6">
                  <h5 className="mb-4 flex items-center gap-2 text-lg font-semibold text-tz-fg">
                    <FileText size={20} className="text-tz-secondary" />
                    {t("keyDocuments")}
                  </h5>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {transition.documents.map((doc, i) => (
                      <DocumentCard key={i} doc={doc} index={i} accentColor={toColor} />
                    ))}
                  </div>
                </div>
              )}

              {/* Риски */}
              {transition.risks.length > 0 && (
                <div className="mt-8 border-t border-tz-border/60 pt-6">
                  <h5 className="mb-4 flex items-center gap-2 text-lg font-semibold text-tz-fg">
                    <AlertTriangle size={20} className="text-tz-secondary" />
                    {t("risksAndSolutions")}
                  </h5>
                  <div className="flex flex-col gap-3">
                    {transition.risks.map((risk, i) => (
                      <RiskCard key={i} risk={risk} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ================================================================== */
/*  Сводная панель                                                    */
/* ================================================================== */

function SummaryCard({
  icon: Icon,
  value,
  label,
  color,
  index,
}: {
  icon: typeof Clock;
  value: string;
  label: string;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: index * 0.12, duration: 0.5, ease: easeOutExpo }}
      className="rounded-2xl border border-white/8 bg-white/[0.04] p-7 transition-all hover:-translate-y-1"
    >
      <Icon size={28} style={{ color, opacity: 0.8 }} />
      <div className="mt-4 font-mono text-[28px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-sm text-white/55">{label}</div>
    </motion.div>
  );
}

function CircularProgress({
  percentage,
  fromColor,
  toColor,
}: {
  percentage: number;
  fromColor: string;
  toColor: string;
}) {
  const t = useTranslations("roadmap");
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
      className="flex flex-col items-center"
    >
      <svg width={200} height={200} viewBox="0 0 200 200">
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={fromColor} />
            <stop offset="100%" stopColor={toColor} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
        <motion.circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: offset }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 1.5, ease: easeOutExpo }}
          transform="rotate(-90 100 100)"
        />
        <text x="100" y="96" textAnchor="middle" className="font-mono text-[36px] font-bold" fill="#FFFFFF">
          {percentage}%
        </text>
        <text x="100" y="118" textAnchor="middle" className="text-xs font-medium uppercase tracking-[0.05em]" fill="rgba(255,255,255,0.5)">
          {t("completed")}
        </text>
      </svg>
    </motion.div>
  );
}

/* ================================================================== */
/*  Страница                                                          */
/* ================================================================== */

export default function RoadmapContent() {
  const t = useTranslations("roadmap");
  const tUgt = useTranslations("ugtData");
  const [currentUgt, setCurrentUgt] = useState<number>(0);
  const [targetUgt, setTargetUgt] = useState<number>(0);
  const [showRoadmap, setShowRoadmap] = useState(false);

  const PRESETS = [
    { label: t("presetFull"), from: 1, to: 9, borderColor: "linear-gradient(135deg, #9a2a2b 0%, #e06a2a 33%, #84cc16 66%, #16a34a 100%)" },
    { label: t("presetResearch"), from: 1, to: 3, borderColor: "#e0522f" },
    { label: t("presetPrototype"), from: 4, to: 6, borderColor: "#eab308" },
    { label: t("presetDeploy"), from: 7, to: 9, borderColor: "#16a34a" },
  ];

  const getNotDefined = t("notDefined");
  const currentOptions = [
    { value: 0, label: getNotDefined },
    ...UGT_LEVELS.map((l) => {
      let code = l.code;
      let name = l.name;
      try { code = tUgt(`code${l.id}`); } catch {}
      try { name = tUgt(`level${l.id}Name`); } catch {}
      return { value: l.id, label: `${code} — ${name}` };
    }),
  ];

  const targetOptions = [
    { value: 0, label: getNotDefined },
    ...UGT_LEVELS.filter((l) => l.id > currentUgt).map((l) => {
      let code = l.code;
      let name = l.name;
      try { code = tUgt(`code${l.id}`); } catch {}
      try { name = tUgt(`level${l.id}Name`); } catch {}
      return {
        value: l.id,
        label: `${code} — ${name}`,
      };
    }),
  ];

  const buildRoadmap = () => {
    if (currentUgt > 0 && targetUgt > 0 && targetUgt > currentUgt) {
      setShowRoadmap(true);
    }
  };

  const handlePreset = (preset: (typeof PRESETS)[number]) => {
    setCurrentUgt(preset.from);
    setTargetUgt(preset.to);
    setShowRoadmap(true);
  };

  const handleCurrentChange = (val: number) => {
    setCurrentUgt(val);
    if (targetUgt <= val) setTargetUgt(0);
    setShowRoadmap(false);
  };

  const levelsInRange = useMemo(() => {
    if (!showRoadmap || currentUgt === 0 || targetUgt === 0) return [];
    return UGT_LEVELS.filter((l) => l.id >= currentUgt && l.id <= targetUgt);
  }, [showRoadmap, currentUgt, targetUgt]);

  const transitionsInRange = useMemo(() => {
    if (!showRoadmap || currentUgt === 0 || targetUgt === 0) return [];
    return ROADMAP_TRANSITIONS.filter((t) => t.from >= currentUgt && t.to <= targetUgt);
  }, [showRoadmap, currentUgt, targetUgt]);

  const summaryStats = useMemo(() => {
    if (transitionsInRange.length === 0) return null;
    const totalMonths = transitionsInRange.reduce((sum, tr) => sum + parseMonths(tr.estimatedTime), 0);
    const totalActions = transitionsInRange.reduce((sum, tr) => sum + tr.actions.length, 0);
    const totalDeliverables = transitionsInRange.reduce((sum, tr) => {
      const toLevel = UGT_LEVELS.find((l) => l.id === tr.to);
      return sum + (toLevel?.deliverables.length ?? 0);
    }, 0);

    return {
      duration: `${Math.round(totalMonths * 0.8)}–${Math.round(totalMonths * 1.2)} ${t("totalDuration").toLowerCase().includes("месяц") ? "месяцев" : "months"}`,
      transitions: `${transitionsInRange.length} ${t("stagesCount").toLowerCase().includes("этап") ? "переходов" : "stages"}`,
      tasks: `${totalActions} ${t("totalTasks").toLowerCase().includes("задач") ? "задач" : "tasks"}`,
      deliverables: `${totalDeliverables} ${t("resultsCount").toLowerCase().includes("результат") ? "результатов" : "deliverables"}`,
      percentage: Math.round((currentUgt / targetUgt) * 100),
      fromColor: ugtColor(currentUgt),
      toColor: ugtColor(targetUgt),
    };
  }, [transitionsInRange, currentUgt, targetUgt, t]);

  // Simpler duration formatting using translation keys? We'll use raw numeric + translation
  // But to keep consistent, we will use earlier logic with translated suffix
  const fmtDuration = useMemo(() => {
    if (!summaryStats) return "";
    const totalMonths = transitionsInRange.reduce((sum, tr) => sum + parseMonths(tr.estimatedTime), 0);
    const lo = Math.round(totalMonths * 0.8);
    const hi = Math.round(totalMonths * 1.2);
    // Use Intl? Keep Russian suffix for ru, English for en — detect via t
    const isRu = t("totalDuration") === "Общий срок";
    return `${lo}–${hi} ${isRu ? "месяцев" : "months"}`;
  }, [transitionsInRange, t, summaryStats]);

  return (
    <>
      {/* ═══ Hero ═══ */}
      <section className="relative" style={{ background: "linear-gradient(135deg, #0b0d12 0%, #14161c 50%, #1d1415 100%)" }}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(214,48,49,0.15), transparent)" }}
        />
        <div className="tz-ornament-pattern pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-16 sm:px-6 sm:pb-20 lg:px-8">
          <motion.nav
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-6 flex items-center gap-2 text-sm text-white/45"
          >
            <Link href="/" className="transition-colors hover:text-tz-accent">
              {t("breadcrumbHome")}
            </Link>
            <ChevronDown size={14} className="-rotate-90" />
            <span className="text-white/65">{t("breadcrumbCurrent")}</span>
          </motion.nav>

          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: easeOutExpo }}
            className="max-w-[720px] text-4xl font-bold tracking-tight text-white sm:text-[52px] sm:leading-[1.1]"
          >
            {t("heroTitle")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5, ease: easeOutExpo }}
            className="mt-6 max-w-[640px] text-lg leading-relaxed text-white/65"
          >
            {t("heroDesc")}
          </motion.p>

          {/* Селекторы */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: easeOutExpo }}
            className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl sm:p-8"
            style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)" }}
          >
            <div className="flex flex-wrap items-end gap-6 sm:gap-8">
              <UgtSelect
                label={t("currentUGT")}
                value={currentUgt}
                onChange={handleCurrentChange}
                options={currentOptions}
              />
              <UgtSelect
                label={t("targetUGT")}
                value={targetUgt}
                onChange={(v) => {
                  setTargetUgt(v);
                  setShowRoadmap(false);
                }}
                options={targetOptions}
              />
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={buildRoadmap}
                className="flex h-[48px] items-center gap-2 rounded-xl bg-tz-accent px-8 text-base font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
                style={{ boxShadow: "0 8px 24px rgba(214,48,49,0.35), inset 0 1px 0 rgba(255,255,255,0.2)" }}
              >
                <Map size={18} />
                {t("buildMap")}
              </motion.button>
            </div>

            {/* Пресеты */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="mr-2 text-xs font-medium uppercase tracking-[0.08em] text-white/40">
                {t("quickChoice")}
              </span>
              {PRESETS.map((preset, i) => (
                <PresetPill key={preset.label} preset={preset} onClick={() => handlePreset(preset)} index={i} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ Визуальный путь ═══ */}
      <AnimatePresence>
        {showRoadmap && levelsInRange.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className="overflow-hidden bg-tz-soft/50"
          >
            <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-center text-3xl font-bold text-tz-fg sm:text-[40px]"
              >
                {t("visualPath")}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-12 text-center text-lg text-tz-secondary"
              >
                {t("ugtTransition", { from: currentUgt, to: targetUgt })}
              </motion.p>

              {/* Desktop */}
              <div className="hidden items-center justify-center gap-0 md:flex">
                {levelsInRange.map((level, i) => {
                  const isLast = i === levelsInRange.length - 1;
                  const status: "completed" | "current" | "upcoming" =
                    level.id < currentUgt ? "completed" : level.id === currentUgt ? "current" : "upcoming";
                  return (
                    <div key={level.id} className="flex flex-1 items-center">
                      <RoadmapNode level={level} status={status} index={i} />
                      {!isLast && (
                        <div className="mx-2 flex flex-1 items-center pb-6">
                          <ConnectorSegment
                            fromColor={ugtColor(level.id)}
                            toColor={ugtColor(levelsInRange[i + 1].id)}
                            status={level.id < currentUgt ? "completed" : level.id === currentUgt ? "current" : "upcoming"}
                            index={i}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile */}
              <div className="flex flex-col gap-6 md:hidden">
                {levelsInRange.map((level, i) => {
                  const status: "completed" | "current" | "upcoming" =
                    level.id < currentUgt ? "completed" : level.id === currentUgt ? "current" : "upcoming";
                  const isLast = i === levelsInRange.length - 1;
                  return (
                    <div key={level.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <RoadmapNode level={level} status={status} index={i} />
                        {!isLast && (
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{ delay: 0.5 + i * 0.1, duration: 0.4, ease: easeOutExpo }}
                            className="mt-2 h-8 w-[6px] origin-top rounded-full"
                            style={{ background: status === "completed" ? ugtColor(level.id) : "var(--tz-border)" }}
                          />
                        )}
                      </div>
                      <div className="pt-2">
                        <div className="text-sm font-semibold text-tz-fg">{level.name}</div>
                        <div className="mt-1 text-xs text-tz-secondary">{level.short}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ Переходы между уровнями ═══ */}
      <AnimatePresence>
        {showRoadmap && transitionsInRange.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="border-y border-tz-border/60 bg-tz-surface/40"
          >
            <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-3xl font-bold text-tz-fg sm:text-[40px]"
              >
                {t("transitionsTitle")}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-10 text-lg text-tz-secondary"
              >
                {t("transitionsDesc")}
              </motion.p>

              <div className="flex flex-col gap-5">
                {transitionsInRange.map((transition, i) => {
                  const fromLevel = UGT_LEVELS.find((l) => l.id === transition.from)!;
                  const toLevel = UGT_LEVELS.find((l) => l.id === transition.to)!;
                  return (
                    <TransitionCard
                      key={`${transition.from}-${transition.to}`}
                      transition={transition}
                      fromLevel={fromLevel}
                      toLevel={toLevel}
                      index={i}
                    />
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ Сводка ═══ */}
      <AnimatePresence>
        {showRoadmap && summaryStats && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative"
            style={{ background: "linear-gradient(135deg, #0b0d12 0%, #14161c 50%, #1d1415 100%)" }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 60% 40% at 80% 50%, rgba(214,48,49,0.08), transparent)" }}
            />
            <div className="relative mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-3xl font-bold text-white sm:text-[40px]"
              >
                {t("summaryTitle")}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-12 text-lg text-white/60"
              >
                {t("summaryDesc")}
              </motion.p>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={Clock} value={fmtDuration} label={t("totalDuration")} color="#e0522f" index={0} />
                <SummaryCard icon={Route} value={`${transitionsInRange.length}`} label={t("stagesCount")} color="#84cc16" index={1} />
                <SummaryCard icon={ListTodo} value={`${transitionsInRange.reduce((s, tr) => s + tr.actions.length, 0)}`} label={t("totalTasks")} color="#eab308" index={2} />
                <SummaryCard icon={FileCheck} value={`${transitionsInRange.reduce((s, tr) => { const lvl = UGT_LEVELS.find((l) => l.id === tr.to); return s + (lvl?.deliverables.length ?? 0); }, 0)}`} label={t("resultsCount")} color="#16a34a" index={3} />
              </div>

              <div className="mt-12 flex flex-col items-center">
                <CircularProgress
                  percentage={summaryStats.percentage}
                  fromColor={summaryStats.fromColor}
                  toColor={summaryStats.toColor}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="mt-8 flex flex-wrap items-center justify-center gap-4"
                >
                  <span className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
                    <Shield size={14} /> {t("techRiskLow")}
                  </span>
                  <span className="flex items-center gap-2 rounded-full bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400">
                    <Layers size={14} /> {t("integRiskMedium")}
                  </span>
                  <span className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400">
                    <AlertCircle size={14} /> {t("prodRiskMedium")}
                  </span>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-12 flex flex-col items-center text-center"
              >
                <h4 className="text-2xl font-semibold text-white">{t("readyTitle")}</h4>
                <Link
                  href="/register"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-tz-accent px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.03] hover:shadow-xl"
                  style={{ boxShadow: "0 8px 24px rgba(214,48,49,0.3), inset 0 1px 0 rgba(255,255,255,0.2)" }}
                >
                  <TrendingUp size={18} />
                  {t("goToAssessment")}
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ═══ Плейсхолдер ═══ */}
      {!showRoadmap && (
        <section className="flex min-h-[400px] flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{ background: "rgba(214,48,49,0.08)", boxShadow: "0 4px 12px rgba(11,13,18,0.08)" }}
            >
              <Map size={36} className="text-tz-accent" style={{ opacity: 0.6 }} />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-tz-muted">
              {t("placeholderTitle")}
            </h3>
            <p className="mt-2 max-w-[360px] text-tz-muted">
              {t("placeholderDesc")}
            </p>
          </motion.div>
        </section>
      )}
    </>
  );
}
