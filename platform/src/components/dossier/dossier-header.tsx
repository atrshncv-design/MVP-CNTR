/**
 * T-007. Заголовок досье технологии: статус проверки/публикации, УГТ,
 * организация, маркировка фикстур. Общий для трёх режимов.
 */

import { Building2 } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { SectionMark } from "@/components/udmurt/section-mark";
import { isFixtureRecord } from "@/lib/types";

export interface DossierHeaderProps {
  dossier: TechnologyDossier;
  /** Заголовок секции (например, «Технология»). */
  eyebrow?: string;
  /** Показать маркировку фикстур (кабинеты — да, публичный — нет). */
  showFixtureBadge?: boolean;
}

export function DossierHeader({
  dossier,
  eyebrow = "Технология",
  showFixtureBadge = true,
}: DossierHeaderProps) {
  return (
    <header className="max-w-4xl">
      <SectionMark label={eyebrow} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={dossier.visibility.publicationStatus} />
        <UgtBadge level={dossier.ugt.currentLevel} />
        {showFixtureBadge && isFixtureRecord(dossier) ? <FixtureBadge /> : null}
      </div>
      <h1 className="mt-3 text-h2 font-semibold tracking-tight text-primary">
        {dossier.title}
      </h1>
      <p className="mt-2 flex items-center gap-1.5 text-small text-secondary">
        <Building2 className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        {dossier.organization.name}
        {dossier.organization.region ? ` · ${dossier.organization.region}` : ""}
      </p>
    </header>
  );
}
