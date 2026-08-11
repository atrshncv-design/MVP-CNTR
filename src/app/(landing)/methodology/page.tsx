import type { Metadata } from "next";
import MethodologyContent from "@/components/landing/methodology-content";

export const metadata: Metadata = {
  title: "Методика оценки УГТ — Технозрелость",
  description:
    "Методология оценки уровня готовности технологий по ГОСТ Р 58048-2017: шкалы УГТ, УГП, УГИ, УГС, процесс оценки и матрица соответствия.",
};

export default function MethodologyPage() {
  return <MethodologyContent />;
}
