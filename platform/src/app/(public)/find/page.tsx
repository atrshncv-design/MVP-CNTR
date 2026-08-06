/**
 * T-006. Задача-first хаб discovery (/find, Design.md §12.2 search-first).
 *
 * Посетитель приходит с задачей («найти решение») — хаб ведёт в реестры,
 * а не в разделы сайта. Счётчики на карточках реестров — только реальные
 * данные (HomeSummary из адаптера): «400 карточек» для НИОКТР, честные
 * «Пока нет публикаций» для пустых реестров.
 *
 * Поисковая форма — обычный GET на /research?search=... (работает без JS,
 * URL-состояние сохраняется в истории). «Часто ищут» — реальные ключевые
 * слова карточек НИОКТР (топ по частоте в датасете, импорт 06.08.2026).
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  FileText,
  FlaskConical,
  Lightbulb,
  Search,
  Sparkles,
} from "lucide-react";
import { getAdapter } from "@/lib/adapter/index.ts";
import type { HomeSummary } from "@/lib/types.ts";
import { formatDate } from "@/lib/datetime.ts";

export const metadata: Metadata = {
  title: "Поиск по платформе — ЦНТР Удмуртии",
  description:
    "Найдите технологию, исполнителя, запрос заказчика или исследование в реестрах Центра научно-технологического развития.",
};

/** Реальные ключевые слова карточек НИОКТР (топ по частоте в датасете). */
const POPULAR_QUERIES = [
  "искусственный интеллект",
  "машинное обучение",
  "нейронные сети",
  "компьютерное зрение",
  "большие данные",
  "предиктивная аналитика",
];

export default async function FindPage() {
  const adapter = getAdapter();
  const summary: HomeSummary = await adapter.getHomeSummary();

  const registries = [
    {
      href: "/research",
      icon: FlaskConical,
      title: "Исследования и НИОКТР",
      description:
        "Реальные карточки научно-исследовательских и опытно-конструкторских работ с исполнителями и ключевыми словами.",
      status: `${summary.researchCount} карточек из реестра Минобрнауки России`,
      ready: true,
    },
    {
      href: "/technologies",
      icon: Lightbulb,
      title: "Технологии",
      description:
        "Проверенные Центром технологии с подтверждённым уровнем готовности УГТ.",
      status:
        summary.technologiesCount > 0
          ? `${summary.technologiesCount} технологий`
          : "Пока нет публикаций",
      ready: summary.technologiesCount > 0,
    },
    {
      href: "/requests",
      icon: FileText,
      title: "Запросы заказчиков",
      description:
        "Потребности предприятий: проблема, ожидаемый результат и условия внедрения.",
      status:
        summary.requestsCount > 0
          ? `${summary.requestsCount} запросов`
          : "Пока нет публикаций",
      ready: summary.requestsCount > 0,
    },
    {
      href: "/partners",
      icon: Building2,
      title: "Партнёры и исполнители",
      description:
        "Организации и исполнители, прошедшие проверку Центра.",
      status:
        summary.organizationsCount > 0
          ? `${summary.organizationsCount} организаций в справочнике`
          : "Раздел готовится",
      ready: summary.organizationsCount > 0,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 md:px-8 md:py-20">
      {/* Поиск-first (§12.2) */}
      <section className="max-w-3xl">
        <h1 className="text-h1 font-semibold tracking-tight text-primary">
          Что вы хотите найти?
        </h1>
        <p className="mt-4 text-body-lg leading-relaxed text-secondary">
          Технологию для внедрения, исполнителя под задачу, запрос заказчика
          или результаты исследований — всё в реестрах Центра.
        </p>

        <form
          action="/research"
          method="get"
          role="search"
          aria-label="Поиск по реестрам платформы"
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              type="search"
              name="search"
              required
              placeholder="Например: искусственный интеллект, композитные материалы, машинное зрение"
              aria-label="Запрос поиска"
              className="h-14 w-full rounded-control border border-subtle bg-surface pl-12 pr-4 text-body text-primary placeholder:text-muted transition-colors hover:border-strong focus:border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-14 shrink-0 items-center justify-center gap-2 rounded-control bg-accent-strong px-6 text-body font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Найти
            <ArrowRight className="h-4.5 w-4.5" aria-hidden />
          </button>
        </form>

        <p className="mt-3 text-meta text-muted">
          Поиск идёт по названию, ключевым словам, исполнителю и номеру
          регистрации реестра НИОКТР — единственного реестра с реальными
          записями на текущий момент.
        </p>
      </section>

      {/* Реестры платформы (анти-slop §6.2: редакционный список, не сетка карточек) */}
      <section className="mt-14 md:mt-20" aria-labelledby="registries-heading">
        <h2
          id="registries-heading"
          className="text-h2 font-semibold tracking-tight text-primary"
        >
          Реестры платформы
        </h2>
        <ul className="mt-6 divide-y divide-subtle border-y border-subtle">
          {registries.map((registry) => {
            const Icon = registry.icon;
            return (
              <li key={registry.href}>
                <Link
                  href={registry.href}
                  className="group flex min-h-24 items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring md:gap-6"
                >
                  <span
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-control bg-surface-elevated text-accent transition-colors group-hover:bg-accent-soft"
                    aria-hidden
                  >
                    <Icon className="h-5.5 w-5.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-h3 font-semibold tracking-tight text-primary transition-colors group-hover:text-accent">
                        {registry.title}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-[6px] px-2 py-0.5 text-meta font-medium ${
                          registry.ready
                            ? "bg-status-success-soft text-status-success"
                            : "bg-surface-elevated text-muted"
                        }`}
                      >
                        {registry.status}
                      </span>
                    </span>
                    <span className="mt-1.5 block max-w-2xl text-small leading-relaxed text-secondary">
                      {registry.description}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-accent"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Часто ищут — реальные ключевые слова реестра */}
      <section className="mt-14 md:mt-20" aria-labelledby="popular-heading">
        <h2
          id="popular-heading"
          className="flex items-center gap-2 text-h3 font-semibold tracking-tight text-primary"
        >
          <Sparkles className="h-5 w-5 text-accent" aria-hidden />
          Часто ищут
        </h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {POPULAR_QUERIES.map((query) => (
            <li key={query}>
              <Link
                href={`/research?search=${encodeURIComponent(query)}`}
                className="inline-flex h-10 items-center rounded-control border border-subtle bg-surface px-3.5 text-small text-secondary transition-colors hover:border-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {query}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-meta text-muted">
          По частоте встречаемости в карточках реестра НИОКТР
          {summary.lastUpdatedAt ? (
            <> (данные на {formatDate(summary.lastUpdatedAt)})</>
          ) : null}
        </p>
      </section>

      {/* Не нашли — следующее действие */}
      <section
        className="mt-14 flex flex-col items-start gap-5 rounded-panel border border-subtle bg-surface p-6 md:mt-20 md:flex-row md:items-center md:justify-between md:p-8"
        aria-labelledby="not-found-heading"
      >
        <div className="max-w-2xl">
          <h2
            id="not-found-heading"
            className="text-h3 font-semibold tracking-tight text-primary"
          >
            Не нашли, что искали?
          </h2>
          <p className="mt-2 text-small leading-relaxed text-secondary">
            Реестры пополняются: технологии и запросы публикуются после
            проверки Центром. Опишите свою задачу — Центр подберёт подходящих
            исполнителей и меры поддержки.
          </p>
        </div>
        <Link
          href="/register"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-control bg-accent-strong px-6 text-small font-medium text-accent-contrast transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Оставить заявку
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
