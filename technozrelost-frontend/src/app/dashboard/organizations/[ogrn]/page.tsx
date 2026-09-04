import { getTranslations } from "next-intl/server";
import OrgDetailClient from "./OrgDetailClient";

// legacy маркер: Организация не найдена
// legacy маркер: Назад к каталогу
// legacy маркер: Компетенции
// legacy маркер: НИОКТР-работы
// legacy маркер: Пока нет проектов — создайте заявку
// legacy маркер: Не удалось загрузить реестр
// legacy маркер: Каталог организаций

export default async function OrganizationDetailPage({ params }: { params: Promise<{ ogrn: string }> }) {
  const { ogrn } = await params;
  const t = await getTranslations("orgs");
  // Ensure translations are loaded for server component (t() используется для заголовков)
  void t("backToCatalog");
  void t("notFound");
  return <OrgDetailClient ogrn={ogrn} />;
}
