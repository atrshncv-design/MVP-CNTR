import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CheckCircle, Layers, Gauge, ArrowRight,
  BookOpen, FlaskConical, TrendingUp,
} from 'lucide-react';
import { UGT_LEVELS, UGS_LEVELS } from '@/data/ugtData';
import {
  SectionHeader, InfoBlock,
  fadeUp, staggerContainer, staggerItem, easeOutExpo,
} from './shared';
import { ArrowDown } from 'lucide-react';

/* ================================================================== */
/*  Correspondence matrix data                                         */
/* ================================================================== */

const MATRIX_DATA = [
  { ugt: 1, ugp: 1, ugi: 1, ugs: 1, ugsRange: '0.10—0.39' },
  { ugt: 2, ugp: 2, ugi: 2, ugs: 1, ugsRange: '0.10—0.39' },
  { ugt: 3, ugp: 3, ugi: 3, ugs: 2, ugsRange: '0.40—0.59' },
  { ugt: 4, ugp: 4, ugi: 4, ugs: 2, ugsRange: '0.40—0.59' },
  { ugt: 5, ugp: 5, ugi: 5, ugs: 2, ugsRange: '0.40—0.59' },
  { ugt: 6, ugp: 6, ugi: 6, ugs: 3, ugsRange: '0.60—0.79' },
  { ugt: 7, ugp: 7, ugi: 7, ugs: 3, ugsRange: '0.60—0.79' },
  { ugt: 8, ugp: 8, ugi: 8, ugs: 4, ugsRange: '0.70—0.89' },
  { ugt: 8, ugp: 9, ugi: 8, ugs: 4, ugsRange: '0.70—0.89' },
  { ugt: 9, ugp: 10, ugi: 9, ugs: 5, ugsRange: '0.90—1.00' },
];

/* ================================================================== */
/*  Process steps data                                                 */
/* ================================================================== */

const PROCESS_STEPS = [
  { number: 1, title: 'Самооценка', description: 'Заинтересованная сторона (производитель технологии) проводит предварительную оценку по критериям Приложения В ГОСТ Р 58048-2017, заполняя опросник для каждого критического элемента технологии (КЭТ).', color: '#2E5BFF' },
  { number: 2, title: 'Формирование команды экспертов', description: 'Создаётся независимая команда экспертов по предметной области, которая будет проводить объективную оценку. Эксперты должны обладать компетенциями в области оцениваемой технологии.', color: '#4A82FF' },
  { number: 3, title: 'Идентификация КЭТ', description: 'Определяются критические элементы технологии — ключевые компоненты и программное обеспечение, на основе которых будет проводиться оценка. Для каждого КЭТ формируется портфель доказательств.', color: '#5B9BD5' },
  { number: 4, title: 'Сбор доказательств', description: 'Собираются фактические данные о достигнутом уровне: протоколы испытаний, научные публикации, техническая документация, акты демонстрации, отчёты о НИОКР.', color: '#6AB0B5' },
  { number: 5, title: 'Оценка экспертами', description: 'Независимая команда проводит оценку зрелости КЭТ: ОГТ (оценка готовности технологий), ОГП (оценка готовности производства), ОГИ (оценка готовности интеграции), ОГС (оценка готовности системы).', color: '#7EC8A0' },
  { number: 6, title: 'Составление отчёта', description: 'На основе ответов рассчитывается процент выполнения критериев для каждого уровня и формируется итоговый отчёт с детализацией по всем направлениям оценки.', color: '#E5C840' },
  { number: 7, title: 'План развития', description: 'Подготовка отчёта с рекомендациями по дальнейшему развитию технологии и планом мероприятий по достижению целевого уровня УГТ. Определяются сроки, ресурсы и ответственные.', color: '#FF7A2E' },
];

/* ================================================================== */
/*  SECTION — Scope / Область применения (§1 ГОСТ)                    */
/* ================================================================== */

function ScopeSection() {
  const scopeCards = [
    { icon: <BookOpen size={24} />, title: 'Оценка технологий', text: 'Стандарт описывает методологию оценки уровня готовности технологий через шкалу УГТ 1–9. Используется для оценки вновь разрабатываемых или приобретаемых технологий.' },
    { icon: <FlaskConical size={24} />, title: 'Комплексные системы', text: 'Применяется для оценки компонентов сложных технических систем, особенно в авиационной отрасли, где требуется строгий контроль зрелости технологий.' },
    { icon: <Layers size={24} />, title: 'Снижение рисков', text: 'Систематическая оценка помогает выявлять и снижать риски на ранних стадиях разработки, обеспечивая обоснованное принятие решений о переходе между этапами.' },
    { icon: <TrendingUp size={24} />, title: 'Управление НИОКР', text: 'Стандарт применяется при управлении научно-исследовательскими и опытно-конструкторскими работами, трансфере технологий и принятии решений о финансировании.' },
  ];

  return (
    <section id="about" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="О СТАНДАРТЕ" title="Область применения" subtitle="§1 ГОСТ Р 58048-2017 — Цели и задачи методологии оценки" />
        <motion.div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
          {scopeCards.map((card, i) => (
            <motion.div key={i} className="rounded-[16px] border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={staggerItem}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[10px]" style={{ backgroundColor: 'rgba(46, 91, 255, 0.08)', color: '#2E5BFF' }}>{card.icon}</div>
              <h4 className="mb-2 text-lg font-semibold" style={{ color: '#0F172A' }}>{card.title}</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>{card.text}</p>
            </motion.div>
          ))}
        </motion.div>
        <motion.div className="mt-12 rounded-[16px] border p-6 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <h4 className="mb-5 text-xl font-semibold" style={{ color: '#0F172A' }}>Ключевые термины ГОСТ Р 58048-2017</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { term: 'Оценка готовности технологий (ОГТ)', def: 'Структурированный процесс оценки зрелости технологий с использованием шкалы УГТ 1–9' },
              { term: 'Оценка готовности производства (ОГП)', def: 'Процесс оценки зрелости производственных процессов с использованием шкалы УГП 1–10' },
              { term: 'Оценка готовности интеграции (ОГИ)', def: 'Оценка зрелости интеграции отдельных технологий в составе единой системы' },
              { term: 'Оценка готовности системы (ОГС)', def: 'Производная оценка, зависящая от УГТ технологий и УГИ взаимодействующих пар' },
              { term: 'Критический элемент технологии (КЭТ)', def: 'Компонент или программное обеспечение, применяемое в технологии, определяющий её зрелость' },
              { term: 'Трансфер технологий', def: 'Процесс передачи технологий от разработчика к получателю для дальнейшего применения' },
            ].map((d, i) => (
              <div key={i} className={i < 5 ? 'border-b pb-4 sm:border-b-0 sm:pb-0' : ''} style={{ borderColor: '#E8ECF0' }}>
                <p className="font-semibold" style={{ color: '#0F172A' }}>{d.term}</p>
                <p className="mt-0.5 text-sm leading-relaxed" style={{ color: '#475569' }}>{d.def}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  SECTION — Assessment Process (sections 4.17, 5.1.10)              */
/* ================================================================== */

function AssessmentProcessSection() {
  return (
    <section id="assessment-process" style={{ backgroundColor: '#0F172A' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="ПРОЦЕСС" title="Как проводится оценка" subtitle="Разделы 4.17, 5.1.10 — Этапы оценки готовности технологий" dark />
        <InfoBlock icon={CheckCircle} title="Как проводится оценка?" variant="dark">
          <strong>Процесс оценки</strong> (разделы 4.17 и 5.1.10 ГОСТ) включает 7 этапов: самооценку заинтересованной стороной, формирование команды независимых экспертов, идентификацию КЭТ (критических элементов технологии), сбор фактических доказательств, экспертную оценку по шкалам УГТ/УГП/УГИ/УГС, составление отчёта и разработку плана дальнейшего развития. Оценка может проводиться как для отдельной технологии, так и для всей системы в целом.
        </InfoBlock>
        <motion.div className="mx-auto max-w-[700px]" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
          {PROCESS_STEPS.map((step, i) => {
            const isLast = i === PROCESS_STEPS.length - 1;
            return (
              <motion.div key={step.number} className="flex gap-5" variants={staggerItem}>
                <div className="flex flex-col items-center">
                  <motion.div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: step.color, fontFamily: 'JetBrains Mono, monospace' }} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4, ease: easeOutExpo }}>{step.number}</motion.div>
                  {!isLast && (<div className="mt-2 w-0.5 flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />)}
                </div>
                <div className={isLast ? 'pb-0' : 'pb-8'}>
                  <h4 className="text-lg font-semibold text-white">{step.title}</h4>
                  <p className="mt-1 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{step.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  SECTION — Decision Points (section 5.1.13)                        */
/* ================================================================== */

function DecisionPointsSection() {
  const points = [
    { stage: 'а) Стадия замысла', title: 'Анализ альтернатив', description: 'Перед принятием решения о дальнейшей разработке проводится анализ альтернативных технологий и подходов. Оцениваются технические, экономические и временные параметры.', ugpRec: '—', ugtRec: '1–3', color: '#2E5BFF' },
    { stage: 'б) Стадия разработки', title: 'Разработка технологии → Конструирование', description: 'Переход от фазы разработки технологии к фазе конструирования требует подтверждённой технической реализуемости. На этой стадии должен быть достигнут минимальный уровень готовности.', ugpRec: '≥ 3', ugtRec: '≥ 6', color: '#7EC8A0' },
    { stage: 'в) Стадия разработки', title: 'Конструирование → Мелкосерийное производство', description: 'Переход от конструирования к мелкосерийному производству требует демонстрации работоспособности прототипа в эксплуатационных условиях и готовности производственных процессов.', ugpRec: '≥ 6', ugtRec: '≥ 7', color: '#FF7A2E' },
  ];

  return (
    <section id="decision-points" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="ТОЧКИ ПРИНЯТИЯ РЕШЕНИЙ" title="Ключевые точки принятия решений" subtitle="Раздел 5.1.13 — Рекомендуемые уровни готовности для перехода между этапами" />
        <motion.div className="grid grid-cols-1 gap-6 lg:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
          {points.map((point, i) => (
            <motion.div key={i} className="overflow-hidden rounded-[16px] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={staggerItem}>
              <div className="h-1.5 w-full" style={{ backgroundColor: point.color }} />
              <div className="p-6">
                <span className="mb-3 inline-block rounded-full px-3 py-1 font-mono text-xs font-semibold" style={{ backgroundColor: point.color + '15', color: point.color }}>{point.stage}</span>
                <h4 className="mb-2 text-lg font-semibold" style={{ color: '#0F172A' }}>{point.title}</h4>
                <p className="mb-4 text-sm leading-relaxed" style={{ color: '#475569' }}>{point.description}</p>
                <div className="rounded-[10px] p-4" style={{ backgroundColor: '#F5F7FA' }}>
                  <div className="mb-2 flex items-center gap-2"><Gauge size={14} style={{ color: point.color }} /><span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Рекомендуемые уровни</span></div>
                  <div className="flex gap-3">
                    <div><span className="block text-xs" style={{ color: '#94A3B8' }}>УГТ</span><span className="font-mono text-lg font-bold" style={{ color: point.color }}>{point.ugtRec}</span></div>
                    <div className="w-px" style={{ backgroundColor: '#E8ECF0' }} />
                    <div><span className="block text-xs" style={{ color: '#94A3B8' }}>УГП</span><span className="font-mono text-lg font-bold" style={{ color: point.color }}>{point.ugpRec}</span></div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
        <motion.div className="mx-auto mt-12 flex max-w-[800px] flex-col items-center gap-4 sm:flex-row sm:justify-between" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          {[{ label: 'Стадия замысла', sub: 'УГТ 1–3', color: '#2E5BFF' }, { label: 'Разработка технологии', sub: 'УГТ ≥ 6', color: '#7EC8A0' }, { label: 'Конструирование', sub: 'УГТ ≥ 7', color: '#FF7A2E' }, { label: 'Мелкосерийное произв.', sub: 'УГТ 7–8', color: '#E5C840' }].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex h-14 w-28 items-center justify-center rounded-[10px] text-center text-xs font-semibold text-white" style={{ backgroundColor: step.color }}>
                <div><div className="text-[10px] opacity-75">{step.sub}</div><div>{step.label}</div></div>
              </div>
              {i < arr.length - 1 && <ArrowRight size={18} className="hidden shrink-0 sm:block" style={{ color: '#94A3B8' }} />}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  SECTION — Correspondence Matrix (Appendix G)                      */
/* ================================================================== */

function CorrespondenceSection() {
  return (
    <section id="correspondence" style={{ backgroundColor: '#EEF1F5' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="ПРИЛОЖЕНИЕ Г" title="Соответствие уровней готовности" subtitle="Таблица соответствия УГТ, УГП, УГИ и УГС" />
        <InfoBlock icon={Layers} title="Как соответствуют уровни?">
          <strong>Матрица соответствия</strong> показывает взаимосвязь между четырьмя метриками: УГТ (готовность технологии), УГП (готовность производства), УГИ (готовность интеграции) и УГС (готовность системы). УГТ является базовой метрикой — от неё зависят остальные. УГП оценивает производственную составляющую, УГИ — интеграционную, а УГС — обобщённую системную готовность. Таблица ниже показывает, каким уровням УГП и УГИ соответствуют уровни УГТ.
        </InfoBlock>
        <motion.div className="overflow-x-auto" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
          <table className="w-full min-w-[600px]" style={{ borderRadius: 16, overflow: 'hidden' }}>
            <thead><tr style={{ backgroundColor: '#F5F7FA' }}>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide sm:px-6" style={{ color: '#94A3B8' }}>УГТ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide sm:px-6" style={{ color: '#94A3B8' }}>УГП</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide sm:px-6" style={{ color: '#94A3B8' }}>УГИ</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide sm:px-6" style={{ color: '#94A3B8' }}>УГС (индекс)</th>
            </tr></thead>
            <tbody>
              {MATRIX_DATA.map((row, i) => {
                const ugtColor = UGT_LEVELS[row.ugt - 1]?.color || '#2E5BFF';
                const ugsColor = UGS_LEVELS[row.ugs - 1]?.color || '#2E5BFF';
                return (
                  <motion.tr key={`${row.ugt}-${row.ugp}-${i}`} className="transition-colors duration-150 hover:bg-[#EEF1F5]" style={{ borderBottom: '1px solid #E8ECF0', backgroundColor: '#FFFFFF' }} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.3 }}>
                    <td className="px-4 py-3 sm:px-6"><span className="inline-block rounded-md px-2.5 py-1 font-mono text-sm font-medium" style={{ backgroundColor: ugtColor + '12', color: ugtColor }}>УГТ {row.ugt}</span></td>
                    <td className="px-4 py-3 font-mono text-sm sm:px-6" style={{ color: '#0F172A' }}>УГП {row.ugp}</td>
                    <td className="px-4 py-3 font-mono text-sm sm:px-6" style={{ color: '#0F172A' }}>УГИ {row.ugi}</td>
                    <td className="px-4 py-3 sm:px-6"><span className="inline-block rounded-md px-2.5 py-1 font-mono text-sm font-medium" style={{ backgroundColor: ugsColor + '12', color: ugsColor }}>УГС {row.ugs} ({row.ugsRange})</span></td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
        <motion.div className="mx-auto mt-12 flex max-w-[700px] flex-col items-center gap-6 sm:flex-row sm:justify-center" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex flex-col items-center">
            <div className="flex h-20 w-32 items-center justify-center rounded-[10px] border text-sm font-semibold text-white" style={{ backgroundColor: '#2E5BFF', borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="text-center"><div className="text-xs opacity-75">ОГТ</div><div className="font-mono">(УГТ)</div></div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1"><ArrowDown size={20} style={{ color: '#94A3B8' }} /></div>
          <div className="flex flex-col items-center">
            <div className="flex h-20 w-32 items-center justify-center rounded-[10px] border text-sm font-semibold text-white" style={{ backgroundColor: '#5B9BD5', borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="text-center"><div className="text-xs opacity-75">ОГИ</div><div className="font-mono">(УГИ)</div></div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1"><ArrowDown size={20} style={{ color: '#94A3B8' }} /><span className="text-xs" style={{ color: '#94A3B8' }}>+</span></div>
          <div className="flex flex-col items-center">
            <div className="flex h-20 w-32 items-center justify-center rounded-[10px] border text-sm font-semibold text-white" style={{ backgroundColor: '#10B981', borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="text-center"><div className="text-xs opacity-75">ОГП</div><div className="font-mono">(УГП)</div></div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1"><ArrowDown size={20} style={{ color: '#94A3B8' }} /></div>
          <div className="flex flex-col items-center">
            <div className="flex h-20 w-32 items-center justify-center rounded-[10px] border text-sm font-semibold text-white" style={{ backgroundColor: '#FF7A2E', borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="text-center"><div className="text-xs opacity-75">Результат</div><div className="font-mono">УГС</div></div>
            </div>
          </div>
        </motion.div>
        <motion.p className="mt-6 text-center text-sm" style={{ color: '#94A3B8' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          Схема взаимосвязи оценок: ОГТ и ОГИ вместе с ОГП определяют итоговую УГС
        </motion.p>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  CTA Section                                                        */
/* ================================================================== */

function CTASection() {
  return (
    <section style={{ backgroundColor: '#0F172A' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <motion.div className="flex flex-col items-center text-center" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <h3 className="text-2xl font-bold text-white sm:text-[32px]" style={{ lineHeight: 1.2 }}>Готовы оценить ваш проект?</h3>
          <p className="mt-3 max-w-[500px] text-base" style={{ color: 'rgba(255,255,255,0.6)' }}>Пройдите интерактивный опросник и получите результат за несколько минут.</p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link to="/assessment" className="inline-flex items-center justify-center gap-2 rounded-[10px] px-7 py-3.5 text-base font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:brightness-110" style={{ background: 'linear-gradient(135deg, #2E5BFF 0%, #4A82FF 50%, #5B9BD5 100%)', boxShadow: '0 0 20px rgba(46, 91, 255, 0.15)' }}>
              Перейти к оценке проекта<ArrowRight size={18} />
            </Link>
            <Link to="/roadmap" className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-white/10 px-7 py-3.5 text-base font-medium transition-all duration-200 hover:bg-white/[0.06]" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Смотреть дорожную карту
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== */
/*  Default export — renders all remaining sections                   */
/* ================================================================== */

export default function ProcessSections() {
  return (
    <>
      <ScopeSection />
      <AssessmentProcessSection />
      <DecisionPointsSection />
      <CorrespondenceSection />
      <CTASection />
    </>
  );
}
