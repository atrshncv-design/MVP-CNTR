/**
 * T-010. Настройки операционного контура (/operations/settings).
 * Конфигурация с сохранением в localStorage, помечена «демо»: реальная
 * конфигурация появится на этапе интеграции с бэкендом.
 */

"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

const SETTINGS_KEY = "nfr-ops-settings";

interface OpsSettings {
  reviewDeadlineDays: string;
  notifyOnSubmission: boolean;
  autoPublishAfterApprove: boolean;
}

const DEFAULTS: OpsSettings = {
  reviewDeadlineDays: "14",
  notifyOnSubmission: true,
  autoPublishAfterApprove: false,
};

const INPUT_CLASS =
  "w-full rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

export default function OperationsSettingsPage() {
  const [settings, setSettings] = useState<OpsSettings | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = window.localStorage.getItem(SETTINGS_KEY);
        if (raw) {
          setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
        } else {
          setSettings(DEFAULTS);
        }
      } catch {
        setSettings(DEFAULTS);
      }
    })();
  }, []);

  const save = () => {
    if (!settings) return;
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSavedAt(new Date().toISOString());
  };

  if (!settings) {
    return <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8">Загружаем настройки…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8">
      <header>
        <h1 className="text-h2 font-semibold tracking-tight text-primary">
          Настройки операционного контура
        </h1>
        <p className="mt-1.5 text-small text-secondary">
          Конфигурация очереди и проверок. Демо-режим: значения сохраняются
          локально в браузере; серверная конфигурация появится на этапе
          интеграции.
        </p>
      </header>

      <div className="mt-6 space-y-5 rounded-panel border border-subtle bg-surface p-6">
        <div>
          <label
            htmlFor="deadline"
            className="text-small font-medium text-primary"
          >
            Срок проверки по умолчанию (дней)
          </label>
          <input
            id="deadline"
            type="number"
            min={1}
            value={settings.reviewDeadlineDays}
            onChange={(event) =>
              setSettings({ ...settings, reviewDeadlineDays: event.target.value })
            }
            className={`${INPUT_CLASS} mt-1.5 max-w-[160px]`}
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="notify"
            type="checkbox"
            checked={settings.notifyOnSubmission}
            onChange={(event) =>
              setSettings({ ...settings, notifyOnSubmission: event.target.checked })
            }
            className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
          />
          <label htmlFor="notify" className="text-small leading-relaxed text-primary">
            Уведомлять ответственного при новой подаче
          </label>
        </div>

        <div className="flex items-start gap-3">
          <input
            id="autopublish"
            type="checkbox"
            checked={settings.autoPublishAfterApprove}
            onChange={(event) =>
              setSettings({
                ...settings,
                autoPublishAfterApprove: event.target.checked,
              })
            }
            className="mt-1 h-4 w-4 accent-[var(--accent-strong)]"
          />
          <label htmlFor="autopublish" className="text-small leading-relaxed text-primary">
            Автопубликация после одобрения (по умолчанию выключено — публикация
            всегда подтверждается вручную)
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
          <button
            type="button"
            onClick={save}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <Save className="h-4 w-4" aria-hidden />
            Сохранить настройки
          </button>
          {savedAt ? (
            <p className="text-meta text-status-success" role="status">
              Сохранено: {new Date(savedAt).toLocaleTimeString("ru-RU")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
