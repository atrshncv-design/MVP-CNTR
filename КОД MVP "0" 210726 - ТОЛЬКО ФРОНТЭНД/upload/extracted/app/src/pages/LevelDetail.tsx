import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Home,
  ArrowLeft,
  ArrowRight,
  Check,
  BookOpen,
  FileText,
  Beaker,
  Target,
  Zap,
  Map,
  Download,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { UGT_LEVELS } from '@/data/ugtData';
import type { DeliverableDoc, RiskItem } from '@/data/ugtData';

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: easeOutExpo },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: easeBounce },
  },
};

const cardStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOutExpo },
  },
};

function getStageLabel(id: number): string {
  if (id <= 2) return 'Исследование';
  if (id <= 4) return 'Подтверждение концепции';
  if (id <= 6) return 'Прототипирование';
  if (id === 7) return 'Полевые испытания';
  if (id === 8) return 'Квалификация';
  return 'Эксплуатация';
}

function getKpiIcon(label: string) {
  if (label.includes('Публикации')) return BookOpen;
  if (label.includes('Патенты')) return FileText;
  return Beaker;
}

function getProbabilityConfig(probability: RiskItem['probability']) {
  switch (probability) {
    case 'low':
      return { label: 'Низкая', color: '#22C55E', bg: '#DCFCE7' };
    case 'medium':
      return { label: 'Средняя', color: '#EAB308', bg: '#FEF9C3' };
    case 'high':
      return { label: 'Высокая', color: '#EF4444', bg: '#FEE2E2' };
    default:
      return { label: 'Средняя', color: '#EAB308', bg: '#FEF9C3' };
  }
}

export default function LevelDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const levelId = parseInt(id || '1', 10);
  const level = UGT_LEVELS.find((l) => l.id === levelId);

  // Checklist state
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  // Risk accordion state
  const [expandedRisks, setExpandedRisks] = useState<Record<number, boolean>>({});

  // Reset checklist when level changes
  useEffect(() => {
    setCheckedItems({});
    setExpandedRisks({});
  }, [levelId]);

  if (!level) {
    return (
      <>
        <div className="mx-auto max-w-[1280px] px-4 pt-[140px] pb-24 text-center sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#0F172A]" style={{ letterSpacing: '-0.02em' }}>Уровень не найден</h1>
          <p className="mt-4 text-base leading-relaxed text-[#475569]">
            УГТ с номером {levelId} не существует. Выберите уровень от 1 до 9.
          </p>
          <Link
            to="/levels"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#2E5BFF] px-6 py-3 font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:brightness-110 active:scale-[0.98]"
          >
            <ArrowLeft size={18} />
            К списку уровней
          </Link>
        </div>
      </>
    );
  }

  const prevLevel = levelId > 1 ? UGT_LEVELS[levelId - 2] : null;
  const nextLevel = levelId < 9 ? UGT_LEVELS[levelId] : null;
  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalRequirements = level.requirements.length;
  const progressPercent = Math.round((checkedCount / totalRequirements) * 100);
  const kpiEntries = Object.entries(level.kpi);

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleRisk = (index: number) => {
    setExpandedRisks((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleNodeClick = (clickedId: number) => {
    if (clickedId !== levelId) {
      navigate(`/level/${clickedId}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDownloadStub = (_doc: DeliverableDoc) => {
    alert('Шаблон документа будет доступен в следующей версии');
  };

  // Animated gradient mesh overlay style
  const heroGradientStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, ${level.color}20 0%, ${level.color}0A 50%, #F5F7FA 100%)`,
    borderBottom: `3px solid ${level.color}`,
  };

  return (
    <>
      {/* ========== Section 1: Hero with animated gradient mesh ========== */}
      <section className="relative overflow-hidden" style={heroGradientStyle}>
        {/* Animated gradient mesh overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 20% 40%, ${level.color}15 0%, transparent 60%),
                         radial-gradient(ellipse 60% 80% at 80% 20%, ${level.color}10 0%, transparent 50%)`,
          }}
        />
        {/* Floating particles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 4 + i * 3,
                height: 4 + i * 3,
                backgroundColor: level.color,
                opacity: 0.08 + i * 0.015,
                left: `${15 + i * 14}%`,
                top: `${20 + (i % 3) * 25}%`,
              }}
              animate={{
                y: [0, -15, 0],
                opacity: [0.08 + i * 0.015, 0.15 + i * 0.02, 0.08 + i * 0.015],
              }}
              transition={{
                duration: 4 + i * 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.5,
              }}
            />
          ))}
        </div>

        <div className="relative mx-auto max-w-[1280px] px-4 pt-[120px] pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <motion.div initial="hidden" animate="visible" className="relative">
            {/* Breadcrumb */}
            <motion.nav
              custom={0.1}
              variants={fadeUpVariants}
              className="mb-6 flex items-center gap-2 text-sm"
              style={{ color: '#94A3B8' }}
            >
              <Link
                to="/"
                className="flex items-center gap-1 transition-colors duration-200 hover:text-[#2E5BFF]"
              >
                <Home size={14} />
                <span>Главная</span>
              </Link>
              <ChevronRight size={14} />
              <Link
                to="/levels"
                className="transition-colors duration-200 hover:text-[#2E5BFF]"
              >
                Уровни УГТ
              </Link>
              <ChevronRight size={14} />
              <span className="font-medium" style={{ color: level.color }}>
                {level.code}
              </span>
            </motion.nav>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: main info */}
              <div className="flex-1">
                {/* Badge Row */}
                <motion.div
                  custom={0.2}
                  variants={fadeUpVariants}
                  className="flex flex-wrap items-center gap-3"
                >
                  <span
                    className="inline-block rounded-full px-4 py-1.5 font-mono text-base font-semibold"
                    style={{
                      background: level.color + '18',
                      color: level.color,
                      border: `1px solid ${level.color}40`,
                      boxShadow: `0 2px 8px ${level.color}15`,
                    }}
                  >
                    {level.code}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.08em]"
                    style={{ background: '#F5F7FA', color: '#94A3B8' }}
                  >
                    {getStageLabel(level.id)}
                  </span>
                </motion.div>

                {/* Title */}
                <motion.h1
                  custom={0.3}
                  variants={fadeUpVariants}
                  className="mt-5 text-4xl font-bold text-[#0F172A] sm:text-5xl lg:text-[56px] lg:leading-[1.1]"
                  style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
                >
                  {level.name}
                </motion.h1>

                {/* Definition */}
                <motion.p
                  custom={0.5}
                  variants={fadeUpVariants}
                  className="mt-4 max-w-[700px] text-lg font-medium text-[#0F172A]"
                  style={{ lineHeight: 1.6 }}
                >
                  {level.short}
                </motion.p>

                {/* Description */}
                <motion.p
                  custom={0.6}
                  variants={fadeUpVariants}
                  className="mt-4 max-w-[700px] text-base text-[#475569]"
                  style={{ lineHeight: 1.7 }}
                >
                  {level.description}
                </motion.p>
              </div>

              {/* Right: prev/next navigation */}
              <motion.div
                custom={0.7}
                variants={fadeUpVariants}
                className="flex flex-col gap-3 lg:w-[220px]"
              >
                {prevLevel && (
                  <Link
                    to={`/level/${prevLevel.id}`}
                    className="group block rounded-2xl border border-[#E8ECF0] bg-white p-4 transition-all duration-200 hover:-translate-x-1 hover:shadow-lg"
                    style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = prevLevel.color + '60';
                      e.currentTarget.style.boxShadow = `0 4px 24px ${prevLevel.color}25`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E8ECF0';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,23,42,0.06)';
                    }}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-[#94A3B8]">
                      <ArrowLeft size={12} /> Предыдущий
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[#0F172A]">
                      {prevLevel.code}: {prevLevel.name}
                    </span>
                  </Link>
                )}
                {nextLevel && (
                  <Link
                    to={`/level/${nextLevel.id}`}
                    className="group block rounded-2xl border border-[#E8ECF0] bg-white p-4 transition-all duration-200 hover:translate-x-1 hover:shadow-lg"
                    style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = nextLevel.color + '60';
                      e.currentTarget.style.boxShadow = `0 4px 24px ${nextLevel.color}25`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E8ECF0';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(15,23,42,0.06)';
                    }}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-[0.06em] text-[#94A3B8]">
                      Следующий <ArrowRight size={12} />
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-[#0F172A]">
                      {nextLevel.code}: {nextLevel.name}
                    </span>
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== Section 2: Mini Timeline (Glassmorphism) ========== */}
      <section className="relative z-10 mx-auto -mt-8 max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: easeOutExpo }}
          className="rounded-2xl border border-white/40 p-5 sm:p-6"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div className="relative flex items-center justify-between">
            {/* Track */}
            <div className="absolute left-0 right-0 top-[17px] h-[3px] rounded-full bg-[#E8ECF0]" />
            <div
              className="absolute left-0 top-[17px] h-[3px] rounded-full transition-all duration-700"
              style={{
                width: `${((levelId - 1) / 8) * 100}%`,
                background: `linear-gradient(90deg, ${UGT_LEVELS[0].color}, ${level.color})`,
              }}
            />

            {/* Nodes */}
            {UGT_LEVELS.map((l) => {
              const isCurrent = l.id === levelId;
              const isCompleted = l.id < levelId;
              return (
                <button
                  key={l.id}
                  onClick={() => handleNodeClick(l.id)}
                  className="relative z-10 flex flex-col items-center gap-1.5 bg-transparent p-0 transition-transform duration-200 hover:scale-110"
                  title={l.name}
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full font-mono text-xs font-semibold transition-all duration-300 sm:h-[36px] sm:w-[36px]"
                    style={{
                      backgroundColor: isCurrent
                        ? l.color
                        : isCompleted
                          ? l.color + '90'
                          : '#E8ECF0',
                      color: isCurrent || isCompleted ? '#FFFFFF' : '#94A3B8',
                      boxShadow: isCurrent
                        ? `0 0 0 3px white, 0 0 0 6px ${l.color}40`
                        : isCompleted
                          ? `0 0 0 2px white, 0 0 0 4px ${l.color}25`
                          : 'none',
                      transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {l.id}
                  </div>
                  <span
                    className="hidden font-mono text-[10px] font-medium sm:block"
                    style={{ color: isCurrent ? l.color : '#94A3B8' }}
                  >
                    {l.code}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      </section>

      {/* ========== Section 3: Checklist ========== */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2
            className="text-3xl font-bold text-[#0F172A] sm:text-[40px]"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            Критерии оценки
          </h2>
          <p className="mt-3 text-lg text-[#475569]" style={{ lineHeight: 1.6 }}>
            Используйте чек-лист для самопроверки соответствия вашего проекта требованиям уровня
          </p>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1, ease: easeOutExpo }}
          className="mt-8 flex items-center gap-4"
        >
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E8ECF0]">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: level.color }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: easeOutExpo }}
            />
          </div>
          <span className="shrink-0 font-mono text-sm text-[#475569]">
            {checkedCount}/{totalRequirements} выполнено
          </span>
          <span
            className="shrink-0 font-mono text-2xl font-semibold"
            style={{ color: level.color }}
          >
            {progressPercent}%
          </span>
        </motion.div>

        {/* Checklist items */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="mt-8 flex flex-col gap-3"
        >
          {level.requirements.map((req, index) => {
            const isChecked = !!checkedItems[index];
            return (
              <motion.div
                key={index}
                variants={staggerItem}
                onClick={() => toggleCheck(index)}
                className="group flex cursor-pointer items-start gap-4 rounded-2xl border bg-white p-4 transition-all duration-200 hover:-translate-y-[2px] hover:shadow-md sm:p-5"
                style={{
                  borderColor: isChecked ? level.color : '#E8ECF0',
                  borderLeftWidth: isChecked ? '3px' : '1px',
                  borderLeftColor: isChecked ? level.color : '#E8ECF0',
                  backgroundColor: isChecked ? level.color + '06' : '#FFFFFF',
                  boxShadow: isChecked
                    ? `0 4px 20px ${level.color}12`
                    : '0 4px 20px rgba(15,23,42,0.04)',
                }}
                onMouseEnter={(e) => {
                  if (!isChecked) e.currentTarget.style.borderColor = level.color + '50';
                }}
                onMouseLeave={(e) => {
                  if (!isChecked) e.currentTarget.style.borderColor = '#E8ECF0';
                }}
              >
                {/* Custom Checkbox */}
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200"
                  style={{
                    borderColor: isChecked ? level.color : '#DEE2E8',
                    backgroundColor: isChecked ? level.color : 'transparent',
                    transform: isChecked ? 'scale(1.08)' : 'scale(1)',
                    boxShadow: isChecked ? `0 2px 8px ${level.color}40` : 'none',
                  }}
                >
                  <AnimatePresence>
                    {isChecked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ duration: 0.2, ease: easeBounce }}
                      >
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <span
                  className="text-base text-[#0F172A] transition-opacity duration-200"
                  style={{
                    fontWeight: 500,
                    lineHeight: 1.6,
                    opacity: isChecked ? 0.75 : 1,
                    textDecoration: isChecked ? 'line-through' : 'none',
                    textDecorationColor: isChecked ? level.color + '60' : 'transparent',
                  }}
                >
                  {req}
                </span>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Reset button */}
        <AnimatePresence>
          {checkedCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={() => setCheckedItems({})}
              className="mt-6 ml-auto block rounded-xl px-5 py-2.5 text-sm font-medium text-[#2E5BFF] transition-all duration-200 hover:scale-[1.03] hover:bg-[#2E5BFF08] active:scale-[0.98]"
            >
              Сбросить прогресс
            </motion.button>
          )}
        </AnimatePresence>
      </section>

      {/* ========== Section 4: Transition Requirements ========== */}
      <section className="bg-[#EEF1F5]">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          {nextLevel ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.6, ease: easeOutExpo }}
              >
                <h2
                  className="text-3xl font-bold text-[#0F172A] sm:text-[40px]"
                  style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
                >
                  Переход на следующий уровень
                </h2>
                <p className="mt-3 text-lg text-[#475569]" style={{ lineHeight: 1.6 }}>
                  Что необходимо для достижения {nextLevel.code}
                </p>
              </motion.div>

              <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Current Level Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0, ease: easeOutExpo }}
                  className="rounded-2xl border-2 bg-white p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  style={{
                    borderColor: level.color,
                    boxShadow: `0 4px 20px rgba(15,23,42,0.06)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 font-mono text-sm font-semibold"
                      style={{
                        background: level.color + '18',
                        color: level.color,
                      }}
                    >
                      {level.code}
                    </span>
                    <span className="font-semibold text-[#0F172A]">{level.name}</span>
                  </div>
                  <div className="my-4 h-px bg-[#E8ECF0]" />
                  <ul className="flex flex-col gap-2.5">
                    {level.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[#475569]">
                        <Check size={18} className="mt-0.5 shrink-0" style={{ color: level.color }} />
                        <span className="text-sm leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>

                {/* Arrow */}
                <div className="hidden items-center justify-center lg:flex">
                  <ArrowRight size={48} className="text-[#94A3B8]" />
                </div>

                {/* Next Level Card */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15, ease: easeOutExpo }}
                  className="rounded-2xl border-2 border-dashed bg-white p-6 sm:p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg lg:-ml-[calc(48px+1.5rem)]"
                  style={{
                    borderColor: nextLevel.color + '80',
                    boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 font-mono text-sm font-semibold"
                      style={{
                        background: nextLevel.color + '18',
                        color: nextLevel.color,
                      }}
                    >
                      {nextLevel.code}
                    </span>
                    <span className="font-semibold text-[#0F172A]">{nextLevel.name}</span>
                  </div>
                  <div className="my-4 h-px bg-[#E8ECF0]" />
                  <ul className="flex flex-col gap-2.5">
                    {nextLevel.requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[#475569]">
                        <Target size={18} className="mt-0.5 shrink-0" style={{ color: nextLevel.color }} />
                        <span className="text-sm leading-relaxed">{req}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>

              {/* CTA to Roadmap */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
                className="mt-10 flex justify-center"
              >
                <Link
                  to="/roadmap"
                  className="inline-flex items-center gap-2 rounded-2xl px-8 py-4 font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${level.color} 0%, ${nextLevel.color} 100%)`,
                    boxShadow: `0 4px 20px ${level.color}35`,
                  }}
                >
                  <Map size={20} />
                  Roadmap: перейти к плану действий
                  <ArrowRight size={18} />
                </Link>
              </motion.div>
            </>
          ) : (
            /* УГТ 9 Special Block */
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: easeOutExpo }}
              className="text-center"
            >
              <div
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-full transition-transform duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #E5C840 0%, #FF7A2E 100%)',
                  boxShadow: '0 0 30px rgba(229, 200, 64, 0.3)',
                }}
              >
                <Target size={36} className="text-white" />
              </div>
              <h2
                className="mt-6 text-3xl font-bold text-[#0F172A] sm:text-[40px]"
                style={{ letterSpacing: '-0.02em' }}
              >
                Максимальный уровень достигнут
              </h2>
              <p className="mx-auto mt-4 max-w-[560px] text-lg text-[#475569]" style={{ lineHeight: 1.7 }}>
                УГТ 9 — уровень успешной эксплуатации. Ваш проект полностью зрелый и находится в
                промышленной эксплуатации.
              </p>
              <Link
                to="/assessment"
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-[#2E5BFF] px-8 py-4 font-semibold text-white transition-all duration-200 hover:scale-[1.03] hover:brightness-110 active:scale-[0.98] hover:shadow-xl"
              >
                <Zap size={20} />
                Начать новую оценку
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* ========== Section 5: KPI (Neumorphism) & Deliverables (Document Cards) ========== */}
      <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: easeOutExpo }}
        >
          <h2
            className="text-3xl font-bold text-[#0F172A] sm:text-[40px]"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            Ключевые показатели
          </h2>
          <p className="mt-3 text-lg text-[#475569]" style={{ lineHeight: 1.6 }}>
            Метрики и результаты уровня
          </p>
        </motion.div>

        {/* KPI Grid - Neumorphism style */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={staggerContainer}
          className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {kpiEntries.map(([label, value]) => {
            const Icon = getKpiIcon(label);
            return (
              <motion.div
                key={label}
                variants={staggerItem}
                className="rounded-2xl border border-[#E8ECF0] bg-white p-7 transition-all duration-200"
                style={{
                  boxShadow:
                    '8px 8px 16px rgba(15, 23, 42, 0.06), -8px -8px 16px rgba(255, 255, 255, 0.8)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = level.color + '50';
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow =
                    '12px 12px 24px rgba(15, 23, 42, 0.08), -12px -12px 24px rgba(255, 255, 255, 0.9)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E8ECF0';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '8px 8px 16px rgba(15, 23, 42, 0.06), -8px -8px 16px rgba(255, 255, 255, 0.8)';
                }}
              >
                <Icon size={32} style={{ color: level.color }} />
                <div className="mt-4 font-mono text-3xl font-semibold text-[#0F172A]">{value}</div>
                <p className="mt-2 text-sm text-[#475569]" style={{ lineHeight: 1.5 }}>
                  {label}
                </p>
              </motion.div>
            );
          })}

          {/* Development duration — derived from roadmap */}
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-[#E8ECF0] bg-white p-7 transition-all duration-200"
            style={{
              boxShadow:
                '8px 8px 16px rgba(15, 23, 42, 0.06), -8px -8px 16px rgba(255, 255, 255, 0.8)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = level.color + '50';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow =
                '12px 12px 24px rgba(15, 23, 42, 0.08), -12px -12px 24px rgba(255, 255, 255, 0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E8ECF0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow =
                '8px 8px 16px rgba(15, 23, 42, 0.06), -8px -8px 16px rgba(255, 255, 255, 0.8)';
            }}
          >
            <Zap size={32} style={{ color: level.color }} />
            <div className="mt-4 font-mono text-3xl font-semibold text-[#0F172A]">
              {level.id <= 3 ? '3-12 мес' : level.id <= 6 ? '6-18 мес' : '12-24 мес'}
            </div>
            <p className="mt-2 text-sm text-[#475569]" style={{ lineHeight: 1.5 }}>
              Срок разработки
            </p>
          </motion.div>
        </motion.div>

        {/* ========== Document Deliverables Section ========== */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2, ease: easeOutExpo }}
          className="mt-20"
        >
          <h3
            className="text-2xl font-bold text-[#0F172A] sm:text-3xl"
            style={{ letterSpacing: '-0.01em', lineHeight: 1.2 }}
          >
            Документы уровня
          </h3>
          <p className="mt-3 text-base text-[#475569]" style={{ lineHeight: 1.6 }}>
            Шаблоны документов и артефактов для скачивания
          </p>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={cardStagger}
            className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {level.deliverableDocs.map((doc) => (
              <motion.div
                key={doc.name}
                variants={cardItem}
                className="group relative overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-6 transition-all duration-200 hover:-translate-y-1"
                style={{
                  boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
                  borderTop: `3px solid ${level.color}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = level.color + '40';
                  e.currentTarget.style.boxShadow = `0 12px 32px rgba(15, 23, 42, 0.1), 0 4px 16px ${level.color}15`;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#E8ECF0';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(15, 23, 42, 0.06)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Top color accent bar */}
                <div
                  className="absolute left-0 right-0 top-0 h-[3px]"
                  style={{ backgroundColor: level.color }}
                />

                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                    style={{ background: level.color + '12' }}
                  >
                    <FileText size={24} style={{ color: level.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-[#0F172A]" style={{ lineHeight: 1.4 }}>
                      {doc.name}
                    </h4>
                    <p className="mt-1.5 text-sm text-[#475569]" style={{ lineHeight: 1.6 }}>
                      {doc.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-md bg-[#F5F7FA] px-2.5 py-1 font-mono text-xs text-[#94A3B8]">
                    {doc.template}
                  </span>
                </div>

                <button
                  onClick={() => handleDownloadStub(doc)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]"
                  style={{
                    backgroundColor: level.color,
                    boxShadow: `0 4px 12px ${level.color}30`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `0 6px 20px ${level.color}50`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = `0 4px 12px ${level.color}30`;
                  }}
                >
                  <Download size={16} />
                  Скачать образец
                </button>
              </motion.div>
            ))}
          </motion.div>

          {/* Legacy deliverables list (kept as visual tags) */}
          <div className="mt-10">
            <h4 className="text-sm font-medium uppercase tracking-[0.06em] text-[#94A3B8]">
              Результаты уровня
            </h4>
            <div className="mt-4 flex flex-wrap gap-2">
              {level.deliverables.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8ECF0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#2E5BFF30] hover:shadow-md"
                  style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
                >
                  <CheckCircle2 size={14} style={{ color: level.color }} />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ========== Section 6: Risk Cards ========== */}
      <section className="bg-[#EEF1F5]">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
          >
            <h2
              className="text-3xl font-bold text-[#0F172A] sm:text-[40px]"
              style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
            >
              Риски и меры предосторожности
            </h2>
            <p className="mt-3 text-lg text-[#475569]" style={{ lineHeight: 1.6 }}>
              Возможные риски на данном уровне и рекомендуемые решения
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            variants={cardStagger}
            className="mt-10 flex flex-col gap-4"
          >
            {level.risks.map((riskItem, index) => {
              const prob = getProbabilityConfig(riskItem.probability);
              const isExpanded = !!expandedRisks[index];
              return (
                <motion.div
                  key={index}
                  variants={cardItem}
                  className="overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white transition-all duration-200"
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: prob.color,
                    boxShadow: isExpanded
                      ? `0 8px 32px rgba(15, 23, 42, 0.1), 0 4px 16px ${prob.color}15`
                      : '0 4px 20px rgba(15, 23, 42, 0.06)',
                  }}
                >
                  {/* Header */}
                  <button
                    onClick={() => toggleRisk(index)}
                    className="flex w-full items-center gap-4 p-5 text-left transition-colors duration-150 hover:bg-[#F8FAFC] sm:p-6"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: prob.color + '15' }}
                    >
                      <AlertTriangle size={20} style={{ color: prob.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-sm font-medium"
                          style={{
                            color: prob.color,
                            background: prob.bg,
                            padding: '2px 10px',
                            borderRadius: '9999px',
                          }}
                        >
                          {prob.label}
                        </span>
                      </div>
                      <p
                        className="mt-1.5 text-base font-medium text-[#0F172A]"
                        style={{ lineHeight: 1.5 }}
                      >
                        {riskItem.risk}
                      </p>
                    </div>

                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: easeOutExpo }}
                      className="shrink-0"
                    >
                      <ChevronDown size={20} className="text-[#94A3B8]" />
                    </motion.div>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: easeOutExpo }}
                      >
                        <div
                          className="border-t border-[#E8ECF0] px-5 pb-5 sm:px-6 sm:pb-6"
                          style={{ paddingTop: '16px' }}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                              style={{ background: '#22C55E15' }}
                            >
                              <CheckCircle2 size={18} style={{ color: '#22C55E' }} />
                            </div>
                            <div>
                              <span className="text-xs font-medium uppercase tracking-[0.06em] text-[#22C55E]">
                                Рекомендуемое решение
                              </span>
                              <p
                                className="mt-1.5 text-base text-[#475569]"
                                style={{ lineHeight: 1.7 }}
                              >
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
          </motion.div>
        </div>
      </section>

      {/* ========== Section 7: Related Levels Navigation ========== */}
      <section className="bg-white">
        <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: easeOutExpo }}
            className="text-3xl font-bold text-[#0F172A] sm:text-[40px]"
            style={{ letterSpacing: '-0.02em', lineHeight: 1.15 }}
          >
            Соседние уровни
          </motion.h2>

          <div className="mt-8 flex flex-col gap-6 lg:flex-row">
            {prevLevel && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="flex-1"
              >
                <Link
                  to={`/level/${prevLevel.id}`}
                  className="group flex items-center gap-5 rounded-2xl border bg-white p-6 transition-all duration-200 hover:-translate-x-1.5"
                  style={{
                    borderColor: prevLevel.color + '30',
                    boxShadow: `0 4px 20px rgba(15,23,42,0.06)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = prevLevel.color + '90';
                    e.currentTarget.style.boxShadow = `0 8px 32px ${prevLevel.color}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = prevLevel.color + '30';
                    e.currentTarget.style.boxShadow = `0 4px 20px rgba(15,23,42,0.06)`;
                  }}
                >
                  <ArrowLeft size={24} style={{ color: prevLevel.color }} />
                  <div>
                    <span
                      className="block font-mono text-sm font-semibold"
                      style={{ color: prevLevel.color }}
                    >
                      {prevLevel.code}
                    </span>
                    <span className="mt-0.5 block text-lg font-semibold text-[#0F172A]">
                      {prevLevel.name}
                    </span>
                  </div>
                </Link>
              </motion.div>
            )}

            {nextLevel && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: easeOutExpo }}
                className="flex-1"
              >
                <Link
                  to={`/level/${nextLevel.id}`}
                  className="group flex items-center justify-end gap-5 rounded-2xl border bg-white p-6 transition-all duration-200 hover:translate-x-1.5"
                  style={{
                    borderColor: nextLevel.color + '30',
                    boxShadow: `0 4px 20px rgba(15,23,42,0.06)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = nextLevel.color + '90';
                    e.currentTarget.style.boxShadow = `0 8px 32px ${nextLevel.color}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = nextLevel.color + '30';
                    e.currentTarget.style.boxShadow = `0 4px 20px rgba(15,23,42,0.06)`;
                  }}
                >
                  <div className="text-right">
                    <span
                      className="block font-mono text-sm font-semibold"
                      style={{ color: nextLevel.color }}
                    >
                      {nextLevel.code}
                    </span>
                    <span className="mt-0.5 block text-lg font-semibold text-[#0F172A]">
                      {nextLevel.name}
                    </span>
                  </div>
                  <ArrowRight size={24} style={{ color: nextLevel.color }} />
                </Link>
              </motion.div>
            )}
          </div>

          {/* Jump selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
            className="mt-10 flex flex-wrap items-center justify-center gap-2"
          >
            <span className="mr-2 text-sm text-[#475569]">Перейти к уровню:</span>
            {UGT_LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => handleNodeClick(l.id)}
                className="rounded-xl px-3.5 py-1.5 font-mono text-sm font-medium transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                style={{
                  backgroundColor: l.id === levelId ? l.color + '18' : '#FFFFFF',
                  color: l.id === levelId ? l.color : '#475569',
                  border: `1px solid ${l.id === levelId ? l.color + '40' : '#E8ECF0'}`,
                  boxShadow:
                    l.id === levelId ? `0 2px 8px ${l.color}20` : '0 1px 3px rgba(15,23,42,0.04)',
                  cursor: l.id === levelId ? 'default' : 'pointer',
                }}
                disabled={l.id === levelId}
              >
                {l.code}
              </button>
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}
