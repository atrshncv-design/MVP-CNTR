import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RoadmapContent from "@/components/landing/roadmap-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  return {
    title: t("metaRoadmapTitle"),
    description: t("metaRoadmapDesc"),
  };
}

export default function RoadmapPage() {
  return <RoadmapContent />;
}
