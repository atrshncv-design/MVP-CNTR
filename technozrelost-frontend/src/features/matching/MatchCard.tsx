"use client";

import * as React from "react";
import { Building2, MapPin, Sparkles } from "lucide-react";

import type { MatchCandidate } from "@/lib/types";

export function MatchCard({
  candidate,
  rank,
  onPropose,
}: {
  candidate: MatchCandidate;
  rank: number;
  onPropose: (c: MatchCandidate) => void;
}) {
  // score не показываем числом — только ранжирование и причины (G28, G44)
  const competencies = candidate.competencies ?? [];
  const reason = candidate.reason ?? "соответствие по реестру";

  return (
    <div className="tz-card flex h-full flex-col p-5" data-testid="match-card" data-rank={rank}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="tz-badge tz-badge-neutral font-mono text-xs">#{rank} подбор</span>
        <span className="tz-badge tz-badge-accent flex items-center gap-1 text-xs">
          <Sparkles size={12} aria-hidden="true" />
          верифицировано
        </span>
      </div>

      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-tz-accent-soft">
          <Building2 size={18} className="text-tz-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-semibold text-tz-fg">{candidate.name || "—"}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-tz-muted">
            {candidate.org_type ? (
              <span className="tz-badge tz-badge-neutral text-[11px]">{candidate.org_type}</span>
            ) : null}
            {candidate.region ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {candidate.region}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {competencies.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {competencies.slice(0, 5).map((c) => (
            <span key={c} className="tz-badge tz-badge-neutral text-[11px]">
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 rounded-xl border border-tz-border bg-tz-surface-2 p-3">
        <p className="text-xs font-semibold text-tz-secondary">Почему полезно</p>
        <p className="mt-1 text-sm text-tz-fg">{reason}</p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPropose(candidate)}
          className="tz-btn tz-btn-primary flex-1"
          data-testid="propose-btn"
        >
          Предложить через ЦНТР
        </button>
      </div>

      <p className="mt-2 text-[11px] text-tz-muted">
        Карточки — только верифицированные организации/исполнители платформы, не внешние НИОКТР
      </p>
    </div>
  );
}
