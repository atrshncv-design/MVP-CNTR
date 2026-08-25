# Isolated implementation tickets

Tickets are ordered by dependency. The first release can be implemented by separate tickets, but every ticket must keep the same tokens, domain vocabulary, data adapter, and state model.

## Dependency map

```text
T-001 Design tokens and theme contract
  ├── T-002 Public shell
  ├── T-003 Authenticated shells
  ├── T-004 Data adapter and real-data fixtures
  └── T-005 State system

T-002 + T-003 + T-004 + T-005
  ├── T-006 Public discovery
  ├── T-007 Technology dossier
  ├── T-008 Customer workspace
  ├── T-009 Partner workspace
  ├── T-010 Operations center
  ├── T-011 UGT path and evidence
  ├── T-012 Requests, documents, comments, decisions
  └── T-013 Registration and authentication surfaces

P1 modules build on T-006 through T-012.
```

## P0 tickets

### T-001 - semantic design system and three themes

Scope:

- semantic color tokens;
- typography;
- spacing and geometry;
- focus and disabled states;
- light, dark, and Udmurt theme variants;
- system preference and persistent manual choice;
- responsive tokens;
- reduced-motion support.

Acceptance:

- the same component renders correctly in all three themes;
- Udmurt is visibly more than a color swap;
- status and UGT meanings remain constant;
- no component uses hardcoded theme colors;
- contrast and focus pass review on desktop and mobile.

### T-002 - public shell and task-based navigation

Scope:

- Center/service identity;
- public header;
- two equal primary entry points;
- task-based navigation;
- global search entry;
- theme switcher;
- responsive mobile navigation;
- footer and public utility links.

Acceptance:

- a visitor can find a technology, present a technology, find a partner, and find support;
- no internal route names are required to understand the primary tasks;
- header and navigation work in all three themes and mobile.

### T-003 - authenticated shells

Scope:

- role-aware shell;
- sidebar;
- contextual top bar;
- notifications;
- profile/organization context;
- shared workspace routing;
- mobile drawer.

Acceptance:

- customer, partner, and Center employee have distinct navigation priorities;
- sidebar remains scalable when modules are added;
- current route and next action are always visible;
- role restrictions are represented truthfully.

### T-004 - typed data layer and real-data fixtures

Scope:

- domain types;
- mock adapter interface;
- real NIOKTR/backend fixture loading where available;
- source metadata;
- no invented public records;
- adapter error and empty responses.

Acceptance:

- public examples come from available real data or appear as empty states;
- a route can switch adapters without component rewrites;
- missing fields are visible as partial data, not silently fabricated.

### T-005 - universal state system

Scope:

- canonical statuses;
- loading, empty, error, permission, success, stale, and archived states;
- notification events;
- upload state primitives;
- decision history display.

Acceptance:

- every P0 data route has explicit state coverage;
- status labels map to [`STATES.md`](./STATES.md);
- state meaning is consistent across themes and roles.

### T-006 - public discovery and registries

Scope:

- `/find`;
- `/technologies`;
- `/requests`;
- `/partners`;
- `/research`;
- global search;
- specialized filters;
- URL-persisted search state;
- compact cards and list/table views.

Acceptance:

- user can search and filter real records;
- no-result and unavailable-data states are designed;
- each result exposes status, provenance, and next action;
- mobile filters and result cards are usable.

### T-007 - technology dossier

Scope:

- public dossier;
- participant dossier;
- Center review dossier;
- compact card to expanded dossier;
- visibility rules;
- evidence summary;
- related requests, research, partners, and pilots.

Acceptance:

- the same technology object has role-appropriate views;
- public view never exposes private comments or unreleased decisions;
- dossier explains current level, evidence, and next action;
- partial data is handled without fake content.

### T-008 - customer workspace

Scope:

- workspace home;
- request creation;
- request dossier;
- solution search;
- comparison and shortlist;
- pilot entry state;
- comments and notifications.

Acceptance:

- customer can create and save a request;
- customer can inspect verified records;
- customer can compare available evidence;
- no match produces an honest next step.

### T-009 - industrial partner workspace

Scope:

- partner workspace;
- technology draft;
- evidence upload;
- UGT path;
- submission for verification;
- clarification response;
- request and pilot participation.

Acceptance:

- partner can save a draft and return to it;
- validation is field-level;
- submission status and next action are clear;
- partner can see why publication or progression is blocked.

### T-010 - Center operations center

Scope:

- operations home;
- prioritized queue;
- table/queue/dossier views;
- assignment;
- deadlines;
- missing evidence;
- publication candidates;
- decision history;
- basic analytics from real records.

Acceptance:

- employee can find the next task without scanning an overloaded menu;
- every queue item leads to the relevant object and action;
- approval, clarification, rejection, publication, and archive are traceable;
- counts are sourced or omitted.

### T-011 - UGT path, checkpoints, and evidence

Scope:

- UGT 1-9 reference;
- four dimensions;
- checkpoint path;
- current and target level;
- evidence checklist;
- N -> N+1 transition;
- three-year reporting placeholder/route.

Acceptance:

- current verified level is distinct from draft progress;
- each checkpoint exposes criteria and missing evidence;
- desktop path becomes a readable mobile sequence;
- radar is supplementary, not the only explanation.

### T-012 - requests, documents, comments, and decisions

Scope:

- document workspace;
- contextual comments;
- notifications;
- decision timeline;
- request clarification;
- approval and rejection confirmations;
- upload states.

Acceptance:

- every decision has reason, actor, time, and next action;
- documents have explicit processing states;
- comments remain attached to the correct object;
- full chat is not required for P0.

### T-013 - authentication and five-step registration

Scope:

- login;
- registration;
- user data;
- organization;
- role;
- confirmation;
- pending/rejected/clarification states;
- password recovery.

Acceptance:

- user knows what happens after submission;
- entered data survives step navigation;
- role and organization are separate concepts;
- error and pending states do not look like successful access.

### T-014 - responsive and accessibility pass

Scope:

- keyboard and focus review;
- screen reader semantics;
- chart/map summaries;
- mobile flows;
- reduced motion;
- contrast and text wrapping;
- long Russian copy.

Acceptance:

- critical customer, partner, and employee flows work on mobile;
- no critical action depends on hover;
- all states are readable in all themes;
- no horizontal overflow in required routes.

## P1 tickets

- T-101 support measure navigator;
- T-102 competitions and pilot showcase;
- T-103 ecosystem map and Udmurt regional layers;
- T-104 investment expertise;
- T-105 events and education;
- T-106 intellectual property and NIOKTR enrichment;
- T-107 analytics and reports;
- T-108 scientific organization workspace;
- T-109 investor workspace;
- T-110 expert/auditor workspace;
- T-111 manufacturer and regulatory organization flows.

Each P1 ticket must use the same route, role, data, and state contracts. A P1 screen is not complete if it only adds a visual card without a data source and empty/error behavior.

## P2 tickets

- T-201 advanced matching and recommendation;
- T-202 saved searches and subscriptions;
- T-203 full contextual chat;
- T-204 live data integrations;
- T-205 exports and external reports;
- T-206 advanced map layers;
- T-207 real-time collaborative review.

