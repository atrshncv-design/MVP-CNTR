'use client';

import { useSession } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Loader2,
  FileText,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { CLIENT_API_BASE as API_URL } from "@/lib/public-api";


interface Source {
  id: number;
  title: string;
  doc_type: string;
  ugt_level?: number | null;
  source_uri?: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

/** Приветственное сообщение — точка отсчёта для кнопки «Очистить чат» */
const INITIAL_ASSISTANT_MESSAGE: Message = {
  role: 'assistant',
  content: 'Здравствуйте! Я AI-ассистент платформы «Технозрелость». Задайте мне вопрос по методологии ГОСТ Р 58048-2017, уровням УГТ или документации проектов.',
};

export default function AiAssistantPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || sending || !session?.user?.accessToken) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.accessToken}`,
        },
        body: JSON.stringify({ message: userMsg.content, history: [] }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply.content,
        sources: data.sources?.map((s: Source) => ({
          id: s.id,
          title: s.title,
          doc_type: s.doc_type,
          ugt_level: s.ugt_level ?? null,
          source_uri: s.source_uri ?? null,
        })) ?? [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: 'Произошла ошибка при обращении к серверу. Попробуйте ещё раз.',
      }]);
    } finally {
      setSending(false);
    }
  };

  /** Очистить чат — вернуть приветственное сообщение */
  const clearChat = () => {
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
  };

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="tz-page-title text-tz-fg">AI-ассистент</h1>
          <p className="text-sm text-tz-muted">
            Задавайте вопросы по ГОСТ Р 58048-2017, уровням УГТ и документации
          </p>
        </div>
        <button
          onClick={clearChat}
          disabled={messages.length <= 1 || sending}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-tz-border bg-tz-surface px-3 py-2 text-xs font-medium text-tz-muted transition-colors hover:border-tz-danger hover:bg-tz-danger-soft hover:text-tz-danger disabled:opacity-50 disabled:hover:border-tz-border disabled:hover:bg-tz-surface disabled:hover:text-tz-muted"
          title="Удалить все сообщения"
        >
          <Trash2 size={14} />
          Очистить чат
        </button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-tz-border bg-tz-surface p-4 space-y-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                msg.role === 'user'
                  ? 'bg-[var(--tz-accent)]'
                  : 'bg-tz-surface-2'
              }`}
            >
              {msg.role === 'user'
                ? <User size={16} className="text-white" />
                : <Bot size={16} className="text-[var(--tz-accent)]" />
              }
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-[var(--tz-accent)] text-white'
                  : 'bg-tz-soft text-tz-fg'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 space-y-2 border-t border-tz-border pt-2">
                  <p className="flex items-center gap-1 text-xs text-tz-muted">
                    <FileText size={12} /> Источники:
                  </p>
                  {msg.sources.map((s) => (
                    <div key={s.id} className="flex items-start gap-2">
                      <FileText size={14} className="mt-0.5 shrink-0 text-[var(--tz-accent)]" />
                      <div className="min-w-0">
                        <p className="text-xs leading-snug text-tz-fg">{s.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {typeof s.ugt_level === 'number' && s.ugt_level > 0 && (
                            <span className="rounded bg-[var(--tz-accent)]/10 px-1.5 py-px text-[10px] font-medium text-[var(--tz-accent)]">
                              УГТ {s.ugt_level}
                            </span>
                          )}
                          {s.source_uri && (
                            <a
                              href={s.source_uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-tz-muted underline decoration-gray-300 underline-offset-2 hover:text-[var(--tz-accent)]"
                            >
                              раздел ГОСТа <ExternalLink size={10} />
                            </a>
                          )}
                          {s.doc_type && (
                            <span className="text-[10px] text-tz-muted">{s.doc_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-tz-surface-2">
              <Bot size={16} className="text-[var(--tz-accent)]" />
            </div>
            <div className="rounded-2xl bg-tz-soft px-4 py-3">
              <Loader2 size={16} className="animate-spin text-[var(--tz-accent)]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="mx-4 mb-3 rounded-lg border border-tz-warning/30 bg-tz-warning-soft px-4 py-2.5 text-sm text-tz-fg">
        <strong>Поиск по ГОСТам временно недоступен.</strong> Ассистент отвечает
        на основе общих знаний модели, без цитирования разделов ГОСТов из базы
        платформы. Цитирование будет восстановлено после подключения
        эмбеддинг-модели.
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Введите вопрос по ГОСТ Р 58048-2017..."
          className="flex-1 rounded-xl border border-tz-border bg-tz-surface px-4 py-3 text-sm outline-none focus:border-[var(--tz-accent)]"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          className="flex items-center gap-2 rounded-xl bg-[var(--tz-accent)] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[var(--tz-accent-hover)] disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Отправить
        </button>
      </div>
    </div>
  );
}
