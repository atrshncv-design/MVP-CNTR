# Lead Agent Tooling Contract

This file reifies the recovery harness for the `codex/recovery-*` worktrees.
External tools are adopted only where they add a verifiable capability; they are
not added to the product runtime without a product requirement.

## Ralph loop

1. Read `Plan.md`, `Status.md`, `PRD.md`, and the nearest `AGENTS.md`.
2. Select one bounded hypothesis and increment the iteration counter (maximum 25).
3. Inspect before editing. Prefer the smallest safe implementation (Ponytail/YAGNI).
4. Run a deterministic check: build, lint, test, health request, or browser assertion.
5. Record the evidence in `Status.md`; stop on repeated failure or missing authority.

## Tool map

| Reference | Applied capability | Recovery policy |
| --- | --- | --- |
| ECC | skills, rules, atomic memory, security-first harness | This contract plus `Plan.md`/`Status.md`; no global config overwrite. |
| Graphify | persistent project navigation graph | Project-scoped Codex skill and `PreToolUse` hook are committed in `.agents/skills/graphify` and `.codex/hooks.json`. Code graphs are maintained in the frontend/backend worktrees and must pass `graphify portable-check` before commit. |
| Headroom | context/log compression | Codex routing is configured in user scope and the loopback proxy runs on `127.0.0.1:8787`. The current Codex process needs one restart before its own requests use the new route; meanwhile bounded log tails and `audit-reads` are active evidence. |
| Agent Browser | accessibility-tree browser checks | Global CLI and Codex skill are installed; use `agent-browser` for localhost accessibility-tree smoke checks after both servers start. |
| Huashu Design | local visual editing | The official skill is installed with its isolated dependencies and verifier. Before any visual implementation it enforces three concrete directions and Functional Validator selection. |
| DESIGN.md | persistent design tokens | `DESIGN.md` is the UI source of truth; validate when UI changes are made. |
| Anima SDK | design-to-code generation | SDK is installed and import-verified. Generation remains credential-gated until an Anima token and an explicit design source are supplied; secrets must remain backend-only. |
| Harness Engineering / Ralph | durable state, deterministic gates, bounded loops | Implemented by this loop and evidence ledger. |
| Ponytail | role/minimality enforcement | Official skill set and plugin are installed. Prefer native/platform features and the smallest diff that passes gates; run an independent Checker review before handoff. Plugin hooks activate after Codex restart. |
| CLI-Anything | JSON-first agent interfaces | Official skill and `cli-hub` are installed. Operational tooling must provide stable `--json` output and non-zero failure exits. |
| Harness Bench Fast | mechanically verified harness benchmark | Official environment is installed in isolation. Run its self-test/smoke gate; do not misrepresent it as product correctness evidence or run paid model benchmarks without credentials/authority. |

## Activation boundary

Tools that change Codex startup configuration (Headroom routing, Ponytail hooks,
newly installed skills) are installed now but become fully active for the agent
process after a Codex restart. This is an explicit lifecycle boundary, not a
fallback implementation. Credential-gated services are marked `ready/gated` in
`.agents/toolchain.json`; they must never be simulated by hard-coded responses.

## Evidence rules

- Never treat a checked box as proof; rerun the corresponding gate.
- Never call a fallback response a production integration.
- Keep credentials out of logs and commits.
- Frontend and backend remain separate worktrees and independently runnable.
