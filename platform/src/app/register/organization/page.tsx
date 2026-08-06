/**
 * T-013. Регистрация, шаг 2 из 5 — организация (/register/organization).
 * Организация — отдельная концепция от роли (Design.md §14): данные
 * организации проверяет Центр. Ввод сохраняется в черновик. Guard:
 * без валидных данных пользователя — редирект на шаг 1.
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import {
  FieldWrap,
  SelectInput,
  TextInput,
} from "@/components/auth/form-controls";
import { RegistrationProgress } from "@/components/auth/registration-progress";
import {
  EMPTY_REGISTRATION_DRAFT,
  ORG_SIZES,
  ORG_TYPES,
  REGIONS,
  isOrgStepValid,
  isUserStepValid,
  validateOrgInn,
  validateOrgName,
  validateOrgRegion,
  validateOrgSize,
  validateOrgSite,
  validateOrgType,
  type RegistrationDraftData,
} from "@/lib/registration";
import {
  readRegistrationDraft,
  registerDraft,
} from "@/lib/session";

export default function RegisterOrganizationPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegistrationDraftData>(EMPTY_REGISTRATION_DRAFT);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const saved = readRegistrationDraft();
      if (!saved || !isUserStepValid(saved)) {
        // Нет данных шага 1 — возвращаем на начало регистрации.
        router.replace("/register");
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

  const markTouched = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  const errors = {
    orgName: touched.orgName ? validateOrgName(draft.orgName) : null,
    orgType: touched.orgType ? validateOrgType(draft.orgType) : null,
    orgInn: touched.orgInn ? validateOrgInn(draft.orgInn) : null,
    orgRegion: touched.orgRegion ? validateOrgRegion(draft.orgRegion) : null,
    orgSize: touched.orgSize ? validateOrgSize(draft.orgSize) : null,
    orgSite: touched.orgSite ? validateOrgSite(draft.orgSite) : null,
  };

  const goBack = () => {
    registerDraft(draft);
    router.push("/register");
  };

  const goNext = () => {
    setTouched({
      orgName: true,
      orgType: true,
      orgInn: true,
      orgRegion: true,
      orgSize: true,
    });
    if (!isOrgStepValid(draft)) return;
    registerDraft(draft);
    router.push("/register/role");
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
          Шаг 2 из 5: организация. Уже есть аккаунт?{" "}
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
      <RegistrationProgress current="organization" />

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
        className="mt-6 space-y-5"
      >
        <FieldWrap
          label="Название организации"
          required
          hint="По названию Центр проверяет участника и ведёт карточку организации."
          hintId="reg-orgname-hint"
          error={errors.orgName}
          errorId="reg-orgname-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="reg-orgname"
              value={draft.orgName}
              onChange={(value) => update({ orgName: value })}
              onBlur={() => markTouched("orgName")}
              placeholder="ООО «ТехноПром»"
              autoComplete="organization"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Тип организации"
          required
          hint="От типа зависят доступные разделы кабинета и подбор мер поддержки."
          hintId="reg-orgtype-hint"
          error={errors.orgType}
          errorId="reg-orgtype-error"
        >
          {({ describedBy }) => (
            <SelectInput
              id="reg-orgtype"
              value={draft.orgType}
              onChange={(value) => update({ orgType: value })}
              onBlur={() => markTouched("orgType")}
              options={ORG_TYPES}
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldWrap
            label="ИНН"
            required
            hint="ИНН подтверждает организацию и ускоряет проверку заявки."
            hintId="reg-inn-hint"
            error={errors.orgInn}
            errorId="reg-inn-error"
          >
            {({ describedBy }) => (
              <TextInput
                id="reg-inn"
                value={draft.orgInn}
                onChange={(value) => update({ orgInn: value.replace(/[^\d]/g, "") })}
                onBlur={() => markTouched("orgInn")}
                placeholder="10 или 12 цифр"
                inputMode="numeric"
                maxLength={12}
                describedBy={describedBy}
              />
            )}
          </FieldWrap>

          <FieldWrap
            label="Регион"
            required
            hint="Центр работает с технологиями Удмуртии и других регионов."
            hintId="reg-region-hint"
            error={errors.orgRegion}
            errorId="reg-region-error"
          >
            {({ describedBy }) => (
              <SelectInput
                id="reg-region"
                value={draft.orgRegion}
                onChange={(value) => update({ orgRegion: value })}
                onBlur={() => markTouched("orgRegion")}
                options={REGIONS}
                describedBy={describedBy}
              />
            )}
          </FieldWrap>
        </div>

        <FieldWrap
          label="Размер организации"
          required
          hint="Влияет на подбор мер поддержки и пилотных программ."
          hintId="reg-size-hint"
          error={errors.orgSize}
          errorId="reg-size-error"
        >
          {({ describedBy }) => (
            <SelectInput
              id="reg-size"
              value={draft.orgSize}
              onChange={(value) => update({ orgSize: value })}
              onBlur={() => markTouched("orgSize")}
              options={ORG_SIZES}
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

        <FieldWrap
          label="Сайт организации"
          hint="Необязательно: помогает Центру быстрее познакомиться с вами."
          hintId="reg-site-hint"
          error={errors.orgSite}
          errorId="reg-site-error"
        >
          {({ describedBy }) => (
            <TextInput
              id="reg-site"
              value={draft.orgSite}
              onChange={(value) => update({ orgSite: value })}
              onBlur={() => markTouched("orgSite")}
              placeholder="https://company.ru"
              autoComplete="url"
              inputMode="url"
              describedBy={describedBy}
            />
          )}
        </FieldWrap>

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
            Далее: роль
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
