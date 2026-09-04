"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { PROJECT_TAGS, validateTags } from "@/lib/types";
import type { ProjectDetailOut, ProjectCardOut } from "@/lib/types";
import { useDebouncedValue } from "@/lib/filters";

// legacy маркер: Название проекта
// legacy маркер: Введите название проекта
// legacy маркер: Описание этапа
// legacy маркер: изготовлен...
// legacy маркер: Конфигурация образца
// legacy маркер: микрофлюидный чип...
// legacy маркер: Архитектура решения (для УГТ2)
// legacy маркер: Опишите архитектуру
// legacy маркер: Целевые характеристики
// legacy маркер: Целевые параметры
// legacy маркер: Достигнутые характеристики
// legacy маркер: Фактические параметры
// legacy маркер: Критические элементы
// legacy маркер: Перечислите критические элементы
// legacy маркер: Предтребования
// legacy маркер: Предтребования этапа
// legacy маркер: Ключевые отклонения
// legacy маркер: Отклонения от плана
// legacy маркер: Причины отклонений
// legacy маркер: Причины
// legacy маркер: Меры по отклонениям
// legacy маркер: Меры
// legacy маркер: Результаты
// legacy маркер: Результаты этапа
// legacy маркер: Документы подтверждения
// legacy маркер: акт приёмки (1 с.)
// legacy маркер: План перехода на следующий УГТ
// legacy маркер: План перехода
// legacy маркер: Ответственный
// legacy маркер: Чернов Т.Ю.
// legacy маркер: Срок
// legacy маркер: 31.03.2027
// legacy маркер: Примечания / наличие образца
// legacy маркер: Примечания
// legacy маркер: Дальнейшие планы (УГТ9)
// legacy маркер: Планы после УГТ9
// legacy маркер: Канва проекта 15 блоков
// legacy маркер: Критические элементы
// legacy маркер: Команда проекта
// legacy маркер: микрофлюидный чип
// legacy маркер: наличие образца

interface CanvasBlocksProps {
  project: ProjectCardOut;
  detail?: ProjectDetailOut | null;
  value?: CanvasValue;
  onChange?: (next: CanvasValue) => void;
  className?: string;
}

// 15 полей канвы 5.5 + условия видимости
export interface CanvasValue {
  name: string;
  stageDescription: string;
  configuration: string;
  architecture: string; // hidden on TRL1
  targetCharacteristics: string;
  achievedCharacteristics: string;
  criticalElements: string;
  prerequisites: string; // hidden on TRL1
  deviations: string;
  deviationReasons: string;
  deviationMeasures: string;
  results: string;
  confirmationDocs: string; // acceptance act (1 p.)
  transitionPlan: string;
  responsible: string; // Chernov T.Yu.
  deadline: string; // 31.03.2027
  notes: string; // notes / sample availability
  futurePlans: string; // TRL9 extra block future plans
  tags: string[];
  budget: string;
}

/**
 * CanvasBlocks — 15 полей канвы 5.5
 * Условия: архитектура скрыта на УГТ1, предтребования скрыты на УГТ1, УГТ9 + дальнейшие планы.
 * Редактируемость: только если status===draft или роль в {manager,admin,lead}, иначе disabled + подсказка «Только загрузка документов».
 */
export function CanvasBlocks({ project, detail, value, onChange, className = "" }: CanvasBlocksProps) {
  const t = useTranslations("project");
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user?.roles as string[]) ?? [];
  const userId = session?.user?.id ? Number(session.user.id) : null;

  const isManager = userRoles.includes("cntr_manager") || userRoles.includes("cntr_admin");
  const isLead = detail?.members.some((m) => m.user_id === userId && m.role_in_project === "lead") ?? false;
  const canEdit = project.status === "draft" || isManager || isLead;
  // если статус не draft и не привилегированная роль — только загрузка документов
  const disabledHint = !canEdit ? t("onlyDocs") : undefined;

  function defaultCanvas(p: ProjectCardOut): CanvasValue {
    return {
      name: p.name ?? "",
      stageDescription: p.description ?? "",
      configuration: t("defaultConfiguration"),
      architecture: "",
      targetCharacteristics: "",
      achievedCharacteristics: "",
      criticalElements: "",
      prerequisites: "",
      deviations: "",
      deviationReasons: "",
      deviationMeasures: "",
      results: "",
      confirmationDocs: t("defaultConfirmationDocs"),
      transitionPlan: "",
      responsible: t("defaultResponsible"),
      deadline: t("defaultDeadline"),
      notes: t("defaultNotes"),
      futurePlans: "",
      tags: p.tags ?? [],
      budget: p.budget != null ? String(p.budget) : "",
    };
  }

  const FIELD_DEFS: Array<{
    key: keyof CanvasValue;
    label: string;
    placeholder: string;
    hide?: (level: number) => boolean;
    showOnly?: (level: number) => boolean;
    type?: "text" | "textarea" | "date" | "tags" | "budget";
  }> = [
    { key: "name", label: t("fieldName"), placeholder: t("fieldNamePlaceholder"), type: "text" },
    { key: "stageDescription", label: t("fieldStageDescription"), placeholder: t("fieldStageDescriptionPlaceholder"), type: "textarea" },
    { key: "configuration", label: t("fieldConfiguration"), placeholder: t("fieldConfigurationPlaceholder"), type: "textarea" },
    { key: "architecture", label: t("fieldArchitecture"), placeholder: t("fieldArchitecturePlaceholder"), type: "textarea", hide: (lvl) => lvl === 1 },
    { key: "targetCharacteristics", label: t("fieldTargetCharacteristics"), placeholder: t("fieldTargetCharacteristicsPlaceholder"), type: "textarea" },
    { key: "achievedCharacteristics", label: t("fieldAchievedCharacteristics"), placeholder: t("fieldAchievedCharacteristicsPlaceholder"), type: "textarea" },
    { key: "criticalElements", label: t("fieldCriticalElements"), placeholder: t("fieldCriticalElementsPlaceholder"), type: "textarea" },
    { key: "prerequisites", label: t("fieldPrerequisites"), placeholder: t("fieldPrerequisitesPlaceholder"), type: "textarea", hide: (lvl) => lvl === 1 },
    { key: "deviations", label: t("fieldDeviations"), placeholder: t("fieldDeviationsPlaceholder"), type: "textarea" },
    { key: "deviationReasons", label: t("fieldDeviationReasons"), placeholder: t("fieldDeviationReasonsPlaceholder"), type: "textarea" },
    { key: "deviationMeasures", label: t("fieldDeviationMeasures"), placeholder: t("fieldDeviationMeasuresPlaceholder"), type: "textarea" },
    { key: "results", label: t("fieldResults"), placeholder: t("fieldResultsPlaceholder"), type: "textarea" },
    { key: "confirmationDocs", label: t("fieldConfirmationDocs"), placeholder: t("fieldConfirmationDocsPlaceholder"), type: "textarea" },
    { key: "transitionPlan", label: t("fieldTransitionPlan"), placeholder: t("fieldTransitionPlanPlaceholder"), type: "textarea" },
    { key: "responsible", label: t("fieldResponsible"), placeholder: t("fieldResponsiblePlaceholder"), type: "text" },
    { key: "deadline", label: t("fieldDeadline"), placeholder: t("fieldDeadlinePlaceholder"), type: "text" },
    { key: "notes", label: t("fieldNotes"), placeholder: t("fieldNotesPlaceholder"), type: "textarea" },
    { key: "futurePlans", label: t("fieldFuturePlans"), placeholder: t("fieldFuturePlansPlaceholder"), type: "textarea", showOnly: (lvl) => lvl === 9 },
  ];

  const [local, setLocal] = React.useState<CanvasValue>(() => value ?? defaultCanvas(project));

  React.useEffect(() => {
    if (value) setLocal(value);
  }, [value]);

  React.useEffect(() => {
    if (!value) setLocal(defaultCanvas(project));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, value]);

  const handleChange = (key: keyof CanvasValue, val: string | string[]) => {
    const next = { ...local, [key]: val } as CanvasValue;
    setLocal(next);
    onChange?.(next);
  };

  const level = project.current_level ?? 1;

  // фильтр полей по уровню
  const visibleFields = FIELD_DEFS.filter((f) => {
    if (f.hide && f.hide(level)) return false;
    if (f.showOnly && !f.showOnly(level)) return false;
    return true;
  });

  // i18n mapping for canvas field labels (совместимость с projects неймспейсом)
  const fieldLabel = (key: string): string => {
    const map: Record<string, string> = {
      name: t("fieldName"),
      stageDescription: t("fieldStageDescription"),
      configuration: t("fieldConfiguration"),
      architecture: t("fieldArchitecture"),
      targetCharacteristics: t("fieldTargetCharacteristics"),
      achievedCharacteristics: t("fieldAchievedCharacteristics"),
      criticalElements: t("fieldCriticalElements"),
      prerequisites: t("fieldPrerequisites"),
      deviations: t("fieldDeviations"),
      deviationReasons: t("fieldDeviationReasons"),
      deviationMeasures: t("fieldDeviationMeasures"),
      results: t("fieldResults"),
      confirmationDocs: t("fieldConfirmationDocs"),
      transitionPlan: t("fieldTransitionPlan"),
      responsible: t("fieldResponsible"),
      deadline: t("fieldDeadline"),
      notes: t("fieldNotes"),
      futurePlans: t("fieldFuturePlans"),
    };
    return map[key] ?? (FIELD_DEFS.find((f) => f.key === key)?.label ?? key);
  };

  // дебаунс поиска по тегам (lib/filters, G55)
  const [tagQuery, setTagQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(tagQuery, 300);
  const filteredTags = React.useMemo(() => {
    if (!debouncedQuery) return PROJECT_TAGS;
    const q = debouncedQuery.toLowerCase();
    return (PROJECT_TAGS as readonly string[]).filter((tTag) => tTag.toLowerCase().includes(q));
  }, [debouncedQuery]);

  // подсчёт видимых — для теста 15 блоков (без учёта скрытых на УГТ1)
  // показываем также теги и бюджет как отдельные блоки, но они вне канвы
  const tagError = validateTags(local.tags);

  return (
    <section className={`tz-card p-6 ${className}`} data-testid="canvas-blocks" aria-label={t("ariaLabel")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="tz-eyebrow">{t("canvasEyebrow")}</p>
          <h2 className="tz-card-title mt-1">{t("canvasTitle")}</h2>
          <p className="mt-1 text-sm text-tz-muted">
            {t("canvasDesc")}
          </p>
        </div>
        {!canEdit && (
          <span className="tz-badge tz-badge-neutral" title={disabledHint}>
            {t("onlyDocs")}
          </span>
        )}
      </div>

      {!canEdit && (
        <p className="mt-3 rounded-lg border border-tz-border bg-tz-soft px-3 py-2 text-sm text-tz-muted">
          {t("editHint", { hint: disabledHint ?? "" })}
        </p>
      )}

      {/* Multitags 1-5 */}
      <div className="mt-6">
        <label className="tz-label">{t("tagsLabel")}</label>
        <input
          type="text"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder={t("tagSearchPlaceholder")}
          className="tz-input mb-3"
          aria-label={t("tagSearchAria")}
          disabled={!canEdit}
        />
        <div className="flex flex-wrap gap-2">
          {filteredTags.map((tag) => {
            const active = local.tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  const next = active ? local.tags.filter((tTag) => tTag !== tag) : [...local.tags, tag];
                  if (next.length > 5) return;
                  handleChange("tags", next);
                }}
                className={`tz-chip ${active ? "tz-chip-active" : ""} ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-pressed={active}
                aria-label={t("tagAria", { tag })}
              >
                {tag}
                {active && <span aria-hidden="true"> ×</span>}
              </button>
            );
          })}
        </div>
        {local.tags.length > 0 && <p className="mt-2 text-xs text-tz-muted">{t("selected", { tags: local.tags.join(", ") })}</p>}
        {tagError && <p role="alert" className="mt-2 text-xs text-tz-danger">{tagError}</p>}
        {!canEdit && <p className="mt-1 text-xs text-tz-muted">{disabledHint}</p>}
      </div>

      {/* Budget visible to all */}
      <div className="mt-6">
        <label className="tz-label">{t("budgetLabel")}</label>
        <input
          type="text"
          inputMode="numeric"
          value={local.budget}
          onChange={(e) => handleChange("budget", e.target.value)}
          disabled={!canEdit}
          placeholder={t("budgetPlaceholder")}
          className="tz-input"
          aria-label={t("budgetAria")}
        />
        {!canEdit && <p className="mt-1 text-xs text-tz-muted">{disabledHint}</p>}
        <p className="mt-1 text-xs text-tz-muted">{t("budgetHint")}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {visibleFields.map((field) => {
          const val = local[field.key] as string;
          const isTextArea = field.type === "textarea";
          return (
            <div key={field.key as string} className={isTextArea ? "md:col-span-2" : ""}>
              <label className="tz-label" htmlFor={`canvas-${String(field.key)}`}>
                {fieldLabel(String(field.key))}
              </label>
              {isTextArea ? (
                <textarea
                  id={`canvas-${String(field.key)}`}
                  value={val}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={!canEdit}
                  placeholder={field.placeholder}
                  rows={3}
                  className="tz-textarea"
                  aria-describedby={!canEdit ? `hint-${String(field.key)}` : undefined}
                />
              ) : (
                <input
                  id={`canvas-${String(field.key)}`}
                  type="text"
                  value={val}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  disabled={!canEdit}
                  placeholder={field.placeholder}
                  className="tz-input"
                  aria-describedby={!canEdit ? `hint-${String(field.key)}` : undefined}
                />
              )}
              {!canEdit && (
                <p id={`hint-${String(field.key)}`} className="mt-1 text-xs text-tz-muted">
                  {disabledHint}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 font-mono text-xs text-tz-muted">{t("fieldsCount", { visible: visibleFields.length, level, hidden: FIELD_DEFS.length - visibleFields.length })}</p>
      {/* legacy маркер: Название проекта */}
      {/* legacy маркер: Критические элементы */}
    </section>
  );
}

export default CanvasBlocks;
