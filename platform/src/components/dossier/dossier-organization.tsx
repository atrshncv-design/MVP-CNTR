/**
 * T-007. Организация и возможности (Design.md §5.2, секция 7).
 */

import { Building2, Users } from "lucide-react";
import type { TechnologyDossier } from "@/lib/types";

export interface DossierOrganizationProps {
  dossier: TechnologyDossier;
}

export function DossierOrganization({ dossier }: DossierOrganizationProps) {
  return (
    <section
      aria-labelledby="organization-heading"
      className="rounded-panel border border-subtle bg-surface p-6"
    >
      <h2
        id="organization-heading"
        className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
      >
        <Building2 className="h-5 w-5 text-accent" aria-hidden />
        Организация
      </h2>
      <div className="mt-3">
        <p className="text-small font-semibold text-primary">
          {dossier.organization.name}
        </p>
        <p className="mt-1 text-small text-secondary">
          {dossier.organization.role}
          {dossier.organization.region
            ? ` · ${dossier.organization.region}`
            : ""}
        </p>
      </div>

      {dossier.teamAndPartners ? (
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-meta font-medium text-muted">
            <Users className="h-3.5 w-3.5" aria-hidden />
            Команда и партнёры
          </p>
          <ul className="mt-2 space-y-1.5">
            {dossier.teamAndPartners.map((party) => (
              <li key={party.name} className="text-small text-secondary">
                {party.name}
                {party.role ? ` — ${party.role}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-meta text-muted">
          Команда и партнёры не раскрыты.
        </p>
      )}
    </section>
  );
}
