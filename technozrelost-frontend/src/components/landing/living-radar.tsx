"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * LivingRadar — анимированный «дышащий» радар с интерактивными осями.
 * Симметричный 4-осевой радар с лучом-сканером, вращающимся по часовой стрелке.
 *
 * Ключевой трюк луча: обёртка translate(100 100) + геометрия от (0,0),
 * вращение вокруг собственного origin (0,0) = центр радара.
 * Иначе framer-motion вращает вокруг центра bounding-box луча — «хаос».
 *
 * Интерактивность: при наведении на ось (линия, вершина или метка) ось
 * подсвечивается, а в window уходит CustomEvent 'radar-axis-hover'
 * с detail = индекс оси (или null при уходе курсора) — легенда на главной
 * слушает его и подсвечивает связанную строку синхронно.
 */
const AXES = [
  { label: "Научная", angle: 0 },
  { label: "Техническая", angle: 90 },
  { label: "Организационная", angle: 180 },
  { label: "Производственная", angle: 270 },
];

const AXIS_HOVER_EVENT = "radar-axis-hover";

export default function LivingRadar({ className = "" }: { className?: string }) {
  const cx = 100;
  const cy = 100;
  const r = 72;

  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);
  const hoveredRef = useRef<number | null>(null);

  /** Устанавливает hover-ось и шлёт событие легенде только при реальной смене. */
  const setHover = (i: number | null) => {
    if (hoveredRef.current === i) return;
    hoveredRef.current = i;
    setHoveredAxis(i);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AXIS_HOVER_EVENT, { detail: i }));
    }
  };

  // Симметричный многоугольник: все вершины на одинаковом расстоянии (0.82*r)
  const dist = r * 0.82;
  const points = AXES.map((axis) => {
    const angle = (axis.angle - 90) * (Math.PI / 180);
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Конец сектора луча: 45° вниз от оси +x (по часовой стрелке в экранных координатах)
  const sweepEndX = r * Math.cos(Math.PI / 4);
  const sweepEndY = r * Math.sin(Math.PI / 4);

  return (
    <div className={`relative ${className}`} onMouseLeave={() => setHover(null)}>
      <svg viewBox="0 0 200 200" className="aspect-square w-full">
        {/* Кольца */}
        {[0.33, 0.66, 1].map((scale) => (
          <circle
            key={scale}
            cx={cx}
            cy={cy}
            r={r * scale}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.15"
          />
        ))}

        {/* Оси: невидимая широкая зона наведения + видимая линия с подсветкой */}
        {AXES.map((axis, i) => {
          const angle = (axis.angle - 90) * (Math.PI / 180);
          const ex = cx + Math.cos(angle) * r;
          const ey = cy + Math.sin(angle) * r;
          const active = hoveredAxis === i;
          return (
            <g key={i}>
              <line
                x1={cx}
                y1={cy}
                x2={ex}
                y2={ey}
                stroke="transparent"
                strokeWidth="14"
                className="cursor-pointer"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <motion.line
                x1={cx}
                y1={cy}
                x2={ex}
                y2={ey}
                stroke="currentColor"
                strokeLinecap="round"
                className="cursor-pointer"
                animate={{
                  opacity: active ? 0.95 : 0.15,
                  strokeWidth: active ? 1.8 : 0.5,
                }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}

        {/* Многоугольник (симметричный, дышащий) */}
        <motion.polygon
          points={polygonPoints}
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Точки вершин (подсвечиваются вместе с осью) */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            fill="currentColor"
            className="cursor-pointer"
            animate={{ r: hoveredAxis === i ? 4.2 : 3 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}

        {/* Луч-сканер: центр радара в (0,0) через translate, вращение вокруг (0,0) */}
        <defs>
          <linearGradient id="radar-sweep" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${cx} ${cy})`}>
          <motion.g
            style={{ originX: 0, originY: 0 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          >
            {/* Сектор-заливка (широкий конец — внешний край, 45° по часовой стрелке) */}
            <path
              d={`M 0 0 L ${r} 0 A ${r} ${r} 0 0 1 ${sweepEndX} ${sweepEndY} Z`}
              fill="url(#radar-sweep)"
              opacity="0.6"
            />
            {/* Сам луч (линия от центра к краю) */}
            <line
              x1={0}
              y1={0}
              x2={r}
              y2={0}
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.5"
            />
          </motion.g>
        </g>

        {/* Центральная точка */}
        <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
      </svg>

      {/* Метки осей — в паддинг-желобе контейнера (не пересекаются с кольцами) */}
      <span
        onMouseEnter={() => setHover(0)}
        onMouseLeave={() => setHover(null)}
        className={`absolute left-1/2 top-0 -translate-x-1/2 cursor-pointer whitespace-nowrap font-mono text-[12px] font-semibold transition-all duration-200 ${
          hoveredAxis === 0
            ? "opacity-100 drop-shadow-[0_0_6px_currentColor]"
            : "opacity-60"
        }`}
      >
        {AXES[0].label}
      </span>
      <span
        onMouseEnter={() => setHover(1)}
        onMouseLeave={() => setHover(null)}
        className={`absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer whitespace-nowrap text-right font-mono text-[12px] font-semibold transition-all duration-200 ${
          hoveredAxis === 1
            ? "opacity-100 drop-shadow-[0_0_6px_currentColor]"
            : "opacity-60"
        }`}
      >
        {AXES[1].label}
      </span>
      <span
        onMouseEnter={() => setHover(2)}
        onMouseLeave={() => setHover(null)}
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer whitespace-nowrap font-mono text-[12px] font-semibold transition-all duration-200 ${
          hoveredAxis === 2
            ? "opacity-100 drop-shadow-[0_0_6px_currentColor]"
            : "opacity-60"
        }`}
      >
        {AXES[2].label}
      </span>
      <span
        onMouseEnter={() => setHover(3)}
        onMouseLeave={() => setHover(null)}
        className={`absolute -left-6 top-1/2 -translate-y-1/2 cursor-pointer whitespace-nowrap font-mono text-[12px] font-semibold transition-all duration-200 ${
          hoveredAxis === 3
            ? "opacity-100 drop-shadow-[0_0_6px_currentColor]"
            : "opacity-60"
        }`}
      >
        {AXES[3].label}
      </span>
    </div>
  );
}
