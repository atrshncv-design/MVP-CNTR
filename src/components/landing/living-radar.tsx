"use client";

import { motion } from "framer-motion";

/**
 * LivingRadar — анимированный «дышащий» радар.
 * Симметричный 4-осевой радар с лучом-сканером, вращающимся по часовой стрелке.
 *
 * Ключевой трюк луча: обёртка translate(100 100) + геометрия от (0,0),
 * вращение вокруг собственного origin (0,0) = центр радара.
 * Иначе framer-motion вращает вокруг центра bounding-box луча — «хаос».
 */
const AXES = [
  { label: "Научная", angle: 0 },
  { label: "Техническая", angle: 90 },
  { label: "Организационная", angle: 180 },
  { label: "Производственная", angle: 270 },
];

export default function LivingRadar({ className = "" }: { className?: string }) {
  const cx = 100;
  const cy = 100;
  const r = 72;

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
    <div className={`relative ${className}`}>
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

        {/* Оси */}
        {AXES.map((axis, i) => {
          const angle = (axis.angle - 90) * (Math.PI / 180);
          const ex = cx + Math.cos(angle) * r;
          const ey = cy + Math.sin(angle) * r;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke="currentColor"
              strokeWidth="0.5"
              opacity="0.15"
            />
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

        {/* Точки вершин */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="currentColor" />
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
      <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[12px] font-semibold opacity-60">
        {AXES[0].label}
      </span>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-right font-mono text-[12px] font-semibold opacity-60">
        {AXES[1].label}
      </span>
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[12px] font-semibold opacity-60">
        {AXES[2].label}
      </span>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[12px] font-semibold opacity-60">
        {AXES[3].label}
      </span>
    </div>
  );
}
