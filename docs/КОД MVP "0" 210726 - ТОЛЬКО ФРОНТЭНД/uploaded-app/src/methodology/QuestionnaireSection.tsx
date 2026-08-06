import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator, Info, ArrowLeft, ArrowRight,
  CircleCheck, AlertTriangle, CheckCircle, RotateCcw,
} from 'lucide-react';
import { UGT_LEVELS } from '@/data/ugtData';
import {
  QUESTIONNAIRE,
} from '@/data/questionnaireData';
import type { QuestionnaireItem } from '@/data/questionnaireData';
import { SectionHeader, InfoBlock, fadeUp, easeOutExpo } from './shared';

/* ================================================================== */
/*  Types & helpers                                                    */
/* ================================================================== */

type SystemType = 'all' | 'O' | 'P' | 'K';

const SYSTEM_TYPE_COLORS: Record<string, string> = { O: '#2E5BFF', P: '#5B9BD5', K: '#A8D65A' };

function getEvaluationStatus(value: number): { label: string; color: string; bgColor: string } {
  if (value >= 75) return { label: 'Соответствует', color: '#16A34A', bgColor: '#DCFCE7' };
  if (value >= 50) return { label: 'Частично соответствует', color: '#D97706', bgColor: '#FEF3C7' };
  return { label: 'Не соответствует', color: '#DC2626', bgColor: '#FEE2E2' };
}

/* ================================================================== */
/*  Question Card                                                      */
/* ================================================================== */

function QuestionCard({ item, value, onChange }: { item: QuestionnaireItem; value: number; onChange: (v: number) => void }) {
  const status = getEvaluationStatus(value);
  const sysColor = SYSTEM_TYPE_COLORS[item.systemType] || '#475569';

  return (
    <div className="rounded-[10px] border p-4 transition-all duration-200 sm:p-5" style={{ backgroundColor: '#FFFFFF', borderColor: value > 0 ? status.color + '30' : '#E8ECF0' }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold" style={{ backgroundColor: item.category === 'critical' ? '#FEE2E2' : '#EEF1F5', color: item.category === 'critical' ? '#DC2626' : '#475569' }}>{item.category === 'critical' ? 'Критический' : 'Поддерживающий'}</span>
        <span className="rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold" style={{ backgroundColor: sysColor + '15', color: sysColor }}>{item.systemType === 'O' ? 'О' : item.systemType === 'P' ? 'П' : 'К'}</span>
        <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>{item.id}</span>
      </div>
      <p className="mb-4 text-sm font-medium sm:text-base" style={{ color: '#0F172A' }}>{item.question}</p>
      <div className="mb-3 grid grid-cols-5 gap-1 sm:gap-2">
        {[0, 25, 50, 75, 100].map((v) => (
          <button key={v} className="rounded-md px-2 py-2 text-xs font-medium transition-all duration-200 sm:text-sm" style={{ backgroundColor: value === v ? status.color + '20' : '#F5F7FA', color: value === v ? status.color : '#475569', border: value === v ? `1.5px solid ${status.color}` : '1.5px solid transparent' }} onClick={() => onChange(v)}>{v}%</button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[#E8ECF0]" style={{ accentColor: status.color }} />
        <span className="min-w-[48px] text-right font-mono text-sm font-semibold" style={{ color: status.color }}>{value}%</span>
      </div>
      {value > 0 && (
        <motion.div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: status.bgColor, color: status.color }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}>
          {value >= 75 ? <CircleCheck size={14} /> : <AlertTriangle size={14} />}{status.label}
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Questionnaire Result                                               */
/* ================================================================== */

function QuestionnaireResult({ result, getLevelCompliance, onReset }: { result: number; getLevelCompliance: (level: number) => number; onReset: () => void }) {
  const resultLevel = UGT_LEVELS[result - 1];
  return (
    <div className="rounded-[16px] border p-6 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }}>
      <div className="mb-6 text-center">
        <motion.div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white" style={{ backgroundColor: resultLevel?.color || '#94A3B8' }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, duration: 0.5, ease: easeOutExpo }}>
          {result}
        </motion.div>
        <h3 className="text-2xl font-bold" style={{ color: '#0F172A' }}>{result > 0 ? resultLevel?.name : 'Уровень не определён'}</h3>
        <p className="mt-2 text-base" style={{ color: '#475569' }}>
          {result > 0 ? (<>Ваш проект соответствует уровню <span className="font-mono font-semibold" style={{ color: resultLevel?.color }}>{resultLevel?.code}</span></>) : 'Необходимо заполнить больше вопросов для определения уровня'}
        </p>
      </div>
      <div className="mb-6 space-y-2">
        <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Детализация по уровням</h4>
        {UGT_LEVELS.map((level, i) => {
          const compliance = getLevelCompliance(i);
          const isAchieved = compliance >= 75;
          return (
            <motion.div key={level.id} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: isAchieved ? level.color + '08' : '#F5F7FA' }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold text-white" style={{ backgroundColor: level.color }}>{level.id}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium" style={{ color: '#0F172A' }}>{level.code} — {level.name}</span>
                  <span className="shrink-0 font-mono text-sm font-semibold" style={{ color: isAchieved ? '#16A34A' : '#94A3B8' }}>{compliance}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#E8ECF0' }}>
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: isAchieved ? level.color : '#CBD5E1' }} initial={{ width: 0 }} animate={{ width: `${compliance}%` }} transition={{ delay: i * 0.06 + 0.3, duration: 0.5, ease: easeOutExpo }} />
                </div>
              </div>
              {isAchieved && <CheckCircle size={18} className="shrink-0" style={{ color: '#16A34A' }} />}
            </motion.div>
          );
        })}
      </div>
      <div className="flex justify-center">
        <button onClick={onReset} className="inline-flex items-center gap-2 rounded-[10px] border px-6 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-[#F5F7FA]" style={{ borderColor: '#DEE2E8', color: '#475569' }}>
          <RotateCcw size={16} />Пройти заново
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Questionnaire Calculator Section                                   */
/* ================================================================== */

export default function QuestionnaireCalculatorSection() {
  const [systemType, setSystemType] = useState<SystemType>('all');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const filteredQuestionnaire = QUESTIONNAIRE.map((ql) => ({
    ...ql,
    items: systemType === 'all' ? ql.items : ql.items.filter((item) => item.systemType === systemType || item.systemType === 'K'),
  }));

  const currentQL = filteredQuestionnaire[currentLevel];
  const handleAnswer = useCallback((id: string, value: number) => { setAnswers((prev) => ({ ...prev, [id]: value })); }, []);

  const getLevelProgress = useCallback((levelIndex: number) => {
    const ql = filteredQuestionnaire[levelIndex];
    if (!ql || ql.items.length === 0) return 0;
    const answered = ql.items.filter((item) => (answers[item.id] || 0) > 0).length;
    return Math.round((answered / ql.items.length) * 100);
  }, [answers, filteredQuestionnaire]);

  const getLevelCompliance = useCallback((levelIndex: number) => {
    const ql = filteredQuestionnaire[levelIndex];
    if (!ql || ql.items.length === 0) return 0;
    const met = ql.items.filter((item) => (answers[item.id] || 0) >= 75).length;
    return Math.round((met / ql.items.length) * 100);
  }, [answers, filteredQuestionnaire]);

  const calculateResult = useCallback(() => {
    let achievedLevel = 0;
    for (let i = 0; i < 9; i++) {
      const compliance = getLevelCompliance(i);
      if (compliance >= 75) { achievedLevel = i + 1; } else { break; }
    }
    return achievedLevel;
  }, [getLevelCompliance]);

  const goNext = () => { if (currentLevel < 8) { setCurrentLevel((p) => p + 1); } };
  const goPrev = () => { if (currentLevel > 0) { setCurrentLevel((p) => p - 1); } };
  const reset = () => { setAnswers({}); setCurrentLevel(0); setShowResults(false); };

  const levelColor = UGT_LEVELS[currentLevel]?.color || '#2E5BFF';
  const progress = getLevelProgress(currentLevel);
  const compliance = getLevelCompliance(currentLevel);

  return (
    <section id="questionnaire" style={{ backgroundColor: '#EEF1F5' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="ОПРОСНИК-КАЛЬКУЛЯТОР" title="Интерактивная оценка УГТ" subtitle="Приложение В — Пошаговый опросник для определения уровня готовности технологий" />
        <InfoBlock icon={Calculator} title="Как работает опросник-калькулятор?">
          <strong>Опросник (Приложение В ГОСТ Р 58048-2017)</strong> — инструмент для оценки УГТ, содержащий перечень конкретных вопросов для каждого из 9 уровней. Для каждого вопроса указывается: тип системы (О — оборудование, П — программное обеспечение, К — комплексная система), категория (критический или поддерживающий элемент) и область анализа. Выберите тип системы и оцените каждый пункт по шкале 0–100%. Уровень считается достигнутым, если 75% и более вопросов получили оценку «Соответствует».
        </InfoBlock>
        <motion.div className="mb-8 rounded-[10px] border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex items-start gap-3">
            <Info size={20} className="mt-0.5 shrink-0" style={{ color: '#2E5BFF' }} />
            <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
              Выберите тип системы и пройдите опросник по каждому уровню УГТ. Для каждого вопроса укажите степень соответствия: 0% — не соответствует, 25–50% — частично соответствует, 75–100% — полностью соответствует. Уровень считается достигнутым, если 75% и более вопросов уровня имеют ответ «Соответствует».
            </p>
          </div>
        </motion.div>
        <motion.div className="mb-8" variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Тип системы</span>
          <div className="inline-flex rounded-[10px] p-1" style={{ backgroundColor: '#EEF1F5' }}>
            {([{ key: 'all' as const, label: 'Все' }, { key: 'O' as const, label: 'Оборудование' }, { key: 'P' as const, label: 'Программное обеспечение' }, { key: 'K' as const, label: 'Комплексная система' }]).map((tab) => (
              <button key={tab.key} onClick={() => { setSystemType(tab.key); setCurrentLevel(0); setAnswers({}); setShowResults(false); }} className="rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200" style={{ backgroundColor: systemType === tab.key ? '#FFFFFF' : 'transparent', color: systemType === tab.key ? '#0F172A' : '#94A3B8', boxShadow: systemType === tab.key ? '0 1px 2px rgba(15,23,42,0.04)' : 'none' }}>{tab.label}</button>
            ))}
          </div>
        </motion.div>

        {!showResults ? (
          <>
            <motion.div className="mb-6 rounded-[10px] border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg font-mono text-sm font-bold text-white" style={{ backgroundColor: levelColor }}>{currentQL?.level}</span>
                  <div>
                    <span className="font-mono text-sm font-semibold" style={{ color: levelColor }}>{currentQL?.code}</span>
                    <span className="ml-2 text-sm" style={{ color: '#0F172A' }}>{UGT_LEVELS[currentLevel]?.name}</span>
                  </div>
                </div>
                <span className="font-mono text-xs" style={{ color: '#94A3B8' }}>Уровень {currentLevel + 1} из 9</span>
              </div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs" style={{ color: '#94A3B8' }}>Прогресс: {progress}%</span>
                <span className="text-xs font-medium" style={{ color: compliance >= 75 ? '#16A34A' : compliance >= 50 ? '#D97706' : '#94A3B8' }}>Соответствие: {compliance}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: '#E8ECF0' }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: levelColor }} initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: easeOutExpo }} />
              </div>
            </motion.div>

            <motion.div className="space-y-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} key={currentLevel}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Вопросы ({currentQL?.items.length || 0})</span>
              </div>
              {currentQL?.items.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.3 }}>
                  <QuestionCard item={item} value={answers[item.id] || 0} onChange={(v) => handleAnswer(item.id, v)} />
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-8 flex items-center justify-between">
              <button onClick={goPrev} disabled={currentLevel === 0} className="inline-flex items-center gap-2 rounded-[10px] border px-5 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-40" style={{ borderColor: '#DEE2E8', color: '#475569', backgroundColor: '#FFFFFF' }}>
                <ArrowLeft size={16} />Назад
              </button>
              {currentLevel === 8 ? (
                <button onClick={() => setShowResults(true)} className="inline-flex items-center gap-2 rounded-[10px] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:brightness-110" style={{ background: 'linear-gradient(135deg, #2E5BFF 0%, #4A82FF 50%, #5B9BD5 100%)', boxShadow: '0 0 20px rgba(46, 91, 255, 0.15)' }}>
                  <Calculator size={16} />Рассчитать результат
                </button>
              ) : (
                <button onClick={goNext} className="inline-flex items-center gap-2 rounded-[10px] border px-5 py-2.5 text-sm font-medium transition-all duration-200" style={{ borderColor: '#DEE2E8', color: '#475569', backgroundColor: '#FFFFFF' }}>
                  Далее<ArrowRight size={16} />
                </button>
              )}
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: easeOutExpo }}>
            <QuestionnaireResult result={calculateResult()} getLevelCompliance={getLevelCompliance} onReset={reset} />
          </motion.div>
        )}
      </div>
    </section>
  );
}
