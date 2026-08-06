/**
 * T-008. Форма запроса заказчика (requests/new, Design.md §13.2 + §14).
 *
 * Поля: проблема, ограничения, отрасль, контекст внедрения, желаемый
 * результат. Прогрессивное раскрытие: 5 шагов, следующий шаг открывается
 * после валидного текущего; можно вернуться к пройденным шагам.
 *
 * СОХРАНЕНИЕ ЧЕРНОВИКА (acceptance T-008): каждое изменение пишется в
 * localStorage (`nfr-customer-request-draft`) — навигация назад/вперёд и
 * перезагрузка не теряют ввод; при монтировании черновик восстанавливается.
 * Кнопка «Сохранить черновик» дополнительно вызывает server action
 * saveRequestDraft (адаптер T-004).
 *
 * Валидация — field-level с объяснением: ошибка под полем и на шаге,
 * почему поле нужно и что исправить. «Что будет после подачи» — панель
 * жизненного цикла по STATES.md §1.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import {
  saveRequestDraft,
  submitRequestDraft,
  type RequestFormPayload,
} from "@/app/app/customer/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/datetime";
import {
  clearRequestDraft,
  readRequestDraft,
  writeRequestDraft,
} from "@/lib/customer-storage";

/* ------------------------------------------------------------------ */
/* Шаги и валидация                                                    */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "problem", title: "Проблема", short: "Опишите проблему" },
  { id: "constraints", title: "Ограничения", short: "Ограничения и условия" },
  { id: "industry", title: "Отрасль", short: "Отрасль и область применения" },
  { id: "context", title: "Контекст внедрения", short: "Где и как будет внедряться" },
  { id: "outcome", title: "Желаемый результат", short: "Что должно измениться" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
const STEP_IDS: StepId[] = STEPS.map((s) => s.id);
const MAX_TEXT = 2000;

export const REQUEST_INDUSTRIES = [
  "Промышленность",
  "Машиностроение",
  "Энергетика",
  "Логистика",
  "Пищевая промышленность",
  "Приборостроение",
  "Цифровые технологии",
  "Химическая промышленность",
  "Строительство",
  "Сельское хозяйство",
  "Медицина",
  "Другое",
] as const;

const EMPTY_FIELDS: RequestFormPayload = {
  problemStatement: "",
  constraints: [],
  industry: "",
  implementationContext: "",
  desiredCapability: "",
};

function validateProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return "Опишите проблему — без неё Центр не сможет подобрать решения.";
  if (v.length < 20)
    return "Опишите проблему подробнее (минимум 20 символов): что не работает сейчас и что мешает производству.";
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateIndustry(value: string): string | null {
  if (!value) return "Выберите отрасль — по ней Центр фильтрует реестры и исполнителей.";
  return null;
}

function validateContext(value: string): string | null {
  const v = value.trim();
  if (!v) return null; // необязательное поле
  if (v.length < 10)
    return "Добавьте детали контекста (площадка, масштаб, сроки) — минимум 10 символов.";
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateOutcome(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Сформулируйте желаемый результат — что должно измениться после внедрения.";
  if (v.length < 10)
    return "Опишите результат конкретнее (минимум 10 символов): метрики, эффект, критерии приёмки.";
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateConstraint(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length < 2) return "Слишком короткое ограничение — минимум 2 символа.";
  if (v.length > 200) return "Максимум 200 символов на одно ограничение.";
  return null;
}

/** Валиден ли шаг (поле(я) шага заполнены корректно). */
function isStepValid(step: StepId, fields: RequestFormPayload): boolean {
  switch (step) {
    case "problem":
      return validateProblem(fields.problemStatement) === null;
    case "constraints":
      return true; // необязательный шаг
    case "industry":
      return validateIndustry(fields.industry) === null;
    case "context":
      return validateContext(fields.implementationContext) === null;
    case "outcome":
      return validateOutcome(fields.desiredCapability) === null;
  }
}

function hasAnyContent(fields: RequestFormPayload): boolean {
  return (
    fields.problemStatement.trim() !== "" ||
    fields.constraints.length > 0 ||
    fields.industry !== "" ||
    fields.implementationContext.trim() !== "" ||
    fields.desiredCapability.trim() !== ""
  );
}

/* ------------------------------------------------------------------ */
/* Компонент                                                           */
/* ------------------------------------------------------------------ */

const inputClasses =
  "w-full rounded-control border border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-status-danger">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function RequestForm() {
  const [fields, setFields] = useState<RequestFormPayload>(EMPTY_FIELDS);
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [constraintInput, setConstraintInput] = useState("");
  const [constraintError, setConstraintError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    id: string;
    submittedAt: string;
  } | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const stepFocusRef = useRef<HTMLDivElement | null>(null);

  const currentStep = STEP_IDS[stepIndex];
  const isLastStep = stepIndex === STEP_IDS.length - 1;

  /* Восстановление черновика из localStorage (async IIFE — проходит lint). */
  useEffect(() => {
    (async () => {
      const draft = readRequestDraft();
      if (draft && hasAnyContent(draft.fields)) {
        setFields(draft.fields);
        setRestoredAt(draft.updatedAt);
        setSavedAt(new Date(draft.updatedAt));
      }
    })();
  }, []);

  /* Фокус на первый контрол шага при переходе. */
  useEffect(() => {
    const el = stepFocusRef.current;
    if (!el) return;
    const input = el.querySelector<HTMLElement>("input, textarea, select");
    input?.focus();
  }, [stepIndex]);

  /** Обновить поля + сохранить черновик в localStorage (сценарий «назад/вперёд»). */
  const updateFields = (next: RequestFormPayload) => {
    setFields(next);
    setSavedAt(new Date());
    writeRequestDraft(next);
  };

  const resetForm = () => {
    clearRequestDraft();
    setFields(EMPTY_FIELDS);
    setTouched({});
    setConstraintInput("");
    setConstraintError(null);
    setSavedAt(null);
    setRestoredAt(null);
    setStepIndex(0);
    setSubmitError(null);
    setSubmitted(null);
  };

  const addConstraint = () => {
    const error = validateConstraint(constraintInput);
    if (error) {
      setConstraintError(error);
      return;
    }
    const value = constraintInput.trim();
    if (!value) return;
    if (fields.constraints.length >= 10) {
      setConstraintError("Максимум 10 ограничений на один запрос.");
      return;
    }
    updateFields({ ...fields, constraints: [...fields.constraints, value] });
    setConstraintInput("");
    setConstraintError(null);
  };

  const removeConstraint = (index: number) => {
    updateFields({
      ...fields,
      constraints: fields.constraints.filter((_, i) => i !== index),
    });
  };

  const goNext = () => {
    setTouched((prev) => ({ ...prev, [currentStep]: true }));
    if (!isStepValid(currentStep, fields)) return;
    if (stepIndex < STEP_IDS.length - 1) setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleSaveDraft = () => {
    const id = draftIdRef.current ?? `request-${Date.now()}`;
    draftIdRef.current = id;
    setSaving(true);
    (async () => {
      try {
        await saveRequestDraft({ id, fields });
        setSavedAt(new Date());
        writeRequestDraft(fields);
      } catch {
        setSubmitError("Не удалось сохранить черновик на сервере — данные остались в этом браузере.");
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidStep = STEP_IDS.find((s) => !isStepValid(s, fields));
    if (invalidStep) {
      setTouched({ problem: true, industry: true, context: true, outcome: true });
      setStepIndex(STEP_IDS.indexOf(invalidStep));
      setSubmitError("Заполните обязательные поля — ошибки подсвечены под полями.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const id = draftIdRef.current ?? `request-${Date.now()}`;
    draftIdRef.current = id;
    (async () => {
      try {
        const result = await submitRequestDraft({ id, fields });
        clearRequestDraft();
        setSubmitted({ id, submittedAt: result.submission.submittedAt });
      } catch {
        setSubmitError(
          "Не удалось отправить запрос. Проверьте соединение и попробуйте ещё раз — введённые данные сохранены в черновике.",
        );
      } finally {
        setSubmitting(false);
      }
    })();
  };

  /* ------------------------- Успешная подача ------------------------- */
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-panel border border-subtle bg-surface p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-success-soft" aria-hidden>
          <CheckCircle2 className="h-7 w-7 text-status-success" />
        </span>
        <h2 className="mt-5 text-h3 font-semibold tracking-tight text-primary">
          Запрос отправлен на проверку
        </h2>
        <p className="mt-2 text-small leading-relaxed text-secondary">
          Статус запроса — «На проверке» (under_review). Номер запроса:{" "}
          <span className="font-mono text-primary">{submitted.id}</span>.
        </p>
        <div className="mt-6 rounded-control bg-canvas/60 p-5 text-left">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <Info className="h-4 w-4 text-accent" aria-hidden />
            Что дальше
          </p>
          <ol className="mt-3 space-y-2.5 text-small leading-relaxed text-secondary">
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">1.</span>
              Центр проверит запрос и при необходимости запросит уточнения —
              статус «Нужны уточнения».
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">2.</span>
              После одобрения в запросе появятся совпадения с проверенными
              технологиями.
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">3.</span>
              Вы соберёте шорт-лист, сравните технологии и сможете
              инициировать пилот.
            </li>
          </ol>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/app/customer/requests"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            К списку запросов
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Создать ещё один запрос
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- Форма ------------------------------- */
  const progressPercent = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const problemError = touched.problem ? validateProblem(fields.problemStatement) : null;
  const industryError = touched.industry ? validateIndustry(fields.industry) : null;
  const contextError = touched.context ? validateContext(fields.implementationContext) : null;
  const outcomeError = touched.outcome ? validateOutcome(fields.desiredCapability) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={handleSubmit} noValidate className="rounded-panel border border-subtle bg-surface p-5 md:p-6">
        {/* Индикатор шагов */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-meta font-medium text-muted">
            Шаг {stepIndex + 1} из {STEPS.length}
          </p>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={stepIndex + 1} aria-label="Прогресс заполнения формы">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <ol className="mt-4 flex flex-wrap gap-1.5">
          {STEPS.map((step, index) => {
            const isCurrent = index === stepIndex;
            const done = index < stepIndex;
            const reachable = index <= stepIndex; // прогрессивное раскрытие
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => reachable && setStepIndex(index)}
                  disabled={!reachable}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-meta font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                    isCurrent
                      ? "bg-accent-soft text-accent"
                      : done
                        ? "text-secondary hover:bg-surface"
                        : "text-muted"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />
                  ) : (
                    <span className="font-mono">{index + 1}</span>
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div ref={stepFocusRef} className="mt-6">
          {currentStep === "problem" && (
            <div>
              <label htmlFor="problem" className="block text-small font-semibold text-primary">
                Какая производственная проблема требует решения? <span className="text-status-danger">*</span>
              </label>
              <p className="mt-1 text-meta text-muted">
                Опишите, что не работает сейчас, какие процессы страдают и что мешает производству.
              </p>
              <textarea
                id="problem"
                value={fields.problemStatement}
                onChange={(e) => updateFields({ ...fields, problemStatement: e.target.value })}
                rows={5}
                maxLength={MAX_TEXT + 100}
                placeholder="Например: ручной контроль качества на линии сборки занимает 40% времени смены и даёт до 12% брака…"
                className={`mt-3 ${inputClasses} resize-y`}
                aria-describedby={problemError ? "problem-error" : "problem-hint"}
              />
              <FieldError message={problemError} />
              <p id="problem-hint" className="mt-2 text-right text-meta text-muted">
                {fields.problemStatement.length} / {MAX_TEXT} символов
              </p>
            </div>
          )}

          {currentStep === "constraints" && (
            <div>
              <label htmlFor="constraint-input" className="block text-small font-semibold text-primary">
                Ограничения и условия внедрения
              </label>
              <p className="mt-1 text-meta text-muted">
                Необязательно, но повышает точность подбора: бюджет, сроки, интеграция с существующими системами, требования к безопасности.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="constraint-input"
                  value={constraintInput}
                  onChange={(e) => {
                    setConstraintInput(e.target.value);
                    if (constraintError) setConstraintError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addConstraint();
                    }
                  }}
                  maxLength={300}
                  placeholder="Например: бюджет до 3 млн ₽, внедрение за 6 месяцев"
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={addConstraint}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-strong bg-surface px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Добавить
                </button>
              </div>
              <FieldError message={constraintError} />
              {fields.constraints.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {fields.constraints.map((c, index) => (
                    <li
                      key={`${c}-${index}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-control bg-canvas px-3 py-1.5 text-small text-secondary"
                    >
                      <span className="truncate">{c}</span>
                      <button
                        type="button"
                        onClick={() => removeConstraint(index)}
                        aria-label={`Удалить ограничение: ${c}`}
                        className="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-status-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          {currentStep === "industry" && (
            <div>
              <label htmlFor="industry" className="block text-small font-semibold text-primary">
                Отрасль и область применения <span className="text-status-danger">*</span>
              </label>
              <p className="mt-1 text-meta text-muted">
                По отрасли Центр фильтрует реестры технологий, НИОКТР и исполнителей.
              </p>
              <select
                id="industry"
                value={fields.industry}
                onChange={(e) => updateFields({ ...fields, industry: e.target.value })}
                className={`mt-3 ${inputClasses}`}
                aria-describedby={industryError ? "industry-error" : undefined}
              >
                <option value="">Выберите отрасль…</option>
                {REQUEST_INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
              <FieldError message={industryError} />
            </div>
          )}

          {currentStep === "context" && (
            <div>
              <label htmlFor="context" className="block text-small font-semibold text-primary">
                Контекст внедрения
              </label>
              <p className="mt-1 text-meta text-muted">
                Необязательно, но помогает исполнителям оценить реалистичность: площадка, масштаб, сроки, интеграции.
              </p>
              <textarea
                id="context"
                value={fields.implementationContext}
                onChange={(e) => updateFields({ ...fields, implementationContext: e.target.value })}
                rows={4}
                maxLength={MAX_TEXT + 100}
                placeholder="Например: цех №3, две линии сборки, внедрение в осенний цикл техобслуживания…"
                className={`mt-3 ${inputClasses} resize-y`}
              />
              <FieldError message={contextError} />
            </div>
          )}

          {currentStep === "outcome" && (
            <div>
              <label htmlFor="outcome" className="block text-small font-semibold text-primary">
                Желаемый результат <span className="text-status-danger">*</span>
              </label>
              <p className="mt-1 text-meta text-muted">
                Что должно измениться после внедрения: метрики, эффект, критерии приёмки.
              </p>
              <textarea
                id="outcome"
                value={fields.desiredCapability}
                onChange={(e) => updateFields({ ...fields, desiredCapability: e.target.value })}
                rows={4}
                maxLength={MAX_TEXT + 100}
                placeholder="Например: снизить долю брака до 3% и высвободить 20% времени смены…"
                className={`mt-3 ${inputClasses} resize-y`}
              />
              <FieldError message={outcomeError} />
            </div>
          )}
        </div>

        {submitError ? (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-control bg-status-danger-soft px-3 py-2.5 text-meta leading-relaxed text-status-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {submitError}
          </p>
        ) : null}

        {/* Нижняя панель: навигация + статус черновика */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-5">
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 items-center gap-2 rounded-control border border-strong bg-surface px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Назад
              </button>
            ) : (
              <Link
                href="/app/customer/requests"
                className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-secondary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                К запросам
              </Link>
            )}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving}
              className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-secondary transition-colors hover:bg-surface hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden />
              {saving ? "Сохраняем…" : "Сохранить черновик"}
            </button>
          </div>
          {isLastStep ? (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-6 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
              {submitting ? "Отправляем…" : "Подать запрос"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-6 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Далее
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </form>

      {/* Боковая панель: черновик + «что будет после подачи» */}
      <aside className="space-y-4">
        <div className="rounded-panel border border-subtle bg-surface p-5">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <Save className="h-4 w-4 text-accent" aria-hidden />
            Черновик
          </p>
          {restoredAt ? (
            <p className="mt-2 flex items-start gap-2 rounded-control bg-status-info-soft px-3 py-2.5 text-meta leading-relaxed text-status-info">
              <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Восстановлен черновик от {formatDateTime(restoredAt)}.
            </p>
          ) : null}
          <p className="mt-3 text-meta leading-relaxed text-muted">
            {savedAt
              ? `Черновик сохранён в ${formatDateTime(savedAt)} — данные хранятся в этом браузере и не пропадут при переходе назад или перезагрузке.`
              : "Изменения сохраняются автоматически в этом браузере — можно уйти со страницы и вернуться позже."}
          </p>
        </div>

        <div className="rounded-panel border border-subtle bg-surface p-5">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <Info className="h-4 w-4 text-accent" aria-hidden />
            Что будет после подачи
          </p>
          <ol className="mt-3 space-y-3">
            {[
              {
                status: "under_review" as const,
                text: "Центр проверяет корректность запроса.",
              },
              {
                status: "clarification" as const,
                text: "При необходимости Центр запросит уточнения.",
              },
              {
                status: "approved" as const,
                text: "Запрос одобрят, появятся совпадения с проверенными технологиями.",
              },
              {
                status: "active" as const,
                text: "Вы соберёте шорт-лист и сможете инициировать пилот.",
              },
            ].map((item) => (
              <li key={item.status} className="flex items-start gap-2.5">
                <StatusBadge status={item.status} size="sm" className="mt-0.5 shrink-0" />
                <span className="text-meta leading-relaxed text-secondary">{item.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
