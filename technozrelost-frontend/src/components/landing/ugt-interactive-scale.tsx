"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { UGT_LEVELS } from "@/lib/ugt-data";

/**
 * UGTInteractiveScale — интерактивная шкала УГТ 1–9 (главная страница).
 *
 * Стиль: трек-линия с градиентом, 9 круглых нод, клик/ховер по ноде —
 * стеклянная карточка-превью с названием, описанием и критериями уровня.
 * Фазы (вариант В): подписи групп 1–3 «Исследование», 4–6 «Прототип», 7–9 «Внедрение».
 *
 * Цвета — токены темы --tz-ugt-1..9 (тёплые низкие → зелёные высокие).
 */

const PHASES = [
  { label: "Исследование", range: [1, 2, 3] as number[] },
  { label: "Прототип", range: [4, 5, 6] as number[] },
  { label: "Внедрение", range: [7, 8, 9] as number[] },
];

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

export default function UGTInteractiveScale() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const selected = UGT_LEVELS.find((l) => l.id === activeId) ?? null;

  return (
    <div className="relative">
      {/* ── Трек с нодами (линия проходит через центры кружков) ───── */}
      <div className="relative mx-auto max-w-[900px]">
        {/* Линия-трек: от центра кружка 1 до центра кружка 9 */}
        <div className="absolute left-5 right-5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-tz-border/50 sm:left-6 sm:right-6 md:left-7 md:right-7">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "100%" }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--tz-ugt-1), var(--tz-ugt-2), var(--tz-ugt-3), var(--tz-ugt-4), var(--tz-ugt-5), var(--tz-ugt-6), var(--tz-ugt-7), var(--tz-ugt-8), var(--tz-ugt-9))",
            }}
          />
        </div>

        {/* Ноды */}
        <div className="flex justify-between">
          {UGT_LEVELS.map((level, i) => {
            const isActive = activeId === level.id;
            return (
              <motion.div
                key={level.id}
                initial={{ scale: 0, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.07, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex flex-col items-center"
              >
                <button
                  type="button"
                  onClick={() => setActiveId(isActive ? null : level.id)}
                  onMouseEnter={() => setActiveId(level.id)}
                  aria-label={`УГТ ${level.id}. ${level.name}`}
                  aria-pressed={isActive}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-tz-bg font-mono text-xs font-bold text-white transition-transform duration-200 hover:scale-110 sm:h-12 sm:w-12 sm:text-sm md:h-14 md:w-14"
                  style={{
                    background: ugtColor(level.id),
                    boxShadow: isActive
                      ? `0 0 22px ${ugtColor(level.id)}99, 0 0 0 3px ${ugtColor(level.id)}22`
                      : `0 0 0 3px ${ugtColor(level.id)}1f`,
                  }}
                >
                  {level.id}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Подписи нод ────────────────────────────────────────────── */}
      <div className="mx-auto mt-1 flex max-w-[900px] justify-between">
        {UGT_LEVELS.map((level) => (
          <span
            key={level.id}
            className="w-10 text-center font-mono text-[11px] text-tz-secondary sm:w-12 md:w-14"
          >
            УГТ {level.id}
          </span>
        ))}
      </div>

      {/* ── Фазы (вариант В) ───────────────────────────────────────── */}
      <div className="mx-auto mt-8 grid max-w-[900px] grid-cols-3 gap-3">
        {PHASES.map((phase, pi) => (
          <div
            key={phase.label}
            className={`rounded-xl border px-4 py-3 text-center transition-colors ${
              selected && phase.range.includes(selected.id)
                ? "border-tz-accent/50 bg-tz-accent/[0.06]"
                : "border-tz-border/60 bg-tz-surface/40"
            }`}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
              {phase.range[0]}–{phase.range[phase.range.length - 1]}
            </div>
            <div className="mt-0.5 text-sm font-semibold text-tz-fg">{phase.label}</div>
          </div>
        ))}
      </div>

      {/* ── Карточка-превью ────────────────────────────────────────── */}
      <div className="mx-auto mt-6 min-h-[190px] max-w-lg">
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="rounded-2xl border border-tz-border/70 bg-tz-surface/80 p-5 shadow-[0_16px_40px_rgba(11,13,18,0.08)] backdrop-blur-md"
          >
            <div className="flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-bold text-white"
                style={{ background: ugtColor(selected.id) }}
              >
                {selected.id}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-3 py-0.5 font-mono text-xs font-semibold"
                    style={{ background: `${ugtColor(selected.id)}22`, color: ugtColor(selected.id) }}
                  >
                    {selected.code}
                  </span>
                </div>
                <h4 className="mt-2 text-lg font-semibold text-tz-fg">{selected.name}</h4>
                <p className="mt-1 text-sm text-tz-secondary">{selected.short}</p>
                <ul className="mt-3 space-y-1">
                  {selected.requirements.slice(0, 3).map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-tz-secondary">
                      <span style={{ color: ugtColor(selected.id) }}>•</span>
                      {r}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/levels/${selected.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors hover:underline"
                  style={{ color: ugtColor(selected.id) }}
                >
                  Подробнее <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
