"use client";

import { motion } from "framer-motion";

/**
 * LivingRadar — анимированный «дышащий» радар (D10).
 * Декоративный элемент hero лендинга: оси → заливка по 4 категориям,
 * плавно «дышит» (scale 1↔1.04), при наведении — вращение сканера.
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

  // Точки многоугольника (4 категории, асимметрично для «живого» вида)
  const points = AXES.map((_, i) => {
    const angle = (AXES[i].angle - 90) * (Math.PI / 180);
    const dist = r * (0.55 + (i % 2) * 0.2 + (i === 0 ? 0.15 : 0));
    return {
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className={`relative ${className}`}>
      <motion.svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
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

        {/* Заливка многоугольника (анимированное появление) */}
        <motion.polygon
          points={polygonPoints}
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Точки вершин */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="currentColor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.15, duration: 0.4 }}
          />
        ))}

        {/* Вращающийся сканер */}
        <motion.g
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <defs>
            <linearGradient id="radar-scan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
            </linearGradient>
          </defs>
          <path
            d={`M ${cx} ${cy} L ${cx + r} ${cy} A ${r} ${r} 0 0 1 ${
              cx + r * Math.cos(Math.PI / 4)
            } ${cy + r * Math.sin(Math.PI / 4)} Z`}
            fill="url(#radar-scan)"
          />
        </motion.g>

        {/* Центральная точка */}
        <circle cx={cx} cy={cy} r="2.5" fill="currentColor" />
      </motion.svg>
    </div>
  );
}
