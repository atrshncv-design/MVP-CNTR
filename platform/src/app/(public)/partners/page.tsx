/**
 * T-006. Партнёры и исполнители (/partners).
 *
 * «Раздел готов к наполнению» + пояснение про проверку: организации
 * публикуются только после проверки Центром (верификация компетенций,
 * реквизитов и статуса). Честное состояние, следующий шаг — реальный
 * реестр НИОКТР, где видны организации-исполнители работ.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/states/empty-state.tsx";

export const metadata: Metadata = {
  title: "Партнёры и исполнители — ЦНТР Удмуртии",
  description:
    "Организации и исполнители, прошедшие проверку Центра, с подтверждёнными компетенциями.",
};

export default function PartnersPage() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-16">
      <header className="max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Партнёры и исполнители
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-secondary">
          Организации, научные коллективы и исполнители с подтверждёнными
          компетенциями — для заказчиков, ищущих решения под свои задачи.
        </p>
      </header>

      <div className="mt-8">
        <EmptyState
          icon={Building2}
          title="Раздел готов к наполнению"
          description={
            <>
              Организации и исполнители появляются в реестре после проверки
              Центром: публикуются только верифицированные участники с
              подтверждёнными реквизитами и компетенциями. До запуска
              публикации ознакомиться с организациями-исполнителями работ
              можно в реестре НИОКТР.
            </>
          }
          action={
            <Link
              href="/research"
              className="inline-flex h-11 items-center rounded-control bg-accent-strong px-5 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Смотреть реестр НИОКТР
            </Link>
          }
        />
      </div>
    </div>
  );
}
