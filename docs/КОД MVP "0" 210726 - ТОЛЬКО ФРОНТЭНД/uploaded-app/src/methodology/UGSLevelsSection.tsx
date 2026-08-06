import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { UGS_LEVELS } from '@/data/ugtData';
import { SectionHeader, InfoBlock, easeOutExpo, easeSmooth } from './shared';

/* ================================================================== */
/*  FULL UGS Descriptions (Appendix B)                                */
/* ================================================================== */

const UGS_FULL_DESCRIPTIONS: Record<number, { full: string; criteria?: string[] }> = {
  1: { full: 'Уточнение концепции (индекс 0.10—0.39). Улучшена начальная концепция системы, разработана стратегия разработки системы/технологии.', criteria: ['Концепция системы уточнена', 'Стратегия разработки разработана', 'Индекс 0.10—0.39'] },
  2: { full: 'Разработка технологии (индекс 0.40—0.59). Снижены технологические риски и определён подходящий набор технологий для интеграции в полную систему.', criteria: ['Технологические риски снижены', 'Набор технологий определён', 'Индекс 0.40—0.59'] },
  3: { full: 'Разработка и демонстрация системы (индекс 0.60—0.79). Разработана система или улучшены её возможности, снижены риски интеграции и производства, реализованы механизмы операционной поддержки, оптимизирована логистика, реализован интерфейс с пользователем, система спроектирована с учётом возможностей производства, обеспечены доступность и защита критической информации. Продемонстрированы интеграция системы, взаимодействие с ней, безопасность и полезность.', criteria: ['Система разработана', 'Риски интеграции снижены', 'Демонстрация проведена', 'Индекс 0.60—0.79'] },
  4: { full: 'Производство системы (индекс 0.70—0.89). Достигнуты функциональные возможности, которые соответствуют требованиям заказчика.', criteria: ['Функциональные возможности достигнуты', 'Соответствие требованиям заказчика', 'Индекс 0.70—0.89'] },
  5: { full: 'Применение и поддержка системы (индекс 0.90—1.00). Поддержка системы осуществляется в соответствии с требованиями к эксплуатации наименее затратным образом на протяжении всего жизненного цикла.', criteria: ['Поддержка системы осуществляется', 'Требования эксплуатации выполнены', 'Индекс 0.90—1.00'] },
};

/* ================================================================== */
/*  UGS Accordion Item                                                  */
/* ================================================================== */

function UGSAccordionItem({ level, index }: { level: (typeof UGS_LEVELS)[number]; index: number }) {
  const [open, setOpen] = useState(false);
  const data = UGS_FULL_DESCRIPTIONS[level.id];

  return (
    <motion.div className="overflow-hidden rounded-[10px] border transition-shadow duration-300 hover:shadow-md"
      style={{ backgroundColor: '#FFFFFF', borderColor: open ? level.color + '40' : '#E8ECF0' }}
      initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.05, duration: 0.4, ease: easeOutExpo }}>
      <button className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-200 sm:px-6" style={{ backgroundColor: open ? level.color + '08' : 'transparent' }} onClick={() => setOpen(!open)}>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold text-white" style={{ backgroundColor: level.color }}>{level.id}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold" style={{ backgroundColor: level.color + '15', color: level.color }}>{level.code}</span>
            <span className="text-sm font-medium" style={{ color: '#0F172A' }}>{level.name}</span>
            <span className="rounded-full px-2 py-0.5 font-mono text-xs" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{level.range}</span>
          </div>
        </div>
        <div className="shrink-0">{open ? <ChevronUp size={18} style={{ color: level.color }} /> : <ChevronDown size={18} style={{ color: '#94A3B8' }} />}</div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: easeSmooth }}>
            <div className="border-t px-5 py-5 sm:px-6" style={{ borderColor: '#E8ECF0' }}>
              <p className="text-sm leading-relaxed sm:text-base" style={{ color: '#475569', lineHeight: 1.7 }}>{data?.full || ''}</p>
              {data?.criteria && (
                <div className="mt-4">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}><CheckCircle size={14} />Ключевые критерии</span>
                  <div className="flex flex-wrap gap-2">
                    {data.criteria.map((r) => (<span key={r} className="rounded-md px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: level.color + '10', color: level.color }}>{r}</span>))}
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
/*  UGS Levels Section                                                  */
/* ================================================================== */

export default function UGSLevelsSection() {
  return (
    <section id="ugs-levels" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="УРОВНИ ГОТОВНОСТИ СИСТЕМЫ" title="Шкала УГС 1–5" subtitle="Приложение Б — Полные описания уровней готовности системы с индексами" />
        <InfoBlock icon={TrendingUp} title="Что такое УГС?">
          <strong>УГС (Уровень Готовности Системы)</strong> — производная оценка, зависящая от УГТ технологий, входящих в систему, и УГИ взаимодействующих пар технологий. Шкала включает 5 уровней с числовыми индексами от 0.10 до 1.00. В отличие от УГТ, УГП и УГИ, которые оценивают отдельные аспекты, УГС даёт обобщённую характеристику готовности всей системы в целом. Рассчитывается по формуле с использованием матрицы УГТ и УГИ.
        </InfoBlock>
        <motion.div className="mb-10 flex gap-1" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          {UGS_LEVELS.map((level, i) => (
            <motion.div key={level.id} className="group relative flex-1" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6, ease: easeOutExpo }} style={{ transformOrigin: 'bottom' }}>
              <div className="flex h-12 items-center justify-center rounded-lg text-xs font-medium text-white transition-transform duration-200 group-hover:scale-y-110 sm:text-sm" style={{ backgroundColor: level.color }}><span className="font-mono">{level.code}</span></div>
              <p className="mt-2 hidden text-center text-xs leading-tight sm:block" style={{ color: '#475569' }}>{level.name}</p>
            </motion.div>
          ))}
        </motion.div>
        <div className="space-y-3">{UGS_LEVELS.map((level, i) => (<UGSAccordionItem key={level.id} level={level} index={i} />))}</div>
      </div>
    </section>
  );
}
