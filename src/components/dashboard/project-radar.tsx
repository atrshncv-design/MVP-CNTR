"use client";

import { MotionConfig, motion } from "framer-motion";
import { ugtTone } from "@/components/landing/ugt-card";

/**
 * ProjectRadar — data-driven радар профиля готовности проекта для ЛК.
 *
 * 4 оси (Научная / Техническая / Организационная / Производственная),
 * форма многоугольника рассчитывается из данных:
 *   - базовая форма — все оси на уровне currentLevel проекта (1–9);
 *   - каждый документ проекта «вытягивает» ось своей категории (+0.5, потолок 9);
 *   - без документов — симметричный многоугольник на currentLevel.
 *
 * Стилизация — токены палитры УГТ (--color-tz-ugt-*), акцент по ugtTone(currentLevel).
 * Размер компактный (по умолчанию 180px) — для карточки проекта.
 */

export type RadarCategory =
  | "scientific"
  | "technical"
  | "organizational"
  | "production";

export interface ProjectRadarDoc {
  doc_type: string;
  /** Название документа — помогает маппить русскоязычные типы (title опционален). */
  title?: string;
}

export const RADAR_CATEGORIES: ReadonlyArray<{
  id: RadarCategory;
  label: string;
  angle: number;
}> = [
  { id: "scientific", label: "Научная", angle: -90 },
  { id: "technical", label: "Техническая", angle: 0 },
  { id: "organizational", label: "Организационная", angle: 90 },
  { id: "production", label: "Производственная", angle: 180 },
];

/** Явные doc_type-слаги бэкенда (см. app/db/seed_templates.py, generation.py). */
const SLUG_TO_CATEGORY: Record<string, RadarCategory> = {
  tz: "technical",
  teo: "technical",
  passport: "organizational",
  stage: "organizational",
  gost: "technical",
};

/**
 * Ключевые слова русскоязычных названий/типов документов.
 * Порядок важен: сначала производственные («акты ввода в эксплуатацию»,
 * «план производства»), потом технические, научные, организационные.
 */
const KEYWORD_RULES: ReadonlyArray<{
  category: RadarCategory;
  keywords: readonly string[];
}> = [
  {
    category: "production",
    keywords: ["в эксплуатац", "пилотн", "производств"],
  },
  {
    category: "technical",
    keywords: [
      "тз",
      "тео",
      "тэо",
      "протокол",
      "испытани",
      "техдокументац",
      "сертификац",
      "гост",
    ],
  },
  {
    category: "scientific",
    keywords: ["публикац", "патент", "научн", "отчёт", "отчет", "исследовани"],
  },
  {
    category: "organizational",
    keywords: ["паспорт", "план", "акт", "договор", "заявк", "смет"],
  },
];

/** Маппинг документа → категория оси; неизвестный doc_type → null (не влияет). */
export function radarCategoryForDoc(doc: ProjectRadarDoc): RadarCategory | null {
  const slug = doc.doc_type.trim().toLowerCase();
  if (slug in SLUG_TO_CATEGORY) return SLUG_TO_CATEGORY[slug];
  const haystack = `${slug} ${(doc.title ?? "").toLowerCase()}`;
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category;
    }
  }
  return null;
}

/** Значения осей: база = currentLevel, +0.5 за документ категории, потолок 9. */
export function radarAxisValues(
  currentLevel: number,
  documents: readonly ProjectRadarDoc[],
): Record<RadarCategory, number> {
  const base = Math.min(9, Math.max(1, Math.round(currentLevel)));
  const counts: Record<RadarCategory, number> = {
    scientific: 0,
    technical: 0,
    organizational: 0,
    production: 0,
  };
  for (const doc of documents) {
    const category = radarCategoryForDoc(doc);
    if (category) counts[category] += 1;
  }
  return {
    scientific: Math.min(9, base + counts.scientific * 0.5),
    technical: Math.min(9, base + counts.technical * 0.5),
    organizational: Math.min(9, base + counts.organizational * 0.5),
    production: Math.min(9, base + counts.production * 0.5),
  };
}

function formatAxisValue(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

interface ProjectRadarProps {
  currentLevel: number;
  documents: readonly ProjectRadarDoc[];
  /** Диаметр радара в px (по умолчанию 180 — компактно для карточки). */
  size?: number;
  className?: string;
}

export default function ProjectRadar({
  currentLevel,
  documents,
  size = 180,
  className = "",
}: ProjectRadarProps) {
  const cx = 100;
  const cy = 100;
  const r = 72;
  const accent = ugtTone(currentLevel);
  const values = radarAxisValues(currentLevel, documents);

  const pointFor = (category: RadarCategory) => {
    const axis = RADAR_CATEGORIES.find((a) => a.id === category)!;
    const dist = (Math.min(9, values[category]) / 9) * r;
    const angle = (axis.angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      value: values[category],
    };
  };

  const points = RADAR_CATEGORIES.map((axis) => pointFor(axis.id));
  const polygonPoints = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`flex flex-col items-stretch ${className}`}
        style={{ width: size >= 160 ? "100%" : size }}
        role="img"
        aria-label={`Радар готовности проекта: научная ${formatAxisValue(values.scientific)}, техническая ${formatAxisValue(values.technical)}, организационная ${formatAxisValue(values.organizational)}, производственная ${formatAxisValue(values.production)} из 9`}
      >
        <svg
          viewBox="0 0 200 200"
          className="mx-auto aspect-square"
          style={{ width: `min(100%, ${size}px)` }}
        >
          {/* Сетка: кольца уровней 3 / 6 / 9 */}
          {[1 / 3, 2 / 3, 1].map((scale) => (
            <circle
              key={scale}
              cx={cx}
              cy={cy}
              r={r * scale}
              fill="none"
              stroke="var(--color-tz-border)"
              strokeWidth="0.6"
            />
          ))}

          {/* Отметки шкалы 3 / 6 / 9 на оси «Техническая» */}
          {[3, 6, 9].map((tick) => (
            <text
              key={tick}
              x={cx + (tick / 9) * r + 2.5}
              y={cy + 2.5}
              fontSize="6.5"
              fill="var(--color-tz-muted)"
              opacity="0.75"
            >
              {tick}
            </text>
          ))}

          {/* Оси */}
          {RADAR_CATEGORIES.map((axis) => {
            const angle = (axis.angle * Math.PI) / 180;
            return (
              <line
                key={axis.id}
                x1={cx}
                y1={cy}
                x2={cx + Math.cos(angle) * r}
                y2={cy + Math.sin(angle) * r}
                stroke="var(--color-tz-border)"
                strokeWidth="0.6"
              />
            );
          })}

          {/* Многоугольник профиля (появление с лёгкой анимацией) */}
          <motion.g
            style={{ transformOrigin: `${cx}px ${cy}px` }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <polygon
              points={polygonPoints}
              fill={accent}
              fillOpacity="0.14"
              stroke={accent}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.6" fill={accent} />
            ))}
          </motion.g>

          {/* Центральная точка */}
          <circle cx={cx} cy={cy} r="2" fill="var(--color-tz-muted)" />
        </svg>

        {/* Подписи вынесены из области графика, чтобы не перекрывать радар. */}
        <ul
          aria-label="Категории готовности"
          className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5"
        >
          {RADAR_CATEGORIES.map((axis) => (
            <li
              key={axis.id}
              className="flex min-w-0 items-center justify-between gap-2 text-[10px] leading-tight"
            >
              <span className="min-w-0 whitespace-nowrap text-tz-secondary">{axis.label}</span>
              <span className="shrink-0 font-mono font-bold" style={{ color: accent }}>
                {formatAxisValue(values[axis.id])}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </MotionConfig>
  );
}
