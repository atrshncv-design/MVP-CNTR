import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import Providers from "@/components/providers";
import { LOCALE_COOKIE, parseLocale } from "@/i18n/config";
import enMessages from "@/messages/en.json";
import ruMessages from "@/messages/ru.json";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Технозрелость — цифровая платформа ЦНТР",
  description:
    "Управление технологическими проектами и оценка УГТ по ГОСТ Р 58048-2017.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await cookies();
  const locale = parseLocale(store.get(LOCALE_COOKIE)?.value);
  const messages = locale === "en" ? enMessages : ruMessages;

  // lang="ru" — дефолт для wcag теста, фактический lang задаётся через {locale} (i18n)
  return (
    <html lang={locale} className={`${manrope.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[60] -translate-y-20 rounded bg-tz-surface px-3 py-2 font-semibold text-tz-fg shadow focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-tz-accent"
        >
          Перейти к основному содержимому
        </a>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
