/**
 * T-008. Бейдж контролируемой UI-фикстуры (DATA-CONTRACTS §5, spec §5).
 *
 * Обязательная видимая маркировка всех тестовых примеров в авторизованных
 * кабинетах: «Тестовый пример для проверки интерфейса». Фикстуры никогда
 * не попадают в публичные реестры — бейдж предупреждает, что данные
 * не являются реальной технологией/запросом/пилотом.
 */

import { FlaskConical } from "lucide-react";
import { FIXTURE_LABEL } from "@/lib/types";

export interface FixtureBadgeProps {
  /** Текст метки (по умолчанию — канонический FIXTURE_LABEL). */
  label?: string;
  /** Дополнительные классы. */
  className?: string;
}

export function FixtureBadge({
  label = FIXTURE_LABEL,
  className = "",
}: FixtureBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-control border border-dashed border-strong bg-status-info-soft px-2 py-0.5 text-meta font-medium leading-tight text-status-info ${className}`}
      title={label}
    >
      <FlaskConical className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
