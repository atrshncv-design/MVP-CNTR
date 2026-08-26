"use client";

/**
 * «Достижения команды» в карточке проекта (тикет 03, спека §4.6):
 * командные медали проекта из GET /projects/{id}/achievements.
 */

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { Medal } from "@/components/achievements/medal";
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


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

interface ProjectAchievementOut {
  achievement: AchievementItem;
  awarded_at: string;
}

export default function ProjectAchievements({ projectId }: { projectId: number }) {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [items, setItems] = useState<ProjectAchievementOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(
          `${API_URL}/api/v1/projects/${projectId}/achievements`,
          { headers, cache: "no-store" },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setItems(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить достижения");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId, token]);

  if (loading) {
    return (
      <div className="flex items-center gap-3" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="size-14 animate-pulse rounded-full bg-tz-border"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-tz-danger">Достижения недоступны: {error}</p>;
  }

  return (
    <section className="mt-6" aria-label="Достижения команды">
      <h2 className="mb-3 text-base font-semibold text-tz-fg">Достижения команды</h2>
      {items.length === 0 ? (
        <p className="text-sm text-tz-muted">
          У команды пока нет достижений. Медали появятся автоматически при
          подтверждении уровней УГТ и принятии документов.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((row) => (
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
              <span className="line-clamp-2 max-w-20 text-[11px] leading-tight text-tz-secondary">
                {row.achievement.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
