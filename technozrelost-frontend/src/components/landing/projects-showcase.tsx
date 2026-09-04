"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Layers,
  Lock,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  getShowcaseProjects,
  getShowcaseCategoryLabel,
  SHOWCASE_CATEGORY_SLUGS,
  type ShowcaseProject,
} from "@/lib/showcase";
import { getUgtLevel } from "@/lib/ugt-data";
import { asTranslateFn } from "@/lib/types";
import { getStatusLabel, getStatusColor } from "@/lib/status";
import ProjectRadar from "@/components/dashboard/project-radar";

const ugtColor = (id: number) => `var(--tz-ugt-${id})`;

/* ================================================================== */
/*  Маленькая карточка (без радара)                                   */
/* ================================================================== */

function ProjectCard({
  project,
  index,
  onOpen,
}: {
  project: ShowcaseProject;
  index: number;
  onOpen: (p: ShowcaseProject) => void;
}) {
  const showT = asTranslateFn(useTranslations("showcase"));
  const ugtT = asTranslateFn(useTranslations("ugt"));
  const color = ugtColor(project.current_level);
  const codeLabel = getUgtLevel(ugtT, project.current_level).code;
  const categoryLabel = getShowcaseCategoryLabel(showT, project.category);
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(project)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="group flex h-full w-full flex-col gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-5 text-left transition-all duration-200 hover:-translate-y-1 hover:border-tz-accent/40 hover:shadow-lg"
      style={{ boxShadow: "0 4px 16px rgba(11,13,18,0.05)", cursor: "pointer" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {codeLabel}
          </span>
          <span className="rounded-full bg-tz-soft/70 px-2.5 py-0.5 font-mono text-[11px] font-medium text-tz-muted">
            {categoryLabel}
          </span>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tz-border/60 bg-tz-soft/60 text-tz-muted transition-colors group-hover:border-tz-accent/40 group-hover:text-tz-accent">
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      <h3 className="tz-card-title leading-snug">{project.name}</h3>

      <p className="flex-1 text-[13px] leading-relaxed text-tz-secondary">
        {project.description}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-tz-border/60 pt-3 text-[11.5px] text-tz-muted">
        <span className="flex items-center gap-1">
          <MapPin size={12} /> {project.region}
        </span>
        <span>{project.org}</span>
      </div>
    </motion.button>
  );
}

/* ================================================================== */
/*  Большая карточка (модалка с радаром)                              */
/* ================================================================== */

function ProjectModal({
  project,
  onClose,
}: {
  project: ShowcaseProject | null;
  onClose: () => void;
}) {
  const t = useTranslations("projectsLanding");
  const showT = asTranslateFn(useTranslations("showcase"));
  const ugtT = asTranslateFn(useTranslations("ugt"));
  // Esc — закрыть
  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [project, onClose]);

  const color = project ? ugtColor(project.current_level) : "var(--tz-accent)";

  const formatBudget = (budget: number | null) => {
    if (budget == null) return t("budgetNotSpecified");
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0,
    }).format(budget);
  };

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-tz-fg/50 p-4 backdrop-blur-sm sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={project.name}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-tz-border bg-tz-surface p-6 shadow-2xl sm:p-8"
          >
            {/* Закрыть */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-tz-border/60 bg-tz-soft/60 text-tz-muted transition-colors hover:border-tz-accent/40 hover:text-tz-accent"
              aria-label={t("close")}
            >
              <X size={16} />
            </button>

            {/* Шапка */}
            <div className="flex flex-wrap items-center gap-2 pr-10">
              <span
                className="rounded-full px-3 py-1 font-mono text-xs font-semibold"
                style={{ backgroundColor: `${color}18`, color }}
              >
                {getUgtLevel(ugtT, project.current_level).code}
              </span>
              <span className="rounded-full bg-tz-soft/70 px-3 py-1 font-mono text-xs font-medium text-tz-muted">
                {getShowcaseCategoryLabel(showT, project.category)}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-medium"
                style={{
                  backgroundColor: `${getStatusColor(project.status)}14`,
                  color: getStatusColor(project.status),
                }}
              >
                {getStatusLabel(project.status)}
              </span>
            </div>

            <h2 className="tz-page-title mt-4 !text-[clamp(1.4rem,2.2vw+0.5rem,2rem)]">
              {project.name}
            </h2>
            <p className="mt-2 text-sm text-tz-muted">
              {project.org} · {project.region}
            </p>

            {/* Тело: радар + детали */}
            <div className="mt-8 grid gap-8 md:grid-cols-[240px_1fr]">
              {/* Радар */}
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-tz-border/60 bg-tz-soft/40 p-5">
                <ProjectRadar
                  currentLevel={project.current_level}
                  documents={[]}
                  size={200}
                />
                <p className="text-center text-[11.5px] leading-relaxed text-tz-muted">
                  {t("radarCaption")}
                </p>
              </div>

              {/* Детали */}
              <div>
                <p className="text-[15px] leading-relaxed text-tz-secondary">
                  {project.description}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                      {t("level")}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold" style={{ color }}>
                      {project.current_level} {t("outOf")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                      {t("budget")}
                    </p>
                    <p className="mt-1 font-mono text-lg font-bold text-tz-fg">
                      {formatBudget(project.budget)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                      {t("category")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-tz-fg">{getShowcaseCategoryLabel(showT, project.category)}</p>
                  </div>
                  <div className="rounded-xl border border-tz-border/60 bg-tz-soft/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-tz-muted">
                      {t("organization")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-tz-fg">{project.org}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-xl border border-tz-border/60 bg-tz-accent/5 p-4">
                  <p className="text-[12.5px] leading-relaxed text-tz-secondary">
                    {t("fullData")}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================================================================== */
/*  Витрина                                                           */
/* ================================================================== */

export default function ProjectsShowcase() {
  const t = useTranslations("projectsLanding");
  const showT = asTranslateFn(useTranslations("showcase"));
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [minLevel, setMinLevel] = useState("all");
  const [maxLevel, setMaxLevel] = useState("all");
  const [selected, setSelected] = useState<ShowcaseProject | null>(null);
  const projects = useMemo(() => getShowcaseProjects(showT), [showT]);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (minLevel !== "all" && p.current_level < Number(minLevel)) return false;
      if (maxLevel !== "all" && p.current_level > Number(maxLevel)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!`${p.name} ${p.description} ${p.org} ${p.region}`.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [search, category, minLevel, maxLevel, projects]);

  const levelOptions = ["all", ...Array.from({ length: 9 }, (_, i) => String(i + 1))];

  const formatCategory = (slug: ShowcaseProject["category"]) => getShowcaseCategoryLabel(showT, slug);

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-16 md:py-24">
      {/* Шапка */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="tz-eyebrow">{t("eyebrow")}</p>
        <h1 className="tz-page-title mt-3 max-w-2xl">{t("title")}</h1>
        <p className="tz-lead mt-4 max-w-2xl">
          {t("desc")}
        </p>
      </motion.div>

      {/* Фильтры */}
      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-tz-border/60 bg-tz-surface p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tz-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-xl border border-tz-border/60 bg-tz-bg pl-9 pr-3 text-sm text-tz-fg outline-none transition-colors placeholder:text-tz-muted focus:border-tz-accent"
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 cursor-pointer rounded-xl border border-tz-border/60 bg-tz-bg px-3 text-sm text-tz-fg outline-none focus:border-tz-accent"
          aria-label={t("ariaSearch")}
        >
          <option value="all">{t("allCategories")}</option>
          {SHOWCASE_CATEGORY_SLUGS.map((slug) => (
            <option key={slug} value={slug}>
              {formatCategory(slug)}
            </option>
          ))}
        </select>

        <select
          value={minLevel}
          onChange={(e) => setMinLevel(e.target.value)}
          className="h-10 cursor-pointer rounded-xl border border-tz-border/60 bg-tz-bg px-3 text-sm text-tz-fg outline-none focus:border-tz-accent"
          aria-label={t("ariaUgtFrom")}
        >
          <option value="all">{t("ugtFromAny")}</option>
          {levelOptions.slice(1).map((l) => (
            <option key={l} value={l}>
              {t("ugtFrom", { level: l })}
            </option>
          ))}
        </select>

        <select
          value={maxLevel}
          onChange={(e) => setMaxLevel(e.target.value)}
          className="h-10 cursor-pointer rounded-xl border border-tz-border/60 bg-tz-bg px-3 text-sm text-tz-fg outline-none focus:border-tz-accent"
          aria-label={t("ariaUgtTo")}
        >
          <option value="all">{t("ugtToAny")}</option>
          {levelOptions.slice(1).map((l) => (
            <option key={l} value={l}>
              {t("ugtTo", { level: l })}
            </option>
          ))}
        </select>
      </div>

      {/* Счётчик */}
      <p className="mt-6 text-[12.5px] text-tz-muted">
        {t("shown", { filtered: filtered.length, total: projects.length })}
      </p>

      {/* Сетка маленьких карточек */}
      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} onOpen={setSelected} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-tz-border bg-tz-surface/50 px-6 py-16 text-center">
          <Layers size={32} className="mx-auto text-tz-muted/60" />
          <h3 className="mt-4 text-lg font-semibold text-tz-fg">{t("nothingFound")}</h3>
          <p className="mt-1.5 text-sm text-tz-muted">{t("tryOtherFilters")}</p>
        </div>
      )}

      {/* Живые данные */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mt-14 flex flex-col items-center gap-4 rounded-2xl border border-tz-border/60 bg-tz-surface p-8 text-center md:flex-row md:justify-between md:text-left"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tz-accent/10 text-tz-accent">
            <Lock size={20} />
          </span>
          <div>
            <h3 className="tz-card-title">{t("liveRegistry")}</h3>
            <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-tz-secondary">
              {t("liveDesc")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3">
          <Link href="/register" className="tz-btn tz-btn-primary">
            {t("register")} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/login" className="tz-btn tz-btn-secondary">
            {t("login")}
          </Link>
        </div>
      </motion.div>

      {/* Модалка с радаром */}
      <ProjectModal project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
