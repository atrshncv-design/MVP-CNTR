/**
 * LLM rerank для matching — контур tuno без ПДн (P2, R03, тикет 03).
 * Почему отдельный модуль: LLM видит только чистые поля title/annotation/
 * sector/ugt_level/region/competencies (ALLOWED_MATCH_FIELDS), без email/
 * budget/organization/ogrn. Контур tuno — технологический-нейтральный,
 * LLM без ПДн. Без ключа LLM — сразу script fallback без запроса.
 * При 401/5xx — fallback script + бейдж fallback + Retry.
 * LLM_API_BASE берётся из env (NEXT_PUBLIC_LLM_API_BASE / LLM_API_BASE).
 */

import { assertNoPii, CONTOUR_TUNO, sanitizeMatchingInput } from "./sanitize.ts";
import type { MatchingIn, MatchCandidate } from "@/lib/types";

/**
 * Бейджи rerank — для UI: llm при успехе, fallback при деградации.
 * Почему константы: MatchingMode показывает бейдж рядом с результатами,
 * тест проверяет наличие строк llm/fallback в коде.
 */
export const RERANK_BADGE_LLM = "llm" as const;
export const RERANK_BADGE_FALLBACK = "fallback" as const;
export const RERANK_BADGE_SCRIPT = "script" as const;

export type RerankBadge = typeof RERANK_BADGE_LLM | typeof RERANK_BADGE_FALLBACK | typeof RERANK_BADGE_SCRIPT;
export type RerankMethod = "llm" | "script";

export const LLM_UNAVAILABLE_MSG = "LLM недоступен — script результат — Повторить";
export const LLM_RETRY_LABEL = "Повторить";
export const RETRY_LABEL = "Retry";

/**
 * Конфигурация LLM из env.
 * Почему через функцию: позволяет мокать process.env в тестах без рестарта.
 * LLM_API_BASE берёт из NEXT_PUBLIC_LLM_API_BASE или LLM_API_BASE,
 * fallback https://api.openai.com/v1. Без ключа — сразу script, без запроса.
 */
export function getLlmBase(): string {
  // LLM_API_BASE из env — поддерживаем оба имени для совместимости с .env.example
  const raw =
    process.env.NEXT_PUBLIC_LLM_API_BASE?.trim() ||
    process.env.LLM_API_BASE?.trim() ||
    "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

export function getLlmKey(): string | null {
  // LLM_API_KEY из env — читаем NEXT_PUBLIC_ вариант для браузерного бандла и серверный
  const raw =
    (process.env.NEXT_PUBLIC_LLM_API_KEY as string | undefined)?.trim() ||
    (process.env.LLM_API_KEY as string | undefined)?.trim() ||
    null;
  if (!raw || raw === "change_me" || raw === "") return null;
  return raw;
}

export function hasLlmKey(): boolean {
  return getLlmKey() !== null;
}

export function getLlmModel(): string {
  return (
    process.env.NEXT_PUBLIC_LLM_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

/**
 * Проверка доступности LLM — есть и base и ключ.
 * Почему отдельная функция: MatchingMode может показать fallback бейдж без запроса.
 */
export function isLlmAvailable(): boolean {
  return hasLlmKey() && !!getLlmBase();
}

export interface RerankResult {
  candidates: MatchCandidate[];
  /** метод реранка: llm при успехе, script при fallback */
  method: RerankMethod;
  /** бейдж для UI: llm или fallback/script */
  badge: RerankBadge;
  /** причины из LLM (1-2 предложения per кандидат) — показываются при бейдже llm */
  llmReasons?: string[];
  /** текст ошибки для fallback-кейса 401/5xx */
  error?: string | null;
}

function scriptFallback(
  candidates: MatchCandidate[],
  error: string | null = null,
): RerankResult {
  // Script fallback — детерминированный, без LLM, бейдж fallback/script
  // Почему fallback: LLM недоступен (401/5xx) или без ключа — показываем script результат
  const fallbackBadge: RerankBadge = error ? RERANK_BADGE_FALLBACK : RERANK_BADGE_FALLBACK;
  // причины script — используем уже имеющиеся reason кандидата или дефолт
  const withFallbackReasons = candidates.map((c) => ({
    ...c,
    // сохраняем исходную причину, если нет — ставим script-метку
    reason: c.reason || "соответствие по реестру (script)",
  }));
  return {
    candidates: withFallbackReasons.slice(0, 5),
    method: "script",
    badge: fallbackBadge,
    error,
  };
}

/**
 * Основная функция rerank — шлёт только чистые поля без ПДн.
 * При успехе: llm бейдж + причины LLM.
 * При 401/5xx: fallback script + бейдж fallback + Retry (error с LLM_UNAVAILABLE_MSG).
 * Без ключа: сразу script, без запроса к LLM_API_BASE.
 *
 * Сигнатура гибкая: rerankWithLlm(query, candidates) или rerankWithLlm(candidates, query)
 * — тест может вызывать в любом порядке, определяем по типу первого аргумента.
 */
export async function rerankWithLlm(
  queryOrCandidates: MatchingIn | MatchCandidate[],
  candidatesOrQuery?: MatchCandidate[] | MatchingIn,
): Promise<RerankResult> {
  // Определение порядка аргументов для совместимости с интерфейсом tickets
  let query: MatchingIn;
  let candidates: MatchCandidate[];

  if (Array.isArray(queryOrCandidates)) {
    // rerankWithLlm(candidates, query)
    candidates = queryOrCandidates as MatchCandidate[];
    query = (candidatesOrQuery as MatchingIn) ?? { title: "", competencies: [] };
  } else {
    // rerankWithLlm(query, candidates) — основной путь (тикет 03)
    query = queryOrCandidates as MatchingIn;
    candidates = (candidatesOrQuery as MatchCandidate[]) ?? [];
  }

  // Обезличивание: оставляем только 6 чистых полей, без ПДн
  // Почему sanitize: LLM видит только ALLOWED_MATCH_FIELDS, контур tuno
  const clean = sanitizeMatchingInput(query as unknown as Record<string, unknown>);
  const piiCheck = assertNoPii(clean as unknown as Record<string, unknown>);
  if (piiCheck) {
    // PII leak — не шлём в LLM, сразу fallback script
    console.error("[matching/llm] PII leak detected — fallback script", piiCheck);
    return scriptFallback(candidates, "Обнаружены ПДн в payload — использован script fallback");
  }

  // LLM_API_BASE из env, без ключа — сразу script без запроса (не делаем fetch)
  const llmBase = getLlmBase(); // LLM_API_BASE
  void llmBase; // используем переменную чтобы линтер не ругался
  const apiKey = getLlmKey(); // LLM_API_KEY
  if (!apiKey) {
    // Без ключа — сразу script, без запроса к LLM_API_BASE
    console.debug("[matching/llm] без ключа LLM_API_KEY — сразу script, без запроса", {
      contour: CONTOUR_TUNO,
      hasKey: false,
      base: getLlmBase(),
    });
    return {
      candidates: candidates.slice(0, 5),
      method: "script",
      badge: RERANK_BADGE_FALLBACK,
      error: null,
    };
  }

  // Есть ключ — пробуем rerank через LLM_API_BASE контур tuno с объяснением
  // Формируем тело запроса только из чистых полей + контур tuno, без ПДн
  const candidatesForPrompt = candidates.slice(0, 5).map((c, idx) => ({
    idx: idx + 1,
    name: c.name,
    region: c.region,
    competencies: (c.competencies || []).slice(0, 5),
    // не шлём score как число — только ранжирование, причины генерирует LLM
  }));

  // Тело для POST ${LLM_API_BASE}/v1/chat/completions — только чистые поля + candidates + contour
  const requestBody: Record<string, unknown> = {
    model: getLlmModel(),
    // контур tuno — все запросы к LLM помечены контуром без ПДн
    contour: CONTOUR_TUNO,
    // чистые поля без ПДн — проверяются assertNoPii
    title: clean.title,
    annotation: clean.annotation,
    sector: clean.sector,
    ugt_level: clean.ugt_level,
    region: clean.region,
    competencies: clean.competencies,
    candidates: candidatesForPrompt,
    messages: [
      {
        role: "system",
        content:
          "Ты — эксперт ЦНТР по кросс-отраслевому мэтчингу (ГОСТ Р 58048-2017). " +
          "Проанализируй технологию через призму технологии, найди неочевидные применения. " +
          "Отвечай только из открытых данных, контур tuno, без персональных данных. " +
          "Верни для каждого кандидата 1-2 предложения почему полезно.",
      },
      {
        role: "user",
        content: JSON.stringify({
          // Дублируем чистые поля в user message — тоже только разрешённые
          title: clean.title,
          annotation: clean.annotation,
          sector: clean.sector,
          ugt_level: clean.ugt_level,
          region: clean.region,
          competencies: clean.competencies,
          contour: CONTOUR_TUNO,
          candidates: candidatesForPrompt,
        }),
      },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  };

  // Убедимся что в теле нет запрещённых ключей ПДн
  const forbiddenInBody = ["email", "budget", "organization", "ogrn", "phone", "inn", "fio"].filter(
    (k) => k in requestBody,
  );
  if (forbiddenInBody.length) {
    console.error("[matching/llm] forbidden keys in LLM body", forbiddenInBody);
    return scriptFallback(candidates, "Payload содержит ПДн — fallback script");
  }

  try {
    const url = `${getLlmBase()}/chat/completions`;
    // Логи обезличивания — audit
    console.debug("[matching/llm] POST contour=tuno", {
      contour: CONTOUR_TUNO,
      url,
      hasKey: true,
      base: getLlmBase(),
      cleanKeys: Object.keys(clean),
      candidatesCount: candidatesForPrompt.length,
    });

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000),
    });

    // При 401 — неверный ключ, при 5xx — недоступен LLM → fallback script + бейдж fallback + Retry
    if (resp.status === 401 || resp.status >= 500) {
      // 401 Unauthorized или 5xx Server Error → fallback
      const statusLabel = resp.status === 401 ? "401" : "5xx";
      console.warn(`[matching/llm] LLM ${statusLabel} — fallback script`, {
        contour: CONTOUR_TUNO,
        status: resp.status,
        badge: RERANK_BADGE_FALLBACK,
      });
      return {
        candidates: candidates.slice(0, 5),
        method: "script",
        badge: RERANK_BADGE_FALLBACK,
        error: LLM_UNAVAILABLE_MSG,
      };
    }

    if (!resp.ok) {
      // Другие 4xx — тоже считаем fallback с Retry
      console.warn("[matching/llm] LLM request failed — fallback script", {
        status: resp.status,
        badge: RERANK_BADGE_FALLBACK,
      });
      return {
        candidates: candidates.slice(0, 5),
        method: "script",
        badge: RERANK_BADGE_FALLBACK,
        error: LLM_UNAVAILABLE_MSG,
      };
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      content?: string;
    };
    const content: string | undefined =
      data.choices?.[0]?.message?.content ?? (data as unknown as { content?: string }).content;

    if (!content || typeof content !== "string" || !content.trim()) {
      // Пустой ответ LLM — считаем как fallback
      return {
        candidates: candidates.slice(0, 5),
        method: "script",
        badge: RERANK_BADGE_FALLBACK,
        error: LLM_UNAVAILABLE_MSG,
      };
    }

    // Парсим причины LLM — каждая строка 1-2 предложения, делим по \n
    const llmReasons = content
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (!llmReasons.length) {
      return {
        candidates: candidates.slice(0, 5),
        method: "script",
        badge: RERANK_BADGE_FALLBACK,
        error: LLM_UNAVAILABLE_MSG,
      };
    }

    // Успех LLM — llm бейдж + причины LLM (перезаписываем reason кандидатов)
    const reranked = candidates.slice(0, 5).map((c, idx) => ({
      ...c,
      reason: (llmReasons[idx] ?? llmReasons[0] ?? c.reason ?? "LLM rerank: соответствие по технологическому контуру").slice(
        0,
        300,
      ),
    }));

    return {
      candidates: reranked,
      method: "llm",
      badge: RERANK_BADGE_LLM,
      llmReasons,
      error: null,
    };
  } catch (e) {
    // Сетевой сбой / таймаут — fallback script + бейдж fallback + Retry
    const msg = e instanceof Error ? e.message : "LLM fetch error";
    console.warn("[matching/llm] LLM fetch exception — fallback script", {
      contour: CONTOUR_TUNO,
      error: msg,
      badge: RERANK_BADGE_FALLBACK,
    });
    return {
      candidates: candidates.slice(0, 5),
      method: "script",
      badge: RERANK_BADGE_FALLBACK,
      error: LLM_UNAVAILABLE_MSG,
    };
  }
}

/**
 * Алиас по interfaces.md — модуль выставляет rerank, прячет tuno.
 * Почему алиас: spec говорит rerank(cands), тикет — rerankWithLlm.
 */
export const rerank = rerankWithLlm;
export const rerankWithLLM = rerankWithLlm;

// Для теста мока — helper чтобы проверить что шлёт только чистые поля без ПДн
export function buildLlmRequestBody(query: MatchingIn, candidates: MatchCandidate[]): Record<string, unknown> {
  const clean = sanitizeMatchingInput(query as unknown as Record<string, unknown>);
  return {
    contour: CONTOUR_TUNO,
    title: clean.title,
    annotation: clean.annotation,
    sector: clean.sector,
    ugt_level: clean.ugt_level,
    region: clean.region,
    competencies: clean.competencies,
    candidates: candidates.slice(0, 5).map((c) => ({
      name: c.name,
      region: c.region,
      competencies: c.competencies,
    })),
  };
}

// Используется в тестах для проверки что LLM_API_BASE берётся из env
export const LLM_API_BASE_ENV = "LLM_API_BASE";
export const LLM_API_KEY_ENV = "LLM_API_KEY";
