import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UGT_LEVELS, type UGTLevel } from "@/lib/ugt-data";

/** Правильное склонение слова «критерий» по числу. */
export function pluralCriteria(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "критерий";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "критерия";
  return "критериев";
}

/** Правильное склонение слова «документ» по числу. */
export function pluralDocs(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "документ";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "документа";
  return "документов";
}

/** Тёплая УГТ-шкала дизайн-системы 2.0: 1–3 низкие, 4–6 средние, 7–9 высокие. */
export function ugtTone(level: number): string {
  if (level <= 3) return "var(--color-tz-ugt-low)";
  if (level <= 6) return "var(--color-tz-ugt-mid)";
  return "var(--color-tz-ugt-high)";
}

export function ugtToneClass(level: number): string {
  if (level <= 3) return "text-tz-ugt-low";
  if (level <= 6) return "text-tz-ugt-mid";
  return "text-tz-ugt-high";
}

export function UGTBadge({ level, size = "md" }: { level: number; size?: "md" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-bold ${size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      style={{
        color: ugtTone(level),
        background: "var(--color-tz-ugt-soft)",
        border: `1px solid ${ugtTone(level)}55`,
      }}
    >
      УГТ {level}
    </span>
  );
}

/** Компактная карточка уровня (сетка /levels, блок шкалы на главной). */
export function UGTLevelCard({ level }: { level: UGTLevel }) {
  return (
    <Link
      href={`/levels/${level.id}`}
      className="tz-card tz-card-hover group block p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <UGTBadge level={level.id} />
        <ChevronRight className="h-4 w-4 text-tz-muted transition-transform group-hover:translate-x-0.5 group-hover:text-tz-fg" />
      </div>
      <h3 className="mt-3 font-display text-[15px] font-bold leading-snug text-tz-fg">
        {level.name}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-tz-secondary">
        {level.short}
      </p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-widest tz-eyebrow">
        {level.requirements.length}{" "}
        {pluralCriteria(level.requirements.length)}
      </p>
    </Link>
  );
}

/** Горизонтальная тёплая шкала 1–9 (секция на главной). */
export function UGTScaleStrip() {
  return (
    <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
      {UGT_LEVELS.map((lvl) => (
        <Link
          key={lvl.id}
          href={`/levels/${lvl.id}`}
          title={lvl.name}
          className="group flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors"
          style={{
            borderColor: `${ugtTone(lvl.id)}44`,
            background: "var(--color-tz-ugt-soft)",
          }}
        >
          <span
            className="h-1.5 w-full rounded-full"
            style={{ background: ugtTone(lvl.id) }}
          />
          <span
            className="font-mono text-[11px] font-bold"
            style={{ color: ugtTone(lvl.id) }}
          >
            {lvl.id}
          </span>
        </Link>
      ))}
    </div>
  );
}
