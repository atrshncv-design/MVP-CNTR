"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  UGT_LEVELS,
  UGP_LEVELS,
  UGI_LEVELS,
  UGS_LEVELS,
} from "@/lib/ugt-data";

/* ================================================================== */
/*  Хелперы                                                           */
/* ================================================================== */

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

const easeOutExpo = [0.16, 1, 0.3, 1] as [number, number, number, number];
const easeSmooth = [0.4, 0, 0.2, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOutExpo },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOutExpo },
  },
};

/* ================================================================== */
/*  Section Header + InfoBlock (в нашем стиле)                        */
/* ================================================================== */

function SectionHeader({
  label,
  title,
  subtitle,
}: {
  label: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      className="mb-10"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
    >
      <span className="tz-eyebrow mb-3 block">{label}</span>
      <h2 className="tz-section-title">{title}</h2>
      {subtitle && <p className="tz-lead mt-3 max-w-[700px]">{subtitle}</p>}
    </motion.div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="mb-8 rounded-2xl border border-tz-border/60 bg-tz-surface p-5 sm:p-6"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tz-accent/10">
          <Icon size={20} className="text-tz-accent" />
        </div>
        <div>
          <h3 className="mb-2 text-base font-semibold text-tz-fg sm:text-lg">{title}</h3>
          <div className="text-sm leading-relaxed text-tz-secondary">{children}</div>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/*  Hero: тёмный, быстрые ссылки-пилюли                               */
/* ================================================================== */

const QUICK_NAV = [
  { label: "Шкала УГТ", href: "#ugt-levels" },
  { label: "Шкала УГП", href: "#ugp-levels" },
  { label: "Шкала УГИ", href: "#ugi-levels" },
  { label: "Шкала УГС", href: "#ugs-levels" },
  { label: "Процесс оценки", href: "#assessment-process" },
  { label: "Матрица соответствия", href: "#correspondence" },
];

function MethodologyHero() {
  const scrollToSection = (href: string) => {
    const id = href.replace("#", "");
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: "linear-gradient(135deg, #0b0d12 0%, #14161c 45%, #1d1415 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(214,48,49,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(214,48,49,0.1) 0%, transparent 50%)",
        }}
      />
      <div className="tz-ornament-pattern pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-[1280px] px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <motion.div
          className="mb-4 flex items-center gap-2 text-sm text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Link href="/" className="transition-colors hover:text-white">
            Главная
          </Link>
          <ArrowRight size={14} />
          <span>Методология</span>
        </motion.div>

        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: easeOutExpo }}
        >
          <span
            className="inline-block rounded-full border px-5 py-2 font-mono text-sm font-medium tracking-[0.05em]"
            style={{
              backgroundColor: "rgba(214,48,49,0.15)",
              borderColor: "rgba(214,48,49,0.35)",
              color: "#ff6b6b",
            }}
          >
            ГОСТ Р 58048-2017
          </span>
        </motion.div>

        <motion.h1
          className="max-w-[900px] text-4xl font-bold tracking-tight sm:text-[52px]"
          style={{ lineHeight: 1.1, letterSpacing: "-0.02em" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6, ease: easeOutExpo }}
        >
          Методология оценки уровня готовности технологий
        </motion.h1>

        <motion.p
          className="mt-6 max-w-[800px] text-lg text-white/65"
          style={{ lineHeight: 1.65 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5, ease: easeOutExpo }}
        >
          Межгосударственный стандарт, устанавливающий единую методологию оценки
          готовности технологий (ОГТ), готовности производства (ОГП), готовности
          интеграции (ОГИ) и готовности системы (ОГС) для принятия решений о
          трансфере технологий и управления НИОКР.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.3 }}
        >
          {QUICK_NAV.map((pill, i) => (
            <motion.button
              key={pill.href}
              type="button"
              onClick={() => scrollToSection(pill.href)}
              className="cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 hover:bg-white/10"
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderColor: "rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.85)",
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.05, duration: 0.3 }}
            >
              {pill.label}
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Аккордеон УГТ (полные описания из данных)                        */
/* ================================================================== */

function UGTAccordionItem({
  level,
  index,
}: {
  level: (typeof UGT_LEVELS)[number];
  index: number;
}) {
  const [open, setOpen] = useState(index === 0);
  const color = ugtColor(level.id);

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border transition-shadow duration-300 hover:shadow-md"
      style={{
        backgroundColor: "var(--tz-surface)",
        borderColor: open ? `${color}55` : "var(--tz-border)",
      }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: easeOutExpo }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 sm:px-6"
        style={{ backgroundColor: open ? `${color}0a` : "transparent" }}
        onClick={() => setOpen(!open)}
      >
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {level.id}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold"
              style={{ backgroundColor: `${color}18`, color }}
            >
              {level.code}
            </span>
            <span className="text-sm font-medium text-tz-fg">{level.name}</span>
          </div>
        </div>
        <div className="shrink-0">
          {open ? (
            <ChevronUp size={18} style={{ color }} />
          ) : (
            <ChevronDown size={18} className="text-tz-muted" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeSmooth }}
          >
            <div className="border-t border-tz-border/60 px-5 py-5 sm:px-6">
              <p className="text-sm leading-relaxed text-tz-secondary sm:text-base" style={{ lineHeight: 1.7 }}>
                {level.description}
              </p>
              <div className="mt-4">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-tz-muted">
                  <CheckCircle size={14} />
                  Ключевые критерии
                </span>
                <div className="flex flex-wrap gap-2">
                  {level.requirements.slice(0, 4).map((r) => (
                    <span
                      key={r}
                      className="rounded-md px-3 py-1.5 text-xs font-medium"
                      style={{ backgroundColor: `${color}12`, color }}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ================================================================== */
/*  Секция УГТ: горизонтальная шкала + аккордеон                     */
/* ================================================================== */

function UGTLevelsSection() {
  return (
    <section id="ugt-levels" className="bg-tz-surface/40">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          label="Уровни готовности технологий"
          title="Шкала УГТ 1–9"
          subtitle="Приложение Б, таблица Б.1 — полные описания уровней готовности технологий"
        />
        <InfoBlock icon={BookOpen} title="Что такое УГТ?">
          <strong className="text-tz-fg">УГТ (Уровень Готовности Технологии)</strong> — это
          показатель, количественно выражающий степень зрелости разрабатываемой технологии.
          Шкала включает 9 уровней: от базовых научных принципов (УГТ 1) до успешной
          эксплуатации в реальных условиях (УГТ 9). Каждый уровень описывает конкретное
          состояние технологии и критерии, которым она должна соответствовать. УГТ является
          основной метрикой для принятия решений о переходе между этапами разработки.
        </InfoBlock>

        {/* Горизонтальная шкала */}
        <motion.div
          className="mb-10 flex gap-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {UGT_LEVELS.map((level, i) => (
            <motion.div
              key={level.id}
              className="group relative flex-1"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.6, ease: easeOutExpo }}
              style={{ transformOrigin: "bottom" }}
            >
              <Link
                href={`/levels/${level.id}`}
                className="flex h-12 items-center justify-center rounded-lg text-xs font-medium text-white transition-transform duration-200 group-hover:scale-y-110 sm:text-sm"
                style={{ backgroundColor: ugtColor(level.id) }}
              >
                <span className="font-mono">{level.code}</span>
              </Link>
              <p className="mt-2 hidden text-center text-xs leading-tight text-tz-secondary sm:block">
                {level.name}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Аккордеон */}
        <div className="space-y-3">
          {UGT_LEVELS.map((level, i) => (
            <UGTAccordionItem key={level.id} level={level} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Шкалы УГП / УГИ / УГС (компактные аккордеоны)                    */
/* ================================================================== */

/** Цвет уровня из палитры УГТ (тёплые → зелёные), интерполяция по шкале. */
function scaleColor(levelId: number, total: number): string {
  const index = Math.min(9, Math.round(1 + ((levelId - 1) / Math.max(total - 1, 1)) * 9));
  return `var(--tz-ugt-${Math.max(index, 1)})`;
}

function AuxLevelsSection({
  id,
  label,
  title,
  subtitle,
  levels,
}: {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  levels: Array<{ id: number; code: string; name: string }>;
}) {
  return (
    <section id={id} className={id === "ugp-levels" ? "" : "bg-tz-surface/40"}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label={label} title={title} subtitle={subtitle} />

        <motion.div
          className="mb-8 flex gap-1"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          {levels.map((lvl, i) => (
            <motion.div
              key={lvl.id}
              className="flex-1"
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.6, ease: easeOutExpo }}
              style={{ transformOrigin: "bottom" }}
            >
              <div
                className="flex h-11 items-center justify-center rounded-lg font-mono text-[11px] font-medium text-white sm:text-xs"
                style={{ backgroundColor: scaleColor(lvl.id, levels.length) }}
              >
                {lvl.code}
              </div>
              <p className="mt-2 hidden text-center text-[11px] leading-tight text-tz-secondary sm:block">
                {lvl.name}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {levels.map((lvl) => (
            <motion.div
              key={lvl.id}
              variants={staggerItem}
              className="flex items-center gap-3 rounded-2xl border border-tz-border/60 bg-tz-surface p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold text-white"
                style={{ backgroundColor: scaleColor(lvl.id, levels.length) }}
              >
                {lvl.id}
              </span>
              <div>
                <span
                  className="font-mono text-[11px] font-semibold"
                  style={{ color: scaleColor(lvl.id, levels.length) }}
                >
                  {lvl.code}
                </span>
                <p className="text-sm font-medium text-tz-fg">{lvl.name}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Процесс оценки (7 шагов)                                          */
/* ================================================================== */

const PROCESS_STEPS = [
  {
    number: 1,
    title: "Самооценка",
    description:
      "Заинтересованная сторона (производитель технологии) проводит предварительную оценку по критериям Приложения В ГОСТ Р 58048-2017, заполняя опросник для каждого критического элемента технологии (КЭТ).",
  },
  {
    number: 2,
    title: "Формирование команды экспертов",
    description:
      "Создаётся независимая команда экспертов по предметной области, которая будет проводить объективную оценку. Эксперты должны обладать компетенциями в области оцениваемой технологии.",
  },
  {
    number: 3,
    title: "Идентификация КЭТ",
    description:
      "Определяются критические элементы технологии — ключевые компоненты и программное обеспечение, на основе которых будет проводиться оценка. Для каждого КЭТ формируется портфель доказательств.",
  },
  {
    number: 4,
    title: "Сбор доказательств",
    description:
      "Собираются фактические данные о достигнутом уровне: протоколы испытаний, научные публикации, техническая документация, акты демонстрации, отчёты о НИОКР.",
  },
  {
    number: 5,
    title: "Оценка экспертами",
    description:
      "Независимая команда проводит оценку зрелости КЭТ: ОГТ (оценка готовности технологий), ОГП (оценка готовности производства), ОГИ (оценка готовности интеграции), ОГС (оценка готовности системы).",
  },
  {
    number: 6,
    title: "Составление отчёта",
    description:
      "На основе ответов рассчитывается процент выполнения критериев для каждого уровня и формируется итоговый отчёт с детализацией по всем направлениям оценки.",
  },
  {
    number: 7,
    title: "План развития",
    description:
      "Подготовка отчёта с рекомендациями по дальнейшему развитию технологии и планом мероприятий по достижению целевого уровня УГТ. Определяются сроки, ресурсы и ответственные.",
  },
];

function ProcessSection() {
  return (
    <section id="assessment-process" className="bg-tz-surface/40">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          label="Процесс оценки"
          title="Как проводится оценка по ГОСТ Р 58048-2017"
          subtitle="Семь последовательных шагов — от самооценки до плана развития технологии"
        />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {PROCESS_STEPS.map((step) => (
            <motion.div
              key={step.number}
              variants={staggerItem}
              className="flex items-start gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-white"
                style={{ background: ugtColor(Math.min(step.number, 9)) }}
              >
                {step.number}
              </span>
              <div>
                <h3 className="text-base font-semibold text-tz-fg">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-tz-secondary">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Матрица соответствия УГТ ↔ УГП ↔ УГИ ↔ УГС                        */
/* ================================================================== */

const MATRIX_DATA = [
  { ugt: 1, ugp: 1, ugi: 1, ugs: 1, ugsRange: "0.10—0.39" },
  { ugt: 2, ugp: 2, ugi: 2, ugs: 1, ugsRange: "0.10—0.39" },
  { ugt: 3, ugp: 3, ugi: 3, ugs: 2, ugsRange: "0.40—0.59" },
  { ugt: 4, ugp: 4, ugi: 4, ugs: 2, ugsRange: "0.40—0.59" },
  { ugt: 5, ugp: 5, ugi: 5, ugs: 2, ugsRange: "0.40—0.59" },
  { ugt: 6, ugp: 6, ugi: 6, ugs: 3, ugsRange: "0.60—0.79" },
  { ugt: 7, ugp: 7, ugi: 7, ugs: 3, ugsRange: "0.60—0.79" },
  { ugt: 8, ugp: 8, ugi: 8, ugs: 4, ugsRange: "0.70—0.89" },
  { ugt: 8, ugp: 9, ugi: 8, ugs: 4, ugsRange: "0.70—0.89" },
  { ugt: 9, ugp: 10, ugi: 9, ugs: 5, ugsRange: "0.90—1.00" },
];

function CorrespondenceSection() {
  return (
    <section id="correspondence">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          label="Матрица соответствия"
          title="Соответствие шкал УГТ, УГП, УГИ и УГС"
          subtitle="Оценка зрелости технологии ведётся по четырём взаимосвязанным шкалам"
        />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="overflow-hidden rounded-2xl border border-tz-border/60"
        >
          <div className="grid grid-cols-5 gap-px bg-tz-border/40">
            <div className="bg-tz-surface px-3 py-3 text-xs font-semibold uppercase tracking-wider text-tz-muted">
              УГТ
            </div>
            <div className="bg-tz-surface px-3 py-3 text-xs font-semibold uppercase tracking-wider text-tz-muted">
              УГП
            </div>
            <div className="bg-tz-surface px-3 py-3 text-xs font-semibold uppercase tracking-wider text-tz-muted">
              УГИ
            </div>
            <div className="bg-tz-surface px-3 py-3 text-xs font-semibold uppercase tracking-wider text-tz-muted">
              УГС
            </div>
            <div className="bg-tz-surface px-3 py-3 text-xs font-semibold uppercase tracking-wider text-tz-muted">
              Диапазон
            </div>
            {MATRIX_DATA.map((row, i) => (
              <motion.div
                key={i}
                variants={staggerItem}
                className="contents"
              >
                <div className="bg-tz-surface px-3 py-2.5 font-mono text-sm font-semibold" style={{ color: ugtColor(Math.min(row.ugt, 9)) }}>
                  {row.ugt}
                </div>
                <div className="bg-tz-surface px-3 py-2.5 font-mono text-sm text-tz-secondary">
                  {row.ugp}
                </div>
                <div className="bg-tz-surface px-3 py-2.5 font-mono text-sm text-tz-secondary">
                  {row.ugi}
                </div>
                <div className="bg-tz-surface px-3 py-2.5 font-mono text-sm text-tz-secondary">
                  {row.ugs}
                </div>
                <div className="bg-tz-surface px-3 py-2.5 font-mono text-xs text-tz-muted">
                  {row.ugsRange}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="mt-10 flex flex-wrap gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOutExpo }}
        >
          <Link href="/levels" className="tz-btn tz-btn-primary">
            Все уровни УГТ <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/register" className="tz-btn tz-btn-secondary">
            Пройти оценку
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Сборка страницы                                                   */
/* ================================================================== */

export default function MethodologyContent() {
  return (
    <>
      <MethodologyHero />
      <UGTLevelsSection />
      <AuxLevelsSection
        id="ugp-levels"
        label="Оценка готовности производства"
        title="Шкала УГП 1–10"
        subtitle="Уровни готовности производства — от определения основных факторов до полномасштабного производства"
        levels={UGP_LEVELS}
      />
      <AuxLevelsSection
        id="ugi-levels"
        label="Оценка готовности интеграции"
        title="Шкала УГИ 1–9"
        subtitle="Уровни готовности интеграции технологии в систему"
        levels={UGI_LEVELS}
      />
      <AuxLevelsSection
        id="ugs-levels"
        label="Оценка готовности системы"
        title="Шкала УГС 1–5"
        subtitle="Уровни готовности системы с числовыми диапазонами оценки"
        levels={UGS_LEVELS}
      />
      <ProcessSection />
      <CorrespondenceSection />
    </>
  );
}
