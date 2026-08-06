/**
 * T-009. Рабочая страница «Доказательства и документы» досье
 * (/app/partner/technologies/[id]/evidence).
 *
 * Объединяет:
 * - прикреплённые свидетельства досье (досье-фикстуры / досье из черновика);
 * - загрузку новых свидетельств (EvidenceUpload, STATES.md §6: выбрано →
 *   загружается → проверяется → принято ТОЛЬКО после завершения mock
 *   валидации, отклонено, ошибка+retry);
 * - подачу на проверку: доступна только с комплектом свидетельств, иначе —
 *   блокировка с объяснением причины; после подачи — «На проверке»;
 * - ответ на уточнение (ClarificationResponse) для статуса clarification;
 * - «что будет после подачи» (паттерн request-form из T-008).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileCheck,
  FileText,
  Info,
  Lock,
  Send,
  Trash2,
} from "lucide-react";
import {
  submitTechnologyForReview,
} from "@/app/app/partner/actions";
import { EvidenceUpload } from "@/components/partner/evidence-upload";
import { ClarificationResponse } from "@/components/partner/clarification-response";
import { FixtureBadge } from "@/components/customer/fixture-badge";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { formatDateTime } from "@/lib/datetime";
import { isFixtureRecord, type Status, type TechnologyDossier } from "@/lib/types";
import {
  draftToDossier,
  readDossierRecord,
  readTechnologyDraft,
  writeDossierRecord,
  writeTechnologyDraft,
  type DossierWorkspaceRecord,
  type TechnologyDraftRecord,
} from "@/lib/partner-storage";
import { EVIDENCE_REQUIREMENTS } from "@/components/partner/technology-submit-form";

export interface EvidenceWorkspaceProps {
  id: string;
  /** Досье из адаптера (фикстуры); null — для досье из черновика localStorage. */
  initialDossier: TechnologyDossier | null;
  /** Статус верификации из карточки-фикстуры. */
  initialStatus: Status;
}

export function EvidenceWorkspace({
  id,
  initialDossier,
  initialStatus,
}: EvidenceWorkspaceProps) {
  const [draft, setDraft] = useState<TechnologyDraftRecord | null>(null);
  const [record, setRecord] = useState<DossierWorkspaceRecord>({ evidence: [], submission: null });
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clarified, setClarified] = useState(false);

  useEffect(() => {
    (async () => {
      setDraft(readTechnologyDraft(id));
      setRecord(readDossierRecord(id));
      setReady(true);
    })();
  }, [id]);

  if (!ready) {
    return (
      <div className="space-y-4" role="status" aria-label="Загружаем доказательства">
        <div className="h-9 w-48 animate-pulse rounded-control bg-surface-elevated" />
        <div className="h-24 animate-pulse rounded-panel bg-surface-elevated" />
        <div className="h-64 animate-pulse rounded-panel bg-surface-elevated" />
      </div>
    );
  }

  const dossier: TechnologyDossier | null = initialDossier ?? (draft ? draftToDossier(draft) : null);

  if (!dossier) {
    return (
      <EmptyState
        title="Досье не найдено"
        description="Запись отсутствует, удалена или ещё не создана. Создайте досье и вернитесь к доказательствам."
        action={
          <Link
            href="/app/partner/technologies/new"
            className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Создать досье
          </Link>
        }
      />
    );
  }

  const isFixture = isFixtureRecord(dossier);
  const submitted = record.submission !== null;
  const status: Status = submitted
    ? "under_review"
    : draft
      ? draft.status
      : initialStatus;

  const attachedCount = dossier.evidence.length + record.evidence.length;
  const blockedReason =
    attachedCount === 0
      ? "Подача заблокирована: приложите хотя бы одно свидетельство — комплект проверяется Центром."
      : null;

  const handleAccept = (evidence: (typeof record.evidence)[number]) => {
    const next: DossierWorkspaceRecord = {
      ...record,
      evidence: [...record.evidence, evidence],
    };
    setRecord(next);
    writeDossierRecord(id, next);
  };

  const handleRemoveUpload = (evidenceId: string) => {
    const next: DossierWorkspaceRecord = {
      ...record,
      evidence: record.evidence.filter((item) => item.id !== evidenceId),
    };
    setRecord(next);
    writeDossierRecord(id, next);
  };

  const handleSubmit = () => {
    if (blockedReason) {
      setSubmitError(blockedReason);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    (async () => {
      try {
        const result = await submitTechnologyForReview({ id });
        const next: DossierWorkspaceRecord = {
          ...record,
          submission: { status: "under_review", submittedAt: result.submittedAt },
        };
        setRecord(next);
        writeDossierRecord(id, next);
        if (draft) {
          const updated = { ...draft, status: "under_review" as const };
          setDraft(updated);
          writeTechnologyDraft(updated);
        }
      } catch {
        setSubmitError(
          "Не удалось подать досье на проверку. Проверьте соединение и повторите — свидетельства сохранены.",
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const claimedLevel = dossier.ugt.currentLevel;

  return (
    <div>
      <Link
        href="/app/partner/technologies"
        className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        К технологиям организации
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h2 font-semibold tracking-tight text-primary">
            Доказательства и документы
          </h1>
          <p className="mt-1 text-small leading-snug text-secondary">{dossier.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {isFixture ? <FixtureBadge /> : null}
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Прикреплённые свидетельства досье */}
          <section
            aria-labelledby="attached-heading"
            className="rounded-panel border border-subtle bg-surface p-6"
          >
            <h2
              id="attached-heading"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <FileCheck className="h-5 w-5 text-accent" aria-hidden />
              Прикреплённые свидетельства
            </h2>
            {dossier.evidence.length === 0 && record.evidence.length === 0 ? (
              <p className="mt-4 rounded-control border border-dashed border-subtle bg-canvas px-4 py-6 text-center text-small text-secondary">
                Свидетельств пока нет — добавьте документы ниже.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {dossier.evidence.map((evidence) => (
                  <li
                    key={evidence.id}
                    className="flex flex-wrap items-center gap-3 rounded-control border border-subtle bg-canvas px-4 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-status-success-soft" aria-hidden>
                      <Lock className="h-5 w-5 text-status-success" />
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-small font-medium text-primary">
                        {evidence.title}
                      </p>
                      <p className="text-meta text-status-success">
                        Принято и зафиксировано в досье
                        {evidence.uploadedAt
                          ? ` · ${formatDateTime(evidence.uploadedAt)}`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-control bg-canvas px-2 py-0.5 font-mono text-meta text-muted">
                      {evidence.kind}
                    </span>
                  </li>
                ))}
                {record.evidence.map((evidence) => (
                  <li
                    key={evidence.id}
                    className="flex flex-wrap items-center gap-3 rounded-control border border-subtle bg-canvas px-4 py-3"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-status-success-soft" aria-hidden>
                      <FileCheck className="h-5 w-5 text-status-success" />
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-small font-medium text-primary">
                        {evidence.title}
                      </p>
                      <p className="text-meta text-status-success">
                        Проверка завершена — принято
                        {evidence.uploadedAt
                          ? ` · ${formatDateTime(evidence.uploadedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-control bg-canvas px-2 py-0.5 font-mono text-meta text-muted">
                        {evidence.kind}
                      </span>
                      {!submitted ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveUpload(evidence.id)}
                          aria-label={`Удалить свидетельство: ${evidence.title}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-control border border-subtle bg-surface text-muted transition-colors hover:border-status-danger hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Загрузка новых свидетельств (STATES.md §6) */}
          <section
            aria-labelledby="upload-heading"
            className="rounded-panel border border-subtle bg-surface p-6"
          >
            <h2
              id="upload-heading"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              Добавить свидетельства
            </h2>
            <p className="mt-1 text-meta leading-relaxed text-muted">
              Протоколы испытаний, акты, заключения, документы организации.
              «Принято» появляется только после завершения проверки формата и
              безопасности (STATES.md §6).
            </p>
            <div className="mt-4">
              <EvidenceUpload
                dossierId={id}
                attachedCount={attachedCount}
                disabled={submitted}
                onAccept={handleAccept}
              />
            </div>
          </section>

          {/* Документы */}
          <section
            aria-labelledby="documents-heading"
            className="rounded-panel border border-subtle bg-surface p-6"
          >
            <h2
              id="documents-heading"
              className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
            >
              <FileText className="h-5 w-5 text-accent" aria-hidden />
              Документы досье
            </h2>
            {dossier.documents.length === 0 ? (
              <p className="mt-3 text-small leading-relaxed text-secondary">
                Документы появятся после начала проверки Центром: заключения
                проверки, акты решений и публикации.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-small text-secondary">
                {dossier.documents.map((document) => (
                  <li key={document.id}>
                    {document.title} · <StatusBadge status={document.status} size="sm" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Боковая панель: подача, уточнения, «что дальше» */}
        <aside className="space-y-4">
          <section
            aria-labelledby="submit-heading"
            className="rounded-panel border border-subtle bg-surface p-5"
          >
            <h2
              id="submit-heading"
              className="flex items-center gap-2 text-small font-semibold text-primary"
            >
              <Send className="h-4 w-4 text-accent" aria-hidden />
              Подача на проверку
            </h2>

            {submitted ? (
              <div className="mt-3 rounded-control bg-status-success-soft px-3 py-3">
                <p className="flex items-center gap-2 text-small font-semibold text-status-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Подано на проверку
                </p>
                <p className="mt-1.5 text-meta leading-relaxed text-status-success">
                  {record.submission
                    ? `Отправлено ${formatDateTime(record.submission.submittedAt)}. Центр проверяет комплект свидетельств; при нехватке документов запросит уточнения.`
                    : "Центр проверяет комплект свидетельств; при нехватке документов запросит уточнения."}
                </p>
              </div>
            ) : status === "clarification" || clarified ? (
              <div className="mt-3">
                <ClarificationResponse
                  dossierId={id}
                  onSent={() => setClarified(true)}
                />
              </div>
            ) : (
              <>
                <p className="mt-3 text-meta leading-relaxed text-muted">
                  Свидетельств в комплекте: {attachedCount}. Подача доступна с
                  комплектом; досье перейдёт в статус «На проверке».
                </p>
                {blockedReason ? (
                  <p
                    role="alert"
                    className="mt-3 flex items-start gap-1.5 rounded-control bg-status-warning-soft px-3 py-2.5 text-meta leading-relaxed text-status-warning"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {blockedReason}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || attachedCount === 0}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
                >
                  <Send className="h-4 w-4" aria-hidden />
                  {submitting ? "Подаём…" : "Подать на проверку"}
                </button>
              </>
            )}

            {submitError ? (
              <p
                role="alert"
                className="mt-3 flex items-start gap-1.5 rounded-control bg-status-danger-soft px-3 py-2.5 text-meta leading-relaxed text-status-danger"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {submitError}
              </p>
            ) : null}

            {status === "rejected" && !submitted ? (
              <p className="mt-3 rounded-control bg-status-danger-soft px-3 py-2.5 text-meta leading-relaxed text-status-danger">
                Досье отклонено. Доработайте комплект свидетельств и подайте
                повторно — причина отклонения в истории решений досье.
              </p>
            ) : null}
          </section>

          {/* Требования к доказательствам */}
          <section
            aria-labelledby="requirements-heading"
            className="rounded-panel border border-subtle bg-surface p-5"
          >
            <h2
              id="requirements-heading"
              className="flex items-center gap-2 text-small font-semibold text-primary"
            >
              <Info className="h-4 w-4 text-accent" aria-hidden />
              Требования для УГТ {claimedLevel}
            </h2>
            <ul className="mt-3 space-y-2 text-meta leading-relaxed text-secondary">
              {(EVIDENCE_REQUIREMENTS[claimedLevel] ?? []).map((requirement) => (
                <li key={requirement} className="flex gap-2">
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    aria-hidden
                  />
                  {requirement}
                </li>
              ))}
            </ul>
          </section>

          {/* Что будет после подачи */}
          <section
            aria-labelledby="after-heading"
            className="rounded-panel border border-subtle bg-surface p-5"
          >
            <h2
              id="after-heading"
              className="flex items-center gap-2 text-small font-semibold text-primary"
            >
              <Info className="h-4 w-4 text-accent" aria-hidden />
              Что будет после подачи
            </h2>
            <ol className="mt-3 space-y-3">
              {[
                { status: "under_review" as const, text: "Центр проверяет комплект свидетельств." },
                { status: "clarification" as const, text: "При нехватке документов запросит уточнения — ответ с пояснением обязателен." },
                { status: "approved" as const, text: "Одобренное досье публикуется, уровень УГТ подтверждается." },
              ].map((item) => (
                <li key={item.status} className="flex items-start gap-2.5">
                  <StatusBadge status={item.status} size="sm" className="mt-0.5 shrink-0" />
                  <span className="text-meta leading-relaxed text-secondary">{item.text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-meta text-muted">
              Обновлено {formatDateTime(dossier.visibility.updatedAt)}.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
