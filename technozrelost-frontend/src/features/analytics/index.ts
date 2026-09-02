/**
 * Публичный контракт модуля analytics (тикет 08).
 * Админ макс-аналитика (воронка + отрасли + муниципалитеты + KPI),
 * менеджер урезанная (только очередь + воронка по своим).
 * Использует lib/types/status/filters/api-client из 01 — не лезет в project/registry core.
 */
export { AdminAnalytics } from "./AdminAnalytics";
export { ManagerAnalytics } from "./ManagerAnalytics";
export { Funnel } from "./Funnel";
export { WeekBars, DayBars } from "./WeekBars";
export { PercentRows } from "./PercentRows";
export { SectorRows, BackendSectorRows, RegionRows } from "./SectorRows";
export { HardGateBadge, ReturnBadge } from "./HardGateBadge";
export type { AdminStats, FunnelData, SectorRow, RegionRow } from "./types";
export { FUNNEL_STATUSES } from "./types";
export {
  buildFunnel,
  funnelSumsToTotal,
  buildSectorRows,
  buildRegionRowsFromProjects,
  buildRegionRowsFromOrgs,
  sortByUpdatedDesc,
  paginate,
  formatBudget,
  ANALYTICS_LIMIT,
  LIGHT_PALETTE_ONLY,
} from "./utils";
export { formatShortDate, formatRelative } from "./utils";
