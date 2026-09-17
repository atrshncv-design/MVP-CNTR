import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Reveal from "@/components/landing/reveal";
import NioktrShowcase from "@/components/landing/nioktr-showcase";
import { fetchPublicNioktrPage } from "../public-showcases";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nioktr");
  return {
    title: t("title"),
    description: t("emptyDesc"),
  };
}

/**
 * Таск 02 (R01/R03): публичный реестр НИОКТР на живых проверенных данных.
 * Первая страница читается сервером анонимно (без Authorization,
 * limit/offset); дальше браузер дотягивает страницы сам через rewrites.
 * Пустой реестр — честное пустое состояние с CTA в регистрацию;
 * сбой — ошибка с ретраем, приватных полей и действий на странице нет.
 */
export default async function NioktrPage() {
  const t = await getTranslations("nioktr");
  const { items, failed, status } = await fetchPublicNioktrPage();
  const initialError = failed ? t("errorLoad") : null;
  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      <Reveal>
        <p className="tz-eyebrow">{t("badgeNioktr")}</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">{t("title")}</h1>
      </Reveal>
      <div className="mt-10">
        <NioktrShowcase initialItems={items} initialError={initialError} initialStatus={status} />
      </div>
    </div>
  );
}
