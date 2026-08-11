import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Поддерживаемые браузеры — Технозрелость",
  description:
    "Browser matrix платформы «Технозрелость»: поддерживаемые браузеры и версии для работы с сервисом.",
};

const BROWSER_MATRIX: { name: string; versions: string; notes: string }[] = [
  { name: "Google Chrome", versions: "109+ (latest-2)", notes: "Основной целевой браузер" },
  { name: "Microsoft Edge", versions: "109+ (latest-2)", notes: "Chromium-ядро, тот же уровень поддержки" },
  { name: "Mozilla Firefox", versions: "102+ (актуальная ESR и новее)", notes: "Проверяется вручную перед релизом" },
  { name: "Apple Safari", versions: "16+ (актуальная и предыдущая)", notes: "Проверяется вручную перед релизом" },
];

export default function BrowserSupportPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-tz-bg px-5 py-12 sm:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-tz-muted">
        Browser matrix
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-tz-fg">
        Поддерживаемые браузеры
      </h1>
      <p className="mt-3 leading-relaxed text-tz-secondary">
        Платформа «Технозрелость» построена на React 19 и Next.js 16 и требует
        современный браузер. Несовместимый браузер получает понятное сообщение
        с этой информацией автоматически.
      </p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-tz-border bg-tz-surface">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="border-b border-tz-border bg-tz-bg text-xs uppercase tracking-wider text-tz-muted">
              <th scope="col" className="px-4 py-3 font-semibold">Браузер</th>
              <th scope="col" className="px-4 py-3 font-semibold">Версии</th>
              <th scope="col" className="px-4 py-3 font-semibold">Примечание</th>
            </tr>
          </thead>
          <tbody>
            {BROWSER_MATRIX.map((row) => (
              <tr key={row.name} className="border-b border-tz-border last:border-0">
                <td className="px-4 py-3 font-semibold text-tz-fg">{row.name}</td>
                <td className="px-4 py-3 text-tz-secondary">{row.versions}</td>
                <td className="px-4 py-3 text-tz-muted">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
