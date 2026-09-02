/**
 * Публичный API модуля matching (тикет 05 + P2 03).
 * Выставляет MatchingMode и обезличивание, прячет скоринг/LLM rerank.
 * P2: добавлен rerankWithLlm — шлёт только чистые поля без ПДн, contour tuno,
 * LLM_API_BASE из env, без ключа сразу script, 401/5xx fallback + Retry.
 */
export { MatchingMode } from "./MatchingMode";
export { MatchCard } from "./MatchCard";
export {
  CONTOUR_TUNO,
  ALLOWED_MATCH_FIELDS,
  sanitizeMatchingInput,
  sanitizeFromProject,
  assertNoPii,
  isInsufficient,
} from "./sanitize";
export {
  rerankWithLlm,
  rerank,
  rerankWithLLM,
  getLlmBase,
  getLlmKey,
  hasLlmKey,
  isLlmAvailable,
  getLlmModel,
  buildLlmRequestBody,
  RERANK_BADGE_LLM,
  RERANK_BADGE_FALLBACK,
  RERANK_BADGE_SCRIPT,
  LLM_UNAVAILABLE_MSG,
  LLM_RETRY_LABEL,
  RETRY_LABEL,
} from "./llm.ts";
export type { RerankResult, RerankBadge, RerankMethod } from "./llm.ts";
export type { MatchingIn, MatchCandidate, MatchOut } from "@/lib/types";
