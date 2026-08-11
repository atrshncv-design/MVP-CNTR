"use client";

import { useEffect, useState } from "react";

/**
 * RadarLegend — легенда «Радар готовности проекта» на главной.
 * Слушает CustomEvent 'radar-axis-hover' от LivingRadar и подсвечивает
 * строку, соответствующую наведённой оси (detail = индекс оси | null).
 */
const AXIS_ITEMS = [
  { label: "Научная", text: "публикации и патентные исследования" },
  { label: "Техническая", text: "прототипы и результаты испытаний" },
  { label: "Организационная", text: "команда, процессы и документация" },
  { label: "Производственная", text: "масштабирование и серийный выпуск" },
];

export default function RadarLegend() {
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const onHover = (e: Event) => {
      const detail = (e as CustomEvent<number | null>).detail;
      setHovered(detail ?? null);
    };
    window.addEventListener("radar-axis-hover", onHover);
    return () => window.removeEventListener("radar-axis-hover", onHover);
  }, []);

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
      {AXIS_ITEMS.map((item, i) => {
        const active = hovered === i;
        return (
          <div
            key={item.label}
            className={`-mx-2 flex items-baseline gap-2 rounded-lg px-2 py-1 transition-all duration-200 ${
              active ? "bg-tz-accent/10" : ""
            }`}
          >
            <span
              className={`font-semibold transition-colors duration-200 ${
                active ? "text-tz-accent" : "text-tz-fg"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`text-[13px] leading-snug transition-colors duration-200 ${
                active ? "text-tz-fg" : "text-tz-secondary"
              }`}
            >
              — {item.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
