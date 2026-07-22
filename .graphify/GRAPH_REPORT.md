# Graph Report - .  (2026-07-22)

## Corpus Check
- Corpus is ~21,591 words - fits in a single context window. You may not need a graph.

## Summary
- 139 nodes · 143 edges · 17 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 103 · imports: 21 · imports_from: 18 · calls: 1


## Input Scope
- Requested: all
- Resolved: all (source: cli)
- Included files: 44 · Candidates: recursive
- Excluded: 0 untracked · 0 ignored · 0 sensitive · 0 missing committed

## Graph Freshness
- Built from Git commit: `e8805f2`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `RoleDashboard()` - 8 edges
2. `ROLES` - 4 edges
3. `RoleSlug` - 4 edges
4. `ROLE_DASHBOARD` - 4 edges
5. `UGT_LEVELS` - 3 edges
6. `getLevelColor()` - 2 edges
7. `QuestionnaireWizardClient()` - 2 edges
8. `isProtectedRoute()` - 2 edges
9. `isAuthRoute()` - 2 edges
10. `allowedRolesFor()` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Communities

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (14): DeliverableDoc, RiskItem, UGI_LEVELS, UGILevel, UGP_LEVELS, UGPLevel, UGS_LEVELS, UGSLevel (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (14): CATEGORY_CONFIG, ChecklistItem, EASE_BOUNCE, EASE_OUT_EXPO, EASE_SMOOTH, fadeUp, getLevelColor(), ProjectInfo (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.20
Nodes (9): allowedRolesFor(), isAuthRoute(), isProtectedRoute(), ROLE_DASHBOARD, ROLES, RoleSlug, ROUTE_ALLOWED_ROLES, Status (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (1): RoleDashboard()

### Community 4 - "Community 4"
Cohesion: 0.25
Nodes (6): AVAILABLE_TASKS, COMPETENCE_AREAS, containerVariants, DOCUMENT_TEMPLATES, easeOut, itemVariants

### Community 5 - "Community 5"
Cohesion: 0.33
Nodes (4): containerVariants, easeOut, itemVariants, statCards

### Community 6 - "Community 6"
Cohesion: 0.33
Nodes (4): ProjectData, STATUS_COLORS, STATUS_LABELS, UGT_LEVEL_NAMES

### Community 7 - "Community 7"
Cohesion: 0.33
Nodes (5): ApiUser, { handlers, signIn, signOut, auth }, LoginResponse, Session, User

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (4): CATEGORIES, STATUS_COLORS, STATUS_LABELS, Technology

### Community 9 - "Community 9"
Cohesion: 0.40
Nodes (3): Executor, ROLE_COLORS, ROLE_NAMES

### Community 10 - "Community 10"
Cohesion: 0.40
Nodes (4): EVALUATION_THRESHOLDS, QUESTIONNAIRE, QuestionnaireItem, QuestionnaireLevel

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (1): Status

### Community 12 - "Community 12"
Cohesion: 0.67
Nodes (1): Message

### Community 13 - "Community 13"
Cohesion: 0.67
Nodes (1): metadata

### Community 15 - "Community 15"
Cohesion: 1.00
Nodes (1): eslintConfig

### Community 17 - "Community 17"
Cohesion: 1.00
Nodes (1): nextConfig

### Community 18 - "Community 18"
Cohesion: 1.00
Nodes (1): config

## Knowledge Gaps
- **64 isolated node(s):** `eslintConfig`, `nextConfig`, `config`, `Message`, `Executor` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 3`** (1 nodes): `RoleDashboard()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (1 nodes): `Status`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (1 nodes): `Message`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (1 nodes): `metadata`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (1 nodes): `eslintConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 17`** (1 nodes): `nextConfig`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 18`** (1 nodes): `config`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `UGT_LEVELS` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `ROLES` connect `Community 2` to `Community 3`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `nextConfig`, `config` to the rest of the system?**
  _64 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._