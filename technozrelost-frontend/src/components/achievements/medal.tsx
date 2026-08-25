// medal.tsx — обёртка медали (тикет 04): подложка, кольцо редкости,
// состояния locked/secret, анимация появления scale+fade.
// Иконки: src/components/achievements/icons/<slug>.tsx (66 ручных SVG).
import type { ComponentType, SVGProps } from "react";

import { medalIcons } from "./icons";
import "./medals.css";

export type MedalRarity = "common" | "epic" | "legendary" | "secret";
export type MedalState = "locked" | "unlocked" | "secret";
export type MedalSize = 96 | 64 | 40;

export interface MedalProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  /** icon_key из каталога 66 медалей (slug файла иконки). */
  slug: string;
  /** Размер: 96 (витрина), 64 (профиль), 40 (история). */
  size?: MedalSize;
  /** Редкость: common — матовая подложка; epic — акцентное кольцо;
   *  legendary — золотое кольцо; secret — серебристое кольцо. */
  rarity?: MedalRarity;
  /** Состояние: unlocked — раскрыта; locked — затемнённая;
   *  secret — силуэт с «?» до раскрытия. */
  state?: MedalState;
  /** A11y-подпись (aria-label). По умолчанию — slug. */
  label?: string;
  /** Появление scale+fade (отключается prefers-reduced-motion). */
  animate?: boolean;
}

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

/** Запасной глиф, если slug неизвестен (4-лучевая звезда). */
function FallbackIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tz-secondary)"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 4.4l2 5.6 5.6 2-5.6 2-2 5.6-2-5.6-5.6-2 5.6-2z" />
    </svg>
  );
}

export function Medal({
  slug,
  size = 64,
  rarity = "common",
  state = "unlocked",
  label,
  animate = true,
  className,
  ...rest
}: MedalProps) {
  const Icon = medalIcons[slug] ?? FallbackIcon;
  const goldId = `tz-medal-gold-${slug}`;
  const ringed = rarity !== "common";
  const ringColor =
    rarity === "epic"
      ? "var(--tz-accent)"
      : rarity === "legendary"
        ? `url(#${goldId})`
        : rarity === "secret"
          ? "var(--tz-secondary)"
          : "var(--tz-border)";

  return (
    <span
      className={`tz-medal tz-medal--${state}${animate ? " tz-medal--animate" : ""}${className ? ` ${className}` : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        role="img"
        {...rest}
        aria-label={label ?? slug}
      >
        <defs>
          {rarity === "legendary" && (
            <linearGradient
              id={goldId}
              x1="0"
              y1="0"
              x2="24"
              y2="24"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="var(--medal-gold-1)" />
              <stop offset="1" stopColor="var(--medal-gold-2)" />
            </linearGradient>
          )}
        </defs>
        {/* Подложка: матовая поверхность */}
        <circle cx="12" cy="12" r="11" fill="var(--tz-surface)" />
        {/* Кольцо редкости (common — тонкий ободок) */}
        <circle
          cx="12"
          cy="12"
          r="11"
          fill="none"
          stroke={ringColor}
          strokeWidth={ringed ? 1.75 : 1}
          strokeOpacity={ringed ? 1 : 0.65}
          data-medal-ring="true"
        />
        {ringed && (
          <circle
            cx="12"
            cy="12"
            r="10.2"
            fill="none"
            stroke={ringColor}
            strokeWidth={1}
            strokeOpacity={0.35}
            data-medal-ring="true"
          />
        )}
        {/* Внутренний тонкий ободок */}
        <circle
          cx="12"
          cy="12"
          r="9.7"
          fill="none"
          stroke="var(--tz-border)"
          strokeWidth={1}
          strokeOpacity={0.35}
        />
        {/* Глиф медали */}
        <g className="tz-medal-glyph">
          <Icon />
        </g>
        {/* Secret: силуэт + «?» до раскрытия */}
        {state === "secret" && (
          <text
            x="12"
            y="12.4"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={MONO}
            fontSize="13.5"
            fontWeight="800"
            fill="var(--tz-secondary)"
            stroke="none"
            opacity="0.85"
          >
            ?
          </text>
        )}
      </svg>
    </span>
  );
}
