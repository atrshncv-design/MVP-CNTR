---
name: Technozrelost MVP
colors:
  primary: "#0F172A"
  secondary: "#64748B"
  accent: "#2E5BFF"
  surface: "#FFFFFF"
  background: "#F5F7FA"
  border: "#DFE5EC"
  success: "#15845B"
  warning: "#B35A18"
  danger: "#DC2626"
typography:
  body:
    fontFamily: Arial
    fontSize: 14px
    lineHeight: 1.45
  display:
    fontFamily: Arial
    fontWeight: 700
rounded:
  sm: 8px
  md: 14px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
---

# Design contract

Functional Validator approved Huashu direction B, «Процесс в центре», on
2026-07-24. The rendered source and exact decision are stored in
`design/phase-1/direction-approved.md`.

The shared application shell uses a graphite horizontal global header, a light
project workspace, a project-context header, local section tabs, and a dominant
process panel. Each P0 workspace must expose the current state, the next
required action, its owner, its deadline, and the conditions for the next
transition before secondary analytics.

The design preserves MVP 0's graphite/blue identity and semantic UGT colors,
while removing prototype-only role cards, fake KPI decoration, and local data.
Production screens may render only API-backed values or explicit
loading/empty/error/forbidden states.

Arial is the current offline-safe token mirrored by `src/app/globals.css`; a
future branded font must ship as a local asset rather than a build-time network
dependency.

Interfaces prioritize readable data density, explicit status, keyboard access,
and WCAG-compatible contrast over decorative effects.

## Component rules

- Global navigation: one horizontal graphite bar; active location is visible
  without relying on color alone.
- Workspace navigation: text tabs below the project title; active tab uses a
  blue underline and stronger weight.
- Process: the largest content block on project pages; state number and label
  are both present.
- Primary action: only one per viewport section. Warning color marks attention,
  not ordinary navigation.
- Cards: white surface, one-pixel neutral border, 14px radius, no decorative
  gradients or floating glass effects.
- UGT: always display both `УГТ N` and the textual level name. Color alone never
  communicates level or status.
- Responsive behavior: global navigation may collapse, but project context,
  current state, and next action remain visible in document order.
