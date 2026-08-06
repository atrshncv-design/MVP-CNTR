/**
 * T-013. Регистрация, шаг 3 из 5 — роль и назначение (/register/role).
 *
 * Роль и организация — отдельные концепции (Design.md §14). Роли Центра
 * (cntr_manager / cntr_admin) НЕ доступны для самовыбора — они назначаются
 * администратором (зеркало бэкенда): для них показан отдельный блок с
 * объяснением. Каждая выбираемая роль объяснена (задача роли, что откроется).
 * «Назначение» (зачем доступ) — поле с объяснением «почему нужно».
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Save, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { FieldError, FieldHint } from "@/components/auth/form-controls";
import { RegistrationProgress } from "@/components/auth/registration-progress";
import {
  CENTER_ROLES,
  EMPTY_REGISTRATION_DRAFT,
  SELF_SELECTABLE_ROLES,
  isOrgStepValid,
  isRoleStepValid,
  validateIntent,
  validateRole,
  type RegistrationDraftData,
} from "@/lib/registration";
import {
  readRegistrationDraft,
  registerDraft,
} from "@/lib/session";
import { getSessionHome } from "@/lib/session";

export default function RegisterRolePage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraftData>(EMPTY_REGISTRATION_DRAFT);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const saved = readRegistrationDraft();
      if (!saved || !isOrgStepValid(saved)) {
        router.replace("/register/organization");
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

  const roleError = touched.roleId ? validateRole(draft.roleId) : null;
  const intentError = touched.intent ? validateIntent(draft.intent) : null;

  const goBack = () => {
    registerDraft(draft);
    router.push("/register/organization");
  };

  const goNext = () => {
    setTouched({ roleId: true, intent: true });
    if (!isRoleStepValid(draft)) return;
    registerDraft(draft);
    router.push("/register/confirm");
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
          Шаг 3 из 5: роль и назначение. Уже есть аккаунт?{" "}
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
      <RegistrationProgress current="role" />

      <p className="mt-4 flex items-center gap-2 text-meta text-muted">
        <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Ввод сохраняется автоматически — можно вернуться на любой шаг.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          goNext();
        }}
        noValidate
        className="mt-6 space-y-6"
      >
        {/* Роли участника (самовыбор) */}
        <fieldset>
          <legend className="text-small font-semibold text-primary">
            Ваша роль на платформе{" "}
            <span className="ml-0.5 text-status-danger" aria-hidden>*</span>
          </legend>
          <p className="mt-1 text-meta leading-relaxed text-muted">
            Роль определяет, какие разделы кабинета вам откроются. Вы всегда
            сможете изменить её после проверки заявки.
          </p>
          {roleError ? (
            <div className="mt-2">
              <FieldError message={roleError} />
            </div>
          ) : null}

          <div className="mt-3 space-y-2" role="radiogroup" aria-label="Роль на платформе">
            {SELF_SELECTABLE_ROLES.map((role) => {
              const selected = draft.roleId === role.id;
              return (
                <label
                  key={role.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring ${
                    selected
                      ? "border-accent bg-accent-soft/40"
                      : "border-border-subtle bg-canvas/60 hover:border-border-strong"
                  }`}
                >
                  <input
                    type="radio"
                    name="registration-role"
                    value={role.id}
                    checked={selected}
                    onChange={() => update({ roleId: role.id })}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-semibold text-primary">
                      {role.label}
                    </span>
                    <span className="mt-0.5 block text-meta leading-relaxed text-secondary">
                      {role.description}
                    </span>
                    <span className="mt-1 block font-mono text-meta text-muted">
                      Кабинет: {getSessionHome(role.id)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Роли Центра — назначаются администратором */}
        <div className="rounded-control border border-dashed border-border-strong bg-canvas/60 p-4">
          <p className="flex items-center gap-2 text-small font-semibold text-primary">
            <ShieldCheck className="h-4 w-4 text-accent" aria-hidden />
            Роли Центра — по назначению администратора
          </p>
          <p className="mt-1.5 text-meta leading-relaxed text-muted">
            Роли сотрудников Центра ({CENTER_ROLES.map((role) => role.label).join(" и ")}){" "}
            недоступны для самовыбора: они назначаются администратором после
            проверки заявки и трудовых отношений с Центром. Если вы сотрудник
            Центра — подайте заявку с любой ролью участника и укажите это в
            назначении, доступ будет изменён.
          </p>
          <ul className="mt-3 space-y-2">
            {CENTER_ROLES.map((role) => (
              <li key={role.id} className="flex items-start gap-2.5">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                <span>
                  <span className="block text-small font-medium text-secondary">
                    {role.label}
                  </span>
                  <span className="block text-meta text-muted">
                    {role.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Назначение */}
        <div>
          <label htmlFor="reg-intent" className="block text-small font-semibold text-primary">
            Назначение: зачем вам доступ?{" "}
            <span className="ml-0.5 text-status-danger" aria-hidden>*</span>
          </label>
          <FieldHint id="reg-intent-hint">
            Кратко опишите цель: например, «представить технологию и найти
            заказчиков» или «найти решения для нашей производственной линии».
            Это ускоряет проверку заявки Центром.
          </FieldHint>
          <textarea
            id="reg-intent"
            value={draft.intent}
            onChange={(event) => update({ intent: event.target.value })}
            onBlur={() => setTouched((prev) => ({ ...prev, intent: true }))}
            rows={4}
            maxLength={600}
            placeholder="Планирую представить технологию лазерной резки и выйти на пилот с промышленными заказчиками…"
            aria-describedby={[
              intentError ? "reg-intent-error" : undefined,
              "reg-intent-hint",
            ]
              .filter(Boolean)
              .join(" ")}
            className="mt-3 w-full resize-y rounded-control border border-border-subtle bg-canvas px-3 py-2.5 text-small text-primary placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <FieldError id="reg-intent-error" message={intentError} />
          <p className="mt-2 text-right text-meta text-muted">
            {draft.intent.length} / 500
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-border-subtle px-4 text-small font-medium text-secondary transition-colors hover:border-border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Назад
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Далее: подтверждение
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
