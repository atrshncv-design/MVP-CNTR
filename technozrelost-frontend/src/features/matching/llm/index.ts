/**
 * Публичный шов модуля matching/llm (P2, R03, тикет 03).
 * Владеет rerank, выставляет rerankWithLlm/rerank, прячет LLM tuno и fallback.
 * Почему barrel: единый импорт из @/features/matching/llm и @/features/matching.
 */

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
  LLM_API_BASE_ENV,
  LLM_API_KEY_ENV,
} from "../llm.ts";
export type { RerankResult, RerankBadge, RerankMethod } from "../llm.ts";
export { CONTOUR_TUNO } from "../sanitize.ts";
