import type { Metadata } from "next";
import RoadmapContent from "@/components/landing/roadmap-content";

export const metadata: Metadata = {
  title: "Дорожная карта проекта — Технозрелость",
  description:
    "Постройте дорожную карту развития вашей технологии: выберите текущий и целевой УГТ, получите план переходов, документы и риски по ГОСТ Р 58048-2017.",
};

export default function RoadmapPage() {
  return <RoadmapContent />;
}
