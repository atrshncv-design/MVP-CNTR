"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import * as React from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { PROJECT_TAGS, validateTags } from "@/lib/types";
import type { ProjectDetailOut, ProjectCardOut } from "@/lib/types";
import { useDebouncedValue } from "@/lib/filters";

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
  architecture: string; // скрыта на УГТ1
  targetCharacteristics: string;
  achievedCharacteristics: string;
  criticalElements: string;
  prerequisites: string; // скрыта на УГТ1
  deviations: string;
  deviationReasons: string;
  deviationMeasures: string;
  results: string;
  confirmationDocs: string; // акт приёмки (1 с.)
  transitionPlan: string;
  responsible: string; // Чернов Т.Ю.
  deadline: string; // 31.03.2027
  notes: string; // примечания / наличие образца
  futurePlans: string; // УГТ9 доп.блок дальнейших планов
  tags: string[];
  budget: string;
}

function defaultCanvas(p: ProjectCardOut): CanvasValue {
  return {
    name: p.name ?? "",
    stageDescription: p.description ?? "",
    configuration: "микрофлюидный чип",
    architecture: "",
    targetCharacteristics: "",
    achievedCharacteristics: "",
    criticalElements: "",
    prerequisites: "",
    deviations: "",
    deviationReasons: "",
    deviationMeasures: "",
    results: "",
    confirmationDocs: "акт приёмки (1 с.)",
    transitionPlan: "",
    responsible: "Чернов Т.Ю.",
    deadline: "31.03.2027",
    notes: "наличие образца",
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
  { key: "name", label: "Название проекта", placeholder: "Введите название проекта", type: "text" },
  { key: "stageDescription", label: "Описание этапа", placeholder: "изготовлен...", type: "textarea" },
  { key: "configuration", label: "Конфигурация образца", placeholder: "микрофлюидный чип...", type: "textarea" },
  { key: "architecture", label: "Архитектура решения (для УГТ2)", placeholder: "Опишите архитектуру", type: "textarea", hide: (lvl) => lvl === 1 },
  { key: "targetCharacteristics", label: "Целевые характеристики", placeholder: "Целевые параметры", type: "textarea" },
  { key: "achievedCharacteristics", label: "Достигнутые характеристики", placeholder: "Фактические параметры", type: "textarea" },
  { key: "criticalElements", label: "Критические элементы", placeholder: "Перечислите критические элементы", type: "textarea" },
  { key: "prerequisites", label: "Предтребования", placeholder: "Предтребования этапа", type: "textarea", hide: (lvl) => lvl === 1 },
  { key: "deviations", label: "Ключевые отклонения", placeholder: "Отклонения от плана", type: "textarea" },
  { key: "deviationReasons", label: "Причины отклонений", placeholder: "Причины", type: "textarea" },
  { key: "deviationMeasures", label: "Меры по отклонениям", placeholder: "Меры", type: "textarea" },
  { key: "results", label: "Результаты", placeholder: "Результаты этапа", type: "textarea" },
  { key: "confirmationDocs", label: "Документы подтверждения", placeholder: "акт приёмки (1 с.)", type: "textarea" },
  { key: "transitionPlan", label: "План перехода на следующий УГТ", placeholder: "План перехода", type: "textarea" },
  { key: "responsible", label: "Ответственный", placeholder: "Чернов Т.Ю.", type: "text" },
  { key: "deadline", label: "Срок", placeholder: "31.03.2027", type: "text" },
  { key: "notes", label: "Примечания / наличие образца", placeholder: "Примечания", type: "textarea" },
  { key: "futurePlans", label: "Дальнейшие планы (УГТ9)", placeholder: "Планы после УГТ9", type: "textarea", showOnly: (lvl) => lvl === 9 },
];

/**
 * CanvasBlocks — 15 полей канвы 5.5
 * Условия: архитектура скрыта на УГТ1, предтребования скрыты на УГТ1, УГТ9 + дальнейшие планы.
 * Редактируемость: только если status===draft или роль в {manager,admin,lead}, иначе disabled + подсказка «Только загрузка документов».
 */
export function CanvasBlocks({ project, detail, value, onChange, className = "" }: CanvasBlocksProps) {
  const t = useTranslations("projects");
  const { data: session } = useSession();
  const userRoles: string[] = (session?.user?.roles as string[]) ?? [];
  const userId = session?.user?.id ? Number(session.user.id) : null;

  const isManager = userRoles.includes("cntr_manager") || userRoles.includes("cntr_admin");
  const isLead = detail?.members.some((m) => m.user_id === userId && m.role_in_project === "lead") ?? false;
  const canEdit = project.status === "draft" || isManager || isLead;
  // если статус не draft и не привилегированная роль — только загрузка документов
  const disabledHint = !canEdit ? t("onlyDocs") : undefined;

  const [local, setLocal] = React.useState<CanvasValue>(() => value ?? defaultCanvas(project));

  React.useEffect(() => {
    if (value) setLocal(value);
  }, [value]);

  React.useEffect(() => {
    if (!value) setLocal(defaultCanvas(project));
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

  // i18n mapping for canvas field labels
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
    <section className={`tz-card p-6 ${className}`} data-testid="canvas-blocks" aria-label="Канва проекта 15 блоков">
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

      {/* Мультитеги 1-5 */}
      <div className="mt-6">
        <label className="tz-label">{t("tagsLabel")}</label>
        <input
          type="text"
          value={tagQuery}
          onChange={(e) => setTagQuery(e.target.value)}
          placeholder={t("tagSearchPlaceholder")}
          className="tz-input mb-3"
          aria-label="Поиск тегов"
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
                aria-label={`Тег ${tag}`}
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

      {/* Бюджет всем виден */}
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
          aria-label="Бюджет проекта"
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
    </section>
  );
}

export default CanvasBlocks;
