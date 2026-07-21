import { Link } from 'react-router-dom';

const footerNav = [
  {
    title: 'Навигация',
    links: [
      { label: 'Главная', path: '/' },
      { label: 'Уровни УГТ', path: '/levels' },
      { label: 'Дорожная карта', path: '/roadmap' },
      { label: 'Оценка проекта', path: '/assessment' },
      { label: 'Методология', path: '/methodology' },
    ],
  },
  {
    title: 'Ресурсы',
    links: [
      { label: 'ГОСТ Р 58048-2017', path: '/methodology' },
      { label: 'PDF-документ', path: '/methodology' },
      { label: 'История версий', path: '/methodology' },
    ],
  },
  {
    title: 'Связь',
    links: [
      { label: 'Email', path: '#' },
      { label: 'GitHub', path: '#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]" style={{ background: '#0F172A' }}>
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 pt-16 sm:grid-cols-2 lg:grid-cols-5">
          {/* Logo Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block">
              <span className="font-mono text-lg font-bold text-white">
                ТЕХНОЗРЕЛОСТЬ
              </span>
            </Link>
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Платформа оценки технологий по ГОСТ Р 58048-2017. Интерактивный дашборд для визуализации уровней готовности технологий УГТ 1-9.
            </p>
          </div>

          {/* Nav Columns */}
          {footerNav.map((col) => (
            <div key={col.title}>
              <h4
                className="mb-4 text-xs font-medium uppercase tracking-[0.05em]"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.path === '#' ? (
                      <span
                        className="cursor-default text-sm transition-colors duration-200"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {link.label}
                      </span>
                    ) : (
                      <Link
                        to={link.path}
                        className="text-sm transition-colors duration-200 hover:text-white"
                        style={{ color: 'rgba(255,255,255,0.6)' }}
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="my-12 h-px w-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <div className="pb-8 text-center">
          <p
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            &copy; 2025 ТЕХНОЗРЕЛОСТЬ &middot; На основе ГОСТ Р 58048-2017
          </p>
        </div>
      </div>
    </footer>
  );
}
