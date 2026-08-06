import Link from "next/link";
import { MapPin } from "lucide-react";
import { PUBLIC_FOOTER_COLUMNS } from "@/components/nav-task-list";

/**
 * T-002. Публичный футер (Design.md §11.1/§12): служебные ссылки,
 * реестры, методология/УГТ и сведения о Центре. Серверный компонент —
 * статичен, стабилен при loading/error дочерних страниц.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-subtle bg-surface">
      <div className="mx-auto max-w-[1280px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Identity */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-strong text-accent-contrast"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                  <path d="M12 1 14.2 9.8 23 12 14.2 14.2 12 23 9.8 14.2 1 12 9.8 9.8Z" />
                </svg>
              </span>
              <span className="flex flex-col leading-tight">
                <span className="text-small font-semibold text-primary">
                  ЦНТР Удмуртии
                </span>
                <span className="text-meta text-muted">
                  Центр научно-технологического развития
                </span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-small leading-relaxed text-secondary">
              Единая цифровая среда, где наука, промышленность и институты
              развития ведут технологию от идеи к серийному производству.
            </p>
            <p className="mt-4 flex items-start gap-2 text-small text-secondary">
              <MapPin
                className="mt-0.5 h-4 w-4 shrink-0 text-muted"
                aria-hidden
              />
              <span>
                Удмуртская Республика, г. Ижевск.
                <br />
                Официальные контакты — на странице{" "}
                <Link
                  href="/about"
                  className="text-link underline-offset-4 hover:underline"
                >
                  «О Центре»
                </Link>
                .
              </span>
            </p>
          </div>

          {/* Служебные колонки */}
          {PUBLIC_FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-meta font-medium uppercase tracking-wide text-muted">
                {column.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-6 items-start text-small text-secondary underline-offset-4 transition-colors hover:text-primary hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border-subtle pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-meta text-muted">
            © {year} Центр научно-технологического развития Удмуртской
            Республики
          </p>
          <p className="text-meta text-muted">
            Готовность технологий — по ГОСТ Р 58048-2017 · уровни УГТ 1–9
          </p>
        </div>
      </div>
    </footer>
  );
}
