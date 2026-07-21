import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map,
  Check,
  ChevronDown,
  ArrowRight,
  ClipboardList,
  Target,
  Clock,
  ListTodo,
  FileCheck,
  AlertCircle,
  TrendingUp,
  Shield,
  Layers,
  Route,
  Download,
  AlertTriangle,
  CheckCircle,
  FileText,
} from 'lucide-react';
import {
  UGT_LEVELS,
  ROADMAP_TRANSITIONS,
  type TransitionDoc,
  type TransitionRisk,
} from '@/data/ugtData';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Preset {
  label: string;
  from: number;
  to: number;
  borderColor: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];
const easeSmooth = [0.4, 0, 0.2, 1] as [number, number, number, number];

const PRESETS: Preset[] = [
  {
    label: 'Полный путь: УГТ 1\u21929',
    from: 1,
    to: 9,
    borderColor: 'linear-gradient(135deg, #2E5BFF 0%, #5B9BD5 33%, #A8D65A 66%, #FF7A2E 100%)',
  },
  {
    label: 'Исследование: УГТ 1\u21923',
    from: 1,
    to: 3,
    borderColor: '#4A82FF',
  },
  {
    label: 'Прототипирование: УГТ 4\u21926',
    from: 4,
    to: 6,
    borderColor: '#7EC8A0',
  },
  {
    label: 'Внедрение: УГТ 7\u21929',
    from: 7,
    to: 9,
    borderColor: '#FF7A2E',
  },
];

/* ------------------------------------------------------------------ */
/*  Helper: compute total estimated months from transitions            */
/* ------------------------------------------------------------------ */
function parseMonths(timeStr: string): number {
  const match = timeStr.match(/(\d+)[-\u2013](\d+)/);
  if (!match) return 0;
  return (parseInt(match[1]) + parseInt(match[2])) / 2;
}

/* ------------------------------------------------------------------ */
/*  Helper: probability config                                         */
/* ------------------------------------------------------------------ */
function getProbabilityConfig(probability: TransitionRisk['probability']) {
  switch (probability) {
    case 'low':
      return {
        label: 'Низкая',
        color: '#10B981',
        bg: 'rgba(16, 185, 129, 0.12)',
        border: 'rgba(16, 185, 129, 0.35)',
      };
    case 'medium':
      return {
        label: 'Средняя',
        color: '#E5C840',
        bg: 'rgba(229, 200, 64, 0.12)',
        border: 'rgba(229, 200, 64, 0.35)',
      };
    case 'high':
      return {
        label: 'Высокая',
        color: '#EF4444',
        bg: 'rgba(239, 68, 68, 0.12)',
        border: 'rgba(239, 68, 68, 0.35)',
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/* --- Breadcrumb --- */
function Breadcrumb() {
  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="mb-6 flex items-center gap-2 text-sm"
      style={{ color: 'rgba(255,255,255,0.45)' }}
    >
      <Link to="/" className="transition-colors hover:text-[#4A82FF]">
        Главная
      </Link>
      <ChevronDown size={14} className="-rotate-90" />
      <span style={{ color: 'rgba(255,255,255,0.65)' }}>Дорожная карта</span>
    </motion.nav>
  );
}

/* --- UGT Select --- */
function UgtSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string; color?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        className="text-xs font-medium uppercase tracking-[0.08em]"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-[48px] w-[200px] cursor-pointer appearance-none rounded-[10px] px-4 text-base text-white outline-none transition-all focus:ring-2"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ color: '#0F172A' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* --- Preset Pill --- */
function PresetPill({
  preset,
  onClick,
  index,
}: {
  preset: Preset;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.9 + index * 0.08, duration: 0.3 }}
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-medium text-white transition-all hover:scale-[1.03]"
      style={{
        background: 'transparent',
        border: `1.5px solid ${preset.borderColor.includes('gradient') ? '#fff' : preset.borderColor}`,
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '4px 4px 8px rgba(0,0,0,0.15), -4px -4px 8px rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
        (e.currentTarget as HTMLElement).style.boxShadow =
          '6px 6px 12px rgba(0,0,0,0.2), -6px -6px 12px rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.boxShadow =
          '4px 4px 8px rgba(0,0,0,0.15), -4px -4px 8px rgba(255,255,255,0.04)';
      }}
    >
      {preset.label}
    </motion.button>
  );
}

/* --- Roadmap Node --- */
function RoadmapNode({
  level,
  status,
  index,
}: {
  level: (typeof UGT_LEVELS)[number];
  status: 'completed' | 'current' | 'upcoming';
  index: number;
}) {
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';

  const statusLabel = isCompleted
    ? 'Завершён'
    : isCurrent
      ? 'Текущий'
      : 'Ожидает';

  const statusBg = isCompleted
    ? 'rgba(16, 185, 129, 0.1)'
    : isCurrent
      ? `${level.color}1A`
      : '#E8ECF0';

  const statusText = isCompleted ? '#10B981' : isCurrent ? level.color : '#94A3B8';

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        delay: 0.3 + index * 0.1,
        duration: 0.4,
        ease: easeBounce,
      }}
      className="flex flex-col items-center gap-2"
      style={{ minWidth: 64 }}
    >
      {/* Circle */}
      <div className="relative" style={{ width: 64, height: 64 }}>
        {isCurrent && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              border: `3px solid ${level.color}`,
              boxShadow: `0 0 20px ${level.color}66, 0 0 40px ${level.color}33`,
            }}
            animate={{
              scale: [1, 1.45, 1],
              opacity: [0.6, 0, 0.6],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: isCompleted || isCurrent ? level.color : '#FFFFFF',
            border: isCompleted || isCurrent ? 'none' : '3px solid #E8ECF0',
            opacity: isCompleted || isCurrent ? 1 : 0.7,
            boxShadow:
              isCompleted || isCurrent
                ? `4px 4px 10px ${level.color}44, -4px -4px 10px rgba(255,255,255,0.3)`
                : '4px 4px 8px rgba(0,0,0,0.06), -4px -4px 8px rgba(255,255,255,0.8)',
          }}
        >
          {isCompleted ? (
            <Check size={28} className="text-white" strokeWidth={3} />
          ) : (
            <span
              className="font-mono text-lg font-bold"
              style={{ color: isCurrent ? '#FFFFFF' : '#94A3B8' }}
            >
              {level.id}
            </span>
          )}
        </div>
      </div>

      {/* Label */}
      <span
        className="whitespace-nowrap font-mono text-xs font-medium"
        style={{ color: isCompleted || isCurrent ? level.color : '#94A3B8' }}
      >
        {level.code}
      </span>

      {/* Status badge */}
      <span
        className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        style={{
          background: statusBg,
          color: statusText,
          boxShadow: '2px 2px 4px rgba(0,0,0,0.06), -2px -2px 4px rgba(255,255,255,0.5)',
        }}
      >
        {isCompleted && '✓ '}
        {isCurrent && '▶ '}
        {!isCompleted && !isCurrent && '○ '}
        {statusLabel}
      </span>
    </motion.div>
  );
}

/* --- Connector Segment --- */
function ConnectorSegment({
  fromColor,
  toColor,
  status,
  index,
}: {
  fromColor: string;
  toColor: string;
  status: 'completed' | 'current' | 'upcoming';
  index: number;
}) {
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';

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
            : '#E8ECF0',
        borderRadius: 9999,
        backgroundSize: isCurrent ? '200% 100%' : undefined,
        boxShadow:
          isCompleted || isCurrent
            ? `0 2px 8px ${fromColor}33`
            : 'inset 1px 1px 2px rgba(0,0,0,0.05)',
      }}
    >
      {isCurrent && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${fromColor}33, ${toColor}, ${fromColor}33)`,
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

/* --- Document Card --- */
function DocumentCard({
  doc,
  index,
  accentColor,
}: {
  doc: TransitionDoc;
  index: number;
  accentColor: string;
}) {
  const handleDownload = () => {
    alert('Шаблон будет доступен в следующей версии');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: easeSmooth }}
      className="flex items-start gap-3 rounded-[12px] border p-4 transition-all"
      style={{
        background: '#F5F7FA',
        borderColor: '#DEE2E8',
        boxShadow: '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `${accentColor}66`;
        el.style.transform = 'translateY(-2px)';
        el.style.boxShadow = `6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff, 0 4px 12px ${accentColor}22`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '#DEE2E8';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff';
      }}
    >
      <div
        className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px]"
        style={{ background: `${accentColor}1A` }}
      >
        <FileText size={18} style={{ color: accentColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>
          {doc.name}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed" style={{ color: '#475569' }}>
          {doc.description}
        </div>
      </div>
      <button
        onClick={handleDownload}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-2 text-xs font-medium transition-all"
        style={{
          background: `${accentColor}1A`,
          color: accentColor,
          boxShadow: '3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = `${accentColor}2D`;
          el.style.transform = 'translateY(-1px)';
          el.style.boxShadow = `4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff, 0 2px 8px ${accentColor}33`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.background = `${accentColor}1A`;
          el.style.transform = 'translateY(0)';
          el.style.boxShadow = '3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff';
        }}
      >
        <Download size={13} />
        Скачать образец
      </button>
    </motion.div>
  );
}

/* --- Risk Card --- */
function RiskCard({
  risk,
  index,
}: {
  risk: TransitionRisk;
  index: number;
}) {
  const [solutionOpen, setSolutionOpen] = useState(false);
  const config = getProbabilityConfig(risk.probability);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1, duration: 0.45, ease: easeSmooth }}
      className="overflow-hidden rounded-[12px] border transition-all"
      style={{
        background: '#FFFFFF',
        borderColor: config.border,
        borderLeftWidth: 4,
        borderLeftColor: config.color,
        boxShadow: '4px 4px 10px rgba(15,23,42,0.06), -4px -4px 10px rgba(255,255,255,0.8)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = `6px 6px 16px rgba(15,23,42,0.1), -6px -6px 16px rgba(255,255,255,0.9), 0 4px 12px ${config.color}22`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow =
          '4px 4px 10px rgba(15,23,42,0.06), -4px -4px 10px rgba(255,255,255,0.8)';
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[8px]"
              style={{ background: config.bg }}
            >
              <AlertTriangle size={16} style={{ color: config.color }} />
            </div>
            <span className="text-sm font-medium leading-relaxed" style={{ color: '#0F172A' }}>
              {risk.risk}
            </span>
          </div>
          <span
            className="flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: config.bg,
              color: config.color,
              boxShadow: '2px 2px 4px rgba(0,0,0,0.06), -2px -2px 4px rgba(255,255,255,0.5)',
            }}
          >
            {config.label}
          </span>
        </div>

        {/* Solution toggle */}
        <button
          onClick={() => setSolutionOpen(!solutionOpen)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: '#2E5BFF' }}
        >
          <motion.div
            animate={{ rotate: solutionOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <ChevronDown size={14} />
          </motion.div>
          {solutionOpen ? 'Скрыть решение' : 'Показать решение'}
        </button>

        <AnimatePresence>
          {solutionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: easeSmooth }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 flex items-start gap-3 rounded-[8px] border p-3"
                style={{
                  background: 'rgba(16, 185, 129, 0.05)',
                  borderColor: 'rgba(16, 185, 129, 0.2)',
                }}
              >
                <CheckCircle
                  size={16}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: '#10B981' }}
                />
                <span className="text-sm leading-relaxed" style={{ color: '#0F172A' }}>
                  {risk.solution}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* --- Transition Card --- */
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

  const actions = transition.actions;
  const deliverables = toLevel.deliverables;
  const duration = transition.estimatedTime;
  const documents = transition.documents;
  const risks = transition.risks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        delay: index * 0.1,
        duration: 0.5,
        ease: easeOutExpo,
      }}
      className="overflow-hidden rounded-[16px] transition-all"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E8ECF0',
        borderLeft: `3px solid transparent`,
        borderImage: `linear-gradient(180deg, ${fromLevel.color} 0%, ${toLevel.color} 100%) 1`,
        boxShadow: '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = `${fromLevel.color}4D`;
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = `12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff, 0 8px 24px ${fromLevel.color}22`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = '#E8ECF0';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff';
      }}
    >
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-7 py-6 text-left"
      >
        <div className="flex items-center gap-4">
          {/* From level indicator */}
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-base font-bold text-white"
            style={{
              background: fromLevel.color,
              boxShadow: `3px 3px 6px ${fromLevel.color}66, -3px -3px 6px rgba(255,255,255,0.3)`,
            }}
          >
            {fromLevel.id}
          </div>

          <ArrowRight size={20} style={{ color: '#94A3B8' }} />

          {/* To level indicator */}
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-base font-bold text-white"
            style={{
              background: toLevel.color,
              boxShadow: `3px 3px 6px ${toLevel.color}66, -3px -3px 6px rgba(255,255,255,0.3)`,
            }}
          >
            {toLevel.id}
          </div>

          <div className="ml-2">
            <h4 className="text-xl font-semibold" style={{ color: '#0F172A' }}>
              {fromLevel.name} &rarr; {toLevel.name}
            </h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: '#94A3B8' }}
              >
                <Clock size={13} />
                {duration}
              </span>
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: '#94A3B8' }}
              >
                <ListTodo size={13} />
                {actions.length} задач
              </span>
              <span
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: '#94A3B8' }}
              >
                <FileCheck size={13} />
                {deliverables.length} результата
              </span>
              {documents.length > 0 && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: '#94A3B8' }}
                >
                  <FileText size={13} />
                  {documents.length} документов
                </span>
              )}
              {risks.length > 0 && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: '#94A3B8' }}
                >
                  <AlertTriangle size={13} />
                  {risks.length} риска
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown size={24} style={{ color: '#94A3B8' }} />
          </motion.div>
          <span className="text-[11px] font-medium" style={{ color: '#94A3B8' }}>
            {expanded ? 'Свернуть' : 'Развернуть'}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: easeSmooth }}
            className="overflow-hidden"
          >
            <div
              className="mx-7 border-t pb-8 pt-6"
              style={{ borderColor: '#E8ECF0' }}
            >
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Left column — Tasks */}
                <div>
                  <h5
                    className="mb-4 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: '#0F172A' }}
                  >
                    <ClipboardList size={20} style={{ color: '#475569' }} />
                    Задачи
                  </h5>
                  <div className="flex flex-col gap-3">
                    {actions.map((task, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: i * 0.06,
                          duration: 0.4,
                          ease: easeSmooth,
                        }}
                        className="flex items-start gap-3 rounded-[10px] border p-4 transition-all"
                        style={{
                          background: '#F5F7FA',
                          borderColor: '#DEE2E8',
                          boxShadow:
                            '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff',
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = `${toLevel.color}66`;
                          el.style.transform = 'translateY(-2px)';
                          el.style.boxShadow = `6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff, 0 4px 12px ${toLevel.color}22`;
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.borderColor = '#DEE2E8';
                          el.style.transform = 'translateY(0)';
                          el.style.boxShadow =
                            '4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff';
                        }}
                      >
                        <div
                          className="mt-0.5 h-[22px] w-[22px] flex-shrink-0 rounded-[6px] border-2"
                          style={{ borderColor: toLevel.color }}
                        />
                        <span className="text-sm" style={{ color: '#0F172A' }}>
                          {task}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Right column — Deliverables */}
                <div>
                  <h5
                    className="mb-4 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: '#0F172A' }}
                  >
                    <Target size={20} style={{ color: '#475569' }} />
                    Результаты
                  </h5>
                  <div className="flex flex-col gap-3">
                    {deliverables.map((result, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: i * 0.06,
                          duration: 0.4,
                          ease: easeSmooth,
                        }}
                        className="flex items-center gap-3"
                      >
                        <div
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: toLevel.color }}
                        />
                        <span className="text-sm" style={{ color: '#0F172A' }}>
                          {result}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Duration badge */}
                  <div
                    className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    style={{
                      background: `${toLevel.color}1A`,
                      color: toLevel.color,
                      boxShadow:
                        '3px 3px 6px #d1d9e6, -3px -3px 6px #ffffff',
                    }}
                  >
                    <Clock size={15} />
                    Срок выполнения: {duration}
                  </div>

                  {/* Link to level detail */}
                  <div className="mt-4">
                    <Link
                      to={`/level/${toLevel.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                      style={{ color: '#2E5BFF' }}
                    >
                      Подробнее об {toLevel.code}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              {documents.length > 0 && (
                <div className="mt-8 border-t pt-6" style={{ borderColor: '#E8ECF0' }}>
                  <h5
                    className="mb-4 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: '#0F172A' }}
                  >
                    <FileText size={20} style={{ color: '#475569' }} />
                    Ключевые документы
                  </h5>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {documents.map((doc, i) => (
                      <DocumentCard
                        key={i}
                        doc={doc}
                        index={i}
                        accentColor={toLevel.color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Risks Section */}
              {risks.length > 0 && (
                <div className="mt-8 border-t pt-6" style={{ borderColor: '#E8ECF0' }}>
                  <h5
                    className="mb-4 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: '#0F172A' }}
                  >
                    <AlertTriangle size={20} style={{ color: '#475569' }} />
                    Риски и решения
                  </h5>
                  <div className="flex flex-col gap-3">
                    {risks.map((risk, i) => (
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

/* --- Summary Card --- */
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
      className="rounded-[16px] p-7 transition-all"
      style={{
        background: '#1E293B',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow:
          '8px 8px 16px rgba(0,0,0,0.3), -8px -8px 16px rgba(255,255,255,0.04)',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(255,255,255,0.12)';
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow =
          '12px 12px 24px rgba(0,0,0,0.35), -12px -12px 24px rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(255,255,255,0.06)';
        el.style.transform = 'translateY(0)';
        el.style.boxShadow =
          '8px 8px 16px rgba(0,0,0,0.3), -8px -8px 16px rgba(255,255,255,0.04)';
      }}
    >
      <Icon size={28} style={{ color, opacity: 0.8 }} />
      <div className="mt-4 font-mono text-[32px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
        {label}
      </div>
    </motion.div>
  );
}

/* --- Circular Progress Ring --- */
function CircularProgress({
  percentage,
  fromColor,
  toColor,
}: {
  percentage: number;
  fromColor: string;
  toColor: string;
}) {
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
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={8}
        />
        {/* Fill */}
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
          filter="url(#glow)"
        />
        {/* Center text */}
        <text
          x="100"
          y="96"
          textAnchor="middle"
          className="font-mono text-[36px] font-bold"
          fill="#FFFFFF"
        >
          {percentage}%
        </text>
        <text
          x="100"
          y="118"
          textAnchor="middle"
          className="text-xs font-medium uppercase tracking-[0.05em]"
          fill="rgba(255,255,255,0.5)"
        >
          завершено
        </text>
      </svg>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */
export default function Roadmap() {
  const [currentUgt, setCurrentUgt] = useState<number>(0);
  const [targetUgt, setTargetUgt] = useState<number>(0);
  const [showRoadmap, setShowRoadmap] = useState(false);

  const currentOptions = [
    { value: 0, label: 'Не определён' },
    ...UGT_LEVELS.map((l) => ({
      value: l.id,
      label: `${l.code} — ${l.name}`,
      color: l.color,
    })),
  ];

  const targetOptions = [
    { value: 0, label: 'Не определён' },
    ...UGT_LEVELS.filter((l) => l.id > currentUgt).map((l) => ({
      value: l.id,
      label: `${l.code} — ${l.name}`,
      color: l.color,
    })),
  ];

  const buildRoadmap = () => {
    if (currentUgt > 0 && targetUgt > 0 && targetUgt > currentUgt) {
      setShowRoadmap(true);
    }
  };

  const handlePreset = (preset: Preset) => {
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
    return ROADMAP_TRANSITIONS.filter(
      (t) => t.from >= currentUgt && t.to <= targetUgt
    );
  }, [showRoadmap, currentUgt, targetUgt]);

  const summaryStats = useMemo(() => {
    if (transitionsInRange.length === 0) return null;

    const totalMonths = transitionsInRange.reduce(
      (sum, t) => sum + parseMonths(t.estimatedTime),
      0
    );
    const totalActions = transitionsInRange.reduce(
      (sum, t) => sum + t.actions.length,
      0
    );
    const totalDeliverables = transitionsInRange.reduce((sum, t) => {
      const toLevel = UGT_LEVELS.find((l) => l.id === t.to);
      return sum + (toLevel?.deliverables.length ?? 0);
    }, 0);

    const fromColor = UGT_LEVELS[currentUgt - 1]?.color ?? '#2E5BFF';
    const toColor = UGT_LEVELS[targetUgt - 1]?.color ?? '#FF7A2E';

    return {
      duration: `${Math.round(totalMonths * 0.8)}–${Math.round(totalMonths * 1.2)} месяцев`,
      transitions: `${transitionsInRange.length} переходов`,
      tasks: `${totalActions} задач`,
      deliverables: `${totalDeliverables} результатов`,
      percentage: Math.round((currentUgt / targetUgt) * 100),
      fromColor,
      toColor,
    };
  }, [transitionsInRange, currentUgt, targetUgt]);

  return (
    <>
      {/* ================================================================ */}
      {/*  Section 1 — Hero                                                */}
      {/* ================================================================ */}
      <section
        className="relative"
        style={{
          background: 'linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #1E293B 100%)',
        }}
      >
        {/* Glass overlay */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(46, 91, 255, 0.15), transparent)',
          }}
        />
        <div className="relative mx-auto max-w-[1280px] px-4 pb-16 pt-[120px] sm:px-6 sm:pb-20 lg:px-8">
          <Breadcrumb />

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: easeOutExpo }}
            className="max-w-[720px] text-4xl font-bold tracking-tight text-white sm:text-[56px] sm:leading-[1.1]"
          >
            Дорожная карта развития
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5, ease: easeOutExpo }}
            className="mt-6 max-w-[640px] text-lg leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            Спланируйте путь вашего проекта от текущего уровня готовности к
            целевому. Каждый переход между УГТ сопровождается конкретным
            планом действий по методологии ГОСТ Р 58048-2017.
          </motion.p>

          {/* Selector Block */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: easeOutExpo }}
            className="mt-12 rounded-[24px] p-6 sm:p-8"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              backdropFilter: 'blur(24px) saturate(180%)',
              WebkitBackdropFilter: 'blur(24px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow:
                '0 16px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex flex-wrap items-end gap-6 sm:gap-8">
              <UgtSelect
                label="Текущий УГТ"
                value={currentUgt}
                onChange={handleCurrentChange}
                options={currentOptions}
              />
              <UgtSelect
                label="Целевой УГТ"
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
                className="flex h-[48px] items-center gap-2 rounded-[10px] px-8 text-base font-semibold text-white shadow-lg transition-shadow hover:shadow-xl"
                style={{
                  background:
                    'linear-gradient(135deg, #2E5BFF 0%, #5B9BD5 33%, #A8D65A 66%, #FF7A2E 100%)',
                  boxShadow:
                    '0 8px 24px rgba(46, 91, 255, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <Map size={18} />
                Построить карту
              </motion.button>
            </div>

            {/* Presets */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span
                className="mr-2 text-xs font-medium uppercase tracking-[0.08em]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Быстрый выбор:
              </span>
              {PRESETS.map((preset, i) => (
                <PresetPill
                  key={preset.label}
                  preset={preset}
                  onClick={() => handlePreset(preset)}
                  index={i}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  Section 2 — Interactive Roadmap Canvas                          */}
      {/* ================================================================ */}
      <AnimatePresence>
        {showRoadmap && levelsInRange.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            style={{ background: '#F5F7FA' }}
            className="overflow-hidden"
          >
            <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-center text-3xl font-bold sm:text-[40px]"
                style={{ color: '#0F172A' }}
              >
                Визуальный путь
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mb-12 text-center text-lg"
                style={{ color: '#475569' }}
              >
                УГТ {currentUgt} &rarr; УГТ {targetUgt}
              </motion.p>

              {/* Desktop: horizontal timeline */}
              <div className="hidden items-center justify-center gap-0 md:flex">
                {levelsInRange.map((level, i) => {
                  const isLast = i === levelsInRange.length - 1;
                  const status: 'completed' | 'current' | 'upcoming' =
                    level.id < currentUgt
                      ? 'completed'
                      : level.id === currentUgt
                        ? 'current'
                        : 'upcoming';

                  return (
                    <div key={level.id} className="flex flex-1 items-center">
                      <RoadmapNode level={level} status={status} index={i} />
                      {!isLast && (
                        <div className="mx-2 flex flex-1 items-center pb-6">
                          <ConnectorSegment
                            fromColor={level.color}
                            toColor={levelsInRange[i + 1].color}
                            status={
                              level.id < currentUgt
                                ? 'completed'
                                : level.id === currentUgt
                                  ? 'current'
                                  : 'upcoming'
                            }
                            index={i}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mobile: vertical timeline */}
              <div className="flex flex-col gap-6 md:hidden">
                {levelsInRange.map((level, i) => {
                  const status: 'completed' | 'current' | 'upcoming' =
                    level.id < currentUgt
                      ? 'completed'
                      : level.id === currentUgt
                        ? 'current'
                        : 'upcoming';

                  const isLast = i === levelsInRange.length - 1;

                  return (
                    <div key={level.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <RoadmapNode level={level} status={status} index={i} />
                        {!isLast && (
                          <motion.div
                            initial={{ scaleY: 0 }}
                            animate={{ scaleY: 1 }}
                            transition={{
                              delay: 0.5 + i * 0.1,
                              duration: 0.4,
                              ease: easeOutExpo,
                            }}
                            className="mt-2 h-8 w-[6px] origin-top rounded-full"
                            style={{
                              background:
                                status === 'completed' ? level.color : '#E8ECF0',
                              boxShadow:
                                status === 'completed'
                                  ? `0 2px 8px ${level.color}44`
                                  : 'none',
                            }}
                          />
                        )}
                      </div>
                      <div className="pt-2">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: '#0F172A' }}
                        >
                          {level.name}
                        </div>
                        <div
                          className="mt-1 text-xs"
                          style={{ color: '#475569' }}
                        >
                          {level.short}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/*  Section 3 — Transition Cards                                    */}
      {/* ================================================================ */}
      <AnimatePresence>
        {showRoadmap && transitionsInRange.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            style={{ background: '#EEF1F5' }}
          >
            <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-3xl font-bold sm:text-[40px]"
                style={{ color: '#0F172A' }}
              >
                Переходы между уровнями
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-10 text-lg"
                style={{ color: '#475569' }}
              >
                Развёрнутый план действий для каждого этапа
              </motion.p>

              <div className="flex flex-col gap-5">
                {transitionsInRange.map((transition, i) => {
                  const fromLevel = UGT_LEVELS.find(
                    (l) => l.id === transition.from
                  )!;
                  const toLevel = UGT_LEVELS.find(
                    (l) => l.id === transition.to
                  )!;
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

      {/* ================================================================ */}
      {/*  Section 4 — Summary Dashboard                                   */}
      {/* ================================================================ */}
      <AnimatePresence>
        {showRoadmap && summaryStats && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{
              background: 'linear-gradient(135deg, #0B1120 0%, #0F172A 50%, #1E293B 100%)',
            }}
          >
            {/* Glass overlay */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(255, 122, 46, 0.08), transparent)',
              }}
            />
            <div className="relative mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="mb-2 text-3xl font-bold text-white sm:text-[40px]"
              >
                Сводка дорожной карты
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-12 text-lg"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                Общая картина пути развития
              </motion.p>

              {/* Summary cards row */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  icon={Clock}
                  value={summaryStats.duration}
                  label="Общий срок"
                  color="#4A82FF"
                  index={0}
                />
                <SummaryCard
                  icon={Route}
                  value={summaryStats.transitions}
                  label="Количество этапов"
                  color="#7EC8A0"
                  index={1}
                />
                <SummaryCard
                  icon={ListTodo}
                  value={summaryStats.tasks}
                  label="Всего задач"
                  color="#E5C840"
                  index={2}
                />
                <SummaryCard
                  icon={FileCheck}
                  value={summaryStats.deliverables}
                  label="Результаты"
                  color="#FF7A2E"
                  index={3}
                />
              </div>

              {/* Progress Overview */}
              <div className="mt-12 flex flex-col items-center">
                <CircularProgress
                  percentage={summaryStats.percentage}
                  fromColor={summaryStats.fromColor}
                  toColor={summaryStats.toColor}
                />

                {/* Risk Indicators */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="mt-8 flex flex-wrap items-center justify-center gap-4"
                >
                  <span
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10B981',
                      boxShadow:
                        '3px 3px 6px rgba(0,0,0,0.15), -3px -3px 6px rgba(255,255,255,0.04)',
                    }}
                  >
                    <Shield size={14} />
                    Технологический риск: низкий
                  </span>
                  <span
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    style={{
                      background: 'rgba(229, 200, 64, 0.12)',
                      color: '#E5C840',
                      boxShadow:
                        '3px 3px 6px rgba(0,0,0,0.15), -3px -3px 6px rgba(255,255,255,0.04)',
                    }}
                  >
                    <Layers size={14} />
                    Интеграционный риск: средний
                  </span>
                  <span
                    className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                    style={{
                      background: 'rgba(255, 122, 46, 0.12)',
                      color: '#FF7A2E',
                      boxShadow:
                        '3px 3px 6px rgba(0,0,0,0.15), -3px -3px 6px rgba(255,255,255,0.04)',
                    }}
                  >
                    <AlertCircle size={14} />
                    Производственный риск: средний
                  </span>
                </motion.div>
              </div>

              {/* CTA Block */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="mt-12 flex flex-col items-center text-center"
              >
                <h4 className="text-2xl font-semibold text-white">
                  Готовы начать?
                </h4>
                <Link
                  to="/assessment"
                  className="mt-6 inline-flex items-center gap-2 rounded-[10px] px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-[1.03] hover:shadow-xl"
                  style={{
                    background:
                      'linear-gradient(135deg, #2E5BFF 0%, #5B9BD5 33%, #A8D65A 66%, #FF7A2E 100%)',
                    boxShadow:
                      '0 8px 24px rgba(46, 91, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  <TrendingUp size={18} />
                  Перейти к оценке проекта
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ================================================================ */}
      {/*  Placeholder when no roadmap built                               */}
      {/* ================================================================ */}
      {!showRoadmap && (
        <section
          className="flex flex-1 items-center justify-center"
          style={{ background: '#F5F7FA', minHeight: 400 }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full"
              style={{
                background: 'rgba(46, 91, 255, 0.08)',
                boxShadow: '6px 6px 12px #d1d9e6, -6px -6px 12px #ffffff',
              }}
            >
              <Map size={36} style={{ color: '#2E5BFF', opacity: 0.5 }} />
            </div>
            <h3
              className="mt-6 text-xl font-semibold"
              style={{ color: '#94A3B8' }}
            >
              Выберите текущий и целевой УГТ
            </h3>
            <p
              className="mt-2 max-w-[360px]"
              style={{ color: '#94A3B8' }}
            >
              Чтобы построить дорожную карту, укажите текущий уровень
              технологической готовности и желаемый целевой
            </p>
          </motion.div>
        </section>
      )}
    </>
  );
}
