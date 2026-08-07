import Link from "next/link";

const SECTIONS = [
  { href: "/about", label: "О центре" },
  { href: "/methodology", label: "Методика оценки" },
  { href: "/levels", label: "Уровни УГТ" },
  { href: "/customers", label: "Заказчикам" },
  { href: "/performers", label: "Исполнителям" },
  { href: "/roadmap", label: "Дорожная карта" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-tz-border/70 bg-tz-surface/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg tz-grad-bg font-mono text-xs font-bold text-white">
              Т
            </span>
            <span className="font-display text-sm font-bold text-tz-fg">Технозрелость</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-tz-muted">
            Цифровая платформа трансфера технологий Центра технологического развития
            Удмуртской Республики.
          </p>
        </div>

        <div>
          <p className="tz-eyebrow">Разделы</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="text-[13px] text-tz-secondary transition-colors hover:text-tz-fg"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="tz-eyebrow">Платформа</p>
          <ul className="mt-3 space-y-2 text-[13px] text-tz-secondary">
            <li>
              <Link href="/register" className="transition-colors hover:text-tz-fg">
                Регистрация участника
              </Link>
            </li>
            <li>
              <Link href="/login" className="transition-colors hover:text-tz-fg">
                Вход в личный кабинет
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-tz-border/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-[12px] text-tz-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© 2026 Центр технологического развития Удмуртской Республики</span>
        </div>
      </div>
    </footer>
  );
}
