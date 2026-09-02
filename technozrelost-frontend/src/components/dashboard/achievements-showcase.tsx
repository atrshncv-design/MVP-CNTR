"use client";

/**
 * Витрина достижений (тикет 03, спека §4.6): «Мои достижения» в профиле.
 * Сетка медалей (Medal из тикета 04), фильтры по группам, прогресс
 * ступеней («5/10 документов — осталось 5»), история начислений.
 */

import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

import { Medal } from "@/components/achievements/medal";
import { CLIENT_API_BASE } from "@/lib/public-api";


const GROUP_LABELS: Record<string, string> = {
  ugt: "УГТ",
  documents: "Документы",
  project: "Проект",
  quality: "Качество",
  sector: "Отрасль",
  role: "Роль",
  member: "Участник",
  organization: "Организация",
  secret: "Секретные",
};

interface AchievementItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  group: string;
  rarity: string;
  sector_slug: string | null;
  threshold: number | null;
  ugt_level: number | null;
  secret: boolean;
  sort_order: number;
  icon_key: string;
}

interface UserAchievementOut {
  achievement: AchievementItem;
  times: number;
  awarded_at: string;
  project_id: number | null;
  project_name: string | null;
  progress: { current_count: number; next_threshold: number } | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AchievementsShowcase() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [items, setItems] = useState<UserAchievementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<string>("all");

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${CLIENT_API_BASE}/api/v1/achievements/mine`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить достижения");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    if (group === "all") return items;
    return items.filter((i) => i.achievement.group === group);
  }, [items, group]);

  const progressRows = useMemo(
    () => items.filter((i) => i.progress !== null),
    [items],
  );

  if (loading) {
    return (
      <div className="tz-card p-6" aria-busy="true">
        <div className="h-5 w-48 animate-pulse rounded bg-tz-border" />
        <div className="mt-4 grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-full bg-tz-border"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tz-card p-6 text-tz-danger">
        Не удалось загрузить достижения: {error}
      </div>
    );
  }

  return (
    <section className="tz-card p-6" aria-label="Мои достижения">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-tz-fg">Мои достижения</h2>
        <span className="text-sm text-tz-muted">
          {items.length > 0 ? `${items.length} медал${items.length === 1 ? "ь" : "и"}` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-tz-muted">
          Пока нет достижений. Медали начисляются автоматически за подтверждённые
          события: принятые документы и переходы проекта по уровням УГТ.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setGroup("all")}
              className={`tz-btn tz-btn-sm ${group === "all" ? "tz-btn-primary" : "tz-btn-secondary"}`}
            >
              Все
            </button>
            {Object.entries(GROUP_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGroup(key)}
                className={`tz-btn tz-btn-sm ${group === key ? "tz-btn-primary" : "tz-btn-secondary"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {progressRows.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="text-sm font-medium text-tz-fg">Прогресс до следующей ступени</h3>
              {progressRows.map((row) => {
                const { current_count, next_threshold } = row.progress!;
                const percent = Math.min(
                  100,
                  Math.round((current_count / next_threshold) * 100),
                );
                return (
                  <div key={`${row.achievement.slug}-progress`} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-sm text-tz-secondary">
                      {row.achievement.title}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-tz-border">
                      <div
                        className="h-full rounded-full bg-tz-accent"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-xs text-tz-muted">
                      {current_count}/{next_threshold} — осталось {next_threshold - current_count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="mt-4 text-sm text-tz-muted">В этой группе пока нет медалей.</p>
          ) : (
            <div className="mt-5 grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8">
              {filtered.map((row) => (
                <div
                  key={row.achievement.slug}
                  title={`${row.achievement.title} — ${row.achievement.description}`}
                  className="flex flex-col items-center gap-1 text-center"
                >
                  <Medal
                    slug={row.achievement.icon_key}
                    size={64}
                    rarity={row.achievement.rarity as "common" | "epic" | "legendary" | "secret"}
                    state={row.achievement.secret ? "secret" : "unlocked"}
                    animate
                    label={row.achievement.title}
                  />
                  <span className="line-clamp-2 text-[11px] leading-tight text-tz-secondary">
                    {row.achievement.title}
                  </span>
                  {row.times > 1 && (
                    <span className="font-mono text-[10px] text-tz-muted">
                      ×{row.times}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 border-t border-tz-border pt-4">
            <h3 className="text-sm font-medium text-tz-fg">История начислений</h3>
            <ul className="mt-3 space-y-2">
              {items.slice(0, 10).map((row) => (
                <li key={`${row.achievement.slug}-${row.awarded_at}`} className="flex items-center gap-3 text-sm">
                  <Medal
                    slug={row.achievement.icon_key}
                    size={40}
                    rarity={row.achievement.rarity as "common" | "epic" | "legendary" | "secret"}
                    state={row.achievement.secret ? "secret" : "unlocked"}
                    label={row.achievement.title}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-tz-fg">{row.achievement.title}</p>
                    <p className="truncate text-xs text-tz-muted">
                      {row.project_name ?? "Платформа"} · {formatDate(row.awarded_at)}
                      {row.times > 1 ? ` · ×${row.times}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
