# T10 — CODE-01 suppressed-exception counter

## Result

Added the bounded Prometheus counter `technozrelost_suppressed_exceptions_total{module=...}` and recorded 30 confirmed swallowed/fallback exception sites. The only permitted module labels are `auth_throttle`, `rag`, `file_storage`, `matching`, `metrics`, `main`, `deps`, and `nioktr`. Exception messages, request paths, project/tenant identifiers, and user data are never labels. Exceptions converted to HTTP errors or explicitly propagated are not counted.

| Module label | Counted sites | Behavior monitored |
|---|---:|---|
| `auth_throttle` | 6 | Redis fallback, LRU fallback, best-effort cleanup |
| `rag` | 3 | DB/embedding/vector-search fallback |
| `file_storage` | 9 | best-effort storage/ClamAV metadata and health metrics |
| `matching` | 2 | lexical and LLM rerank fallback |
| `metrics` | 4 | metrics scrape fallback and middleware recovery |
| `main` | 1 | scheduler iteration caught so loop can continue |
| `deps` | 2 | invalid optional token treated as anonymous |
| `nioktr` | 3 | registry rate-limit Redis/LRU fallback |
| **Total** | **30** | fixed, low-cardinality labels |

## TDD and validation

- RED: `tests/test_observability.py::test_suppressed_exception_counter_is_bounded_and_resettable` failed as expected before implementation (`AttributeError`: recorder absent).
- GREEN: the same contract now verifies accumulation, 500 concurrent increments under a fixed module label, invalid/dynamic label rejection, and `reset()`; focused test → 1 passed.
- Representative callsite: Redis ping failure in `auth_throttle._get_redis()` increments the `auth_throttle` series; test included in `tests/test_auth_throttle.py`.
- Related backend tests: `./.venv/bin/pytest tests/test_observability.py tests/test_auth_throttle.py tests/test_file_storage.py tests/test_nioktr.py tests/test_health.py tests/test_semantic_embeddings.py -q` → 41 passed, 1 pre-existing Starlette/httpx deprecation warning (37.06s). The later concurrency expansion changed only the test; its dedicated test passed.
- Ruff on all changed backend files → PASS. Python 3.11 mypy → PASS, 62 source files.
- Sandbox-only pytest attempt could not connect to local test PostgreSQL (`Operation not permitted`); rerun with approved local test-DB access passed. No production host/data were accessed.
- Full backend regression is scheduled after T10–T12, per the wave plan; not yet claimed.

## Known boundary

The metric is process-local like the existing counters; Prometheus aggregates replica series at scrape time. It records exception events, not unique incidents. The remaining broad catches outside CODE-01's evidence scope are not changed by this ticket.
