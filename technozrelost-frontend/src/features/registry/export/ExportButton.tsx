"use client";

import { Download } from "lucide-react";
import { useSession } from "next-auth/react";
import * as React from "react";

/**
 * Кнопка «Экспорт XLSX» — видна только cntr_admin (тикет 01, R01).
 * Почему здесь проверка роли: критерий «кнопка видна только cntr_admin (менеджеру скрыта)».
 * Менеджер — read-only, экспорт ему не показываем. Проверка по session.user.roles,
 * fail-closed: нет роли → не показываем. Использует client-side exceljs,
 * скачивает XLSX с текущими фильтрами (те же строки что на экране) и escape =+-@.
 */

interface ExportButtonProps {
  /** Строки текущей выборки — уже отфильтрованные displayItems (фильтры из URL применены). */
  rows: unknown[];
  /** Имя файла по умолчанию: registry-{key}-{дата}.xlsx */
  filename?: string;
  /** Ключ реестра для имени файла (projects/technologies/organizations/nioktr). */
  registryKey?: string;
  /** Заголовок листа внутри XLSX. */
  sheetName?: string;
}

export function ExportButton({ rows, filename, registryKey, sheetName }: ExportButtonProps) {
  const { data: session } = useSession();
  const roles = (session?.user?.roles ?? []) as string[];
  // Экспорт только cntr_admin (R01, история 1) — менеджеру скрыт
  const isAdmin = roles.includes("cntr_admin");
  const [loading, setLoading] = React.useState(false);

  // Остальные роли (включая менеджера) не видят кнопку — fail-closed
  if (!isAdmin) return null;

  const handleExport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      // Динамический импорт, чтобы exceljs не тянулся в SSR (client-side per spec)
      const mod = await import("./exportXlsx");
      // Универсальный экспорт — сам определит тип строк (проекты/организации/НИОКТР)
      if (mod.exportGenericXlsx) {
        await mod.exportGenericXlsx(rows, {
          filename: filename ?? `${registryKey ?? "registry"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
          sheetName,
          registryKey,
        });
      } else if (mod.exportXlsx) {
        // fallback — проекты (совместимость)
        await (mod.exportXlsx as unknown as (rows: unknown[], opts?: unknown) => Promise<void>)(rows, {
          filename: filename ?? `${registryKey ?? "registry"}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        });
      }
    } catch (err) {
      console.error("Экспорт XLSX не удался", err);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading;

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      aria-label="Экспорт XLSX"
      className="tz-btn tz-btn-secondary inline-flex items-center gap-2 disabled:opacity-60"
    >
      <Download size={16} aria-hidden="true" />
      {loading ? "Экспорт…" : "Экспорт XLSX"}
    </button>
  );
}

export default ExportButton;
