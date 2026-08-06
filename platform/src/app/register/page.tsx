/**
 * T-013. Регистрация, шаг 1 из 5 — данные пользователя (/register).
 * Ввод сохраняется в черновик (localStorage) при каждом изменении:
 * навигация назад/вперёд и перезагрузка не теряют данные (Design.md §14).
 * Валидация — на уровне полей, с объяснением «почему» и «что исправить».
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  FieldWrap,
  TextInput,
} from "@/components/auth/form-controls";
import { RegistrationProgress } from "@/components/auth/registration-progress";
import {
  EMPTY_REGISTRATION_DRAFT,
  hasRegistrationContent,
  isUserStepValid,
  validateEmail,
  validateFirstName,
  validateLastName,
  validateMiddleName,
  validatePhone,
  type RegistrationDraftData,
} from "@/lib/registration";
import {
  readRegistrationDraft,
  registerDraft,
} from "@/lib/session";

export default function RegisterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraftData>(EMPTY_REGISTRATION_DRAFT);
  const [ready, setReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /* Восстановление черновика (localStorage доступен только в браузере). */
  useEffect(() => {
    (async () => {
      const saved = readRegistrationDraft();
      if (saved && hasRegistrationContent(saved)) {
        setDraft({ ...EMPTY_REGISTRATION_DRAFT, ...saved });
        setRestored(true);
      }
      setReady(true);
    })();
  }, []);

  const update = (patch: Partial<RegistrationDraftData>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    registerDraft(next);
  };

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const errors = {
    firstName: touched.firstName ? validateFirstName(draft.firstName) : null,
    lastName: touched.lastName ? validateLastName(draft.lastName) : null,
    middleName: touched.middleName ? validateMiddleName(draft.middleName) : null,
    email: touched.email ? validateEmail(draft.email) : null,
    phone: touched.phone ? validatePhone(draft.phone) : null,
  };

  const goNext = () => {
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    });
    if (!isUserStepValid(draft)) return;
    registerDraft(draft);
    router.push("/register/organization");
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
          Шаг 1 из 5: данные пользователя. Уже есть аккаунт?{" "}
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
      <RegistrationProgress current="user" />

      {restored ? (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-control border border-status-info/40 bg-status-info-soft px-3 py-2 text-meta text-status-info"
        >
          <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Черновик восстановлен — ввод сохраняется автоматически.
        </p>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-meta text-muted">
          <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Ввод сохраняется автоматически — можно вернуться на любой шаг.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          goNext();
        }}
        noValidate
        className="mt-6 space-y-5"
      >
        <FieldWrap
          label="Фамилия"
          required
          hint="Фамилия нужна для документов и проверки организации."
          hintId="reg-lastname-hint"
          error={errors.lastName}
          errorId="reg-lastname-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="reg-lastname"
              value={draft.lastName}
              onChange={(value) => update({ lastName: value })}
              onBlur={() => markTouched("lastName")}
              placeholder="Иванова"
              autoComplete="family-name"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldWrap
            label="Имя"
            required
            hint="По имени Центр обращается к вам в переписке."
            hintId="reg-firstname-hint"
            error={errors.firstName}
            errorId="reg-firstname-error"
          >
            {({ describedBy }) => (
              <TextInput
                id="reg-firstname"
                value={draft.firstName}
                onChange={(value) => update({ firstName: value })}
                onBlur={() => markTouched("firstName")}
                placeholder="Мария"
                autoComplete="given-name"
                describedBy={describedBy}
              />
            )}
          </FieldWrap>

          <FieldWrap
            label="Отчество"
            hint="Необязательно, но помогает при документах."
            hintId="reg-middlename-hint"
            error={errors.middleName}
            errorId="reg-middlename-error"
          >
            {({ describedBy }) => (
              <TextInput
                id="reg-middlename"
                value={draft.middleName}
                onChange={(value) => update({ middleName: value })}
                onBlur={() => markTouched("middleName")}
                placeholder="Сергеевна"
                autoComplete="additional-name"
                describedBy={describedBy}
              />
            )}
          </FieldWrap>
        </div>

        <FieldWrap
          label="Email"
          required
          hint="На этот адрес придёт решение по заявке и уведомления. Он станет логином."
          hintId="reg-email-hint"
          error={errors.email}
          errorId="reg-email-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="reg-email"
              type="email"
              value={draft.email}
              onChange={(value) => update({ email: value })}
              onBlur={() => markTouched("email")}
              placeholder="you@company.ru"
              autoComplete="email"
              inputMode="email"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Телефон"
          required
          hint="Нужен для связи по заявке и запроса уточнений."
          hintId="reg-phone-hint"
          error={errors.phone}
          errorId="reg-phone-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="reg-phone"
              type="tel"
              value={draft.phone}
              onChange={(value) => update({ phone: value })}
              onBlur={() => markTouched("phone")}
              placeholder="+7 (912) 000-00-00"
              autoComplete="tel"
              inputMode="tel"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-control border border-border-subtle px-4 text-small font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            На главную
          </Link>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Далее: организация
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
