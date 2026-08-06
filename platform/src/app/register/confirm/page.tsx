/**
 * T-013. Регистрация, шаг 4 из 5 — подтверждение и безопасность
 * (/register/confirm): сводка данных шагов 1–3 (с «Изменить» на каждый шаг),
 * пароль, согласие на обработку данных и «что будет после подачи».
 * Подача создаёт заявку со статусом pending (mock-хранилище).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Pencil,
  Save,
  Send,
} from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  CheckboxField,
  FieldWrap,
  PasswordInput,
} from "@/components/auth/form-controls";
import { RegistrationProgress } from "@/components/auth/registration-progress";
import {
  EMPTY_REGISTRATION_DRAFT,
  ORG_SIZES,
  ORG_TYPES,
  REGIONS,
  getRoleLabel,
  isRegistrationComplete,
  isRoleStepValid,
  validateConsent,
  validatePassword,
  validatePasswordConfirm,
  type RegistrationDraftData,
} from "@/lib/registration";
import {
  completeRegistration,
  readRegistrationDraft,
  registerDraft,
} from "@/lib/session";

const orgTypeLabel = (id: string) =>
  ORG_TYPES.find((t) => t.id === id)?.label ?? id;
const orgSizeLabel = (id: string) =>
  ORG_SIZES.find((s) => s.id === id)?.label ?? id;
const regionLabel = (id: string) =>
  REGIONS.find((r) => r.id === id)?.label ?? id;

export default function RegisterConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraftData>(EMPTY_REGISTRATION_DRAFT);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = readRegistrationDraft();
      if (!saved || !isRoleStepValid(saved)) {
        router.replace("/register/role");
        return;
      }
      setDraft({ ...EMPTY_REGISTRATION_DRAFT, ...saved });
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<RegistrationDraftData>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    registerDraft(next);
  };

  const passwordError = touched.password ? validatePassword(draft.password) : null;
  const confirmError = touched.passwordConfirm
    ? validatePasswordConfirm(draft.passwordConfirm, draft.password)
    : null;
  const consentError = touched.consent ? validateConsent(draft.consent) : null;

  const handleSubmit = () => {
    setTouched({ password: true, passwordConfirm: true, consent: true });
    if (!isRegistrationComplete(draft)) {
      setSubmitError(
        "Заполните все обязательные поля — ошибки подсвечены под полями.",
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    // Mock-подача: заявка уходит в «На проверке» (на интеграции — бэкенд).
    completeRegistration(draft);
    router.push("/register/pending");
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <p role="status" className="text-small text-muted">
          Загружаем регистрацию…
        </p>
      </div>
    );
  }

  return (
    <AuthShell
      title="Регистрация"
      subtitle={
        <>
          Шаг 4 из 5: подтверждение и безопасность. Уже есть аккаунт?{" "}
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
      <RegistrationProgress current="confirm" />

      <p className="mt-4 flex items-center gap-2 text-meta text-muted">
        <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Ввод сохраняется автоматически — можно вернуться на любой шаг.
      </p>

      {submitError ? (
        <p
          role="alert"
          className="mt-4 rounded-control border border-status-danger/40 bg-status-danger-soft px-3.5 py-2.5 text-small text-status-danger"
        >
          {submitError}
        </p>
      ) : null}

      {/* Сводка */}
      <div className="mt-6 space-y-4">
        <section className="rounded-control border border-border-subtle bg-canvas/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-small font-semibold text-primary">Пользователь</h2>
            <Link
              href="/register"
              className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Изменить
            </Link>
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-small sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">ФИО</dt>
              <dd className="text-right font-medium text-primary">
                {[draft.lastName, draft.firstName, draft.middleName]
                  .filter(Boolean)
                  .join(" ") || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Email</dt>
              <dd className="text-right font-mono text-primary">{draft.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Телефон</dt>
              <dd className="text-right text-primary">{draft.phone || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-control border border-border-subtle bg-canvas/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-small font-semibold text-primary">Организация</h2>
            <Link
              href="/register/organization"
              className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Изменить
            </Link>
          </div>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-small sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Название</dt>
              <dd className="text-right font-medium text-primary">{draft.orgName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Тип</dt>
              <dd className="text-right text-primary">{orgTypeLabel(draft.orgType)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">ИНН</dt>
              <dd className="text-right font-mono text-primary">{draft.orgInn || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Регион</dt>
              <dd className="text-right text-primary">{regionLabel(draft.orgRegion)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Размер</dt>
              <dd className="text-right text-primary">{orgSizeLabel(draft.orgSize)}</dd>
            </div>
            {draft.orgSite.trim() ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Сайт</dt>
                <dd className="truncate text-right text-primary">{draft.orgSite}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-control border border-border-subtle bg-canvas/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-small font-semibold text-primary">Роль и назначение</h2>
            <Link
              href="/register/role"
              className="inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-meta font-medium text-accent hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Изменить
            </Link>
          </div>
          <dl className="mt-2 space-y-1.5 text-small">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Роль</dt>
              <dd className="text-right font-medium text-primary">
                {draft.roleId ? getRoleLabel(draft.roleId) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Назначение</dt>
              <dd className="mt-0.5 text-primary">{draft.intent || "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Безопасность */}
      <div className="mt-6 space-y-5">
        <FieldWrap
          label="Пароль"
          required
          hint="Минимум 8 символов, хотя бы одна буква и одна цифра. Пароль защищает доступ к кабинету и данным организации."
          hintId="reg-password-hint"
          error={passwordError}
          errorId="reg-password-error"
        >
          {({ describedBy }) => (
            <PasswordInput
              id="reg-password"
              value={draft.password}
              onChange={(value) => update({ password: value })}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              autoComplete="new-password"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Повторите пароль"
          required
          hint="Повтор нужен, чтобы исключить опечатку."
          hintId="reg-password2-hint"
          error={confirmError}
          errorId="reg-password2-error"
        >
          {({ describedBy }) => (
            <PasswordInput
              id="reg-password2"
              value={draft.passwordConfirm}
              onChange={(value) => update({ passwordConfirm: value })}
              onBlur={() =>
                setTouched((prev) => ({ ...prev, passwordConfirm: true }))
              }
              autoComplete="new-password"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <CheckboxField
          id="reg-consent"
          checked={draft.consent}
          onChange={(checked) => {
            update({ consent: checked });
            setTouched((prev) => ({ ...prev, consent: true }));
          }}
          error={consentError}
          errorId="reg-consent-error"
        >
          Согласен(на) на обработку персональных данных в соответствии с
          152-ФЗ: данные нужны для проверки заявки и ведения карточки
          организации. Данные не передаются третьим лицам.
        </CheckboxField>
      </div>

      {/* Что будет после подачи */}
      <div className="mt-6 rounded-control bg-canvas/60 p-4">
        <p className="flex items-center gap-2 text-small font-semibold text-primary">
          <Info className="h-4 w-4 text-accent" aria-hidden />
          Что будет после подачи
        </p>
        <ol className="mt-3 space-y-2.5 text-small leading-relaxed text-secondary">
          <li className="flex gap-2">
            <span className="font-mono font-semibold text-accent">1.</span>
            Заявка уходит на проверку Центру — статус «На проверке».
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-semibold text-accent">2.</span>
            Если данных не хватит, Центр запросит уточнения — вы получите
            уведомление на email.
          </li>
          <li className="flex gap-2">
            <span className="font-mono font-semibold text-accent">3.</span>
            После одобрения на email придёт ссылка для входа — кабинет откроется
            с выбранной ролью.
          </li>
        </ol>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-5">
        <Link
          href="/register/role"
          className="inline-flex h-11 items-center gap-2 rounded-control border border-border-subtle px-4 text-small font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Назад
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Отправляем заявку…" : "Отправить заявку на проверку"}
          {!submitting ? (
            <Send className="h-4 w-4" aria-hidden />
          ) : null}
        </button>
      </div>

      <p className="mt-4 flex items-start gap-2 text-meta leading-relaxed text-muted">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Перед отправкой проверьте данные: после одобрения email и ИНН станут
        основными идентификаторами аккаунта.
      </p>
    </AuthShell>
  );
}
