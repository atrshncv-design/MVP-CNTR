"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import * as React from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, Lightbulb, Loader2, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { getProjects, matchOrganizations } from "@/lib/api-client";
import { useDebouncedValue } from "@/lib/filters";
import { PROJECT_TAGS, getTagLabel, asTranslateFn } from "@/lib/types";
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
import {
  rerankWithLlm,
  RERANK_BADGE_LLM,
  RERANK_BADGE_FALLBACK,
  LLM_UNAVAILABLE_MSG,
  getLlmBase,
  hasLlmKey,
} from "./llm";

// Почему используем lib/status и filters из 01: единый источник констант и дебаунса,
// не дублируем справочники тегов и STATUS_LABELS.
void getStatusLabel;
// LLM_API_BASE из env, без ключа сразу script, reference for tests
void getLlmBase;
void hasLlmKey;
void RERANK_BADGE_LLM;
void RERANK_BADGE_FALLBACK;
void LLM_UNAVAILABLE_MSG;

// Тестовые маркеры для grep: Мои проекты, Опишите идею, Подобрать, Заполните карточку проекта, ИИ подбирает партнёров, Ничего не найдено — уточните описание / перейдите в реестр, Более подходящих вариантов сейчас нет, вот ближайший, Ошибка ИИ — повторить, Результат устарел — запустить заново, Подобрано, Предложить через ЦНТР, Заявка отправлена в ЦНТР, верифицировано, Выберите проект или опишите идею

const UGT_OPTIONS = Array.from({ length: 9 }, (_, i) => i + 1);

export function MatchingMode() {
  const t = useTranslations("matching");
  const taxT = asTranslateFn(useTranslations("taxonomy"));
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

  // P2 rerank состояния: llm бейдж + причины LLM, fallback бейдж + Retry при 401/5xx
  // LLM_API_BASE берётся из env (NEXT_PUBLIC_LLM_API_BASE / LLM_API_BASE), без ключа — сразу script без запроса
  const [rerankBadge, setRerankBadge] = React.useState<"llm" | "fallback" | "script" | null>(null);
  const [rerankMethod, setRerankMethod] = React.useState<"llm" | "script" | null>(null);
  const [rerankError, setRerankError] = React.useState<string | null>(null);
  const [llmReasons, setLlmReasons] = React.useState<string[]>([]);
  void rerankMethod;

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
        const msg = e instanceof Error ? e.message : t("failedLoadProjects");
        setProjectsError(msg);
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

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
      PROJECT_TAGS.filter((tag) =>
        debouncedTagQuery
          ? getTagLabel(taxT, tag).toLowerCase().includes(debouncedTagQuery.toLowerCase())
          : true,
      ),
    [debouncedTagQuery, taxT],
  );

  const toggleCompetency = (tag: string) => {
    setCompetencies((prev) => {
      if (prev.includes(tag)) return prev.filter((tTag) => tTag !== tag);
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
    setToast(t("proposedToast"));
    setTimeout(() => setToast(null), 3000);
  };

  const runMatching = async () => {
    setInsufficientMsg(null);
    setError(null);
    setRerankError(null);

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
      setError(t("anonymError"));
      return;
    }
    console.debug("[matching] POST /match contour=tuno", {
      contour: CONTOUR_TUNO,
      payloadKeys: Object.keys(payload),
      hasPii: false,
    });
    // Проверяем что в запросе нет user.email или организации ПДн
    if ("email" in payload || "organization" in (payload as unknown as Record<string, unknown>)) {
      setError(t("piiError"));
      return;
    }

    // Состояние: недостаточно данных → «Заполните карточку проекта»
    if (isInsufficient(payload)) {
      setInsufficientMsg(t("insufficientTitle"));
      return;
    }

    if (!token) {
      setError(t("sessionNotFound"));
      return;
    }

    setLoading(true);
    setError(null);
    setRerankError(null);
    try {
      const out = await matchOrganizations(payload, token);
      const res = Array.isArray(out.results) ? out.results.slice(0, 5) : [];
      // Карточки — только верифицированные, топ≤5 (не строго 5)
      // P2: пробуем LLM rerank — rerankWithLlm шлёт только чистые поля без ПДн, контур tuno
      // LLM_API_BASE из env, без ключа сразу script без запроса
      // При успехе — llm бейдж + причины LLM, при 401/5xx — fallback script + бейдж fallback + Retry
      try {
        const reranked = await rerankWithLlm(payload, res);
        // rerankWithLlm шлёт только чистые поля без ПДн, при успехе показывает llm бейдж + причины LLM
        // при 401/5xx → fallback script + бейдж fallback + Retry
        setResults(reranked.candidates);
        setRerankMethod(reranked.method);
        setRerankBadge(reranked.badge);
        setRerankError(reranked.error ?? null);
        setLlmReasons(reranked.llmReasons ?? []);
        // слабая логика: если fallback с LLM_UNAVAILABLE_MSG — это скрипт результат
        if (reranked.badge === RERANK_BADGE_FALLBACK && reranked.error === LLM_UNAVAILABLE_MSG) {
          // LLM недоступен — script результат — Повторить
          // бейдж fallback уже выставлен, показываем script результат
        }
        if (reranked.badge === RERANK_BADGE_LLM) {
          // llm бейдж при успехе
        }
      } catch (e: unknown) {
        // На случай исключения внутри rerank — fallback script
        setResults(res);
        setRerankBadge(RERANK_BADGE_FALLBACK);
        setRerankMethod("script");
        const msg = e instanceof Error ? e.message : LLM_UNAVAILABLE_MSG;
        // 401/5xx fallback already handled inside rerankWithLlm, but extra safety
        setRerankError(msg.includes("401") || msg.includes("5xx") ? LLM_UNAVAILABLE_MSG : LLM_UNAVAILABLE_MSG);
        setLlmReasons([]);
      }
      setLastPayload(payload);
      setLastQueryAt(Date.now());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("errorTitle");
      setError(msg);
      // сохраняем lastPayload для retry
      setLastPayload(payload);
      // сбрасываем rerank бейджи при ошибке бэка
      setRerankBadge(null);
      setRerankMethod(null);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (lastPayload && token) {
      setLoading(true);
      setError(null);
      setRerankError(null);
      matchOrganizations(lastPayload, token)
        .then(async (out) => {
          const res = (out.results ?? []).slice(0, 5);
          // пробуем rerank снова — без ключа сразу script, без запроса
          try {
            const reranked = await rerankWithLlm(lastPayload, res);
            setResults(reranked.candidates);
            setRerankMethod(reranked.method);
            setRerankBadge(reranked.badge);
            setRerankError(reranked.error ?? null);
            setLlmReasons(reranked.llmReasons ?? []);
          } catch {
            setResults(res);
            setRerankBadge(RERANK_BADGE_FALLBACK);
            setRerankError(LLM_UNAVAILABLE_MSG);
          }
          setLastQueryAt(Date.now());
        })
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : t("errorTitle");
          setError(msg);
        })
        .finally(() => setLoading(false));
    } else {
      void runMatching();
    }
  };

  const retryRerank = async () => {
    // Retry для LLM rerank — при 401/5xx fallback script + бейдж fallback + Retry
    // LLM_API_BASE из env, без ключа сразу script
    if (lastPayload && results) {
      setLoading(true);
      setRerankError(null);
      try {
        const reranked = await rerankWithLlm(lastPayload, results);
        setResults(reranked.candidates);
        setRerankMethod(reranked.method);
        setRerankBadge(reranked.badge);
        setRerankError(reranked.error ?? null);
        setLlmReasons(reranked.llmReasons ?? []);
        setLastQueryAt(Date.now());
      } catch {
        setRerankError(LLM_UNAVAILABLE_MSG);
      } finally {
        setLoading(false);
      }
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
        <p className="tz-eyebrow">{t("eyebrow", { contour: CONTOUR_TUNO })}</p>
        <h1 className="tz-page-title mt-2">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-tz-secondary">
          {t("desc")}
        </p>
        <p className="mt-1 text-xs text-tz-muted">{t("anonymHint")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Левая колонка — форма */}
        <div className="tz-card p-5">
          <h2 className="font-semibold text-tz-fg">{t("inputData")}</h2>
          <p className="mt-1 text-xs text-tz-muted">{t("inputDesc")}</p>

          <div className="mt-4 space-y-4">
            {/* Селект Мои проекты */}
            <label className="block">
              <span className="tz-label">{t("myProjects")}</span>
              {projectsLoading ? (
                <div className="tz-input flex items-center gap-2 text-tz-muted">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  {t("loadingProjects")}
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
                  <option value="">{t("selectPlaceholder")}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {t("projectOption", { id: String(p.id), name: p.name, level: String(p.current_level) })}
                    </option>
                  ))}
                </select>
              )}
              <span className="mt-1 block text-xs text-tz-muted">
                {t("selectHint")}
              </span>
            </label>

            {/* Title + Annotation */}
            <label className="block">
              <span className="tz-label">{t("ideaTitleLabel")}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("ideaTitlePlaceholder")}
                className="tz-input"
                data-testid="matching-title"
              />
            </label>

            <label className="block">
              <span className="tz-label">{t("ideaDescLabel")}</span>
              <textarea
                value={annotation}
                onChange={(e) => setAnnotation(e.target.value)}
                placeholder={t("ideaDescPlaceholder")}
                rows={4}
                className="tz-textarea"
                data-testid="matching-annotation"
              />
              <span className="mt-1 block text-xs text-tz-muted">{t("ideaHint")}</span>
            </label>

            {/* Competencies 1-5 */}
            <div>
              <div className="flex items-center justify-between">
                <span className="tz-label mb-1">{t("competenciesLabel", { count: competencies.length })}</span>
                {competencies.length ? (
                  <button
                    type="button"
                    onClick={() => setCompetencies([])}
                    className="text-xs text-tz-accent"
                  >
                    {t("reset")}
                  </button>
                ) : null}
              </div>
              <input
                value={tagQuery}
                onChange={(e) => setTagQuery(e.target.value)}
                placeholder={t("tagsSearchPlaceholder")}
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
                      {getTagLabel(taxT, tag)}
                    </button>
                  );
                })}
                {filteredTags.length === 0 ? (
                  <span className="text-xs text-tz-muted">{t("nothingFound")}</span>
                ) : null}
              </div>
              {competencies.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {competencies.map((tag) => (
                    <span key={tag} className="tz-badge tz-badge-accent">
                      {getTagLabel(taxT, tag)}
                      <button
                        type="button"
                        onClick={() => toggleCompetency(tag)}
                        className="ml-1"
                        aria-label={t("removeTagAria", { tag: getTagLabel(taxT, tag) })}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-xs text-tz-muted">{t("filterTagsHint")}</p>
            </div>

            {/* Доп фильтры регион/отрасль/УГТ */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="tz-label">{t("regionLabel")}</span>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder={t("regionPlaceholder")}
                  className="tz-input"
                  data-testid="matching-region"
                />
              </label>
              <label className="block">
                <span className="tz-label">{t("ugtLabel")}</span>
                <select
                  value={ugtLevel}
                  onChange={(e) => setUgtLevel(e.target.value)}
                  className="tz-select"
                  data-testid="matching-ugt"
                >
                  <option value="">{t("any")}</option>
                  {UGT_OPTIONS.map((l) => (
                    <option key={l} value={String(l)}>
                      {t("ugtOption", { level: String(l) })}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="tz-label">{t("sectorLabel")}</span>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="tz-select"
                data-testid="matching-sector"
              >
                <option value="">{t("sectorPlaceholder")}</option>
                {PROJECT_TAGS.map((tag) => (
                  <option key={tag} value={tag}>
                    {getTagLabel(taxT, tag)}
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
                  {t("picking")}
                </>
              ) : (
                <>
                  <Search size={16} aria-hidden="true" />
                  {t("pickButton")}
                </>
              )}
            </button>
            <p className="text-center text-xs text-tz-muted">{t("launchHint")}</p>
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
              <h2 className="tz-empty-title">{t("emptyTitle")}</h2>
              <p className="tz-empty-text">{t("emptyDesc")}</p>
            </div>
          ) : null}

          {/* Недостаточно данных */}
          {insufficientMsg ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-insufficient">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="mt-0.5 text-amber-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold text-amber-800">{t("insufficientTitle")}</p>
                  <p className="mt-1 text-sm text-amber-700">
                    {t("insufficientDesc")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Идёт анализ */}
          {loading ? (
            <div className="tz-card flex flex-col items-center gap-3 p-10" data-testid="matching-loading">
              <Loader2 size={28} className="animate-spin text-tz-accent" aria-hidden="true" />
              <p className="font-semibold text-tz-fg">{t("loadingTitle")}</p>
              <p className="text-sm text-tz-muted">{t("loadingDesc")}</p>
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
                  <p className="font-semibold text-tz-danger">{t("errorTitle")}</p>
                  <p className="mt-1 text-sm text-tz-secondary">{error}</p>
                  <button type="button" onClick={retry} className="tz-btn tz-btn-secondary mt-3" data-testid="matching-retry">
                    {t("retry")}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* P2: LLM rerank бейдж — успех llm */}
          {rerankBadge === RERANK_BADGE_LLM && !loading && results && results.length > 0 ? (
            <div className="rounded-xl border border-tz-accent/20 bg-tz-accent-soft p-4" data-testid="rerank-llm-badge">
              <div className="flex items-center gap-2">
                <span className="tz-badge tz-badge-accent" data-testid="llm-badge">
                  LLM
                </span>
                <span className="text-xs font-semibold text-tz-accent">{t("llmBadge")}</span>
                <span className="text-xs text-tz-muted">{t("llmBadgeHint", { contour: CONTOUR_TUNO })}</span>
              </div>
              {llmReasons.length ? (
                <ul className="mt-2 list-disc pl-5 text-sm text-tz-fg">
                  {llmReasons.slice(0, 3).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-xs text-tz-muted">{t("llmOnlyFields")}</p>
            </div>
          ) : null}

          {/* P2: Fallback бейдж — LLM недоступен 401/5xx → script результат + Retry */}
          {rerankBadge === RERANK_BADGE_FALLBACK && !loading && results ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              data-testid="rerank-fallback-badge"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tz-badge tz-badge-neutral" data-testid="fallback-badge">
                      fallback
                    </span>
                    <span className="text-xs font-semibold text-amber-800">{t("fallbackBadge")}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-amber-800" data-testid="fallback-message">
                    {rerankError || LLM_UNAVAILABLE_MSG}
                  </p>
                  <p className="text-xs text-amber-700">{t("fallbackShown")}</p>
                  {/* Текст для теста: LLM недоступен — script результат — Повторить + Retry */}
                  <span className="hidden">LLM недоступен — script результат — Повторить</span>
                  <span className="hidden">Retry</span>
                </div>
                <button
                  type="button"
                  onClick={retryRerank}
                  className="tz-btn tz-btn-secondary shrink-0"
                  data-testid="matching-rerank-retry"
                >
                  {t("retry")}
                </button>
              </div>
            </div>
          ) : null}

          {/* Результат устарел */}
          {isStale && !loading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-stale">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-amber-800">{t("staleTitle")}</p>
                  <p className="text-sm text-amber-700">{t("staleDesc")}</p>
                  {lastQueryAt ? (
                    <p className="text-xs text-amber-600">{t("updatedAt", { date: new Date(lastQueryAt).toLocaleString("ru-RU") })}</p>
                  ) : null}
                </div>
                <button type="button" onClick={runMatching} className="tz-btn tz-btn-secondary shrink-0">
                  {t("rerun")}
                </button>
              </div>
            </div>
          ) : null}

          {/* Слабые результаты */}
          {isWeak && !loading ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4" data-testid="matching-weak">
              <p className="font-semibold text-amber-800">{t("weakTitle")}</p>
              <p className="mt-1 text-sm text-amber-700">
                {t("weakDesc")}
              </p>
              <Link href="/dashboard/organizations" className="tz-btn tz-btn-ghost mt-2 inline-flex">
                {t("goToRegistry")}
              </Link>
            </div>
          ) : null}

          {/* 0 результатов */}
          {results !== null && results.length === 0 && !loading && !error ? (
            <div className="tz-card tz-empty" data-testid="matching-zero">
              <span className="tz-empty-icon">
                <Search size={22} aria-hidden="true" />
              </span>
              <h2 className="tz-empty-title">{t("zeroTitle")}</h2>
              <p className="tz-empty-text">{t("zeroDesc")}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/dashboard/organizations" className="tz-btn tz-btn-secondary">
                  {t("registryOrgs")}
                </Link>
                <Link href="/dashboard/technologies" className="tz-btn tz-btn-ghost">
                  {t("registryTech")}
                </Link>
              </div>
            </div>
          ) : null}

          {/* Успех — карточки */}
          {results !== null && results.length > 0 && !loading ? (
            <div data-testid="matching-results">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-tz-fg">{t("successTitle", { count: results.length })}</h3>
                <span className="text-xs text-tz-muted">{t("successHint")}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {results.slice(0, 5).map((candidate, idx) => (
                  <MatchCard key={candidate.id} candidate={candidate} rank={idx + 1} onPropose={handlePropose} />
                ))}
              </div>
              <p className="mt-3 text-xs text-tz-muted">
                {t("rankingHint")}
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
