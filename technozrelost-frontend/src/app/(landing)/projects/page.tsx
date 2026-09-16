import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaProjectsTitle"),
    description: t("metaProjectsDesc"),
  };
}

/**
 * P2-gating (таск 02, G04/G35): публичный реестр откроется в P3.
 * Почему плейсхолдер вместо fetch: анонимный доступ к реестрам в P2 закрыт —
 * страница не обращается к GET /projects/registry ни с сервера, ни с клиента.
 * Честное пустое состояние ведёт в регистрацию (порядок «инфоконтур → ЛК», G06).
 */
export default async function ProjectsPage() {
  const t = await getTranslations("projectsLanding");
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="tz-eyebrow">{t("eyebrow")}</p>
      <h1 className="mt-3 max-w-xl tz-page-title">{t("title")}</h1>
      <div className="mt-10 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-12 text-center">
        <h2 className="font-display text-[16px] font-bold text-tz-fg">{t("emptyRegistryTitle")}</h2>
        <p className="mx-auto mt-2 max-w-xl text-[13.5px] text-tz-secondary">{t("emptyRegistryHint")}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="tz-btn tz-btn-primary tz-btn-sm">
            {t("register")}
          </Link>
          <Link href="/login" className="tz-btn tz-btn-ghost tz-btn-sm">
            {t("login")}
          </Link>
        </div>
      </div>
    </section>
  );
}
