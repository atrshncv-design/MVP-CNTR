"use client";

import { motion } from "framer-motion";

/**
 * LivingRadar — анимированный «дышащий» радар.
 * Симметричный 4-осевой радар с вращающимся по часовой стрелке сканером.
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

  // Метки на осях (снаружи круга)
  const labelDist = r + 16;

  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full">
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

        {/* Вращающийся луч-сканер: закреплён в центре, вращается по часовой стрелке */}
        <defs>
          <linearGradient id="radar-sweep" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.g
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {/* Сектор-заливка (широкий конец — внешний край) */}
          <path
            d={`M ${cx} ${cy}
                L ${cx + r} ${cy}
                A ${r} ${r} 0 0 0 ${cx + r * Math.cos(-Math.PI / 4)} ${cy + r * Math.sin(-Math.PI / 4)}
                Z`}
            fill="url(#radar-sweep)"
            opacity="0.6"
          />
          {/* Сам луч (линия от центра к краю) */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + r}
            y2={cy}
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.5"
          />
        </motion.g>

        {/* Центральная точка */}
        <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />

        {/* Метки осей */}
        {AXES.map((axis, i) => {
          const angle = (axis.angle - 90) * (Math.PI / 180);
          const lx = cx + Math.cos(angle) * labelDist;
          const ly = cy + Math.sin(angle) * labelDist;
          return (
            <text
              key={i}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-current"
              style={{
                fontSize: "8px",
                fontWeight: 600,
                opacity: 0.5,
                fontFamily: "var(--font-mono)",
              }}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
