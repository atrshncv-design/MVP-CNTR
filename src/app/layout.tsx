import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Технозрелость — цифровая платформа ЦНТР",
  description:
    "Управление технологическими проектами и оценка УГТ по ГОСТ Р 58048-2017.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
