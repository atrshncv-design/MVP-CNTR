import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { UGT_LEVELS } from '@/data/ugtData';
import { SectionHeader, InfoBlock, easeOutExpo, easeSmooth } from './shared';
import { BookOpen } from 'lucide-react';

/* ================================================================== */
/*  FULL UGT Descriptions (Appendix B, Table B.1)                     */
/* ================================================================== */

const UGT_FULL_DESCRIPTIONS: Record<number, { full: string; criteria: string[] }> = {
  1: {
    full: 'Выявлены и опубликованы фундаментальные принципы. Сформулирована идея решения той или иной физической или технической проблемы, произведено её теоретическое и/или экспериментальное обоснование.',
    criteria: [
      'Сформулирована идея разработки новой технологии',
      'Определены используемые физические законы и допущения',
      'Предварительные расчёты подтверждают базовые принципы',
      'Опубликованы базовые научные принципы',
    ],
  },
  2: {
    full: 'Сформулированы технологическая концепция и/или применение возможных концепций для перспективных объектов. Обоснованы необходимость и возможность создания новой технологии или технического решения, в которых используются физические эффекты и явления, подтвердившие уровень УГТ 1. Подтверждена обоснованность концепции, технического решения, доказана эффективность использования идеи (технологии) в решении прикладных задач на базе предварительной проработки на уровне расчётных исследований и моделирования.',
    criteria: [
      'Определена спецификация концепции',
      'Обоснована необходимость создания новой технологии',
      'Проведены расчётные исследования и моделирование',
      'Доказана эффективность использования идеи',
    ],
  },
  3: {
    full: 'Даны аналитические и экспериментальные подтверждения по важнейшим функциональным возможностям и/или характеристикам выбранной концепции. Проведено расчётное и/или экспериментальное (лабораторное) обоснование эффективности технологий, продемонстрирована работоспособность концепции новой технологии в экспериментальной работе на мелкомасштабных моделях устройств. На этом этапе в проектах также предусматривается отбор работ для дальнейшей разработки технологий. Критерием отбора выступает демонстрация работы технологии на мелкомасштабных моделях или с применением расчётных моделей, учитывающих ключевые особенности разрабатываемой технологии, или эффективность использования интегрированного комплекса новых технологий в решении прикладных задач на базе более детальной проработки концепции на уровне экспериментальных разработок по ключевым направлениям, детальных комплексных расчётных исследований и моделирования.',
    criteria: [
      'Подтверждены ключевые функциональные характеристики',
      'Проведены лабораторные эксперименты на мелкомасштабных моделях',
      'Выполнены детальные комплексные расчётные исследования',
      'Отобраны работы для дальнейшей разработки',
    ],
  },
  4: {
    full: 'Компоненты и/или макеты проверены в лабораторных условиях. Продемонстрированы работоспособность и совместимость технологий на достаточно подробных макетах разрабатываемых устройств (объектов) в лабораторных условиях.',
    criteria: [
      'Макеты проверены в лабораторных условиях',
      'Продемонстрирована работоспособность компонентов',
      'Проверена совместимость технологий',
      'Определены ключевые параметры дизайна',
    ],
  },
  5: {
    full: 'Компоненты и/или макеты подсистем испытаны в условиях, близких к реальным. Основные технологические компоненты интегрированы с подходящими другими («поддерживающими») элементами, и технология испытана в моделируемых условиях. Достигнут уровень промежуточных/полных масштабов разрабатываемых систем, которые могут быть исследованы на стендовом оборудовании и в условиях, приближённых к условиям эксплуатации. Испытывают не прототипы, а только детализированные макеты разрабатываемых устройств.',
    criteria: [
      'Компоненты интегрированы с поддерживающими элементами',
      'Испытания в моделируемых условиях',
      'Достигнут уровень промежуточных/полных масштабов',
      'Исследования на стендовом оборудовании',
    ],
  },
  6: {
    full: 'Модель или прототип системы/подсистемы продемонстрированы в условиях, близких к реальным. Прототип системы/подсистемы содержит все детали разрабатываемых устройств. Доказаны реализуемость и эффективность технологий в условиях эксплуатации или близких к ним условиях и возможность интеграции технологии в компоновку разрабатываемой конструкции, для которой данная технология должна продемонстрировать работоспособность. Возможна полномасштабная разработка системы с реализацией требуемых свойств и уровня характеристик.',
    criteria: [
      'Прототип содержит все детали системы',
      'Демонстрация в релевантном окружении',
      'Продемонстрирована работоспособность',
      'Подтверждены ключевые функции системы',
    ],
  },
  7: {
    full: 'Прототип системы прошёл демонстрацию в эксплуатационных условиях. Прототип отражает планируемую штатную систему или близок к ней. На этой стадии решают вопрос о возможности применения целостной технологии на объекте и целесообразности запуска объекта в серийное производство.',
    criteria: [
      'Прототип испытан в полевых условиях',
      'Демонстрация в эксплуатационной среде',
      'Успешные полевые испытания',
      'Готов к мелкосерийному производству',
    ],
  },
  8: {
    full: 'Создана штатная система и освидетельствована (квалифицирована) посредством испытаний и демонстраций. Технология проверена на работоспособность в своей конечной форме и в ожидаемых условиях эксплуатации в составе технической системы (комплекса). В большинстве случаев данный УГТ соответствует окончанию разработки подлинной системы.',
    criteria: [
      'Система квалифицирована после испытаний',
      'Соответствие спецификации подтверждено',
      'DT&E завершены',
      'Производственные процессы на пилотной линии',
    ],
  },
  9: {
    full: 'Продемонстрирована работа реальной системы в условиях реальной эксплуатации. Технология подготовлена к серийному производству.',
    criteria: [
      'Система в успешной эксплуатации',
      'OT&E завершены',
      'Концепция использования реализована',
      'Производство стабильное (6-сигма)',
    ],
  },
};

/* ================================================================== */
/*  UGT Accordion Item                                                  */
/* ================================================================== */

function UGTAccordionItem({ level, index }: { level: (typeof UGT_LEVELS)[number]; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const data = UGT_FULL_DESCRIPTIONS[level.id];

  return (
    <motion.div className="overflow-hidden rounded-[10px] border transition-shadow duration-300 hover:shadow-md"
      style={{ backgroundColor: '#FFFFFF', borderColor: open ? level.color + '40' : '#E8ECF0' }}
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.06, duration: 0.4, ease: easeOutExpo }}>
      <button className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 sm:px-6" style={{ backgroundColor: open ? level.color + '08' : 'transparent' }} onClick={() => setOpen(!open)}>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold text-white" style={{ backgroundColor: level.color }}>{level.id}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold" style={{ backgroundColor: level.color + '15', color: level.color }}>{level.code}</span>
            <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{level.name}</span>
          </div>
        </div>
        <div className="shrink-0">{open ? <ChevronUp size={18} style={{ color: level.color }} /> : <ChevronDown size={18} style={{ color: '#94A3B8' }} />}</div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: easeSmooth }}>
            <div className="border-t px-5 py-5 sm:px-6" style={{ borderColor: '#E8ECF0' }}>
              <p className="text-sm leading-relaxed sm:text-base" style={{ color: '#475569', lineHeight: 1.7 }}>{data?.full || level.description}</p>
              <div className="mt-4">
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}><CheckCircle size={14} />Ключевые критерии</span>
                <div className="flex flex-wrap gap-2">
                  {(data?.criteria || level.requirements.slice(0, 4)).map((r) => (
                    <span key={r} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: level.color + '10', color: level.color }}>{r}</span>
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
/*  UGT Levels Section                                                  */
/* ================================================================== */

export default function UGTLevelsSection() {
  return (
    <section id="ugt-levels" style={{ backgroundColor: '#EEF1F5' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="УРОВНИ ГОТОВНОСТИ ТЕХНОЛОГИЙ" title="Шкала УГТ 1–9" subtitle="Приложение Б, таблица Б.1 — Полные описания уровней готовности технологий" />
        <InfoBlock icon={BookOpen} title="Что такое УГТ?">
          <strong>УГТ (Уровень Готовности Технологии)</strong> — это показатель, количественно выражающий степень зрелости разрабатываемой технологии. Шкала включает 9 уровней: от базовых научных принципов (УГТ 1) до успешной эксплуатации в реальных условиях (УГТ 9). Каждый уровень описывает конкретное состояние технологии и критерии, которым она должна соответствовать. УГТ является основной метрикой для принятия решений о переходе между этапами разработки.
        </InfoBlock>
        <motion.div className="mb-10 flex gap-1" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          {UGT_LEVELS.map((level, i) => (
            <motion.div key={level.id} className="group relative flex-1" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6, ease: easeOutExpo }} style={{ transformOrigin: 'bottom' }}>
              <div className="flex h-12 items-center justify-center rounded-lg text-xs font-medium text-white transition-transform duration-200 group-hover:scale-y-110 sm:text-sm" style={{ backgroundColor: level.color }}><span className="font-mono">{level.code}</span></div>
              <p className="mt-2 hidden text-center text-xs leading-tight sm:block" style={{ color: '#475569' }}>{level.name}</p>
            </motion.div>
          ))}
        </motion.div>
        <div className="space-y-3">{UGT_LEVELS.map((level, i) => (<UGTAccordionItem key={level.id} level={level} index={i} />))}</div>
      </div>
    </section>
  );
}
