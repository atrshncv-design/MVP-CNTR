/**
 * T-013. Регистрация: типы, справочники и field-level валидация пяти шагов
 * (1 пользователь → 2 организация → 3 роль и назначение → 4 подтверждение
 * и безопасность → 5 ожидание/одобрение). Чистый модуль без window:
 * используется клиентскими страницами /register/* и lib/session.ts
 * (хранение черновика и заявки).
 *
 * Каждый валидатор объясняет, ПОЧЕМУ поле нужно и ЧТО исправить — это
 * требование Design.md §14 («explain why a field is required»).
 */

import {
  BACKEND_ROLES,
  getRoleDefinition,
  isCenterRole,
  type BackendRoleId,
} from "./roles.ts";

/* ------------------------------------------------------------------ */
/* Шаги                                                                 */
/* ------------------------------------------------------------------ */

export const REGISTRATION_STEPS = [
  {
    id: "user",
    href: "/register",
    title: "Пользователь",
    short: "Данные пользователя",
  },
  {
    id: "organization",
    href: "/register/organization",
    title: "Организация",
    short: "Организация",
  },
  {
    id: "role",
    href: "/register/role",
    title: "Роль",
    short: "Роль и назначение",
  },
  {
    id: "confirm",
    href: "/register/confirm",
    title: "Подтверждение",
    short: "Подтверждение и безопасность",
  },
  {
    id: "pending",
    href: "/register/pending",
    title: "Ожидание",
    short: "Проверка заявки",
  },
] as const;

export type RegistrationStepId = (typeof REGISTRATION_STEPS)[number]["id"];

/* ------------------------------------------------------------------ */
/* Черновик                                                            */
/* ------------------------------------------------------------------ */

/** Роли, доступные для САМОВЫБОРА при регистрации (роли ЦНТР — нет). */
export type RegistrationRoleId = Exclude<
  BackendRoleId,
  "cntr_admin" | "cntr_manager"
>;

export interface RegistrationDraftData {
  /* Шаг 1 — пользователь */
  firstName: string;
  lastName: string;
  middleName: string;
  email: string;
  phone: string;
  /* Шаг 2 — организация */
  orgName: string;
  orgType: string;
  orgInn: string;
  orgRegion: string;
  orgSize: string;
  orgSite: string;
  /* Шаг 3 — роль и назначение */
  roleId: string; // "" | RegistrationRoleId
  intent: string;
  /* Шаг 4 — безопасность */
  password: string;
  passwordConfirm: string;
  consent: boolean;
}

export const EMPTY_REGISTRATION_DRAFT: RegistrationDraftData = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  phone: "",
  orgName: "",
  orgType: "",
  orgInn: "",
  orgRegion: "",
  orgSize: "",
  orgSite: "",
  roleId: "",
  intent: "",
  password: "",
  passwordConfirm: "",
  consent: false,
};

/** Есть ли в черновике хоть что-то (для подписи «Черновик восстановлен»). */
export function hasRegistrationContent(draft: RegistrationDraftData): boolean {
  return (
    draft.firstName.trim() !== "" ||
    draft.lastName.trim() !== "" ||
    draft.email.trim() !== "" ||
    draft.orgName.trim() !== "" ||
    draft.roleId !== ""
  );
}

/* ------------------------------------------------------------------ */
/* Справочники                                                          */
/* ------------------------------------------------------------------ */

export const ORG_TYPES = [
  {
    id: "industrial",
    label: "Промышленная компания / производство",
    hint: "Производите продукцию и ищете технологии или хотите представить свою",
  },
  {
    id: "scientific",
    label: "Научная организация / НИИ",
    hint: "Ведёте исследования и НИОКТР, публикуете результаты",
  },
  {
    id: "university",
    label: "Вуз / образовательная организация",
    hint: "Разрабатываете технологии в лабораториях и научных группах",
  },
  {
    id: "startup",
    label: "Стартап / технологическая команда",
    hint: "Разрабатываете технологию и ищете заказчиков, пилоты и поддержку",
  },
  {
    id: "individual",
    label: "ИП / самозанятый",
    hint: "Работаете как индивидуальный предприниматель или автор технологии",
  },
  {
    id: "other",
    label: "Другое",
    hint: "Иная форма организации — укажите в заявке",
  },
] as const;

export const ORG_SIZES = [
  { id: "micro", label: "До 15 человек", hint: "Малый коллектив, чаще всего стартап или научная группа" },
  { id: "small", label: "15–100 человек", hint: "Небольшая компания или подразделение" },
  { id: "medium", label: "100–1000 человек", hint: "Среднее предприятие" },
  { id: "large", label: "Более 1000 человек", hint: "Крупное предприятие / корпорация" },
] as const;

export const REGIONS = [
  { id: "izhevsk", label: "Ижевск" },
  { id: "glazov", label: "Глазов" },
  { id: "sarapul", label: "Сарапул" },
  { id: "votkinsk", label: "Воткинск" },
  { id: "mozhga", label: "Можга" },
  { id: "udmurtia-other", label: "Другой район Удмуртии" },
  { id: "other-region", label: "Другой регион России" },
] as const;

/** Роли для самовыбора: все роли платформы, кроме ролей Центра. */
export const SELF_SELECTABLE_ROLES = BACKEND_ROLES.filter(
  (role) => !isCenterRole(role.id),
);

/** Роли Центра: назначаются администратором, при регистрации не выбираются. */
export const CENTER_ROLES = BACKEND_ROLES.filter((role) =>
  isCenterRole(role.id),
);

export function isSelfSelectableRoleId(
  value: string,
): value is RegistrationRoleId {
  return SELF_SELECTABLE_ROLES.some((role) => role.id === value);
}

export function getRoleLabel(id: string): string {
  return getRoleDefinition(id as BackendRoleId)?.label ?? id;
}

/* ------------------------------------------------------------------ */
/* Валидация (field-level, с объяснением «почему» и «что исправить»)    */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DIGITS_RE = /^\+?[0-9 ()-]{10,20}$/;
const INN_RE = /^\d{10}$|^\d{12}$/;

export function validateFirstName(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите имя — по нему Центр обращается к вам и связывает заявку с пользователем.";
  if (v.length < 2)
    return "Имя слишком короткое — минимум 2 символа.";
  if (!/^[А-ЯЁA-Zа-яёa-z\- ]+$/.test(v))
    return "Имя может содержать только буквы, пробел и дефис.";
  return null;
}

export function validateLastName(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите фамилию — она нужна для документов и проверки организации.";
  if (v.length < 2) return "Фамилия слишком короткая — минимум 2 символа.";
  if (!/^[А-ЯЁA-Zа-яёa-z\- ]+$/.test(v))
    return "Фамилия может содержать только буквы, пробел и дефис.";
  return null;
}

export function validateMiddleName(value: string): string | null {
  const v = value.trim();
  if (!v) return null; // необязательное поле
  if (!/^[А-ЯЁA-Zа-яёa-z\- ]+$/.test(v))
    return "Отчество может содержать только буквы, пробел и дефис.";
  return null;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите email — на него придёт решение по заявке и уведомления.";
  if (!EMAIL_RE.test(v))
    return "Похоже, в адресе опечатка. Пример корректного адреса: ivan@company.ru";
  return null;
}

export function validatePhone(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите телефон — он нужен для связи по заявке и уточнений.";
  if (!PHONE_DIGITS_RE.test(v))
    return "Проверьте номер: допустимы цифры, +, скобки и пробелы (10–20 символов).";
  return null;
}

export function validateOrgName(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите название организации — по нему Центр проверяет участника.";
  if (v.length < 3)
    return "Название слишком короткое — минимум 3 символа.";
  return null;
}

export function validateOrgType(value: string): string | null {
  if (!value)
    return "Выберите тип организации — от него зависят доступные разделы кабинета.";
  return null;
}

export function validateOrgInn(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Укажите ИНН — он подтверждает организацию и ускоряет проверку.";
  if (!INN_RE.test(v))
    return "ИНН — 10 цифр (организация) или 12 цифр (ИП). Проверьте ввод.";
  return null;
}

export function validateOrgRegion(value: string): string | null {
  if (!value)
    return "Укажите регион — Центр работает с технологиями Удмуртии и других регионов.";
  return null;
}

export function validateOrgSize(value: string): string | null {
  if (!value)
    return "Укажите размер организации — это влияет на подбор мер поддержки.";
  return null;
}

export function validateOrgSite(value: string): string | null {
  const v = value.trim();
  if (!v) return null; // необязательное поле
  if (/\s/.test(v) || !v.includes("."))
    return "Укажите адрес сайта в формате https://company.ru (без пробелов).";
  return null;
}

export function validateRole(value: string): string | null {
  if (!value)
    return "Выберите роль — она определяет, какие разделы кабинета вам откроются.";
  if (!isSelfSelectableRoleId(value))
    return "Эта роль назначается администратором Центра — выберите роль участника платформы.";
  return null;
}

export function validateIntent(value: string): string | null {
  const v = value.trim();
  if (!v)
    return "Опишите назначение — зачем вам доступ. Это ускоряет проверку заявки.";
  if (v.length < 10)
    return "Опишите назначение подробнее (минимум 10 символов): что планируете делать на платформе.";
  if (v.length > 500) return `Слишком длинно — сократите до 500 символов.`;
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value)
    return "Придумайте пароль — он защищает доступ к кабинету и данным организации.";
  if (value.length < 8)
    return "Пароль слишком короткий — минимум 8 символов.";
  if (!/[A-Za-zА-ЯЁа-яё]/.test(value) || !/\d/.test(value))
    return "Пароль должен содержать хотя бы одну букву и одну цифру.";
  return null;
}

export function validatePasswordConfirm(
  value: string,
  password: string,
): string | null {
  if (!value) return "Повторите пароль, чтобы исключить опечатку.";
  if (value !== password) return "Пароли не совпадают — проверьте ввод.";
  return null;
}

export function validateConsent(value: boolean): string | null {
  if (!value)
    return "Без согласия на обработку данных мы не можем открыть доступ — это требование 152-ФЗ.";
  return null;
}

/* Валидность шагов (для «Далее», guard-редиректов и подачи). */
export function isUserStepValid(draft: RegistrationDraftData): boolean {
  return (
    validateFirstName(draft.firstName) === null &&
    validateLastName(draft.lastName) === null &&
    validateMiddleName(draft.middleName) === null &&
    validateEmail(draft.email) === null &&
    validatePhone(draft.phone) === null
  );
}

export function isOrgStepValid(draft: RegistrationDraftData): boolean {
  return (
    validateOrgName(draft.orgName) === null &&
    validateOrgType(draft.orgType) === null &&
    validateOrgInn(draft.orgInn) === null &&
    validateOrgRegion(draft.orgRegion) === null &&
    validateOrgSize(draft.orgSize) === null &&
    validateOrgSite(draft.orgSite) === null
  );
}

export function isRoleStepValid(draft: RegistrationDraftData): boolean {
  return (
    validateRole(draft.roleId) === null && validateIntent(draft.intent) === null
  );
}

export function isSecurityStepValid(draft: RegistrationDraftData): boolean {
  return (
    validatePassword(draft.password) === null &&
    validatePasswordConfirm(draft.passwordConfirm, draft.password) === null &&
    validateConsent(draft.consent) === null
  );
}

export function isRegistrationComplete(draft: RegistrationDraftData): boolean {
  return (
    isUserStepValid(draft) &&
    isOrgStepValid(draft) &&
    isRoleStepValid(draft) &&
    isSecurityStepValid(draft)
  );
}

/** Первый невалидный шаг (для «исправить» из confirm). */
export function firstInvalidStep(
  draft: RegistrationDraftData,
): RegistrationStepId | null {
  if (!isUserStepValid(draft)) return "user";
  if (!isOrgStepValid(draft)) return "organization";
  if (!isRoleStepValid(draft)) return "role";
  if (!isSecurityStepValid(draft)) return "confirm";
  return null;
}
