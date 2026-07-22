---
name: Technozrelost MVP
colors:
  primary: "#111827"
  secondary: "#4B5563"
  accent: "#2563EB"
  surface: "#FFFFFF"
  background: "#F3F4F6"
typography:
  body:
    fontFamily: Arial
    fontSize: 1rem
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
---

# Design contract

This recovery baseline documents the existing offline-safe neutral B2B/B2G direction. It is
not permission to restyle the application. UI changes must first inventory the
actual frontend tokens and then update this file and implementation atomically.
The Arial token mirrors `src/app/globals.css`; a future branded font change must
ship as a local asset rather than a build-time network dependency.

Interfaces prioritize readable data density, explicit status, keyboard access,
and WCAG-compatible contrast over decorative effects.
