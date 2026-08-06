import type { Metadata } from "next";
import "@fontsource-variable/golos-text";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default:
      "Центр научно-технологического развития Удмуртской Республики",
    template: "%s — ЦНТР Удмуртской Республики",
  },
  description:
    "Цифровая платформа Центра научно-технологического развития Удмуртской Республики: оценка готовности технологий, реестры, заявки и поддержка.",
};

/**
 * Стартовый скрипт без FOUC: устанавливает data-theme на <html> ДО первого
 * рендера. Приоритет: сохранённый выбор (localStorage "nfr-theme"), иначе
 * prefers-color-scheme, иначе светлая. Значения: light|dark|udmurt.
 */
const themeInitScript = `(function(){try{var k="nfr-theme";var t=localStorage.getItem(k);var theme="light";if(t==="light"||t==="dark"||t==="udmurt"){theme=t}else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches){theme="dark"}document.documentElement.setAttribute("data-theme",theme)}catch(e){document.documentElement.setAttribute("data-theme","light")}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
