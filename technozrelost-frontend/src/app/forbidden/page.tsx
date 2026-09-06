import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const t = await getTranslations("auth");
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl border border-tz-danger bg-tz-danger-soft p-8 text-center">
      <h1 className="mb-2 tz-page-title text-tz-danger">{t("forbiddenTitle")}</h1>
      <p className="mb-4 text-tz-secondary">
        {t("forbiddenDesc")}
      </p>
      <Link href="/dashboard" className="text-tz-accent underline">
        {t("forbiddenLink")}
      </Link>
    </main>
  );
}
