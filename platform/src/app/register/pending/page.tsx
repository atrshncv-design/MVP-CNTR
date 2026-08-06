/**
 * T-013. Регистрация, шаг 5 из 5 — ожидание решения (/register/pending).
 *
 * Состояния (STATES.md §1, ROUTES.md /register/pending):
 * - pending — «Заявка отправлена на проверку»: НЕ выглядит как успешный
 *   доступ (доступ откроется после одобрения), показано «что дальше»;
 * - rejected — отклонено С ПРИЧИНОЙ + восстановление черновика
 *   («исправить и подать заново»);
 * - clarification — запрошены уточнения + восстановление черновика.
 * В dev-режиме доступна панель симуляции решения модератора.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  Info,
  Mail,
  RotateCcw,
} from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationProgress } from "@/components/auth/registration-progress";
import {
  REGISTRATION_STEPS,
  firstInvalidStep,
  getRoleLabel,
  type RegistrationDraftData,
} from "@/lib/registration";
import {
  getRegistrationApplication,
  registerDraft,
  setRegistrationApplicationStatus,
  type RegistrationApplication,
} from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";

/** Маршрут для продолжения работы над заявкой (первый невалидный шаг). */
function resumeHref(draft: RegistrationDraftData): string {
  const invalid = firstInvalidStep(draft);
  if (!invalid) return "/register/confirm";
  return (
    REGISTRATION_STEPS.find((step) => step.id === invalid)?.href ??
    "/register"
  );
}

export default function RegisterPendingPage() {
  const router = useRouter();
  const [application, setApplication] = useState<RegistrationApplication | null>(null);
  const [ready, setReady] = useState(false);
  const [devNote, setDevNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setApplication(getRegistrationApplication());
      setReady(true);
    })();
  }, []);

  const resume = () => {
    if (!application) return;
    // Восстановление черновика из снимка заявки (recovery rejected/incomplete).
    registerDraft(application.draft);
    router.push(resumeHref(application.draft));
  };

  const simulate = (status: "rejected" | "clarification" | "pending") => {
    let reason: string | undefined;
    if (status === "rejected") {
      reason =
        window.prompt(
          "Причина отклонения (будет показана пользователю):",
          "Указанная организация не найдена в ЕГРЮЛ. Проверьте ИНН и название.",
        ) ?? undefined;
    } else if (status === "clarification") {
      reason =
        window.prompt(
          "Что нужно уточнить (будет показано пользователю):",
          "Укажите сайт организации и уточните назначение доступа.",
        ) ?? undefined;
    }
    const next = setRegistrationApplicationStatus(status, reason);
    if (next) {
      setApplication(next);
      setDevNote(
        status === "pending"
          ? "Заявка снова «На проверке»."
          : status === "rejected"
            ? "Заявка отклонена с причиной — проверьте экран ниже."
            : "Запрошены уточнения — проверьте экран ниже.",
      );
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <p role="status" className="text-small text-muted">
          Загружаем статус заявки…
        </p>
      </div>
    );
  }

  if (!application) {
    return (
      <AuthShell
        title="Статус заявки"
        subtitle="Заявка на регистрацию не найдена."
        backHref="/"
        backLabel="На главную"
      >
        <div className="text-center">
          <p className="text-small leading-relaxed text-secondary">
            Похоже, вы ещё не подавали заявку на регистрацию, либо она была
            очищена в этом браузере.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Начать регистрацию
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </AuthShell>
    );
  }

  const { status, reason } = application;

  return (
    <AuthShell
      title="Регистрация"
      subtitle={
        <>
          Шаг 5 из 5: проверка заявки Центром. Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Войти
          </Link>
        </>
      }
      backHref="/"
      backLabel="На главную"
    >
      <RegistrationProgress current="pending" navigable={false} />

      {status === "pending" ? (
        <>
          <div className="mt-6 rounded-panel border border-border-subtle bg-surface p-6 text-center">
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-control bg-status-info-soft"
              aria-hidden
            >
              <Clock className="h-7 w-7 text-status-info" />
            </span>
            <h2 className="mt-4 text-h3 font-semibold tracking-tight text-primary">
              Заявка отправлена на проверку
            </h2>
            <p className="mt-2 text-small leading-relaxed text-secondary">
              Статус заявки — «На проверке» (under_review). Номер заявки:{" "}
              <span className="font-mono text-primary">{application.id}</span>.
              Дата подачи: {formatDateTime(application.submittedAt)}.
            </p>
            <p className="mt-3 flex items-center justify-center gap-2 text-meta text-muted">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Решение придёт на {application.email}
            </p>
          </div>

          <div className="mt-5 rounded-control bg-canvas/60 p-4">
            <p className="flex items-center gap-2 text-small font-semibold text-primary">
              <Info className="h-4 w-4 text-accent" aria-hidden />
              Что дальше
            </p>
            <ol className="mt-3 space-y-2.5 text-small leading-relaxed text-secondary">
              <li className="flex gap-2">
                <span className="font-mono font-semibold text-accent">1.</span>
                Специалист Центра проверит данные организации
                ({application.orgName}) и заявленную роль «{getRoleLabel(application.roleId)}».
              </li>
              <li className="flex gap-2">
                <span className="font-mono font-semibold text-accent">2.</span>
                Если данных не хватит — запросим уточнения (статус «Нужны
                уточнения»), вы сможете дополнить заявку.
              </li>
              <li className="flex gap-2">
                <span className="font-mono font-semibold text-accent">3.</span>
                После одобрения на email придёт ссылка для входа, и кабинет
                откроется с выбранной ролью.
              </li>
            </ol>
            <p className="mt-3 text-meta leading-relaxed text-muted">
              Обычно проверка занимает 1–2 рабочих дня.
            </p>
          </div>
        </>
      ) : null}

      {status === "rejected" ? (
        <div className="mt-6 rounded-panel border border-status-danger/40 bg-status-danger-soft p-6">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-control bg-status-danger-soft"
            aria-hidden
          >
            <AlertTriangle className="h-5 w-5 text-status-danger" />
          </span>
          <h2 className="mt-3 text-h3 font-semibold tracking-tight text-status-danger">
            Заявка отклонена
          </h2>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Заявка № <span className="font-mono text-primary">{application.id}</span>{" "}
            не прошла проверку. Это не блокировка — вы можете исправить данные
            и подать заявку заново.
          </p>
          <div className="mt-4 rounded-control border border-status-danger/30 bg-surface p-4">
            <p className="text-small font-semibold text-primary">Причина</p>
            <p className="mt-1.5 text-small leading-relaxed text-secondary">
              {reason ?? "Причина не указана — свяжитесь с Центром."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resume}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Исправить и подать заново
            </button>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Ко входу
            </Link>
          </div>
          <p className="mt-4 text-meta leading-relaxed text-muted">
            Ваши данные сохранены — при «Исправить» заявка откроется с
            заполненными полями.
          </p>
        </div>
      ) : null}

      {status === "clarification" ? (
        <div className="mt-6 rounded-panel border border-status-warning/40 bg-status-warning-soft p-6">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-control bg-status-warning-soft"
            aria-hidden
          >
            <Info className="h-5 w-5 text-status-warning" />
          </span>
          <h2 className="mt-3 text-h3 font-semibold tracking-tight text-status-warning">
            Нужны уточнения
          </h2>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Центр почти готов одобрить заявку №{" "}
            <span className="font-mono text-primary">{application.id}</span> —
            осталось дополнить данные.
          </p>
          <div className="mt-4 rounded-control border border-status-warning/30 bg-surface p-4">
            <p className="text-small font-semibold text-primary">
              Что нужно уточнить
            </p>
            <p className="mt-1.5 text-small leading-relaxed text-secondary">
              {reason ?? "Специалист Центра запросил уточнения."}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={resume}
              className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Внести уточнения
            </button>
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-5 text-small font-medium text-primary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Ко входу
            </Link>
          </div>
          <p className="mt-4 text-meta leading-relaxed text-muted">
            Введённые данные сохранены — уточнения вносятся в уже заполненную
            заявку.
          </p>
        </div>
      ) : null}

      {/* Симуляция решения модератора (dev) */}
      {process.env.NODE_ENV === "development" ? (
        <div className="mt-6 rounded-control border border-dashed border-border-strong bg-canvas/60 p-4">
          <p className="flex items-center gap-2 text-meta font-medium uppercase tracking-wider text-muted">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            Симуляция решения модератора
            <span className="rounded-[4px] bg-accent-soft px-1.5 py-0.5 font-medium text-accent">
              dev
            </span>
          </p>
          <p className="mt-1.5 text-meta leading-relaxed text-muted">
            На интеграции статус приходит с бэкенда. Здесь можно проверить
            состояния rejected (с причиной) и clarification в браузере.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => simulate("pending")}
              className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 text-meta font-medium text-primary transition-colors hover:border-border-strong"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-hidden />
              Одобрить
            </button>
            <button
              type="button"
              onClick={() => simulate("clarification")}
              className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 text-meta font-medium text-primary transition-colors hover:border-border-strong"
            >
              <Info className="h-3.5 w-3.5 text-status-warning" aria-hidden />
              Запросить уточнения
            </button>
            <button
              type="button"
              onClick={() => simulate("rejected")}
              className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 text-meta font-medium text-primary transition-colors hover:border-border-strong"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-status-danger" aria-hidden />
              Отклонить (с причиной)
            </button>
          </div>
          {devNote ? (
            <p role="status" className="mt-2.5 text-meta text-status-info">
              {devNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </AuthShell>
  );
}
