/**
 * Публичный API модуля matching (тикет 05).
 * Выставляет MatchingMode и обезличивание, прячет скоринг/LLM rerank.
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
export type { MatchingIn, MatchCandidate, MatchOut } from "@/lib/types";
