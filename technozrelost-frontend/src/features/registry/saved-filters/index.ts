/**
 * Публичный шов модуля registry/saved-filters (interfaces.md, P2 R02).
 * Владеет сохранёнными фильтрами, выставляет useSavedFilters, прячет
 * бэк vs localStorage фолбэк.
 * Почему barrel: единый импорт из @/features/registry/saved-filters.
 */

export { SAVED_FILTERS_KEY, BLOCKED_REASON, readLocalSavedFilters, writeLocalSavedFilters, addLocalSavedFilter, removeLocalSavedFilter, clearLocalSavedFilters } from "./storage";
export type { SavedFilter } from "./storage";
export { useSavedFilters } from "./useSavedFilters";
export type { UseSavedFiltersReturn } from "./useSavedFilters";
export { SavedFilters } from "./SavedFilters";
export { default } from "./SavedFilters";
