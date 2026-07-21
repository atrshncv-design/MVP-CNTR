import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator } from 'lucide-react';
import { UGT_LEVELS, UGI_LEVELS, UGS_LEVELS } from '@/data/ugtData';
import { SectionHeader, InfoBlock, fadeUp, easeSmooth, easeOutExpo } from './shared';

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface UGSResultData {
  ugsValues: number[];
  maxUGS: number;
  ugsLevel: number;
  normalizedUGT: number[];
  normalizedUGI: number[][];
}

/* ================================================================== */
/*  UGS Results                                                        */
/* ================================================================== */

function UGSResults({ data, ugtValues }: { data: UGSResultData; ugtValues: number[] }) {
  const { ugsValues, maxUGS, ugsLevel, normalizedUGT, normalizedUGI } = data;
  const ugsLevelData = UGS_LEVELS[ugsLevel - 1];

  return (
    <div>
      <h4 className="mb-4 text-lg font-semibold" style={{ color: '#0F172A' }}>Результаты расчёта</h4>
      <div className="mb-4 rounded-[10px] p-4" style={{ backgroundColor: '#F5F7FA' }}>
        <h5 className="mb-2 text-sm font-semibold" style={{ color: '#0F172A' }}>Нормализованные УГТ (УГТ / 9)</h5>
        <div className="flex flex-wrap gap-2">
          {normalizedUGT.map((v, i) => (<span key={i} className="rounded-md px-3 py-1 font-mono text-xs" style={{ backgroundColor: UGT_LEVELS[ugtValues[i] - 1]?.color + '15', color: '#0F172A' }}>Т{i + 1}: {v.toFixed(2)}</span>))}
        </div>
      </div>
      <div className="mb-4 rounded-[10px] p-4" style={{ backgroundColor: '#F5F7FA' }}>
        <h5 className="mb-2 text-sm font-semibold" style={{ color: '#0F172A' }}>Нормализованная матрица УГИ (УГИ / 9)</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-xs"><tbody>
            {normalizedUGI.map((row, i) => (<tr key={i}>{row.map((v, j) => (<td key={j} className="px-2 py-1 text-center font-mono">{v.toFixed(2)}</td>))}</tr>))}
          </tbody></table>
        </div>
      </div>
      <div className="mb-4 rounded-[10px] p-4" style={{ backgroundColor: '#F5F7FA' }}>
        <h5 className="mb-2 text-sm font-semibold" style={{ color: '#0F172A' }}>УГС для каждой технологии</h5>
        <div className="space-y-2">
          {ugsValues.map((v, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="min-w-[60px] font-mono text-xs" style={{ color: '#0F172A' }}>Т{i + 1}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: '#E8ECF0' }}>
                <motion.div className="h-full rounded-full" style={{ backgroundColor: UGT_LEVELS[ugtValues[i] - 1]?.color || '#2E5BFF' }} initial={{ width: 0 }} animate={{ width: `${Math.min(v * 100 * 2, 100)}%` }} transition={{ duration: 0.8, ease: easeOutExpo }} />
              </div>
              <span className="min-w-[60px] text-right font-mono text-xs font-semibold" style={{ color: '#0F172A' }}>{v.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[10px] p-5 text-center" style={{ backgroundColor: ugsLevelData?.color + '10' || '#F5F7FA', border: `2px solid ${ugsLevelData?.color || '#E8ECF0'}` }}>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Результат</span>
        <div className="text-3xl font-bold" style={{ color: ugsLevelData?.color || '#0F172A' }}>{ugsLevelData?.code || `УГС ${ugsLevel}`}</div>
        <div className="mt-1 text-base font-medium" style={{ color: '#0F172A' }}>{ugsLevelData?.name || ''}</div>
        <div className="mt-1 font-mono text-sm" style={{ color: '#475569' }}>Индекс: {maxUGS.toFixed(4)} (диапазон {ugsLevelData?.range || ''})</div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  UGS Calculator Section                                             */
/* ================================================================== */

export default function UGSCalculatorSection() {
  const [techCount, setTechCount] = useState(3);
  const [ugtValues, setUgtValues] = useState<number[]>([7, 6, 8]);
  const [ugiMatrix, setUgiMatrix] = useState<number[][]>([[9, 7, 6], [7, 9, 8], [6, 8, 9]]);
  const [showCalculation, setShowCalculation] = useState(false);

  const handleTechCountChange = (count: number) => {
    if (count < 2 || count > 10) return;
    setTechCount(count);
    setUgtValues((prev) => { const next = [...prev]; while (next.length < count) next.push(5); return next.slice(0, count); });
    setUgiMatrix((prev) => {
      const next = prev.map((row) => [...row]);
      while (next.length < count) { const newRow = Array(count).fill(5); newRow[next.length] = 9; next.push(newRow); }
      return next.slice(0, count).map((row) => { const r = row.slice(0, count); while (r.length < count) r.push(5); return r; });
    });
    setShowCalculation(false);
  };

  const handleUGTChange = (index: number, value: number) => { setUgtValues((prev) => { const next = [...prev]; next[index] = value; return next; }); setShowCalculation(false); };
  const handleUGIChange = (i: number, j: number, value: number) => { setUgiMatrix((prev) => { const next = prev.map((row) => [...row]); next[i][j] = value; if (i !== j) next[j][i] = value; return next; }); setShowCalculation(false); };

  const calculateUGS = useCallback(() => {
    const ti = techCount;
    const ugsValues: number[] = [];
    const normalizedUGT: number[] = ugtValues.map((v) => v / 9);
    const normalizedUGI: number[][] = ugiMatrix.map((row) => row.map((v) => v / 9));
    for (let i = 0; i < ti; i++) {
      let sum = 0;
      for (let j = 0; j < ti; j++) { sum += normalizedUGI[i][j] * ugtValues[j]; }
      const ugsi = sum / 9 / ti;
      ugsValues.push(ugsi);
    }
    const maxUGS = Math.max(...ugsValues);
    let ugsLevel = 1;
    if (maxUGS >= 0.9) ugsLevel = 5;
    else if (maxUGS >= 0.7) ugsLevel = 4;
    else if (maxUGS >= 0.6) ugsLevel = 3;
    else if (maxUGS >= 0.4) ugsLevel = 2;
    return { ugsValues, maxUGS, ugsLevel, normalizedUGT, normalizedUGI };
  }, [ugtValues, ugiMatrix, techCount]);

  return (
    <section id="ugs-calculator" style={{ backgroundColor: '#F5F7FA' }}>
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader label="АЛГОРИТМ РАСЧЁТА УГС" title="Калькулятор индекса УГС" subtitle="Раздел 5.4.4 — Расчёт уровня готовности системы на основе УГТ и УГИ" />
        <InfoBlock icon={Calculator} title="Как рассчитать УГС?">
          <strong>Алгоритм расчёта УГС</strong> (раздел 5.4.4 ГОСТ) определяет уровень готовности системы на основе УГТ входящих технологий и УГИ их взаимодействия. Формула: <em>УГСi = (УГИi₁ × УГТ₁ + УГИi₂ × УГТ₂ + ... + УГИiₙ × УГТₙ) / 9 / ti</em>, где ti — количество технологий. Введите количество технологий, укажите УГТ каждой технологии и УГИ взаимодействия между парами — калькулятор выполнит все расчёты автоматически.
        </InfoBlock>
        <motion.div className="mb-8 rounded-[10px] border p-5" style={{ backgroundColor: '#0F172A', borderColor: 'rgba(255,255,255,0.1)' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <h4 className="mb-3 text-sm font-semibold text-white">Формула расчёта</h4>
          <div className="rounded-lg p-4 font-mono text-sm leading-relaxed" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.85)' }}>
            УГСi = (УГИi1 × УГТ1 + УГИi2 × УГТ2 + ... + УГИin × УГТn) / 9 / ti
          </div>
          <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            где ti — количество технологий, УГТj — уровень готовности j-й технологии, УГИij — уровень готовности интеграции i-й и j-й технологий.
          </p>
        </motion.div>
        <motion.div className="rounded-[16px] border p-6 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium" style={{ color: '#0F172A' }}>Количество технологий (подсистем)</label>
            <div className="inline-flex items-center gap-3">
              <input type="number" min={2} max={10} value={techCount} onChange={(e) => handleTechCountChange(Number(e.target.value))} className="w-20 rounded-[10px] border px-4 py-2.5 text-center font-mono text-sm font-semibold outline-none transition-colors focus:border-[#2E5BFF] focus:ring-2 focus:ring-[#2E5BFF]/20" style={{ borderColor: '#DEE2E8', color: '#0F172A' }} />
              <input type="range" min={2} max={10} value={techCount} onChange={(e) => handleTechCountChange(Number(e.target.value))} className="h-2 w-40 cursor-pointer appearance-none rounded-full bg-[#E8ECF0] accent-[#2E5BFF]" />
            </div>
          </div>
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold" style={{ color: '#0F172A' }}>Уровни готовности технологий (УГТ)</h4>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {ugtValues.map((val, i) => (
                <div key={i} className="rounded-[10px] border p-3" style={{ borderColor: '#E8ECF0' }}>
                  <label className="mb-1 block text-xs font-medium" style={{ color: '#94A3B8' }}>Технология {i + 1}</label>
                  <select value={val} onChange={(e) => handleUGTChange(i, Number(e.target.value))} className="w-full rounded-md border px-2 py-1.5 font-mono text-sm font-semibold outline-none" style={{ borderColor: '#DEE2E8', color: UGT_LEVELS[val - 1]?.color || '#0F172A' }}>
                    {UGT_LEVELS.map((l) => (<option key={l.id} value={l.id}>{l.code} — {l.name}</option>))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <h4 className="mb-3 text-sm font-semibold" style={{ color: '#0F172A' }}>Матрица УГИ (взаимодействие технологий)</h4>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: techCount * 100 }}>
                <thead><tr><th className="px-2 py-2 text-xs" style={{ color: '#94A3B8' }}>УГИ</th>{Array.from({ length: techCount }, (_, i) => (<th key={i} className="px-2 py-2 text-center font-mono text-xs" style={{ color: '#0F172A' }}>Т{i + 1}</th>))}</tr></thead>
                <tbody>
                  {Array.from({ length: techCount }, (_, i) => (
                    <tr key={i}>
                      <td className="px-2 py-2 font-mono text-xs font-semibold" style={{ color: '#0F172A' }}>Т{i + 1}</td>
                      {Array.from({ length: techCount }, (_, j) => (
                        <td key={j} className="px-1 py-1">
                          {i === j ? (
                            <div className="flex h-9 items-center justify-center rounded-md font-mono text-xs font-semibold" style={{ backgroundColor: '#EEF1F5', color: '#94A3B8' }}>9</div>
                          ) : (
                            <select value={ugiMatrix[i]?.[j] ?? 5} onChange={(e) => handleUGIChange(i, j, Number(e.target.value))} className="h-9 w-full rounded-md border px-1 py-1 text-center font-mono text-xs outline-none" style={{ borderColor: '#DEE2E8', color: '#0F172A' }}>
                              {UGI_LEVELS.map((l) => (<option key={l.id} value={l.id}>{l.id}</option>))}
                            </select>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <button onClick={() => setShowCalculation(true)} className="inline-flex items-center gap-2 rounded-[10px] px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:brightness-110" style={{ background: 'linear-gradient(135deg, #2E5BFF 0%, #4A82FF 50%, #5B9BD5 100%)', boxShadow: '0 0 20px rgba(46, 91, 255, 0.15)' }}>
            <Calculator size={16} />Рассчитать УГС
          </button>
        </motion.div>
        <AnimatePresence>
          {showCalculation && (
            <motion.div className="mt-8 rounded-[16px] border p-6 sm:p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8ECF0' }} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.5, ease: easeSmooth }}>
              <UGSResults data={calculateUGS()} ugtValues={ugtValues} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
