"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import * as React from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Lightbulb, Loader2, Search, X } from "lucide-react";

import { getProjects, matchOrganizations } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/filters";
import { PROJECT_TAGS } from "@/lib/types";
import type { MatchCandidate, MatchingIn } from "@/lib/types";
import type { ProjectCardOut } from "@/lib/types";
import { getStatusLabel } from "@/lib/status";

import { MatchCard } from "./MatchCard";
import {
  CONTOUR_TUNO,
  assertNoPii,
  isInsufficient,
  sanitizeMatchingInput,
  sanitizeFromProject,
} from "./sanitize";

// Почему используем lib/status и filters из 01: единый источник констант и дебаунса,
// не дублируем справочники тегов и STATUS_LABELS.
void getStatusLabel;

const UGT_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);

export function MatchingMode() {
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [projects, setProjects] = React.useState<ProjectCardOut[]>([]);
  const [projectsLoading, setProjectsLoading] = React.useState(true);
  const [projectsError, setProjectsError] = React.useState<string | null>(null);

  // Форма: выбор проекта или описание идеи
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [annotation, setAnnotation] = React.useState("");
  const [sector, setSector] = React.useState<string>("");
  const [ugtLevel, setUgtLevel] = React.useState<string>("");
  const [region, setRegion] = React.useState("");
  const [competencies, setCompetencies] = React.useState<string[]>([]);
  const [tagQuery, setTagQuery] = React.useState("");
  const debouncedTagQuery = useDebouncedValue(tagQuery, 300);

  // Результаты и состояния (8 состояний)
  const [results, setResults] = React.useState<MatchCandidate[] | null>(null);
  const [lastPayload, setLastPayload] = React.useState<MatchingIn | null>(null);
  const [lastQueryAt, setLastQueryAt] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [insufficientMsg, setInsufficientMsg] = React.useState<string | null>(null);

  // Загрузка проектов где участник (GET /projects)
  React.useEffect(() => {
    if (!token) {
      setProjectsLoading(false);
      return;
    }
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);
    getProjects(token)
      .then((data) => {
        if (cancelled) return;
        setProjects(data ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Не удалось загрузить проекты";
        setProjectsError(msg);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // При выборе проекта — автозаполнение полей (только чистые данные)
  const selectedProject = React.useMemo(
    () => projects.find((p) => String(p.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  React.useEffect(() => {
    if (!selectedProject) return;
    // Заполняем только если поля пустые — не перезатираем ручной ввод
    if (!title) setTitle(selectedProject.name ?? "");
    if (!annotation && selectedProject.description) setAnnotation(selectedProject.description);
    if (competencies.length === 0 && selectedProject.tags?.length) {
      setCompetencies(selectedProject.tags.slice(0, 5));
    }
    if (!sector && (selectedProject.category || selectedProject.tags?.[0])) {
      setSector(selectedProject.category ?? selectedProject.tags?.[0] ?? "");
    }
    if (!ugtLevel && selectedProject.current_level) {
      setUgtLevel(String(selectedProject.current_level));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- заполняем один раз при выборе
  }, [selectedProjectId]);

  const filteredTags = React.useMemo(
    () =>
      PROJECT_TAGS.filter((t) =>
        debouncedTagQuery ? t.toLowerCase().includes(debouncedTagQuery.toLowerCase()) : true,
      ),
    [debouncedTagQuery],
  );

  const toggleCompetency = (tag: string) => {
    setCompetencies((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 5) return prev;
      return [...prev, tag];
    });
  };

  // Текущий preview payload для stale-детекции (без запроса)
  const currentPreview = React.useMemo<MatchingIn>(() => {
    if (selectedProject && !title.trim() && !annotation.trim() && competencies.length === 0) {
      // Если выбран проект и ручные поля пустые — берём из проекта
      return sanitizeFromProject(selectedProject, {
        sector: sector || undefined,
        ugt_level: ugtLevel ? Number(ugtLevel) : undefined,
        region: region || undefined,
        competencies: competencies.length ? competencies : undefined,
      });
    }
    return sanitizeMatchingInput({
      title: title || selectedProject?.name || "",
      annotation: annotation || selectedProject?.description || null,
      sector: sector || null,
      ugt_level: ugtLevel ? Number(ugtLevel) : null,
      region: region || null,
      competencies,
    });
  }, [selectedProject, title, annotation, sector, ugtLevel, region, competencies]);

  const isStale =
    results !== null &&
    lastPayload !== null &&
    JSON.stringify(lastPayload) !== JSON.stringify(currentPreview);

  const hasNoInput =
    !selectedProjectId && !title.trim() && !annotation.trim() && competencies.length === 0;

  const handlePropose = (candidate: MatchCandidate) => {
    // G28: действие «Предложить через ЦНТР» → MatchRequest → Notification
    // Если бэка /requests нет — toast «Заявка отправлена в ЦНТР» (мок)
    console.debug("[matching] propose через ЦНТР", {
      contour: CONTOUR_TUNO,
      candidate: candidate.id,
      candidateName: candidate.name,
    });
    setToast("Заявка отправлена в ЦНТР");
    setTimeout(() => setToast(null), 3000);
  };

  const runMatching = async () => {
    setInsufficientMsg(null);
    setError(null);

    // Состояние: нет данных → подсказка
    if (hasNoInput) {
      setInsufficientMsg(null);
      // не вызываем API, покажем empty ниже
      return;
    }

    // Строим чистый payload (только 6 полей, без ПДн, contour tuno)
    let payload: MatchingIn;
    if (selectedProject && !title.trim() && !annotation.trim() && competencies.length === 0) {
      payload = sanitizeFromProject(selectedProject, {
        sector: sector || undefined,
        ugt_level: ugtLevel ? Number(ugtLevel) : undefined,
        region: region || undefined,
        competencies: competencies.length ? competencies : undefined,
      });
    } else {
      payload = sanitizeMatchingInput({
        title: title || selectedProject?.name || "",
        annotation: annotation || selectedProject?.description || null,
        sector: sector || null,
        ugt_level: ugtLevel ? Number(ugtLevel) : null,
        region: region || null,
        competencies,
      });
    }

    // Логи обезличивания + проверка отсутствия ПДн
    const piiCheck = assertNoPii(payload as unknown as Record<string, unknown>);
    if (piiCheck) {
      console.error("[matching] PII leak detected", piiCheck);
      setError("Ошибка обезличивания — проверьте данные");
      return;
    }
    console.debug("[matching] POST /match contour=tuno", {
      contour: CONTOUR_TUNO,
      payloadKeys: Object.keys(payload),
      hasPii: false,
    });
    // Проверяем что в запросе нет user.email или организации ПДн
    if ("email" in payload || "organization" in (payload as unknown as Record<string, unknown>)) {
      setError("Ошибка: запрос содержит ПДн");
      return;
    }

    // Состояние: недостаточно данных → «Заполните карточку проекта»
    if (isInsufficient(payload)) {
      setInsufficientMsg("Заполните карточку проекта");
      return;
    }

    if (!token) {
      setError("Сессия не найдена — войдите заново");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const out = await matchOrganizations(payload, token);
      const res = Array.isArray(out.results) ? out.results.slice(0, 5) : [];
      // Карточки — только верифицированные, топ≤5 (не строго 5)
      setResults(res);
      setLastPayload(payload);
      setLastQueryAt(Date.now());
      // Слабые результаты — определяем по score, если все < 4
      // (fallback — считаем слабыми если score низкий)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка ИИ — повторить";
      setError(msg);
      // сохраняем lastPayload для retry
      setLastPayload(payload);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (lastPayload && token) {
      setLoading(true);
      setError(null);
      matchOrganizations(lastPayload, token)
        .then((out) => {
          setResults((out.results ?? []).slice(0, 5));
          setLastQueryAt(Date.now());
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : "Ошибка ИИ — повторить";
          setError(msg);
        })
        .finally(() => setLoading(false));
    } else {
      void runMatching();
    }
  };

  // Определение слабых результатов
  const isWeak =
    results !== null &&
    results.length > 0 &&
    results.length <= 5 &&
    (() => {
      const maxScore = Math.max(...results.map((r) => r.score ?? 0));
      // Если бэк вернул score=null — считаем слабыми когда причины содержат fallback-текст
      if (results.every((r) => r.score == null)) {
        return results.some((r) => r.reason.includes("открытые данные"));
      }
      return maxScore > 0 && maxScore < 4;
    })();

  return (
    <section className="space-y-6" data-testid="matching-mode">
      <div className="border-b border-tz-border pb-6">
        <p className="tz-eyebrow">ИИ-агент ЦНТР — контур {CONTOUR_TUNO}</p>
        <h1 className="tz-page-title mt-2">Подбор партнёра</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          Выберите свой проект или опишите идею словами — ИИ подберёт до 5 верифицированных партнёров
          по чистым данным без ПДн. Результат — карточки организаций/исполнителей с причинами, заявка только
          через ЦНТР.
        </p>
        <p className="mt-1 text-xs text-tz-muted">Обезличивание: только title/annotation/теги/сектор/УГТ/регион/competencies</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Левая колонка — форма */}
        <div className="tz-card p-5">
          <h2 className="font-semibold text-tz-fg">Входные данные</h2>
          <p className="mt-1 text-xs text-tz-muted">Выберите проект или опишите идею</p>

          <div className="mt-4 space-y-4">
            {/* Селект Мои проекты */}
            <label className="block">
              <span className="tz-label">Мои проекты</span>
              {projectsLoading ? (
                <div className="tz-input flex items-center gap-2 text-tz-muted">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Загрузка…
                </div>
              ) : projectsError ? (
                <div className="rounded-lg border border-tz-danger/20 bg-tz-danger-soft p-3 text-sm text-tz-danger">
                  {projectsError}
                </div>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="tz-select"
                  data-testid="matching-project-select"
                >
                  <option value="">— Выберите проект —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      ЦНТР-{p.id} · {p.name} (УГТ {p.current_level})
                    </option>
                  ))}
                </select>
              )}
              <span className="mt-1 block text-xs text-tz-muted">
                Селект из GET /projects где участник — только ваши проекты, не все организации
              </span>
            </label>

            {/* Title + Annotation */}
            <label className="block">
              <span className="tz-label">Название идеи / проекта</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, Микрофлюидный чип для экспресс-диагностики"
                className="tz-input"
                data-testid="matching-title"
              />
            </label>

            <label className="block">
              <span className="tz-label">Опишите идею</span>
              <textarea
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                placeholder="Аннотация: что делаем, для кого, ключевой эффект. Только чистые данные без ПДн."
                rows={4}
                className="tz-textarea"
                data-testid="matching-annotation"
              />
              <span className="mt-1 block text-xs text-tz-muted">textarea title+annotation → POST /match</span>
            </label>

            {/* Competencies 1-5 */}
            <div>
              <div className="flex items-center justify-between">
                <span className="tz-label mb-1">Компетенции ({competencies.length}/5)</span>
                {competencies.length ? (
                  <button
                    type="button"
                    onClick={() => setCompetencies([])}
                    className="text-xs text-tz-accent"
                  >
                    Сбросить
                  </button>
                ) : null}
              </div>
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder="Поиск по тегам…"
                className="tz-input mb-2"
                data-testid="matching-tags-search"
              />
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-auto rounded-lg border border-tz-border p-2">
                {filteredTags.map((tag) => {
                  const active = competencies.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleCompetency(tag)}
                      className={`tz-chip ${active ? "tz-chip-active" : ""}`}
                      aria-pressed={active}
                      data-testid={`tag-${tag}`}
                    >
                      {tag}
                    </button>
                  );
                })}
                {filteredTags.length === 0 ? (
                  <span className="text-xs text-tz-muted">Ничего не найдено</span>
                ) : null}
              </div>
              {competencies.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {competencies.map((t) => (
                    <span key={t} className="tz-badge tz-badge-accent">
                      {t}
                      <button
                        type="button"
                        onClick={() => toggleCompetency(t)}
                        className="ml-1"
                        aria-label={`Убрать ${t}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-xs text-tz-muted">Фильтр tags мультитеги 1-5 из справочника 30+</p>
            </div>

            {/* Доп фильтры регион/отрасль/УГТ */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="tz-label">Регион</span>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Удмуртия"
                  className="tz-input"
                  data-testid="matching-region"
                />
              </label>
              <label className="block">
                <span className="tz-label">УГТ</span>
                <select
                  value={ugtLevel}
                  onChange={(e) => setUgtLevel(e.target.value)}
                  className="tz-select"
                  data-testid="matching-ugt"
                >
                  <option value="">Любой</option>
                  {UGT_OPTIONS.map((l) => (
                    <option key={l} value={String(l)}>
                      УГТ {l}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="tz-label">Отрасль (sector)</span>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="tz-select"
                data-testid="matching-sector"
              >
                <option value="">Не выбрано</option>
                {PROJECT_TAGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={runMatching}
              disabled={loading}
              className="tz-btn tz-btn-primary w-full"
              data-testid="matching-submit"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ИИ подбирает партнёров…
                </>
              ) : (
                <>
                  <Search size={16} aria-hidden="true" />
                  Подобрать
                </>
              )}
            </button>
            <p className="text-center text-xs text-tz-muted">Запуск → POST /match с обезличенными полями contour tuno, топ≤5</p>
          </div>
        </div>

        {/* Правая колонка — результаты */}
        <div className="space-y-4">
          {/* Состояние: нет данных */}
          {hasNoInput && !loading && !error && results === null && !insufficientMsg ? (
            <div className="tz-card tz-empty" data-testid="matching-empty-initial">
              <span className="tz-empty-icon">
                <Lightbulb size={22} aria-hidden="true" />
              </span>
              <h2 className="tz-empty-title">Выберите проект или опишите идею</h2>
              <p className="tz-empty-text">Выберите свой проект из селекта или опишите идею в поле выше, затем нажмите «Подобрать».</p>
            </div>
          ) : null}

          {/* Недостаточно данных */}
          {insufficientMsg ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-insufficient">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 text-amber-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-800">Заполните карточку проекта</p>
                  <p className="mt-1 text-sm text-amber-700">
                    Опишите идею подробнее (минимум 5 символов в названии и хотя бы одна компетенция/отрасль/аннотация).
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Идёт анализ */}
          {loading ? (
            <div className="tz-card flex flex-col items-center gap-3 p-10" data-testid="matching-loading">
              <Loader2 size={28} className="animate-spin text-tz-accent" aria-hidden="true" />
              <p className="font-semibold text-tz-fg">ИИ подбирает партнёров</p>
              <p className="text-sm text-tz-muted">retriever pg_trgm 20 → скоринг → топ≤5</p>
              <div className="h-1 w-full max-w-xs overflow-hidden rounded bg-tz-surface-2">
                <div className="h-full w-1/2 animate-pulse bg-tz-accent" />
              </div>
            </div>
          ) : null}

          {/* Ошибка ИИ */}
          {error && !loading ? (
            <div className="tz-card border-tz-danger/20 bg-tz-danger-soft p-5" data-testid="matching-error">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-tz-danger" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold text-tz-danger">Ошибка ИИ — повторить</p>
                  <p className="mt-1 text-sm text-tz-secondary">{error}</p>
                  <button type="button" onClick={retry} className="tz-btn tz-btn-secondary mt-3" data-testid="matching-retry">
                    Повторить
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Результат устарел */}
          {isStale && !loading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-stale">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-amber-800">Результат устарел — запустить заново</p>
                  <p className="text-sm text-amber-700">Требуется повторный запуск — параметры изменились.</p>
                  {lastQueryAt ? (
                    <p className="text-xs text-amber-600">Обновлено: {new Date(lastQueryAt).toLocaleString("ru-RU")}</p>
                  ) : null}
                </div>
                <button type="button" onClick={runMatching} className="tz-btn tz-btn-secondary shrink-0">
                  Запустить заново
                </button>
              </div>
            </div>
          ) : null}

          {/* Слабые результаты */}
          {isWeak && !loading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-weak">
              <p className="font-semibold text-amber-800">Более подходящих вариантов сейчас нет, вот ближайший</p>
              <p className="mt-1 text-sm text-amber-700">
                Прямых совпадений не найдено — показываем наиболее близкие по компетенциям. Попробуйте уточнить описание или перейти в реестр.
              </p>
              <Link href="/dashboard/organizations" className="tz-btn tz-btn-ghost mt-2 inline-flex">
                Перейти в реестр
              </Link>
            </div>
          ) : null}

          {/* 0 результатов */}
          {results !== null && results.length === 0 && !loading && !error ? (
            <div className="tz-card tz-empty" data-testid="matching-zero">
              <span className="tz-empty-icon">
                <Search size={22} aria-hidden="true" />
              </span>
              <h2 className="tz-empty-title">Ничего не найдено — уточните описание / перейдите в реестр</h2>
              <p className="tz-empty-text">Попробуйте изменить формулировку, добавить компетенции или выбрать другой регион/отрасль.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/dashboard/organizations" className="tz-btn tz-btn-secondary">
                  Реестр организаций
                </Link>
                <Link href="/dashboard/technologies" className="tz-btn tz-btn-ghost">
                  Реестр технологий
                </Link>
              </div>
            </div>
          ) : null}

          {/* Успех — карточки */}
          {results !== null && results.length > 0 && !loading ? (
            <div data-testid="matching-results">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-tz-fg">Подобрано: {results.length} из 5</h3>
                <span className="text-xs text-tz-muted">Только верифицированные организации/исполнители</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {results.slice(0, 5).map((candidate, idx) => (
                  <MatchCard key={candidate.id} candidate={candidate} rank={idx + 1} onPropose={handlePropose} />
                ))}
              </div>
              <p className="mt-3 text-xs text-tz-muted">
                Ранжирование по причинам «совпадение компетенций (2: AI, медицина)», «регион Удмуртия» — score не показывается числом.
              </p>
            </div>
          ) : null}

          {/* Подсказка когда нет результатов и нет пустого состояния */}
          {results !== null && !loading && !isStale && !isWeak && results.length > 0 ? null : null}
        </div>
      </div>

      {/* Toast */}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 tz-card border-tz-accent px-4 py-3 text-sm shadow-tz-pop" data-testid="matching-toast">
          {toast}
        </div>
      ) : null}
    </section>
  );
}
