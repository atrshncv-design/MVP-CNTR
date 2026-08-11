import type { Metadata } from "next";
import ProjectsShowcase from "@/components/landing/projects-showcase";

export const metadata: Metadata = {
  title: "Витрина проектов — Технозрелость",
  description:
    "Проекты региона, прошедшие оценку уровня готовности технологий по ГОСТ Р 58048-2017: категории, УГТ, бюджеты. Полные данные — в личном кабинете.",
};

export default function ProjectsPage() {
  return <ProjectsShowcase />;
}
