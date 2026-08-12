"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Breadcrumb, { type BreadcrumbItem } from "@/components/dashboard/breadcrumb";

/** Русские названия сегментов пути для цепочки breadcrumb по умолчанию. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Рабочий стол",
  projects: "Проекты",
  project: "Проект",
  gk_customer: "Заявки",
  new: "Новая заявка",
  nioktr: "НИОКТР",
  technologies: "Реестры",
  organizations: "Организации",
  executors: "Исполнители",
  profile: "Профиль",
  "ai-assistant": "Документы",
  auditor: "Аудит",
  cntr_admin: "Администрирование",
  cntr_manager: "Управление ЦНТР",
  investor: "Инвестиции",
  rd_executor: "НИОКТР",
  regulating_organization: "Регулятор",
  scientific_org: "Наука",
  serial_manufacturer: "Производство",
};

/** Человекочитаемое название неизвестного сегмента. */
function humanize(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.replace(/[-_]+/g, " ").slice(1);
}

/** Цепочка по умолчанию: «Рабочий стол» + сегменты пути. */
function itemsFromPathname(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter((segment) => segment && segment !== "dashboard");
  if (segments.length === 0) return [{ label: "Рабочий стол" }];

  const items: BreadcrumbItem[] = [{ label: "Рабочий стол", href: "/dashboard" }];
  let acc = "/dashboard";
  segments.forEach((segment, index) => {
    acc += `/${segment}`;
    const isLast = index === segments.length - 1;
    items.push({
      label: SEGMENT_LABELS[segment] ?? humanize(segment),
      ...(isLast ? {} : { href: acc }),
    });
  });
  return items;
}

interface BreadcrumbContextValue {
  /** Переопределённая цепочка; null — использовать цепочку из pathname. */
  items: BreadcrumbItem[] | null;
  setItems: (items: BreadcrumbItem[] | null) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue>({
  items: null,
  setItems: () => {},
});

/**
 * Провайдер обязательного breadcrumb (тикет 03). Оборачивает контент
 * dashboard/layout.tsx, чтобы страницы могли переопределить цепочку через
 * useBreadcrumb, а компонент оставался единым для всех внутренних страниц.
 */
export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null);
  return (
    <BreadcrumbContext.Provider value={{ items, setItems }}>{children}</BreadcrumbContext.Provider>
  );
}

/**
 * Переопределить цепочку breadcrumb на текущей странице:
 * `useBreadcrumb([{ label: "Проекты" }, { label: "Проект N", href: "/dashboard/project/1" }])`.
 * Передайте null/[] (или просто не вызывайте хук), чтобы вернуть цепочку из pathname.
 */
export function useBreadcrumb(items: BreadcrumbItem[] | null) {
  const { setItems } = useContext(BreadcrumbContext);
  useEffect(() => {
    setItems(items);
    return () => setItems(null);
  }, [items, setItems]);
}

/** Breadcrumb dashboard/layout.tsx: переопределённая цепочка или из pathname. */
export default function DashboardBreadcrumb() {
  const pathname = usePathname();
  const { items } = useContext(BreadcrumbContext);
  const resolved = items ?? itemsFromPathname(pathname);
  return <Breadcrumb items={resolved} className="mb-6" />;
}
