import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { UGI_LEVELS } from '@/data/ugtData';
import { SectionHeader, InfoBlock, easeOutExpo, easeSmooth } from './shared';

/* ================================================================== */
/*  FULL UGI Descriptions (Appendix B)                                */
/* ================================================================== */

const UGI_FULL_DESCRIPTIONS: Record<number, { full: string; criteria?: string[] }> = {
  1: { full: 'Интерфейс между технологиями определён с детализацией, достаточной для дальнейшего проектирования взаимодействия. Это низший уровень готовности к интеграции, на котором выбирается среда интеграции.', criteria: ['Интерфейс определён', 'Детализация достаточна для проектирования', 'Выбрана среда интеграции'] },
  2: { full: 'Определена спецификация, характеризующая взаимодействие (способность оказывать влияние) между технологиями через интерфейс. После определения среды интеграции выбран метод сигнализации — такой, что две интегрируемые технологии способны влиять друг на друга через выбранную среду. На этой стадии утверждается концепция интеграции.', criteria: ['Спецификация взаимодействия определена', 'Метод сигнализации выбран', 'Концепция интеграции утверждена'] },
  3: { full: 'Достигнута совместимость (общий язык) технологий, позволяющая обеспечить их упорядоченную и эффективную интеграцию и взаимодействие. Минимально требуемый уровень для обеспечения успешной интеграции. Две технологии способны не только влиять одна на другую, но и передавать интерпретируемые данные. Это первый реальный уровень зрелости в процессе интеграции.', criteria: ['Достигнута совместимость технологий', 'Передача интерпретируемых данных', 'Общий язык обеспечен'] },
  4: { full: 'Достигнуто качество взаимодействия и гарантируется интеграция между технологиями. Многие процессы интеграции технологий завершились неудачей на уровне УГИ 3 из-за предположения, что, если две технологии способны успешно обмениваться информацией, тогда они полностью интегрированы. УГИ 4 идёт дальше простого обмена данными и требует, чтобы полученные данные соответствовали отправленным данным, и для проверки этого существует механизм.', criteria: ['Качество взаимодействия достигнуто', 'Данные соответствуют отправленным', 'Механизм проверки существует'] },
  5: { full: 'Достигнут достаточный уровень управления технологиями, чтобы устанавливать, поддерживать и прекращать взаимодействие. УГИ 5 обозначает способность одной или нескольких интегрируемых технологий самостоятельно управлять интеграцией (устанавливать, поддерживать и прекращать взаимодействие).', criteria: ['Управление интеграцией достигнуто', 'Возможность установления/прекращения взаимодействия', 'Автономное управление'] },
  6: { full: 'Интегрируемые технологии могут принять, преобразовать и структурировать информацию по назначению. УГИ 6 — высший технический уровень, который может быть достигнут, он включает способность не только управлять интеграцией, но и определять, какой информацией обмениваться, метки, определяющие, что это за информация, способность транслировать данные из внешнего формата во внутренний.', criteria: ['Принятие и преобразование информации', 'Структурирование данных', 'Трансляция форматов'] },
  7: { full: 'Интеграция технологий была проверена и испытана с достаточной для использования степенью детализации. УГИ 7 представляет собой значительный по сравнению с УГИ 6 шаг: интеграция работает не только с технической точки зрения, но и с точки зрения требований. УГИ 7 подтверждает соответствие интеграции требованиям по производительности, пропускной способности и надёжности.', criteria: ['Интеграция проверена', 'Соответствие требованиям производительности', 'Достаточная детализация'] },
  8: { full: 'Реальная интеграция завершена и проверена испытаниями и демонстрацией в составе системы. УГИ 8 представляет не только соответствие интеграции требованиям, но и демонстрацию в составе системы в релевантном окружении. Это позволяет выявить любые неизвестные ошибки/дефекты, которые не могут быть обнаружены до тех пор, пока взаимодействие двух интегрируемых технологий не проверяется в составе системы.', criteria: ['Интеграция завершена', 'Проверена в составе системы', 'Демонстрация в релевантном окружении'] },
  9: { full: 'Возможность интеграции проверена в применении. УГИ 9 показывает, что интегрируемые технологии были успешно использованы в составе системы. Чтобы технология достигла УГТ 9, она должна быть интегрирована в систему и после проверена в релевантном окружении. Переход на УГИ 9 также влияет на достижение технологией уровня зрелости УГТ 9.', criteria: ['Интеграция проверена в применении', 'Успешное использование в системе', 'Влияние на УГТ 9'] },
};

/* ================================================================== */
/*  UGI Accordion Item                                                  */
/* ================================================================== */

function UGIAccordionItem({ level, index }: { level: (typeof UGI_LEVELS)[number]; index: number }) {
  const [open, setOpen] = useState(false);
  const data = UGI_FULL_DESCRIPTIONS[level.id];

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
/*  UGI Levels Section                                                  */
/* ================================================================== */

export default function UGILevelsSection() {
  return (
    <section id="ugi-levels" style={{ backgroundColor: '#EEF1F5' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="УРОВНИ ГОТОВНОСТИ ИНТЕГРАЦИИ" title="Шкала УГИ 1–9" subtitle="Приложение Б — Полные описания уровней готовности интеграции" />
        <InfoBlock icon={Layers} title="Что такое УГИ?">
          <strong>УГИ (Уровень Готовности Интеграции)</strong> — вспомогательная метрика, оценивающая зрелость механизмов интеграции двух технологий в составе единой системы. Шкала включает 9 уровней: от определения интерфейса (УГИ 1) до проверки интеграции в реальном применении (УГИ 9). УГИ измеряет способность технологий взаимодействовать друг с другом: обмениваться данными, управлять взаимодействием, поддерживать качество связи. Эта метрика используется при расчёте УГС — уровня готовности всей системы.
        </InfoBlock>
        <motion.div className="mb-10 flex gap-1" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          {UGI_LEVELS.map((level, i) => (
            <motion.div key={level.id} className="group relative flex-1" initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.6, ease: easeOutExpo }} style={{ transformOrigin: 'bottom' }}>
              <div className="flex h-12 items-center justify-center rounded-lg text-xs font-medium text-white transition-transform duration-200 group-hover:scale-y-110 sm:text-sm" style={{ backgroundColor: level.color }}><span className="font-mono">{level.code}</span></div>
              <p className="mt-2 hidden text-center text-xs leading-tight sm:block" style={{ color: '#475569' }}>{level.name}</p>
            </motion.div>
          ))}
        </motion.div>
        <div className="space-y-3">{UGI_LEVELS.map((level, i) => (<UGIAccordionItem key={level.id} level={level} index={i} />))}</div>
      </div>
    </section>
  );
}
