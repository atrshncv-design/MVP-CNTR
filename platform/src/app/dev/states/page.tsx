/**
 * T-005. Dev-демо системы состояний: все канонические статусы, УГТ,
 * все состояния экрана, история решений и состояния загрузки документов.
 * Демонстрационные данные — только для проверки интерфейса; реальные данные
 * подключит T-004 (адаптер).
 *
 * Семантика одинакова во всех трёх темах: переключение — ThemeToggle
 * (светлая / тёмная / удмуртская), компоненты используют только токены.
 */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ExternalLink, FolderOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { STATUS_LIST } from "@/lib/status";
import { StatusBadge } from "@/components/status-badge";
import { UgtBadge } from "@/components/ugt-badge";
import {
  UGT_BAND_META,
  UGT_LEVELS,
  UGT_TRANSITION_META,
  bandRangeLabel,
  describeUgtPosition,
} from "@/lib/ugt";
import { LoadingSkeleton } from "@/components/states/loading-skeleton";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { PermissionState } from "@/components/states/permission-state";
import { SuccessState } from "@/components/states/success-state";
import { StaleNotice } from "@/components/states/stale-notice";
import { ArchivedState } from "@/components/states/archived-state";
import { SaveInProgress, type SavePhase } from "@/components/states/save-in-progress";
import {
  DecisionTimeline,
  type DecisionTimelineItem,
} from "@/components/decision-timeline";
import {
  UploadState,
  type UploadFileState,
  type UploadPhase,
} from "@/components/upload-state";

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <hr className="section-divider" aria-hidden />
      <h2 className="mt-6 text-h2 font-semibold tracking-tight text-primary">
        {title}
      </h2>
      {intro ? (
        <p className="mt-2 max-w-2xl text-body leading-relaxed text-secondary">
          {intro}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Демо-данные истории решений (STATES.md §4)                          */
/* ------------------------------------------------------------------ */

const demoDecisions: DecisionTimelineItem[] = [
  {
    id: "dec-1",
    actor: "Анна Смирнова",
    actorRole: "Менеджер Центра",
    decidedAt: "2026-08-05T14:32:00+04:00",
    decision: "approved",
    reason:
      "Комплект свидетельств по УГТ 4 полный: протокол испытаний макета и акт опытной эксплуатации на площадке заказчика.",
    evidence: [
      { label: "Заключение проверки №П-2026-041", href: "#" },
      { label: "Акт опытной эксплуатации" },
    ],
    comment:
      "Исполнитель ответил на замечания по методике измерений — расхождения устранены.",
    nextAction: "Опубликовать уровень в реестре или перейти к подготовке УГТ 5.",
    visibility: "participants",
  },
  {
    id: "dec-2",
    actor: "Сергей Ковалёв",
    actorRole: "Эксперт Центра",
    decidedAt: "2026-07-28T10:05:00+04:00",
    decision: "clarification",
    reason:
      "Не хватает документов, подтверждающих серийность партии: требуется акт приёмо-сдаточных испытаний.",
    nextAction: "Дополнить комплект свидетельств и подать заявку повторно.",
    visibility: "participants",
  },
  {
    id: "dec-3",
    actor: "Анна Смирнова",
    actorRole: "Менеджер Центра",
    decidedAt: "2026-07-15T09:40:00+04:00",
    decision: "rejected",
    reason:
      "Приложенный PDF не прошёл проверку безопасности: файл содержит исполняемый скрипт. Требуется повторная загрузка проверенного документа.",
    nextAction: "Загрузить исправленную версию документа и подать заново.",
    visibility: "staff",
  },
  {
    id: "dec-4",
    actor: "Олег Тарасов",
    actorRole: "Менеджер Центра",
    decidedAt: "2026-06-30T16:20:00+04:00",
    decision: { label: "Опубликовано в реестре", tone: "success" },
    reason:
      "Запись проверена и соответствует требованиям публичного реестра.",
    nextAction: "Отслеживать обновления карточки в публичном реестре.",
    visibility: "public",
  },
];

/* Демо-времена (модульный уровень — рендер остаётся чистым). */
const STALE_DEMO_AT = new Date(Date.now() - 2 * 60 * 60 * 1000);
const SAVED_DEMO_AT = new Date();

/* ------------------------------------------------------------------ */
/* Демо-машина загрузки документа (STATES.md §6)                       */
/* ------------------------------------------------------------------ */

const UPLOAD_FLOW: UploadPhase[] = [
  "selected",
  "uploading",
  "scanning",
  "accepted",
];

function UploadDemo() {
  const [flowFile, setFlowFile] = useState<UploadFileState | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const runFlow = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    setFlowFile({
      id: "flow-1",
      name: "протокол-испытаний-макета.pdf",
      size: 1_842_000,
      phase: "selected",
    });
    UPLOAD_FLOW.forEach((phase, index) => {
      timersRef.current.push(
        window.setTimeout(
          () =>
            setFlowFile({
              id: "flow-1",
              name: "протокол-испытаний-макета.pdf",
              size: 1_842_000,
              phase,
            }),
          500 * (index + 1),
        ),
      );
    });
  };

  const demoFiles: UploadFileState[] = [
    {
      id: "accepted-1",
      name: "заключение-проверки-угт4.pdf",
      size: 248_000,
      phase: "accepted",
    },
    {
      id: "rejected-1",
      name: "скан-паспорта-испытаний.exe",
      size: 12_000,
      phase: "rejected",
      message: "тип файла недопустим для комплекта",
    },
    {
      id: "failed-1",
      name: "протокол-испытаний-v2.docx",
      size: 1_120_000,
      phase: "failed",
      message: "соединение прервано",
    },
    {
      id: "removed-1",
      name: "старый-черновик-описания.docx",
      size: 89_000,
      phase: "removed",
    },
    {
      id: "submitted-1",
      name: "приказ-о-серии-0.pdf",
      size: 512_000,
      phase: "submitted",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-small font-medium text-primary">
          Жизненный цикл загрузки (интерактивно)
        </p>
        <button
          type="button"
          onClick={runFlow}
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Запустить загрузку
        </button>
        <p className="text-meta text-muted">
          «Принято» появляется только после завершения проверки (STATES.md §6) —
          в демо фазы сменяются с задержкой.
        </p>
        <UploadState
          files={flowFile ? [flowFile] : []}
          emptyLabel="Файл не выбран — нажмите «Запустить загрузку»"
        />
      </div>
      <div className="space-y-4">
        <p className="text-small font-medium text-primary">
          Остальные состояния (статические примеры)
        </p>
        <UploadState files={demoFiles} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Страница                                                           */
/* ------------------------------------------------------------------ */

export default function StatesDemoPage() {
  const [errorDemo, setErrorDemo] = useState(false);
  const [draftTitle, setDraftTitle] = useState(
    "Композитный материал на основе льняного волокна",
  );
  const [savePhase, setSavePhase] = useState<SavePhase>("saved");

  const simulateSave = () => {
    setSavePhase("saving");
    window.setTimeout(() => {
      setSavePhase("saved");
    }, 1400);
  };

  return (
    <div className="flex flex-1 justify-center bg-canvas">
      <div className="w-full max-w-5xl px-5 py-10 md:px-8 md:py-14">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-mono text-meta text-muted">
              /dev/states · T-005 · universal state system
            </p>
            <h1 className="mt-3 text-h1 font-semibold tracking-tight text-primary">
              Система состояний
            </h1>
            <p className="mt-3 max-w-2xl text-body-lg leading-relaxed text-secondary">
              Канонические статусы и состояния экрана — единый набор для всех
              P0-страниц. Семантика одинакова во всех трёх темах: переключите
              тему, чтобы убедиться. Подписи статусов — строго по STATES.md.
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Статусы */}
        <Section
          id="statuses"
          title="Канонические статусы (STATES.md §1)"
          intro="12 статусов, единых для технологий, запросов, документов, организаций и пилотов. Иконка + текст + цвет: цвет — не единственный канал."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_LIST.map((meta) => (
              <div
                key={meta.key}
                className="rounded-panel border border-subtle bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusBadge status={meta.key} />
                  <span className="font-mono text-meta text-muted">
                    {meta.key}
                  </span>
                </div>
                <p className="mt-2.5 text-small leading-snug text-secondary">
                  {meta.meaning}
                </p>
                <p className="mt-2 text-meta text-muted">
                  <span className="font-medium text-secondary">Дальше: </span>
                  {meta.nextAction}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* УГТ */}
        <Section
          id="ugt"
          title="Уровень готовности технологии (УГТ 1–9)"
          intro="Низкая готовность 1–3, средняя 4–6, высокая 7–9 (Design.md §10). Число, название уровня, band и форма маркера; в удмуртской теме маркер — восьмиконечная звезда."
        >
          <div className="rounded-panel border border-subtle bg-surface p-6">
            <div className="flex flex-wrap gap-2.5">
              {UGT_LEVELS.map((item) => (
                <UgtBadge key={item.number} level={item.number} />
              ))}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {(Object.keys(UGT_BAND_META) as Array<keyof typeof UGT_BAND_META>).map(
                (band) => {
                  const meta = UGT_BAND_META[band];
                  return (
                    <div
                      key={band}
                      className={`rounded-control px-4 py-3 ${
                        band === "low"
                          ? "bg-ugt-low-soft"
                          : band === "medium"
                            ? "bg-ugt-medium-soft"
                            : "bg-ugt-high-soft"
                      }`}
                    >
                      <p
                        className={`text-small font-medium ${
                          band === "low"
                            ? "text-ugt-low"
                            : band === "medium"
                              ? "text-ugt-medium"
                              : "text-ugt-high"
                        }`}
                      >
                        {meta.label} · {bandRangeLabel(band)}
                      </p>
                      <p className="mt-1 text-meta text-secondary">
                        {meta.description}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
            <div className="mt-6 rounded-control border border-subtle bg-canvas/60 p-4">
              <p className="text-small font-medium text-primary">
                Текущий уровень ≠ переход N → N+1 (STATES.md §2)
              </p>
              <p className="mt-2 max-w-3xl text-small leading-relaxed text-secondary">
                {describeUgtPosition(5, "under_review", true)}
              </p>
              <p className="mt-1 max-w-3xl text-small leading-relaxed text-secondary">
                {describeUgtPosition(7, "not_started", false)}
              </p>
              <p className="mt-3 text-meta text-muted">
                Варианты перехода:{" "}
                {Object.values(UGT_TRANSITION_META)
                  .map((meta) => meta.label)
                  .join(" · ")}
              </p>
            </div>
          </div>
        </Section>

        {/* Загрузка */}
        <Section
          id="loading"
          title="Загрузка"
          intro="Структурные скелеты вместо фейковых счётчиков (STATES.md §3): каркас повторяет форму контента — список, карточки, таблица, детали, форма."
        >
          <div className="space-y-8">
            <LoadingSkeleton variant="list" rows={3} label="Загружаем список технологий" />
            <LoadingSkeleton variant="card" rows={3} label="Загружаем карточки реестра" />
            <LoadingSkeleton variant="table" rows={4} label="Загружаем таблицу НИОКТР" />
            <LoadingSkeleton variant="detail" label="Загружаем досье технологии" />
            <LoadingSkeleton variant="form" label="Загружаем форму черновика" />
          </div>
        </Section>

        {/* Пусто */}
        <Section
          id="empty"
          title="Пустые состояния"
          intro="Каждое пустое состояние объясняет, почему список пуст, и предлагает следующее осмысленное действие (STATES.md §3)."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <EmptyState
              title="Пока нет опубликованных технологий по этому фильтру"
              description="Измените фильтры или сбросьте поиск — реестр наполняется по мере проверки заявок."
              action={
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Сбросить фильтры
                </button>
              }
            />
            <EmptyState
              title="У вашей организации пока нет запросов"
              description="Создайте первый запрос — Центр подберёт исполнителей по вашей задаче."
              action={
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Создать запрос
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              }
            />
            <EmptyState
              title="Очередь пуста"
              description="Новых задач на проверку нет. Список обновляется автоматически."
              icon={FolderOpen}
              compact
            />
            <EmptyState
              title="По заданным условиям записи не найдены"
              description="В реестре НИОКТР нет записей, соответствующих выбранным условиям поиска."
              compact
            />
          </div>
        </Section>

        {/* Ошибка */}
        <Section
          id="error"
          title="Ошибка"
          intro="Что сломалось, retry и fallback-маршрут. Ввод пользователя сохраняется: форма под сообщением остаётся живой и повторная попытка ничего не стирает."
        >
          {errorDemo ? (
            <ErrorState
              title="Не удалось загрузить черновик технологии"
              description="Сервер данных временно недоступен. Попробуйте повторить запрос — введённые данные сохранены в форме ниже."
              onRetry={() => setErrorDemo(false)}
              retryLabel="Повторить загрузку"
              fallbackHref="/"
              fallbackLabel="На главную"
              preservedInput={
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="draft-title"
                    className="text-meta font-medium text-muted"
                  >
                    Название технологии (сохранено)
                  </label>
                  <input
                    id="draft-title"
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="h-11 rounded-control border border-border-strong bg-surface px-3 text-small text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  />
                </div>
              }
            />
          ) : (
            <div className="rounded-panel border border-subtle bg-surface p-6">
              <p className="text-small text-secondary">
                Нажмите «Симулировать ошибку», чтобы увидеть состояние ошибки с
                сохранением ввода (поле ниже переживает ошибку).
              </p>
              <button
                type="button"
                onClick={() => setErrorDemo(true)}
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Симулировать ошибку
              </button>
            </div>
          )}
        </Section>

        {/* Доступ */}
        <Section
          id="permission"
          title="Доступ"
          intro="Запись существует, доступ ограничен (когда это известно) + путь запроса доступа (STATES.md §3)."
        >
          <PermissionState
            recordExists
            action={
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Запросить доступ
              </button>
            }
          />
          <div className="mt-4">
            <PermissionState
              recordExists={false}
              description="Раздел «Аналитика Центра» доступен только сотрудникам операционного центра."
              action={
                <a
                  href="mailto:info@cntr-ur.ru"
                  className="inline-flex h-11 items-center gap-2 rounded-control px-4 text-small font-medium text-accent transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Связаться с Центром
                </a>
              }
            />
          </div>
        </Section>

        {/* Успех */}
        <Section
          id="success"
          title="Успех"
          intro="Подтверждение реально выполненной операции + следующее действие (STATES.md §3). Одобрение и публикация — с шагом подтверждения."
        >
          <SuccessState
            title="Черновик сохранён"
            description="Изменения сохранены. Черновик можно продолжить позже — он доступен в вашем кабинете."
            actions={
              <>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Открыть проект
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Продолжить позже
                </button>
              </>
            }
          />
        </Section>

        {/* Устаревшие данные */}
        <Section
          id="stale"
          title="Устаревшие данные"
          intro="Когда данные могли устареть — timestamp последнего обновления и отсутствие иллюзии реального времени (STATES.md §3)."
        >
          <StaleNotice updatedAt={STALE_DEMO_AT} />
          <div className="mt-3">
            <StaleNotice
              updatedAt="2026-08-06T09:15:00+04:00"
              detail="Очередь обновляется вручную — нажмите «Обновить», чтобы получить актуальный список."
            />
          </div>
        </Section>

        {/* Архив */}
        <Section
          id="archived"
          title="Архив"
          intro="Объект больше не активен и не публичен по умолчанию; содержимое сохранено (STATES.md §1 archived, §3)."
        >
          <ArchivedState
            archivedAt="2026-07-20"
            action={
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Открыть архив
              </button>
            }
          />
        </Section>

        {/* Сохранение */}
        <Section
          id="save"
          title="Сохранение"
          intro="Неблокирующий inline-статус: пользователь продолжает работу, статус обновляется. Три фазы — сохраняется / сохранено / ошибка."
        >
          <div className="flex flex-wrap items-center gap-4 rounded-panel border border-subtle bg-surface p-5">
            <SaveInProgress phase={savePhase} savedAt={SAVED_DEMO_AT} />
            <button
              type="button"
              onClick={simulateSave}
              className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              onClick={() => setSavePhase("error")}
              className="inline-flex h-11 items-center rounded-control border border-status-danger bg-transparent px-5 text-small font-medium text-status-danger transition-colors hover:bg-status-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Показать ошибку сохранения
            </button>
          </div>
        </Section>

        {/* История решений */}
        <Section
          id="decisions"
          title="История решений"
          intro="Actor, дата и время, решение, причина, связанные доказательства, следующее действие, видимость (STATES.md §4). Отклонение и уточнение всегда с причиной; одобрение — с шагом подтверждения."
        >
          <DecisionTimeline decisions={demoDecisions} />
        </Section>

        {/* Загрузка документов */}
        <Section
          id="upload"
          title="Загрузка документов"
          intro="Состояния по STATES.md §6: выбрано → загружается → проверяется → принято (только после завершения валидации), отклонено, ошибка + retry, удалено из черновика, отправлено и зафиксировано."
        >
          <UploadDemo />
        </Section>

        <div className="mt-12 rounded-panel border border-subtle bg-surface p-6">
          <p className="flex items-center gap-2 text-small font-medium text-primary">
            <ExternalLink className="h-4 w-4 text-accent" aria-hidden />
            Проверка в трёх темах
          </p>
          <p className="mt-2 max-w-3xl text-small leading-relaxed text-secondary">
            Переключите тему переключателем вверху страницы: светлая, тёмная,
            удмуртская. Статусы, состояния и контраст не меняются по смыслу —
            токены T-001 адаптируют визуальный мир. Семантика одинакова для
            всех ролей: компоненты не знают о роли просматривающего.
          </p>
          <p className="mt-3 text-meta text-muted">
            Демонстрационные данные помечены только в этом dev-разделе;
            публичные реестры получают реальные записи из адаптера T-004 или
            честные пустые состояния.
          </p>
        </div>
      </div>
    </div>
  );
}
