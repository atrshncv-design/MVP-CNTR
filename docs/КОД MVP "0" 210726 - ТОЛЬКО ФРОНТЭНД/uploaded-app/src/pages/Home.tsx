import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ClipboardCheck, Map, BookOpen, ListChecks, FileText, ChevronRight,
} from 'lucide-react';
import ParticleCanvas from '@/components/ParticleCanvas';
import { UGT_LEVELS } from '@/data/ugtData';

// Animation variants
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

// Easing constant
const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

/* ------------------------------------------------------------------ */
/*  Hero Section                                                       */
/* ------------------------------------------------------------------ */
function HeroSection() {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  return (
    <section
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
      style={{ background: '#0F172A', minHeight: 700 }}
    >
      <ParticleCanvas />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-4 text-center sm:px-6">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: easeOutExpo }}
          className="mb-6 inline-block rounded-full border px-4 py-1.5 text-[13px] font-medium tracking-[0.05em]"
          style={{
            background: 'rgba(46, 91, 255, 0.15)',
            borderColor: 'rgba(46, 91, 255, 0.3)',
            color: '#4A82FF',
          }}
        >
          ГОСТ Р 58048-2017
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: easeOutExpo }}
          className="font-sans text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-white sm:text-[56px] lg:text-[72px]"
        >
          ТЕХНОЗРЕЛОСТЬ
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8, ease: easeOutExpo }}
          className="mt-4 font-sans text-2xl font-semibold sm:text-[32px]"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          Платформа оценки технологий
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.0, ease: easeOutExpo }}
          className="mt-4 max-w-[560px] text-base leading-relaxed sm:text-lg"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Интерактивный дашборд для оценки и визуализации уровней готовности
          технологий по методологии УГТ 1-9
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 1.2, ease: easeBounce }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/assessment"
            className="inline-flex items-center gap-2 rounded-[10px] px-7 py-3.5 text-base font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:brightness-110"
            style={{
              background: 'linear-gradient(135deg, #2E5BFF 0%, #4A82FF 50%, #5B9BD5 100%)',
              boxShadow: '0 0 20px rgba(46, 91, 255, 0.15)',
            }}
          >
            Начать оценку проекта
          </Link>
          <Link
            to="/methodology"
            className="inline-flex items-center gap-2 rounded-[10px] border px-7 py-3.5 text-base font-medium text-white transition-all duration-300 hover:bg-white/10"
            style={{ borderColor: 'rgba(255,255,255,0.3)' }}
          >
            Узнать методику
          </Link>
        </motion.div>

        {/* UGT Quick Stats Bar */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.4, ease: easeOutExpo }}
          className="mt-16 hidden rounded-2xl px-6 py-4 sm:flex sm:gap-6 md:gap-8 lg:gap-10"
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(16px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {UGT_LEVELS.map((level, i) => (
            <div
              key={level.id}
              className="group relative flex cursor-default flex-col items-center gap-1.5"
              onMouseEnter={() => setHoveredLevel(i)}
              onMouseLeave={() => setHoveredLevel(null)}
            >
              <span
                className="font-mono text-sm font-medium"
                style={{ color: level.color }}
              >
                {level.code}
              </span>
              <div
                className="h-2 w-2 rounded-full transition-all duration-300"
                style={{
                  background: level.color,
                  opacity: hoveredLevel === i ? 1 : 0.7,
                  transform: hoveredLevel === i ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: hoveredLevel === i ? `0 0 10px ${level.color}` : 'none',
                }}
              />
              {/* Tooltip */}
              {hoveredLevel === i && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-10 left-1/2 z-20 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium text-white"
                  style={{
                    background: '#1E293B',
                    transform: 'translateX(-50%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {level.name}
                </motion.div>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2: Interactive Timeline                                    */
/* ------------------------------------------------------------------ */
function TimelineSection() {
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  const selected = hoveredNode ?? activeNode;

  return (
    <section ref={sectionRef} className="bg-[#F5F7FA] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
          custom={0}
          className="mb-16 text-center"
        >
          <span
            className="mb-3 inline-block text-xs font-medium uppercase tracking-[0.1em]"
            style={{ color: '#94A3B8' }}
          >
            Интерактивная шкала
          </span>
          <h2 className="mt-2 font-sans text-[32px] font-bold leading-[1.15] tracking-[-0.015em] text-[#0F172A] sm:text-[40px]">
            Уровни готовности технологий
          </h2>
          <p className="mt-4 text-lg" style={{ color: '#475569' }}>
            Кликните на любой уровень, чтобы изучить требования и критерии перехода
          </p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
          }}
          className="relative"
        >
          {/* Track line */}
          <div className="relative mx-auto h-1 max-w-[900px] rounded-full" style={{ background: '#E8ECF0' }}>
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: '100%' }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2, ease: easeOutExpo }}
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #2E5BFF, #5B9BD5, #A8D65A, #FF7A2E)' }}
            />
          </div>

          {/* Nodes */}
          <div className="mx-auto mt-0 flex max-w-[900px] justify-between">
            {UGT_LEVELS.map((level, i) => (
              <motion.div
                key={level.id}
                variants={{
                  hidden: { scale: 0, opacity: 0 },
                  visible: {
                    scale: 1, opacity: 1,
                    transition: { duration: 0.4, ease: easeBounce },
                  },
                }}
                className="flex flex-col items-center"
                style={{ marginTop: -14 }}
              >
                <Link
                  to={`/level/${level.id}`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-xs font-semibold text-white transition-all duration-300 hover:scale-110 sm:h-12 sm:w-12 sm:text-sm md:h-14 md:w-14"
                  style={{
                    background: level.color,
                    boxShadow:
                      (activeNode === i || hoveredNode === i)
                        ? `0 0 20px ${level.color}66`
                        : `0 0 0 3px ${level.color}20`,
                  }}
                  onMouseEnter={() => setHoveredNode(i)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setActiveNode(i)}
                >
                  <span className="font-mono">{level.id}</span>
                </Link>
                <span
                  className="mt-3 hidden max-w-[100px] text-center text-xs sm:block md:text-sm"
                  style={{ color: '#475569' }}
                >
                  {level.code}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Preview Card */}
          {selected !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="mx-auto mt-10 max-w-lg rounded-2xl border border-white/15 p-5"
              style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(16px) saturate(180%)',
                boxShadow: '0 16px 40px rgba(15,23,42,0.12), 0 4px 12px rgba(15,23,42,0.04)',
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${UGT_LEVELS[selected].color}25` }}
                >
                  <span
                    className="font-mono text-lg font-bold"
                    style={{ color: UGT_LEVELS[selected].color }}
                  >
                    {UGT_LEVELS[selected].id}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-0.5 font-mono text-xs font-semibold"
                      style={{
                        background: `${UGT_LEVELS[selected].color}25`,
                        color: UGT_LEVELS[selected].color,
                      }}
                    >
                      {UGT_LEVELS[selected].code}
                    </span>
                  </div>
                  <h4 className="mt-2 text-lg font-semibold text-[#0F172A]">
                    {UGT_LEVELS[selected].name}
                  </h4>
                  <p className="mt-1 text-sm" style={{ color: '#475569' }}>
                    {UGT_LEVELS[selected].short}
                  </p>
                  <ul className="mt-3 space-y-1">
                    {UGT_LEVELS[selected].requirements.slice(0, 3).map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm" style={{ color: '#475569' }}>
                        <span style={{ color: UGT_LEVELS[selected].color }}>•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={`/level/${UGT_LEVELS[selected].id}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                    style={{ color: UGT_LEVELS[selected].color }}
                  >
                    Подробнее <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3: UGT Level Grid                                          */
/* ------------------------------------------------------------------ */
function LevelGridSection() {
  return (
    <section className="bg-[#EEF1F5] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
          custom={0}
          className="mb-16 text-center"
        >
          <span
            className="mb-3 inline-block text-xs font-medium uppercase tracking-[0.1em]"
            style={{ color: '#94A3B8' }}
          >
            Все уровни
          </span>
          <h2 className="mt-2 font-sans text-[32px] font-bold leading-[1.15] tracking-[-0.015em] text-[#0F172A] sm:text-[40px]">
            Детальный обзор УГТ 1-9
          </h2>
          <p className="mt-4 text-lg" style={{ color: '#475569' }}>
            Полная информация о каждом уровне готовности технологий
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={staggerContainer}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {UGT_LEVELS.map((level) => (
            <motion.div key={level.id} variants={staggerChild}>
              <Link
                to={`/level/${level.id}`}
                className="group block rounded-2xl border border-[#E8ECF0] bg-white p-7 shadow-md transition-all hover:-translate-y-1.5 hover:shadow-xl"
                style={{ borderRadius: 16, transitionDuration: '350ms' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${level.color}4D`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E8ECF0';
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] text-white transition-transform duration-300 group-hover:scale-[1.08]"
                    style={{ background: level.color }}
                  >
                    <span className="font-mono text-sm font-semibold">
                      {String(level.id).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <span
                      className="font-mono text-sm font-medium"
                      style={{ color: level.color }}
                    >
                      {level.code}
                    </span>
                    <h4 className="mt-0.5 text-xl font-semibold text-[#0F172A]">
                      {level.name}
                    </h4>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed" style={{ color: '#475569' }}>
                  {level.short}
                </p>
                <div className="my-4 h-px w-full" style={{ background: '#E8ECF0' }} />
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <ListChecks size={14} />
                    {level.requirements.length} требований
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#94A3B8' }}>
                    <FileText size={14} />
                    {level.deliverables.length} результата
                  </span>
                </div>
                <div
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors"
                  style={{ color: level.color }}
                >
                  Подробнее <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 4: Dashboard Stats                                         */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const duration = 1200;
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="font-mono text-5xl font-bold" style={{ color }}>
      {display}
    </div>
  );
}

const STATS_DATA = [
  { label: 'Уровней УГТ', value: 9, color: '#4A82FF' },
  { label: 'Уровней УГП', value: 10, color: '#7EC8A0' },
  { label: 'Уровней УГИ', value: 9, color: '#E5C840' },
  { label: 'Уровней УГС', value: 5, color: '#FF7A2E' },
];

const CHART_DATA = UGT_LEVELS.map((l) => ({
  name: l.code,
  УГТ: l.id,
  УГП: Math.min(l.id + 1, 10),
}));

function StatsSection() {
  return (
    <section className="bg-[#0F172A] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
          custom={0}
          className="mb-12"
        >
          <span
            className="mb-3 inline-block text-xs font-medium uppercase tracking-[0.1em]"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            Метрики
          </span>
          <h2 className="mt-2 font-sans text-[32px] font-bold leading-[1.15] tracking-[-0.015em] text-white sm:text-[40px]">
            Ключевые показатели методологии
          </h2>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1 } },
          }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {STATS_DATA.map((stat) => (
            <motion.div
              key={stat.label}
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1, y: 0,
                  transition: { duration: 0.6, ease: easeOutExpo },
                },
              }}
              className="rounded-2xl border border-white/[0.06] p-8 transition-all duration-300 hover:-translate-y-[3px]"
              style={{ background: '#1E293B' }}
            >
              <AnimatedNumber value={stat.value} color={stat.color} />
              <p className="mt-2 text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {stat.label}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Chart */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
          custom={0.3}
          className="mx-auto mt-16 max-w-[800px]"
        >
          <h3 className="mb-6 text-center text-xl font-semibold text-white">
            Соответствие УГТ и УГП
          </h3>
          <div className="h-[300px] w-full sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CHART_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#fff',
                  }}
                  labelStyle={{ color: '#94A3B8' }}
                />
                <Bar
                  dataKey="УГТ"
                  fill="#2E5BFF"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
                <Bar
                  dataKey="УГП"
                  fill="rgba(106,176,181,0.5)"
                  radius={[4, 4, 0, 0]}
                  animationDuration={800}
                  animationEasing="ease-out"
                  animationBegin={200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 5: Quick Actions                                           */
/* ------------------------------------------------------------------ */
function QuickActionsSection() {
  const cards = [
    {
      icon: ClipboardCheck,
      title: 'Оценить проект',
      description: 'Пройдите интерактивный опросник и определите текущий УГТ вашего проекта',
      button: 'Начать оценку',
      link: '/assessment',
      bg: 'linear-gradient(135deg, #2E5BFF 0%, #4A82FF 100%)',
      buttonStyle: { background: 'white', color: '#2E5BFF' } as React.CSSProperties,
    },
    {
      icon: Map,
      title: 'Дорожная карта',
      description: 'Визуализируйте путь развития вашего проекта от текущего к целевому УГТ',
      button: 'Открыть карту',
      link: '/roadmap',
      bg: 'linear-gradient(135deg, #A8D65A 0%, #E5C840 50%, #FF7A2E 100%)',
      buttonStyle: { background: 'white', color: '#FF7A2E' } as React.CSSProperties,
    },
    {
      icon: BookOpen,
      title: 'Методология ГОСТ Р 58048-2017',
      description: 'Изучите подробное описание стандарта, шкалы УГП, УГИ, УГС',
      button: 'Изучить',
      link: '/methodology',
      bg: '#0F172A',
      border: '1px solid rgba(255,255,255,0.1)',
      buttonStyle: { background: '#2E5BFF', color: 'white' } as React.CSSProperties,
    },
  ];

  return (
    <section className="bg-[#F5F7FA] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px]">
        {/* Header */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={fadeUp}
          custom={0}
          className="mb-12 text-center"
        >
          <h2 className="font-sans text-[32px] font-bold leading-[1.15] tracking-[-0.015em] text-[#0F172A] sm:text-[40px]">
            Начните работу
          </h2>
          <p className="mt-4 text-lg" style={{ color: '#475569' }}>
            Выберите подходящий инструмент для вашего проекта
          </p>
        </motion.div>

        {/* Cards */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12 } },
          }}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {cards.map((card) => (
            <motion.div
              key={card.link}
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: {
                  opacity: 1, y: 0,
                  transition: { duration: 0.6, ease: easeOutExpo },
                },
              }}
            >
              <Link
                to={card.link}
                className="group block h-full rounded-3xl p-10 text-white transition-all duration-300 hover:-translate-y-1"
                style={{
                  background: card.bg,
                  border: (card as Record<string, unknown>).border as string || 'none',
                  boxShadow: card.bg !== '#0F172A'
                    ? '0 0 20px rgba(46,91,255,0.15)'
                    : undefined,
                }}
              >
                <card.icon
                  size={48}
                  className="mb-6 opacity-90"
                  strokeWidth={1.5}
                />
                <h4 className="text-2xl font-semibold">{card.title}</h4>
                <p
                  className="mt-3 text-base leading-relaxed"
                  style={{ color: card.bg === '#0F172A' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.85)' }}
                >
                  {card.description}
                </p>
                <span
                  className="mt-6 inline-flex items-center gap-1 rounded-[10px] px-6 py-3 text-sm font-semibold transition-transform group-hover:scale-[1.03]"
                  style={card.buttonStyle}
                >
                  {card.button} <ChevronRight size={14} />
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Home Page                                                          */
/* ------------------------------------------------------------------ */
export default function Home() {
  return (
    <>
      <HeroSection />
      <TimelineSection />
      <LevelGridSection />
      <StatsSection />
      <QuickActionsSection />
    </>
  );
}
