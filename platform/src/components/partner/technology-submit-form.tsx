/**
 * T-009. Форма «Представить технологию» (Design.md §13.3/§14).
 *
 * Прогрессивное раскрытие: 5 шагов, следующий открывается после валидного
 * текущего; можно вернуться к пройденным. Шаг 1 — УРОВЕНЬ И ТРЕБОВАНИЯ:
 * требования к доказательствам показываются ДО длинной формы, чтобы
 * исполнитель не вкладывался в описание, если комплект собрать нельзя.
 *
 * СОХРАНЕНИЕ ЧЕРНОВИКА (acceptance T-009): каждое изменение пишется в
 * localStorage (`nfr-partner-tech-drafts` + активный id) — перезагрузка и
 * возврат не теряют ввод; при монтировании черновик восстанавливается.
 * Кнопка «Сохранить черновик» дополнительно вызывает server action
 * saveTechnologyDraft (адаптер T-004).
 *
 * Валидация — field-level с объяснением: ошибка под полем и на шаге,
 * почему поле нужно и что исправить. «Что будет после подачи» — панель
 * жизненного цикла по STATES.md §1. Создание досье = статус «Черновик»;
 * доказательства прикладываются на странице досье, подача на проверку —
 * там же (сценарий «создать → черновик → доказательства → подать»).
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
  FileCheck,
  Info,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { saveTechnologyDraft } from "@/app/app/partner/actions";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/datetime";
import { ugtLevelInfo } from "@/lib/ugt";
import {
  readActiveTechnologyDraft,
  removeTechnologyDraft,
  writeTechnologyDraft,
  type TechnologyDraftFields,
  type TechnologyDraftRecord,
} from "@/lib/partner-storage";

/* ------------------------------------------------------------------ */
/* Шаги и валидация                                                    */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "level", title: "Уровень и требования", short: "Заявленный УГТ" },
  { id: "technology", title: "Технология", short: "Название и описание" },
  { id: "problem", title: "Проблема и решение", short: "Зачем и как" },
  { id: "application", title: "Применение", short: "Области применения" },
  { id: "review", title: "Проверка и создание", short: "Черновик досье" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
const STEP_IDS: StepId[] = STEPS.map((s) => s.id);

const MAX_TEXT = 2000;
const MIN_TITLE = 10;
const MIN_DESCRIPTION = 30;
const MIN_PROBLEM = 20;
const MIN_SOLUTION = 20;

export const PARTNER_INDUSTRIES = [
  "Промышленность",
  "Машиностроение",
  "Энергетика",
  "Приборостроение",
  "Цифровые технологии",
  "Химическая промышленность",
  "Логистика",
  "Строительство",
  "Сельское хозяйство",
  "Медицина",
  "Другое",
] as const;

const EMPTY_FIELDS: TechnologyDraftFields = {
  title: "",
  shortDescription: "",
  industry: "",
  applicationAreas: [],
  problem: "",
  solution: "",
  claimedLevel: null,
};

/** Требования к доказательствам для перехода на заявленный уровень (Design.md §14). */
export const EVIDENCE_REQUIREMENTS: Record<number, string[]> = {
  1: ["Публикация или обоснование базовых принципов технологии"],
  2: ["Описание концепции технологии и области её применения"],
  3: ["Результаты подтверждения критических функций (эксперименты, расчёты, макеты)"],
  4: ["Протокол лабораторных испытаний макета или компонента"],
  5: ["Акт испытаний в окружении, близком к реальному"],
  6: ["Демонстрация системного прототипа в релевантном окружении"],
  7: ["Протокол полевых испытаний прототипа в условиях эксплуатации"],
  8: ["Акт завершения и квалификации реальной системы"],
  9: ["Подтверждение успешной эксплуатации (отзывы, метрики, контракты)"],
};

const COMMON_REQUIREMENTS = [
  "Реквизиты организации и документ, подтверждающий полномочия",
  "Описание технологии в форме (заполняется ниже)",
];

function validateLevel(value: number | null): string | null {
  if (value === null)
    return "Выберите заявленный уровень УГТ — по нему Центр проверяет комплект свидетельств.";
  return null;
}

function validateTitle(value: string): string | null {
  const v = value.trim();
  if (!v) return "Укажите название технологии — без него досье не найти в кабинете.";
  if (v.length < MIN_TITLE)
    return `Название слишком короткое — минимум ${MIN_TITLE} символов: что это за технология.`;
  if (v.length > 200) return "Максимум 200 символов — название не должно быть аннотацией.";
  return null;
}

function validateDescription(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Кратко опишите технологию — одно-два предложения о сути и результате.";
  if (v.length < MIN_DESCRIPTION)
    return `Описание слишком короткое — минимум ${MIN_DESCRIPTION} символов: суть, принцип действия, результат.`;
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateIndustry(value: string): string | null {
  if (!value) return "Выберите отрасль — по ней Центр связывает досье с запросами и реестрами.";
  return null;
}

function validateProblem(value: string): string | null {
  const v = value.trim();
  if (!v) return "Опишите проблему, которую решает технология.";
  if (v.length < MIN_PROBLEM)
    return `Опишите проблему подробнее (минимум ${MIN_PROBLEM} символов): что не работает сейчас и почему это важно.`;
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateSolution(value: string): string | null {
  const v = value.trim();
  if (!v) return "Опишите решение — как технология закрывает проблему.";
  if (v.length < MIN_SOLUTION)
    return `Опишите решение подробнее (минимум ${MIN_SOLUTION} символов): принцип действия и ожидаемый эффект.`;
  if (v.length > MAX_TEXT) return `Слишком длинно — сократите до ${MAX_TEXT} символов.`;
  return null;
}

function validateArea(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.length < 3) return "Слишком короткая область — минимум 3 символа.";
  if (v.length > 100) return "Максимум 100 символов на одну область.";
  return null;
}

function isStepValid(step: StepId, fields: TechnologyDraftFields): boolean {
  switch (step) {
    case "level":
      return validateLevel(fields.claimedLevel) === null;
    case "technology":
      return (
        validateTitle(fields.title) === null &&
        validateDescription(fields.shortDescription) === null &&
        validateIndustry(fields.industry) === null
      );
    case "problem":
      return (
        validateProblem(fields.problem) === null &&
        validateSolution(fields.solution) === null
      );
    case "application":
      return true; // необязательный шаг
    case "review":
      // Шаг «проверка» валидируется отдельно (чекбокс готовности — состояние формы).
      return true;
  }
}

function hasAnyContent(fields: TechnologyDraftFields): boolean {
  return (
    fields.title.trim() !== "" ||
    fields.shortDescription.trim() !== "" ||
    fields.industry !== "" ||
    fields.applicationAreas.length > 0 ||
    fields.problem.trim() !== "" ||
    fields.solution.trim() !== "" ||
    fields.claimedLevel !== null
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
    <p
      role="alert"
      className="mt-2 flex items-start gap-1.5 text-meta leading-relaxed text-status-danger"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Генерация id черновика (чистая функция на уровне модуля — вне компонента). */
function newDraftId(): string {
  return `tech-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function TechnologySubmitForm() {
  const [fields, setFields] = useState<TechnologyDraftFields>(EMPTY_FIELDS);
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [areaInput, setAreaInput] = useState("");
  const [areaError, setAreaError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdDraft, setCreatedDraft] = useState<TechnologyDraftRecord | null>(null);
  const [confirmReady, setConfirmReady] = useState(false);
  const draftIdRef = useRef<string | null>(null);
  const stepFocusRef = useRef<HTMLDivElement | null>(null);

  const currentStep = STEP_IDS[stepIndex];
  const isLastStep = stepIndex === STEP_IDS.length - 1;

  /* Восстановление черновика из localStorage (async IIFE — проходит lint). */
  useEffect(() => {
    (async () => {
      const draft = readActiveTechnologyDraft();
      if (draft) {
        if (draft.created) {
          setCreatedDraft(draft);
          return;
        }
        if (hasAnyContent(draft.fields)) {
          setFields(draft.fields);
          draftIdRef.current = draft.id;
          setRestoredAt(draft.updatedAt);
          setSavedAt(new Date(draft.updatedAt));
        }
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

  /** Обновить поля + автосохранение черновика в localStorage. */
  const updateFields = (next: TechnologyDraftFields) => {
    const id = draftIdRef.current ?? newDraftId();
    draftIdRef.current = id;
    setFields(next);
    const now = new Date().toISOString();
    writeTechnologyDraft({
      id,
      createdAt: now,
      updatedAt: now,
      created: false,
      status: "draft",
      fields: next,
    });
    setSavedAt(new Date());
  };

  const resetForm = () => {
    if (draftIdRef.current) removeTechnologyDraft(draftIdRef.current);
    draftIdRef.current = null;
    setFields(EMPTY_FIELDS);
    setTouched({});
    setAreaInput("");
    setAreaError(null);
    setSavedAt(null);
    setRestoredAt(null);
    setSubmitError(null);
    setCreatedDraft(null);
    setConfirmReady(false);
    setStepIndex(0);
  };

  const addArea = () => {
    const error = validateArea(areaInput);
    if (error) {
      setAreaError(error);
      return;
    }
    const value = areaInput.trim();
    if (!value) return;
    if (fields.applicationAreas.length >= 10) {
      setAreaError("Максимум 10 областей применения.");
      return;
    }
    updateFields({
      ...fields,
      applicationAreas: [...fields.applicationAreas, value],
    });
    setAreaInput("");
    setAreaError(null);
  };

  const removeArea = (index: number) => {
    updateFields({
      ...fields,
      applicationAreas: fields.applicationAreas.filter((_, i) => i !== index),
    });
  };

  const goNext = () => {
    setTouched((prev) => ({ ...prev, [currentStep]: true }));
    if (currentStep === "review" && !confirmReady) {
      setSubmitError(
        "Подтвердите готовность комплекта свидетельств — без этого досье не создать.",
      );
      return;
    }
    if (!isStepValid(currentStep, fields)) return;
    if (stepIndex < STEP_IDS.length - 1) setStepIndex(stepIndex + 1);
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleSaveDraft = () => {
    const id = draftIdRef.current ?? newDraftId();
    draftIdRef.current = id;
    setSaving(true);
    (async () => {
      try {
        await saveTechnologyDraft({ id, payload: { ...fields } });
        updateFields(fields);
        setSavedAt(new Date());
      } catch {
        setSubmitError(
          "Не удалось сохранить черновик на сервере — данные остались в этом браузере.",
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      level: true,
      technology: true,
      problem: true,
      application: true,
      review: true,
    });
    const invalidStep = STEP_IDS.find((s) => s !== "review" && !isStepValid(s, fields));
    if (invalidStep) {
      setStepIndex(STEP_IDS.indexOf(invalidStep));
      setSubmitError("Заполните обязательные поля — ошибки подсвечены под полями.");
      return;
    }
    if (!confirmReady) {
      setStepIndex(4);
      setSubmitError(
        "Подтвердите готовность комплекта свидетельств — без этого досье не создать.",
      );
      return;
    }
    setSubmitError(null);
    setCreating(true);
    const id = draftIdRef.current ?? newDraftId();
    draftIdRef.current = id;
    const now = new Date().toISOString();
    const record: TechnologyDraftRecord = {
      id,
      createdAt: now,
      updatedAt: now,
      created: true,
      status: "draft",
      fields,
    };
    (async () => {
      try {
        await saveTechnologyDraft({ id, payload: { ...fields } });
        writeTechnologyDraft(record);
        setCreatedDraft(record);
      } catch {
        setSubmitError(
          "Не удалось создать досье. Проверьте соединение и повторите — введённые данные сохранены в черновике.",
        );
      } finally {
        setCreating(false);
      }
    })();
  };

  /* -------------------- Досье уже создано (черновик) -------------------- */
  if (createdDraft) {
    return (
      <div className="mx-auto max-w-2xl rounded-panel border border-subtle bg-surface p-8 text-center">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-success-soft"
          aria-hidden
        >
          <CheckCircle2 className="h-7 w-7 text-status-success" />
        </span>
        <h2 className="mt-5 text-h3 font-semibold tracking-tight text-primary">
          Досье создано — это черновик
        </h2>
        <p className="mt-2 text-small leading-relaxed text-secondary">
          Статус досье — «Черновик» (draft). Номер досье:{" "}
          <span className="font-mono text-primary">{createdDraft.id}</span>.
          Публикация начнётся только после проверки Центра.
        </p>
        <div className="mt-6 rounded-control bg-canvas/60 p-5 text-left">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <Info className="h-4 w-4 text-accent" aria-hidden />
            Что дальше
          </p>
          <ol className="mt-3 space-y-2.5 text-small leading-relaxed text-secondary">
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">1.</span>
              Приложите доказательства на странице досье — загруженные файлы
              проходят проверку формата и безопасности.
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">2.</span>
              Подайте досье на проверку Центра — статус станет «На проверке».
            </li>
            <li className="flex gap-2">
              <span className="font-mono font-semibold text-accent">3.</span>
              После одобрения досье перейдёт к публикации, а уровень УГТ будет
              подтверждён проверкой.
            </li>
          </ol>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href={`/app/partner/technologies/${createdDraft.id}/evidence`}
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <FileCheck className="h-4 w-4" aria-hidden />
            Приложить доказательства
          </Link>
          <Link
            href={`/app/partner/technologies/${createdDraft.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Открыть досье
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-secondary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Создать ещё одно досье
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- Форма ------------------------------- */
  const progressPercent = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const levelError = touched.level ? validateLevel(fields.claimedLevel) : null;
  const titleError = touched.technology ? validateTitle(fields.title) : null;
  const descriptionError = touched.technology
    ? validateDescription(fields.shortDescription)
    : null;
  const industryError = touched.technology ? validateIndustry(fields.industry) : null;
  const problemError = touched.problem ? validateProblem(fields.problem) : null;
  const solutionError = touched.solution ? validateSolution(fields.solution) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form
        onSubmit={handleCreate}
        noValidate
        className="rounded-panel border border-subtle bg-surface p-5 md:p-6"
      >
        {/* Индикатор шагов */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-meta font-medium text-muted">
            Шаг {stepIndex + 1} из {STEPS.length}
          </p>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-canvas"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={stepIndex + 1}
            aria-label="Прогресс заполнения формы"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <ol className="mt-4 flex flex-wrap gap-1.5">
          {STEPS.map((step, index) => {
            const isCurrent = index === stepIndex;
            const done = index < stepIndex;
            const reachable = index <= stepIndex;
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
          {/* Шаг 1: уровень и требования к доказательствам ДО длинной формы */}
          {currentStep === "level" && (
            <div>
              <label
                htmlFor="claimed-level"
                className="block text-small font-semibold text-primary"
              >
                Заявленный уровень готовности (УГТ 1–9){" "}
                <span className="text-status-danger">*</span>
              </label>
              <p className="mt-1 text-meta text-muted">
                По этому уровню Центр проверит комплект свидетельств. Сначала
                посмотрите требования ниже — если доказательства собрать нельзя,
                выберите более низкий уровень.
              </p>
              <select
                id="claimed-level"
                value={fields.claimedLevel ?? ""}
                onChange={(e) =>
                  updateFields({
                    ...fields,
                    claimedLevel: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className={`mt-3 ${inputClasses}`}
                aria-describedby={levelError ? "level-error" : undefined}
              >
                <option value="">Выберите уровень…</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((level) => (
                  <option key={level} value={level}>
                    УГТ {level} — {ugtLevelInfo(level)?.name ?? ""} ({" "}
                    {level <= 3 ? "низкая" : level <= 6 ? "средняя" : "высокая"}{" "}
                    готовность)
                  </option>
                ))}
              </select>
              <FieldError message={levelError} />

              {fields.claimedLevel !== null ? (
                <div className="mt-4 rounded-control border border-subtle bg-canvas p-4">
                  <p className="flex items-center gap-2 text-small font-semibold text-primary">
                    <FileCheck className="h-4 w-4 text-accent" aria-hidden />
                    Требования к доказательствам для УГТ {fields.claimedLevel}
                  </p>
                  <ul className="mt-3 space-y-2 text-small leading-relaxed text-secondary">
                    {(EVIDENCE_REQUIREMENTS[fields.claimedLevel] ?? []).map(
                      (requirement) => (
                        <li key={requirement} className="flex gap-2">
                          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                          {requirement}
                        </li>
                      ),
                    )}
                    {COMMON_REQUIREMENTS.map((requirement) => (
                      <li key={requirement} className="flex gap-2">
                        <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        {requirement}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-meta leading-relaxed text-muted">
                    Доказательства прикладываются после создания досье, на
                    странице «Доказательства». Без комплекта подача на проверку
                    будет заблокирована с объяснением причины.
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-control border border-dashed border-subtle bg-canvas px-4 py-3 text-meta leading-relaxed text-muted">
                  Выберите уровень — появятся требования к комплекту свидетельств.
                </p>
              )}
            </div>
          )}

          {/* Шаг 2: технология */}
          {currentStep === "technology" && (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="tech-title"
                  className="block text-small font-semibold text-primary"
                >
                  Название технологии <span className="text-status-danger">*</span>
                </label>
                <input
                  id="tech-title"
                  value={fields.title}
                  onChange={(e) => updateFields({ ...fields, title: e.target.value })}
                  maxLength={300}
                  placeholder="Например: система мониторинга вибрации оборудования"
                  className={`mt-2 ${inputClasses}`}
                  aria-describedby={titleError ? "title-error" : undefined}
                />
                <FieldError message={titleError} />
              </div>
              <div>
                <label
                  htmlFor="tech-description"
                  className="block text-small font-semibold text-primary"
                >
                  Краткое описание <span className="text-status-danger">*</span>
                </label>
                <p className="mt-1 text-meta text-muted">
                  Одно-два предложения: суть, принцип действия, ожидаемый результат.
                </p>
                <textarea
                  id="tech-description"
                  value={fields.shortDescription}
                  onChange={(e) =>
                    updateFields({ ...fields, shortDescription: e.target.value })
                  }
                  rows={3}
                  maxLength={MAX_TEXT + 100}
                  placeholder="Например: система на базе датчиков и edge-аналитики выявляет дефекты подшипников за 48 часов до отказа…"
                  className={`mt-2 ${inputClasses} resize-y`}
                  aria-describedby={descriptionError ? "description-error" : undefined}
                />
                <FieldError message={descriptionError} />
              </div>
              <div>
                <label
                  htmlFor="tech-industry"
                  className="block text-small font-semibold text-primary"
                >
                  Отрасль <span className="text-status-danger">*</span>
                </label>
                <p className="mt-1 text-meta text-muted">
                  По отрасли Центр связывает досье с запросами заказчиков.
                </p>
                <select
                  id="tech-industry"
                  value={fields.industry}
                  onChange={(e) =>
                    updateFields({ ...fields, industry: e.target.value })
                  }
                  className={`mt-2 ${inputClasses}`}
                  aria-describedby={industryError ? "industry-error" : undefined}
                >
                  <option value="">Выберите отрасль…</option>
                  {PARTNER_INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
                <FieldError message={industryError} />
              </div>
            </div>
          )}

          {/* Шаг 3: проблема и решение */}
          {currentStep === "problem" && (
            <div className="space-y-5">
              <div>
                <label
                  htmlFor="tech-problem"
                  className="block text-small font-semibold text-primary"
                >
                  Какую проблему решает технология?{" "}
                  <span className="text-status-danger">*</span>
                </label>
                <p className="mt-1 text-meta text-muted">
                  Что не работает сейчас, какие процессы страдают и почему это важно.
                </p>
                <textarea
                  id="tech-problem"
                  value={fields.problem}
                  onChange={(e) => updateFields({ ...fields, problem: e.target.value })}
                  rows={5}
                  maxLength={MAX_TEXT + 100}
                  placeholder="Например: внеплановая остановка оборудования из-за отказа подшипников приводит к потере до 7% сменного времени…"
                  className={`mt-2 ${inputClasses} resize-y`}
                  aria-describedby={problemError ? "problem-error" : undefined}
                />
                <FieldError message={problemError} />
              </div>
              <div>
                <label
                  htmlFor="tech-solution"
                  className="block text-small font-semibold text-primary"
                >
                  Как технология решает проблему?{" "}
                  <span className="text-status-danger">*</span>
                </label>
                <textarea
                  id="tech-solution"
                  value={fields.solution}
                  onChange={(e) => updateFields({ ...fields, solution: e.target.value })}
                  rows={5}
                  maxLength={MAX_TEXT + 100}
                  placeholder="Например: датчики вибрации и температуры + модель ранней диагностики; прогноз за 48 часов, точность 94% на опытной выборке…"
                  className={`mt-2 ${inputClasses} resize-y`}
                  aria-describedby={solutionError ? "solution-error" : undefined}
                />
                <FieldError message={solutionError} />
              </div>
            </div>
          )}

          {/* Шаг 4: применение */}
          {currentStep === "application" && (
            <div>
              <label
                htmlFor="area-input"
                className="block text-small font-semibold text-primary"
              >
                Области применения
              </label>
              <p className="mt-1 text-meta text-muted">
                Необязательно, но помогает сопоставлению с запросами заказчиков:
                «предиктивное обслуживание», «контроль качества», «логистика».
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="area-input"
                  value={areaInput}
                  onChange={(e) => {
                    setAreaInput(e.target.value);
                    if (areaError) setAreaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addArea();
                    }
                  }}
                  maxLength={150}
                  placeholder="Например: предиктивное обслуживание"
                  className={inputClasses}
                />
                <button
                  type="button"
                  onClick={addArea}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control border border-strong bg-surface px-4 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  Добавить
                </button>
              </div>
              <FieldError message={areaError} />
              {fields.applicationAreas.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {fields.applicationAreas.map((area, index) => (
                    <li
                      key={`${area}-${index}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-control bg-canvas px-3 py-1.5 text-small text-secondary"
                    >
                      <span className="truncate">{area}</span>
                      <button
                        type="button"
                        onClick={() => removeArea(index)}
                        aria-label={`Удалить область: ${area}`}
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

          {/* Шаг 5: проверка и создание */}
          {currentStep === "review" && (
            <div className="space-y-5">
              <div className="rounded-control border border-subtle bg-canvas p-4">
                <p className="text-small font-semibold text-primary">
                  Проверьте данные досье
                </p>
                <dl className="mt-3 space-y-2 text-small leading-relaxed">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted">Уровень:</dt>
                    <dd className="font-medium text-primary">
                      {fields.claimedLevel
                        ? `УГТ ${fields.claimedLevel} — ${ugtLevelInfo(fields.claimedLevel)?.name ?? ""}`
                        : "не выбран"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted">Название:</dt>
                    <dd className="font-medium text-primary">
                      {fields.title.trim() || "не заполнено"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted">Отрасль:</dt>
                    <dd className="font-medium text-primary">
                      {fields.industry || "не выбрана"}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted">Области применения:</dt>
                    <dd className="font-medium text-primary">
                      {fields.applicationAreas.length > 0
                        ? fields.applicationAreas.join(", ")
                        : "не указаны"}
                    </dd>
                  </div>
                </dl>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-control border border-subtle bg-canvas p-4">
                <input
                  type="checkbox"
                  checked={confirmReady}
                  onChange={(e) => setConfirmReady(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-small leading-relaxed text-secondary">
                  Я понимаю, что доказательства прикладываются до подачи на
                  проверку, и готов(а) дополнить комплект свидетельств на
                  странице досье.
                </span>
              </label>

              <div className="rounded-control border border-subtle bg-canvas p-4">
                <p className="flex items-center gap-2 text-small font-semibold text-primary">
                  <Info className="h-4 w-4 text-accent" aria-hidden />
                  Что будет после создания
                </p>
                <ol className="mt-3 space-y-2.5 text-small leading-relaxed text-secondary">
                  <li className="flex gap-2">
                    <span className="font-mono font-semibold text-accent">1.</span>
                    Досье появится в списке технологий со статусом «Черновик».
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono font-semibold text-accent">2.</span>
                    Вы приложите доказательства — файлы пройдут проверку формата
                    и безопасности.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-mono font-semibold text-accent">3.</span>
                    Подача на проверку Центра доступна только с комплектом
                    свидетельств.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {submitError ? (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-control bg-status-danger-soft px-3 py-2.5 text-meta leading-relaxed text-status-danger"
          >
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
                href="/app/partner/technologies"
                className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-secondary transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                К технологиям
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
              disabled={creating}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-6 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {creating ? "Создаём…" : "Создать досье"}
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
              ? `Черновик сохранён в ${formatDateTime(savedAt)} — данные хранятся в этом браузере и не пропадут при перезагрузке.`
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
                status: "draft" as const,
                text: "Досье создаётся как черновик — правки доступны в любой момент.",
              },
              {
                status: "under_review" as const,
                text: "После подачи Центр проверяет комплект свидетельств.",
              },
              {
                status: "clarification" as const,
                text: "При нехватке документов Центр запросит уточнения — ответ с пояснением обязателен.",
              },
              {
                status: "approved" as const,
                text: "Одобренное досье публикуется, уровень УГТ подтверждается проверкой.",
              },
            ].map((item) => (
              <li key={item.status} className="flex items-start gap-2.5">
                <StatusBadge status={item.status} size="sm" className="mt-0.5 shrink-0" />
                <span className="text-meta leading-relaxed text-secondary">
                  {item.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
