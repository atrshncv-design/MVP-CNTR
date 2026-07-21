'use client';

import { motion } from 'framer-motion';
import {
  Briefcase,
  Search,
  Download,
  FileText,
  Building2,
  ArrowRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Beaker,
  Cpu,
  Microscope,
  Shield,
  Zap,
} from 'lucide-react';

const easeOut = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeOut },
  },
};

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */
const AVAILABLE_TASKS = [
  {
    id: 1,
    title: 'Разработка системы автономного контроля качества на основе CV',
    customer: 'Росатом Автоматика',
    ugtRange: 'УГТ 3 → УГТ 5',
    budget: '18 млн ₽',
    deadline: '28.02.2026',
    description: 'Разработка и верификация алгоритмов компьютерного зрения для неразрушающего контроля изделий на производственной линии.',
    tags: ['Компьютерное зрение', 'ML', 'Промышленность'],
  },
  {
    id: 2,
    title: 'Создание цифрового двойника испытательного стенда',
    customer: 'РЖД Технологии',
    ugtRange: 'УГТ 4 → УГТ 6',
    budget: '24 млн ₽',
    deadline: '15.04.2026',
    description: 'Разработка цифрового двойника стенда динамических испытаний для прогнозирования отказов и оптимизации регламента обслуживания.',
    tags: ['Цифровые двойники', 'IoT', 'Симуляция'],
  },
  {
    id: 3,
    title: 'Платформа предиктивной аналитики для энергосетей',
    customer: 'Россети Инновации',
    ugtRange: 'УГТ 2 → УГТ 4',
    budget: '12 млн ₽',
    deadline: '10.06.2026',
    description: 'Разработка алгоритмов прогнозирования аварийных режимов и оптимизации нагрузки в распределительных сетях с использованием ML.',
    tags: ['ML', 'Энергетика', 'Аналитика'],
  },
  {
    id: 4,
    title: 'Биометрическая система идентификации для режимных объектов',
    customer: 'Газпром Цифровые Решения',
    ugtRange: 'УГТ 3 → УГТ 5',
    budget: '30 млн ₽',
    deadline: '30.08.2026',
    description: 'Разработка мультимодальной биометрической системы на основе распознавания лиц, голоса и походки для контроля доступа.',
    tags: ['Биометрия', 'CV', 'Безопасность'],
  },
  {
    id: 5,
    title: 'Интеллектуальный агент управления НИОКР (AI-ассистент)',
    customer: 'ЦНТР (Внутренний заказ)',
    ugtRange: 'УГТ 3 → УГТ 6',
    budget: '8 млн ₽',
    deadline: '01.05.2026',
    description: 'Разработка AI-агента для автоматизации формирования мини-ТЗ, верификации УГТ и генерации отчётности по этапам НИОКР.',
    tags: ['AI-агенты', 'RAG', 'Автоматизация'],
  },
  {
    id: 6,
    title: 'VR-тренажёр для обучения операторов буровых установок',
    customer: 'Лукойл Технологии',
    ugtRange: 'УГТ 4 → УГТ 6',
    budget: '20 млн ₽',
    deadline: '20.07.2026',
    description: 'Создание иммерсивного VR-тренажёра с физически точной симуляцией процессов бурения для ускоренного обучения персонала.',
    tags: ['VR/AR', 'Симуляция', 'Нефтегаз'],
  },
];

const COMPETENCE_AREAS = [
  { label: 'Компьютерное зрение', icon: Cpu, level: 'УГТ 6' },
  { label: 'Машинное обучение', icon: TrendingUp, level: 'УГТ 5' },
  { label: 'Цифровые двойники', icon: Microscope, level: 'УГТ 4' },
  { label: 'Промышленная разработка ПО', icon: Shield, level: 'УГТ 6' },
  { label: 'Встраиваемые системы', icon: Zap, level: 'УГТ 4' },
  { label: 'Биометрия', icon: Beaker, level: 'УГТ 3' },
];

const DOCUMENT_TEMPLATES = [
  {
    title: 'Техническое задание (ТЗ)',
    description: 'ГОСТ 19.201-78 — шаблон технического задания на разработку технологии',
    icon: FileText,
    color: '#2E5BFF',
    format: 'DOCX',
    size: '24 КБ',
  },
  {
    title: 'Технико-экономическое обоснование (ТЭО)',
    description: 'Обоснование экономической эффективности разработки и внедрения технологии',
    icon: TrendingUp,
    color: '#10B981',
    format: 'XLSX',
    size: '36 КБ',
  },
  {
    title: 'Паспорт проекта',
    description: 'Сводный документ — цели, этапы, УГТ, бюджет и ключевые показатели проекта',
    icon: Briefcase,
    color: '#FF7A2E',
    format: 'DOCX',
    size: '32 КБ',
  },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default function RdExecutorDashboard() {
  return (
    <div className="min-h-screen" style={{ background: '#F5F7FA' }}>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1a2744 100%)' }}
      >
        <div className="mx-auto max-w-[1280px] px-4 pt-[100px] pb-16 sm:px-6 lg:px-8 sm:pb-20">
          <motion.div initial="hidden" animate="visible" variants={containerVariants}>
            <motion.div variants={itemVariants}>
              <span
                className="inline-block rounded-full px-4 py-1.5 font-mono text-sm font-semibold"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10B981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                R&D-исполнитель • Стартап / Научная организация
              </span>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[44px] lg:leading-[1.1]"
            >
              Кабинет исполнителя НИОКР
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed sm:text-lg"
              style={{ color: 'rgba(255,255,255,0.65)' }}
            >
              Находите заказы от ГосКомпаний, управляйте профилем компетенций
              и загружайте отчётную документацию по проектам
            </motion.p>
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-4 pb-16 sm:px-6 lg:px-8" style={{ marginTop: '-40px' }}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 gap-6"
        >
          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 1: Profile & Competences                             */}
          {/* ════════════════════════════════════════════════════════════ */}
          <motion.section variants={itemVariants}>
            <div className="rounded-2xl border border-[#E8ECF0] bg-white p-6 sm:p-8"
              style={{ boxShadow: '0 4px 20px rgba(15,23,42,0.06)' }}>
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                {/* Organisation info */}
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={{
                        background: 'linear-gradient(135deg, #10B981, #34D399)',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.25)',
                      }}
                    >
                      <Building2 size={32} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                        Ваша организация
                      </h2>
                      <p className="text-sm" style={{ color: '#475569' }}>
                        Заполните профиль, чтобы получать релевантные предложения
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div
                      className="rounded-xl p-4"
                      style={{ background: '#F5F7FA', border: '1px solid #E8ECF0' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                        Уровень УГТ
                      </p>
                      <p className="mt-1 text-lg font-bold" style={{ color: '#10B981' }}>УГТ 3–6</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Диапазон компетенций</p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{ background: '#F5F7FA', border: '1px solid #E8ECF0' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                        Тип организации
                      </p>
                      <p className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>R&D Стартап</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>ИТ-разработка</p>
                    </div>
                    <div
                      className="rounded-xl p-4"
                      style={{ background: '#F5F7FA', border: '1px solid #E8ECF0' }}
                    >
                      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                        Завершённые проекты
                      </p>
                      <p className="mt-1 text-lg font-bold" style={{ color: '#0F172A' }}>7</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>За последние 2 года</p>
                    </div>
                  </div>
                </div>

                {/* Competence tags */}
                <div className="w-full lg:w-80">
                  <h3 className="mb-3 text-sm font-semibold" style={{ color: '#0F172A' }}>
                    <span className="inline-flex items-center gap-1.5">
                      <Beaker size={14} style={{ color: '#10B981' }} />
                      Области компетенций
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {COMPETENCE_AREAS.map((area) => {
                      const Icon = area.icon;
                      const levelColors: Record<string, string> = {
                        'УГТ 6': '#10B981',
                        'УГТ 5': '#34D399',
                        'УГТ 4': '#6EE7B7',
                        'УГТ 3': '#A7F3D0',
                      };
                      const bgColor = levelColors[area.level] || '#10B981';
                      return (
                        <div
                          key={area.label}
                          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all hover:shadow-sm"
                          style={{
                            borderColor: `${bgColor}30`,
                            background: `${bgColor}0A`,
                          }}
                        >
                          <Icon size={14} style={{ color: bgColor }} />
                          <span style={{ color: '#0F172A' }}>{area.label}</span>
                          <span
                            className="ml-1 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                            style={{ background: `${bgColor}18`, color: bgColor }}
                          >
                            {area.level}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                    style={{ color: '#10B981' }}
                  >
                    Редактировать профиль
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 2: Available Tasks (витрина)                         */}
          {/* ════════════════════════════════════════════════════════════ */}
          <motion.section variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                  Доступные задачи
                </h2>
                <p className="text-sm" style={{ color: '#475569' }}>
                  {AVAILABLE_TASKS.length} проектов от ГосКомпаний, ожидающих исполнителя
                </p>
              </div>
              <button
                className="inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2 text-sm font-medium transition-all hover:bg-[#EEF1F5]"
                style={{ color: '#2E5BFF', border: '1px solid #DEE2E8' }}
              >
                <Search size={14} />
                Все задачи
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {AVAILABLE_TASKS.map((task) => (
                <div
                  key={task.id}
                  className="group relative overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2E5BFF40'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E8ECF0'; }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
                      style={{
                        background: '#2E5BFF12',
                        color: '#2E5BFF',
                        border: '1px solid #2E5BFF25',
                      }}
                    >
                      {task.ugtRange}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                      {task.budget}
                    </span>
                  </div>

                  <h3
                    className="text-base font-semibold leading-snug transition-colors group-hover:text-[#2E5BFF]"
                    style={{ color: '#0F172A' }}
                  >
                    {task.title}
                  </h3>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                    <Building2 size={12} />
                    {task.customer}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed" style={{ color: '#475569' }}>
                    {task.description}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {task.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: '#F5F7FA', color: '#64748B' }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                      <Clock size={12} />
                      до {task.deadline}
                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded-[8px] px-3.5 py-2 text-xs font-semibold text-white transition-all hover:scale-[1.04] active:scale-[0.97]"
                      style={{ background: '#2E5BFF' }}
                    >
                      Откликнуться
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* SECTION 3: Document Templates                                */}
          {/* ════════════════════════════════════════════════════════════ */}
          <motion.section variants={itemVariants}>
            <div className="mb-4">
              <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>
                Шаблоны документов
              </h2>
              <p className="text-sm" style={{ color: '#475569' }}>
                Скачайте актуальные шаблоны для оформления проектной документации по ГОСТ
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {DOCUMENT_TEMPLATES.map((doc) => {
                const Icon = doc.icon;
                return (
                  <div
                    key={doc.title}
                    className="group relative overflow-hidden rounded-2xl border border-[#E8ECF0] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer"
                    style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${doc.color}40`; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E8ECF0'; }}
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl"
                      style={{ background: `${doc.color}15` }}
                    >
                      <Icon size={24} style={{ color: doc.color }} />
                    </div>

                    <h3 className="mt-4 text-base font-semibold" style={{ color: '#0F172A' }}>
                      {doc.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: '#475569' }}>
                      {doc.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs" style={{ color: '#94A3B8' }}>
                        <span
                          className="rounded-md px-2 py-0.5 font-mono font-semibold"
                          style={{ background: '#F5F7FA', color: '#64748B' }}
                        >
                          {doc.format}
                        </span>
                        {doc.size}
                      </div>
                      <button
                        className="inline-flex items-center gap-1 rounded-[8px] px-3.5 py-2 text-xs font-semibold transition-all hover:scale-[1.04] active:scale-[0.97]"
                        style={{ background: `${doc.color}12`, color: doc.color }}
                      >
                        <Download size={12} />
                        Скачать
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* Stats row at the bottom                                      */}
          {/* ════════════════════════════════════════════════════════════ */}
          <motion.section variants={itemVariants} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Активные отклики', value: '4', icon: CheckCircle, color: '#2E5BFF' },
              { label: 'Мои проекты', value: '2', icon: Briefcase, color: '#10B981' },
              { label: 'Архив проектов', value: '7', icon: Clock, color: '#E5C840' },
              { label: 'Шаблонов скачано', value: '12', icon: FileText, color: '#FF7A2E' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[#E8ECF0] bg-white p-5 transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: `${stat.color}15` }}
                    >
                      <Icon size={18} style={{ color: stat.color }} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{stat.value}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
