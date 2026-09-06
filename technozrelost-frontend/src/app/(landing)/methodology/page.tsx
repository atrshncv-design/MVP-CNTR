import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import MethodologyContent from "@/components/landing/methodology-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaMethodologyTitle"),
    description: t("metaMethodologyDesc"),
  };
}

export default function MethodologyPage() {
  return <MethodologyContent />;
}
