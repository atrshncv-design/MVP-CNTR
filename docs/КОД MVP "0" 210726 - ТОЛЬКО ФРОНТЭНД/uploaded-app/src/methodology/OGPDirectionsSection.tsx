import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import { OGP_DIRECTIONS } from '@/data/questionnaireData';
import { SectionHeader, InfoBlock, staggerContainer, staggerItem, easeSmooth } from './shared';

/* ================================================================== */
/*  OGP Direction Card                                                  */
/* ================================================================== */

function OGPDirectionCard({ direction }: { direction: (typeof OGP_DIRECTIONS)[number] }) {
  const [open, setOpen] = useState(false);
  const letterColors: Record<string, string> = { А: '#2E5BFF', Б: '#3B6CFF', В: '#4A82FF', Г: '#5B9BD5', Д: '#6AB0B5', Е: '#7EC8A0', Ж: '#A8D65A', И: '#E5C840', К: '#FF7A2E' };
  const color = letterColors[direction.letter] || '#2E5BFF';

  return (
    <motion.div className="overflow-hidden rounded-[10px] border transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={staggerItem} initial="hidden" whileInView="visible" viewport={{ once: true }}>
      <button className="flex w-full items-start gap-4 px-5 py-5 text-left sm:px-6" onClick={() => setOpen(!open)}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] font-mono text-xl font-bold text-white" style={{ backgroundColor: color }}>{direction.letter}</span>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold sm:text-lg" style={{ color: '#0F172A' }}>{direction.title}</h4>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: '#475569' }}>{direction.description}</p>
        </div>
        <div className="shrink-0 pt-2">{open ? <ChevronUp size={18} style={{ color }} /> : <ChevronDown size={18} style={{ color: '#94A3B8' }} />}</div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: easeSmooth }}>
            <div className="border-t px-5 pb-5 pt-4 sm:px-6" style={{ borderColor: '#E8ECF0' }}>
              <div className="space-y-2">
                {direction.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ backgroundColor: '#F5F7FA' }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold text-white" style={{ backgroundColor: color + 'CC' }}>{item.id}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#0F172A' }}>{item.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: '#475569' }}>{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ================================================================== */
/*  OGP Directions Section                                             */
/* ================================================================== */

export default function OGPDirectionsSection() {
  return (
    <section id="ogp-directions" style={{ backgroundColor: '#EEF1F5' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="9 НАПРАВЛЕНИЙ ОЦЕНКИ ОГП" title="Направления оценки готовности производства" subtitle="Раздел 5.2.9 — Структурированный анализ производственной готовности" />
        <InfoBlock icon={Gauge} title="Что такое ОГП?">
          <strong>ОГП (Оценка Готовности Производства)</strong> — комплексная оценка готовности производства по 9 направлениям (А–К): производственные технологии и база, дизайн системы, затраты и финансирование, материалы, возможности и управление процессами, управление качеством, производственный персонал, оборудование, управление производством. Каждое направление включает конкретные элементы оценки. ОГП проводится независимо от ОГТ и даёт полную картину производственной готовности.
        </InfoBlock>
        <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}>
          {OGP_DIRECTIONS.map((dir) => (<OGPDirectionCard key={dir.letter} direction={dir} />))}
        </motion.div>
      </div>
    </section>
  );
}
