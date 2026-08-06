# D-05: Графики в аналитике и дашбордах (SVG, без библиотек)

Status: ready-for-agent

## Цель
«Графиков нет» — добавить визуализации данных: бар-чарт распределения УГТ, спарки на дашбордах. Только реальные/фикстурные данные с подписанным источником.

## Изменяемые файлы
- `platform/src/components/charts/bar-chart.tsx`, `sparkline.tsx` (новые).
- `platform/src/app/operations/analytics/page.tsx` — добавить BarChart (распределение УГТ по досье-фикстурам: 6 досье × currentLevel).
- `platform/src/app/app/customer/page.tsx` и/или `partner/page.tsx` — мини-спарки (например, активность по неделям из фикстурных дат ИЛИ честное «данные появятся»).
- НЕ трогать: токены (D-01), главную (D-04), ugt-компоненты (D-07).

## Контракт
```tsx
export interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number; // default 160
  color?: string;  // default var(--accent)
  ariaLabel: string;
}
export function BarChart(props: BarChartProps): JSX.Element;

export interface SparklineProps {
  points: number[];
  height?: number; // default 40
  color?: string;
  ariaLabel: string;
}
export function Sparkline(props: SparklineProps): JSX.Element;
```

## Требования
1. Чистый SVG: ось-бары с подписями, значения ≥0; пустые данные → честное «Нет данных для графика».
2. Токены: `var(--border-subtle)` сетка, `var(--text-muted)` подписи, accent — заливка.
3. `role="img"` + `aria-label`; reduced-motion — без анимации.
4. В аналитике: BarChart «Распределение заявленных уровней УГТ по досье» (данные из `technologyDossierFixtures.ugt.currentLevel`) + существующие метрики остаются.
5. Источник подписан под каждым графиком (как в OpsAnalytics).

## Acceptance
- Гейты: lint/tsc/build; браузер :3001: /operations/analytics (роль Менеджер) показывает BarChart с реальными числами фикстур; дашборд заказчика — спарк или честное состояние.
- Скриншоты в 3 темах.

## Desktop/mobile
BarChart на мобильном: горизонтальный скролл контейнера или вертикальные бары с переносом подписей — не ломать вёрстку.
