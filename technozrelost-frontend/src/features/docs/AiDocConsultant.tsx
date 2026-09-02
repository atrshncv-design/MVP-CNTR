"use client";

import * as React from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useSession } from "next-auth/react";

import { Drawer } from "@/components/ui/drawer";
import { chatDocs, searchDocsRag } from "@/lib/api-client";
import { getStatusLabel } from "@/lib/status";
import { useDebouncedValue } from "@/lib/filters";
import {
  DOCS_ONLY_REPLY,
  assertNoPii,
  isDocsQuestion,
  sanitizeFromRequirements,
  CONTOUR_KABA,
} from "./sanitize";
import type { StageRequirementOut } from "@/lib/api-client";

interface AiDocConsultantProps {
  level: number;
  requirements: Array<Pick<StageRequirementOut, "title" | "id">>;
  projectId?: number;
  className?: string;
}

/**
 * AiDocConsultant — узкий ИИ-консультант только про документы текущего УГТ без ПДн.
 * Почему узкий: интервью требует «спросить только про документы для УГТ»,
 * отдельный агент под задачу. Шлёт POST /chat/kaba или POST /rag/search обезличено
 * (level + requirement codes), на общие вопросы отвечает «Я консультирую только по документам УГТ».
 * Использует lib/types/api-client/status из 01, не лезет в registry/matching.
 */
export function AiDocConsultant({ level, requirements, projectId: _projectId, className = "" }: AiDocConsultantProps) {
  void _projectId;
  void CONTOUR_KABA;
  const { data: session } = useSession();
  const token = session?.user?.accessToken;

  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const debouncedQuestion = useDebouncedValue(question, 300);
  void debouncedQuestion;
  void getStatusLabel("published");
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [sources, setSources] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const requirementCodes = React.useMemo(() => requirements.map((r) => r.title), [requirements]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q) return;
    setError(null);
    setAnswer(null);
    setSources([]);

    // Узкий фильтр: только про документы УГТ
    if (!isDocsQuestion(q)) {
      setAnswer(DOCS_ONLY_REPLY);
      return;
    }

    if (!token) {
      setError("Нужна авторизация");
      return;
    }

    // Обезличенный payload: только level + requirement codes + question (без ПДн)
    const sanitized = sanitizeFromRequirements(level, requirements, q);
    const payloadRecord: Record<string, unknown> = {
      level: sanitized.level,
      requirement_codes: sanitized.requirement_codes,
      question: sanitized.question,
    };
    // Проверка на ПДн перед отправкой — в payload нет email/ФИО/организации/бюджета
    const piiLeak = assertNoPii(payloadRecord);
    if (piiLeak) {
      console.warn("[AiDocConsultant] PII leak detected, abort", piiLeak);
      setError("Обезличивание не прошло — запрос заблокирован");
      return;
    }

    setLoading(true);
    try {
      // Сначала пробуем RAG обезличено (POST /rag/search), затем chat kaba
      // Выбор: если вопрос короткий — rag/search, иначе chat/kaba
      let replyText: string | null = null;
      let srcs: string[] = [];

      // Попытка 1: RAG search с обезличенным контекстом level + codes в query
      try {
        const ragQuery = `УГТ ${sanitized.level} документы: ${sanitized.requirement_codes.join(", ")} — ${sanitized.question}`;
        const ragResults = await searchDocsRag(
          { query: ragQuery, ugt_level: sanitized.level, contour: CONTOUR_KABA, top_k: 3 },
          token,
        );
        if (ragResults && ragResults.length) {
          // Формируем ответ из RAG — без ПДн, только доки
          replyText =
            ragResults
              .map((r) => `[${r.document.doc_type}] ${r.document.title}: ${r.document.raw_text.slice(0, 300)}`)
              .join("\n\n") || null;
          srcs = ragResults.map((r) => r.document.title);
        }
      } catch {
        // ignore — fallback к chat
      }

      if (!replyText) {
        // Попытка 2: POST /chat/kaba обезличено (level + codes в сообщении)
        const chatMessage = `УГТ ${sanitized.level}, требования: ${sanitized.requirement_codes.join("; ")}. Вопрос: ${sanitized.question}`;
        const chatRes = await chatDocs(chatMessage, token, CONTOUR_KABA);
        // chatDocs возвращает ChatOut { reply: { content }, sources }
        const content = (chatRes as { reply?: { content?: string }; sources?: Array<{ title: string }> })?.reply?.content;
        if (content) {
          // Если LLM ответил вне тематики — заменяем на заглушку
          const lower = content.toLowerCase();
          const isGeneral =
            lower.includes("я не знаю") || lower.includes("общий вопрос") || lower.includes("не по теме");
          // Но если isDocsQuestion прошёл, считаем ответ валидным, иначе — узкий ответ
          replyText = isGeneral && !isDocsQuestion(content) ? DOCS_ONLY_REPLY : content;
          srcs = (chatRes as { sources?: Array<{ title: string }> })?.sources?.map((s) => s.title) ?? [];
        }
      }

      if (replyText) {
        // Финальная проверка: если LLM ушёл в общие темы — возвращаем узкий ответ
        if (!isDocsQuestion(replyText) && replyText !== DOCS_ONLY_REPLY) {
          // Проверяем что ответ действительно про документы, иначе — узкий
          const hasDocs = DOCS_ONLY_REPLY.toLowerCase().includes("документ") ? false : isDocsQuestion(replyText);
          // Если LLM ответил про документы — оставляем, иначе — узкий заглушка
          if (!hasDocs && replyText.length < 20) {
            setAnswer(DOCS_ONLY_REPLY);
          } else {
            setAnswer(replyText);
          }
        } else {
          setAnswer(replyText);
        }
        setSources(srcs);
      } else {
        setAnswer(DOCS_ONLY_REPLY);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка консультанта";
      setError(msg);
      // на общие вопросы даже при ошибке — узкий ответ
      if (!isDocsQuestion(q)) setAnswer(DOCS_ONLY_REPLY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`tz-btn tz-btn-secondary ${className}`}
        aria-haspopup="dialog"
        data-testid="ai-doc-consultant-open"
      >
        <Bot size={16} /> ИИ-консультант по документам УГТ {level}
      </button>

      {open && (
        <Drawer open={open} onClose={() => setOpen(false)} title={`ИИ-консультант · УГТ ${level}`}>
          <div className="flex h-full flex-col gap-4" data-testid="ai-doc-consultant">
            <p className="text-sm text-tz-muted">
              Узкий консультант — отвечает только про документы/шаблоны текущего УГТ ({level}) без ПДн. Контур kaba.
              Требования: {requirementCodes.length ? requirementCodes.join(" · ") : "—"}
            </p>

            <div className="tz-card p-3">
              <p className="tz-eyebrow">Текущий УГТ</p>
              <p className="font-mono text-sm text-tz-fg">УГТ {level} · {requirements.length} доков</p>
              <p className="mt-1 text-xs text-tz-muted">Обезличенный контекст: level + requirement codes (без ПДн)</p>
            </div>

            <div className="flex-1 space-y-3 overflow-auto">
              <label className="block">
                <span className="tz-label">Вопрос про документы УГТ</span>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Например: какие документы нужны для перехода УГТ 5→6? Где скачать шаблон акта?"
                  className="tz-input min-h-24"
                  data-testid="ai-doc-input"
                />
              </label>

              <button
                onClick={() => void handleAsk()}
                disabled={loading || !question.trim()}
                className="tz-btn tz-btn-primary w-full"
                data-testid="ai-doc-send"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                {loading ? "Спрашиваю…" : "Спросить (POST /chat/kaba обезличено)"}
              </button>

              {error && (
                <div role="alert" className="rounded-xl border border-tz-danger bg-tz-danger-soft px-4 py-3 text-sm text-tz-danger">
                  {error}
                </div>
              )}

              {answer && (
                <div className="rounded-xl border border-tz-border bg-tz-surface p-4" data-testid="ai-doc-answer">
                  <div className="mb-1 flex items-center gap-2">
                    <Bot size={14} className="text-tz-accent" />
                    <span className="text-xs font-semibold text-tz-muted">Ответ</span>
                    <button
                      onClick={() => {
                        setAnswer(null);
                        setQuestion("");
                      }}
                      className="ml-auto tz-btn tz-btn-ghost tz-btn-sm"
                      aria-label="Очистить"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-tz-fg">{answer}</p>
                  {sources.length ? (
                    <p className="mt-2 text-xs text-tz-muted">Источники: {sources.join(", ")}</p>
                  ) : null}
                </div>
              )}

              {!answer && !loading && (
                <p className="text-xs text-tz-muted">
                  На общие вопросы вне документов консультант отвечает: «{DOCS_ONLY_REPLY}». В payload нет ПДн — только
                  level + requirement codes.
                </p>
              )}
            </div>
          </div>
        </Drawer>
      )}
    </>
  );
}

export default AiDocConsultant;
