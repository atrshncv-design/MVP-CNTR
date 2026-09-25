# T05 — UX-01 public form labels

- Executor: fresh OpenCode session `ses_f29115f65ffeCD6WYsDKEaVcSh`, `opencode/space-bunny-free` variant `max`; no executor commit or push.
- RED: focused regression initially failed because `/projects` search had no `aria-label`.
- Implementation: `/projects` search receives localized `projectsLanding.searchAria` (ru/en/zh in both message trees); `UgtSelect` uses native `label[for]` → `select[id]` with an independent ID per instance. No filter/API behavior changed.
- Review: Manifest+Spec PASS; Craft first FAIL on test coupling to `useId()`/exact call-site count, corrected by executor; Craft re-review PASS.
- Independent checks from frontend directory: `node --test tests/public-form-labels.test.mjs` 1 passed; `npm run lint` exit 0 (one pre-existing `_params` warning in `src/lib/api-client.ts:677`); `npm test` 239 passed; `API_URL_INTERNAL=http://backend:8000 npm run build -- --webpack` exit 0, 53 routes; `git diff --check` exit 0.
- Visual screenshots at 1920/768/375 were not taken; this is an optional ticket check and remains unverified. Production was not touched.
- Code commit `d12c0ee`, pushed to `origin/autopilot/production-stabilization`.
