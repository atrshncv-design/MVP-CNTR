"use client";

import * as React from "react";

import type { RegistryView } from "./RegistryViewToggle";

/**
 * Хук хранения вида реестра карточки↔таблица (P3, R02).
 * Почему per-registry: пользователь может держать проекты в таблице,
 * а организации в карточках — изоляция ключом `tz:registry:view:{key}`.
 * Хранится в localStorage без бэка, дефолт карточки (совместимость с P2).
 */
const PREFIX = "tz:registry:view:";

function storageKey(registryKey: string): string {
  return `${PREFIX}${registryKey}`;
}

export function useRegistryView(
  registryKey: string,
  defaultView: RegistryView = "cards",
): [RegistryView, (v: RegistryView) => void] {
  const [view, setViewRaw] = React.useState<RegistryView>(defaultView);

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(registryKey));
      if (raw === "cards" || raw === "table") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация из localStorage при монтировании/смене ключа
        setViewRaw(raw);
      }
    } catch {
      // localStorage недоступен (SSR/private) — игнорируем
    }
  }, [registryKey]);

  const setView = React.useCallback(
    (v: RegistryView) => {
      setViewRaw(v);
      try {
        window.localStorage.setItem(storageKey(registryKey), v);
      } catch {
        // ignore
      }
    },
    [registryKey],
  );

  return [view, setView] as const;
}
