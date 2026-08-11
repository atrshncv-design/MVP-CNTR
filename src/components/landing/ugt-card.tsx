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
      <h3 className="tz-card-title mt-3 leading-snug">
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

/** Короткие названия уровней для полосы-градиента (секция на главной). */
const UGT_STRIP_SHORT_NAMES: Record<number, string> = {
  1: "Базовые принципы",
  2: "Концепция",
  3: "Критические функции",
  4: "Лаб. проверка",
  5: "Верификация",
  6: "Прототип",
  7: "Полевые испытания",
  8: "Квалификация",
  9: "Эксплуатация",
};

/** Горизонтальная полоса-градиент УГТ 1–9: сегмент = уровень, клик ведёт на /levels/N. */
export function UGTScaleStrip() {
  return (
    <div className="grid grid-cols-9 gap-1.5 sm:gap-2">
      {UGT_LEVELS.map((lvl) => (
        <Link
          key={lvl.id}
          href={`/levels/${lvl.id}`}
          aria-label={`УГТ ${lvl.id}. ${lvl.name}. ${lvl.short}`}
          className="group relative flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition-[filter,box-shadow] hover:shadow-md hover:brightness-110 sm:min-h-16"
          style={{ background: `var(--tz-ugt-${lvl.id})` }}
        >
          <span className="font-mono text-sm font-bold leading-none text-white drop-shadow-sm">
            {lvl.id}
          </span>
          <span className="mt-1 hidden text-[9px] font-medium leading-tight text-white/90 sm:block">
            {UGT_STRIP_SHORT_NAMES[lvl.id]}
          </span>
          {/* Tooltip: полное название + короткое описание уровня */}
          <span
            className={`pointer-events-none invisible absolute bottom-full z-10 mb-2 w-52 rounded-xl border border-tz-border bg-tz-surface p-3 text-left opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 ${
              lvl.id === 1 ? "left-0" : lvl.id === 9 ? "right-0" : "left-1/2 -translate-x-1/2"
            }`}
          >
            <span className="block text-xs font-semibold text-tz-fg">{lvl.name}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-tz-secondary">
              {lvl.short}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Фазы УГТ для группировки */
const UGT_PHASES = [
  {
    title: "Низкие УГТ",
    subtitle: "Исследование и концепция",
    range: [1, 2, 3],
    description: "Фундаментальные исследования, концепция технологии и подтверждение критических функций",
  },
  {
    title: "Средние УГТ",
    subtitle: "Лаборатория и прототип",
    range: [4, 5, 6],
    description: "Лабораторная проверка, стендовые испытания и создание системного прототипа",
  },
  {
    title: "Высокие УГТ",
    subtitle: "Внедрение и эксплуатация",
    range: [7, 8, 9],
    description: "Полевые испытания, квалификация системы и успешная промышленная эксплуатация",
  },
];

/** УГТ-шкала с группировкой по фазам и карточками уровней (секция на главной). */
export function UGTPhasedScale() {
  return (
    <div className="space-y-8">
      {UGT_PHASES.map((phase) => {
        const levels = UGT_LEVELS.filter((lvl) => phase.range.includes(lvl.id));
        return (
          <div key={phase.title}>
            <div className="mb-4">
              <h3 className="tz-card-title">{phase.title}</h3>
              <p className="mt-1 text-sm text-tz-secondary">{phase.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {levels.map((lvl) => (
                <Link
                  key={lvl.id}
                  href={`/levels/${lvl.id}`}
                  title={lvl.name}
                  className="group rounded-xl border p-4 transition-all hover:shadow-md"
                  style={{
                    borderColor: `${ugtTone(lvl.id)}44`,
                    background: "var(--color-tz-ugt-soft)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold"
                      style={{
                        background: ugtTone(lvl.id),
                        color: "white",
                      }}
                    >
                      {lvl.id}
                    </span>
                    <ChevronRight className="h-4 w-4 text-tz-muted transition-transform group-hover:translate-x-0.5 group-hover:text-tz-fg" />
                  </div>
                  <h4 className="mt-3 font-semibold text-tz-fg">{lvl.name}</h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-tz-secondary">
                    {lvl.short}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
