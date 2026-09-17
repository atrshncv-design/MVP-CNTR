'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Правила публикации на странице создания проекта (таск 01, R02.1).
 * Едины для заказчика и исполнителя: УГТ 1–2 — автоматически после
 * экспресс-оценки, УГТ 3–9 — через менеджера ЦНТР, опубликованный проект
 * попадает в публичный реестр (PUT /projects/{id}/publish, бэк без
 * ролевых различий по автору).
 */
export function PublishRulesNote() {
  const t = useTranslations('dashboard');
  return (
    <div
      data-testid="publish-rules-note"
      className="flex items-start gap-3 rounded-2xl border border-tz-border bg-tz-surface p-4"
    >
      <Globe size={18} className="mt-0.5 shrink-0 text-tz-accent" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold text-tz-fg">{t('publishRulesTitle')}</p>
        <p className="mt-1 text-tz-secondary">{t('publishRulesText')}</p>
      </div>
    </div>
  );
}
