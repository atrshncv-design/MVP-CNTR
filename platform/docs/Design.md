# Design system and product design specification

## 0. Purpose of this document

This document is the primary design specification for the new frontend of the digital platform of the Center for Scientific and Technological Development of the Udmurt Republic.

The document is written for an AI development agent and must be treated as an implementation contract. The agent must read it before changing the visual system, public navigation, role dashboards, project dossiers, forms, registries, or status flows.

Supporting documents:

- [`CONTEXT.md`](./CONTEXT.md) - canonical domain vocabulary.
- [`ROUTES.md`](./ROUTES.md) - route and screen inventory.
- [`ROLES.md`](./ROLES.md) - role model and scenario coverage.
- [`DATA-CONTRACTS.md`](./DATA-CONTRACTS.md) - frontend data boundary and real-data rules.
- [`STATES.md`](./STATES.md) - statuses, interface states, and state transitions.
- [`TICKETS.md`](./TICKETS.md) - implementation order and isolated tickets.

If a later ticket conflicts with this document, preserve the principles, hierarchy, semantics, and data rules here unless the product owner explicitly changes the decision.

## 1. Product foundation

### 1.1 Brand architecture

The main brand is the **Center for Scientific and Technological Development of the Udmurt Republic**.

**Technomaturity** is a digital service of the Center. It is the service for assessing, documenting, verifying, and advancing technology readiness levels. It is not the name of the entire ecosystem.

The architecture must allow the Center to add public registries, customer requests, support measures, competitions, pilots, research, education, investment expertise, and regional analytics without forcing every feature into the language of UGT assessment.

Recommended visible relationship:

```text
Center for Scientific and Technological Development of the Udmurt Republic
└── Digital platform
    ├── Technomaturity: technology readiness and project progression
    ├── Technology registry
    ├── Customer requests
    ├── Industrial partners and executors
    ├── Support navigator
    ├── Competitions and pilots
    ├── Research and NIOKTR
    ├── Investment expertise
    ├── Education and events
    └── Ecosystem map and analytics
```

The visual identity may show the service name prominently inside its own workflow, but public pages must make the Center and the broader ecosystem legible.

### 1.2 Main promise

Primary promise:

> A unified digital environment where science, industry, and development institutions move technology from an idea toward serial production.

Concrete proof:

> The platform shows the current readiness of a technology, the evidence behind it, the next verified step, available partners, and the path toward implementation.

The first screen must not reduce the Center to a single assessment form. The two equal public entry points are:

- **Find a solution** - search technologies, research, executors, support, and customer requests.
- **Present a technology** - create or submit a technology dossier and begin the readiness path.

### 1.3 Design objectives

The redesign must achieve all of the following:

1. Make the Center feel like an operating innovation infrastructure, not a generic SaaS landing page.
2. Make real data, evidence, projects, research, organizations, and decisions visible.
3. Separate public discovery, applicant work, and Center operations into appropriate interface modes.
4. Make the technology path understandable without requiring the user to know internal terminology first.
5. Support three themes through one semantic system and one UX architecture.
6. Allow the frontend to be built and accepted independently from the current backend.
7. Give the development agent an implementation order that can be split into isolated tickets.

### 1.4 Current product audit

The current interface contains useful business content and working flows, but its visual language is too uniform:

- most sections are dark-blue rectangles with thin borders;
- blue is used for navigation, links, actions, decoration, and emphasis at the same time;
- uppercase monospace labels and grid backgrounds are repeated on nearly every page;
- public pages, forms, dashboards, registries, and operational screens share the same density and tone;
- the interface has few visual proofs of real Center activity;
- the current theme switch mostly changes colors instead of changing the visual atmosphere;
- the personal cabinet puts too many primary destinations into one horizontal bar;
- repeated three-card rows create a predictable AI-generated page rhythm.

The redesign must preserve the domain logic and improve the visual and interaction system. Do not remove working business concepts merely because their current presentation is weak.

## 2. Reference direction and product mechanics

### 2.1 Reference

The main reference for the public product direction is [i.moscow](https://i.moscow/). Use it as a reference for the feeling of a mature public innovation platform: content-first structure, useful discovery, large information surfaces, service navigation, registries, and ecosystem mechanics.

Useful reference mechanics to evaluate and adapt:

- technology and project showcase;
- startup and high-tech company registry;
- customer demand showcase;
- large-customer requests;
- support measure navigator;
- competitions and pilot programs;
- investment expertise and startup showcase;
- ecosystem participant map;
- research, NIOKTR, and intellectual property catalogues;
- educational programs and events.

Official reference pages supplied for research:

- [Project showcase](https://i.moscow/company/projects)
- [Startup registry](https://i.moscow/startup_reestr)
- [Customer showcase](https://i.moscow/b2b)
- [Investment expertise](https://i.moscow/invest/expertise)
- [Ecosystem map](https://i.moscow/mappartner)
- [Research catalogue](https://i.moscow/catalogDirectory)

The new product must not copy the reference site's exact markup, logo, texts, or branded visual assets. Adopt the product logic and level of maturity, then build a distinct Udmurt technology ecosystem identity.

### 2.2 Visual direction in one sentence

**A restrained, editorial technology infrastructure with visible evidence, clear pathways, regional character, and operational precision.**

The reference style is modern and public-facing, not cyberpunk, gaming, crypto, or futuristic decoration.

### 2.3 Three visual metaphors

Use three metaphors as a layered system:

1. **Technology path** for a project's progression from idea to production. Use milestones, evidence, checkpoints, and next-step indicators.
2. **Ecosystem map** for public discovery and matching. Use relationships between organizations, technologies, research, requests, and support.
3. **Production flow** for customer requests, pilots, implementation, and verification. Use stage gates, owners, deliverables, and decision history.

These metaphors must clarify information. They are not decorative backgrounds.

## 3. Audience and interface modes

All planned roles must have a coherent route and credible empty/loading/error states. The first complete implementation priority is:

1. industry customer / large or state-owned company;
2. industrial partner and technology executor;
3. Center employee;

The following roles must be represented in the architecture and receive at least the relevant public or operational screens:

- scientific organization;
- serial manufacturer;
- investor;
- expert or auditor;
- regulatory organization;
- Center manager;
- Center administrator;
- public visitor.

### 3.1 Public mode

Purpose: discover, understand, compare, and decide whether to participate.

Public users can:

- search verified technologies and research;
- browse customer requests;
- inspect organizations and industrial capabilities;
- browse support, competitions, pilots, events, and educational programs;
- inspect the ecosystem map;
- read the methodology and UGT scale;
- start an application or registration flow.

Public users cannot see private documents, internal comments, unreleased decisions, or unverified records.

### 3.2 Authenticated participant mode

Purpose: manage an organization's projects, applications, documents, requests, and communications.

The shell uses a left sidebar with role-oriented sections and a contextual top bar. Do not keep expanding the current overloaded horizontal dashboard menu.

### 3.3 Center operations mode

Purpose: review submissions, verify evidence, manage queues, publish records, control UGT progression, coordinate pilots, and maintain data quality.

The main object is an operational queue connected to technology dossiers, requests, organizations, documents, deadlines, owners, and decisions.

## 4. Information architecture

### 4.1 Public top-level navigation

Navigation is task-based, not an internal list of departments:

- Find a solution
- Present a technology
- Find a partner
- Find support
- Research and NIOKTR
- About the Center

Secondary navigation may expose:

- requests and pilots;
- registries;
- competitions;
- investment expertise;
- events and education;
- ecosystem map;
- methodology and UGT levels.

The header must show the current section, global search, theme switcher, and authentication entry. It must not expose every possible module as a flat row.

### 4.2 Authenticated sidebar

Shared items:

- Workspace
- My projects or assigned work
- Notifications
- Documents
- Profile and organization

Role-oriented items are added below the shared block. Examples:

Customer:

- Requests
- Technology search
- Pilots
- Shortlists
- Procurement-ready materials

Industrial partner / executor:

- Technologies
- Applications
- Customer requests
- Evidence and documents
- Pilots

Center employee:

- Operations center
- Verification queue
- Technology registry
- Customer requests
- Organizations and partners
- Research and NIOKTR
- Decisions and audit history
- Analytics

### 4.3 Information architecture rule

Every route must answer four questions:

1. Who is using this screen?
2. What object is being acted on?
3. What decision or action can be taken here?
4. Where does the user go next?

If a page cannot answer these questions, it is probably a decorative landing section rather than a useful product screen.

## 5. Domain model

The canonical vocabulary is in [`CONTEXT.md`](./CONTEXT.md). The following relationships govern the UI:

```text
Organization
├── Users and roles
├── Technologies / technology projects
├── Customer requests
├── NIOKTR records
└── Documents and evidence

Technology dossier
├── Project identity
├── Technology description
├── Readiness assessment
├── Four readiness dimensions
├── Evidence and documents
├── Current UGT level
├── Next checkpoint
├── Partners and team
├── Customer applications / matches
├── Pilot records
└── Decision and publication history
```

The central object is the **technology dossier**. It is not only a form and not only a public card. It is the same underlying object represented differently in public, participant, and Center operations modes.

### 5.1 Public technology card

The default card is compact and information-rich:

- technology name;
- one-line problem and solution;
- field or industry;
- organization;
- verified UGT level;
- evidence or publication status;
- relevant use case;
- last update date;
- action to open the dossier.

The card can expand into a full dossier without losing the user's search context.

### 5.2 Full technology dossier

Public dossier sections:

1. Header and verification status.
2. Problem and solution.
3. Application areas.
4. Current UGT level and readiness path.
5. Four readiness dimensions.
6. Evidence summary and available public documents.
7. Organization and capabilities.
8. Pilot or implementation history.
9. Related requests, support, research, or partners.
10. Contact or action to submit an application.

Participant dossier adds:

- editable project fields;
- full document workspace;
- checkpoints and criteria;
- comments and requests for clarification;
- submission history;
- N -> N+1 transition workflow;
- three-year reporting path.

Center dossier adds:

- verification queue context;
- reviewer assignment;
- internal notes;
- decision history;
- publication controls;
- audit trail;
- related organizations and requests;
- conflict or missing-evidence flags.

## 6. Design language

### 6.1 Core principle

Technology is communicated through evidence and relationships, not through glowing gradients, abstract circuit lines, or generic 3D images.

Use:

- structured data;
- real research and NIOKTR records;
- maps and geographies;
- document evidence;
- stage transitions;
- status history;
- organization and industry context;
- diagrams that explain a mechanism;
- restrained motion that explains change.

### 6.2 Anti-slop rules

The agent must apply the following rules on every new screen:

1. Do not make every section a bordered card.
2. Do not use blue for every interactive and decorative element.
3. Do not use a monospace uppercase eyebrow above every heading.
4. Do not use a uniform three-card grid as the default page composition.
5. Do not add a grid background merely to signal technology.
6. Do not use a blue or purple glow as a substitute for visual identity.
7. Do not use random AI-generated people, laboratories, equipment, or buildings as if they were real Center materials.
8. Do not show invented metrics, organizations, projects, or outcomes.
9. Do not make public, dashboard, form, registry, and operations screens look identical.
10. Do not use pill-shaped controls for ordinary buttons, cards, or navigation.

Positive replacement:

- public pages use editorial composition and real data;
- dashboards use information density and action priority;
- forms use progressive disclosure and clear progress;
- registries use search, filters, comparison, and evidence;
- operations use queues, ownership, deadlines, decisions, and history;
- technology feeling comes from paths, maps, data, and production logic.

### 6.3 Composition rules

Use a varied page rhythm:

- wide introduction followed by a data surface;
- split layout when the right side provides a meaningful visual model;
- full-width timeline for progression;
- table or list when comparison matters;
- map when relationships or geography matter;
- dossier layout when one object needs depth;
- controlled card groups only when the items are genuinely comparable.

Do not force every page into hero -> three cards -> CTA.

### 6.4 Imagery

The user currently has no proprietary photo library. Temporary AI images are allowed only as replaceable placeholders.

Rules:

- mark temporary assets in the content/config layer;
- do not attribute generated scenes to a real enterprise or Center event;
- avoid generic smiling teams, blue neon laboratories, floating holograms, and fake factory interiors;
- prefer abstract technical diagrams, real NIOKTR visualizations, maps, equipment close-ups, industrial textures, and document fragments;
- keep image slots replaceable without changing layout;
- when there is no verified image, use a deliberate data visualization or neutral visual placeholder.

### 6.5 Icons and illustration

Use one coherent icon family with stroke width and optical size controlled in the design system. Avoid mixing multiple icon libraries on the same screen. Existing icon dependencies may be replaced where their visual defaults conflict with the new system.

Icons must support recognition, not decorate every card. Use text with icons where ambiguity is possible.

## 7. Typography

### 7.1 Direction

Typography should feel like a mature Russian public technology platform: clear, restrained, editorial, and legible. It may share the general visual tone of i.moscow without copying its exact typography.

Recommended family system:

- primary display and UI family: **Golos Display / Golos Text** or an equivalent Russian-native variable sans;
- optional data family: **IBM Plex Mono** or equivalent, used only for IDs, timestamps, technical codes, and compact metadata.

Do not use monospace for all labels, body text, headings, or navigation.

### 7.2 Type scale

Use a responsive scale, starting from these values and tuning against real Russian copy:

| Token | Desktop | Mobile | Use |
| --- | ---: | ---: | --- |
| Display | 64/68 | 40/44 | public hero only |
| H1 | 48/54 | 32/36 | page title |
| H2 | 36/42 | 28/32 | major section |
| H3 | 24/30 | 22/28 | object or section title |
| Body large | 20/30 | 18/27 | introduction |
| Body | 16/24 | 16/24 | default content |
| Small | 14/20 | 14/20 | supporting content |
| Meta | 12/16 | 12/16 | technical metadata only |

Rules:

- use sentence case by default;
- reserve uppercase for rare tags, status codes, and compact data labels;
- do not letter-space every small label;
- let Russian text wrap naturally;
- test every heading with the longest realistic route name.

## 8. Geometry and layout

### 8.1 Geometry

- standard control radius: 8px;
- card or panel radius: 12px;
- large feature surface radius: 16px only when the composition benefits from it;
- no default pill radius;
- border width: 1px for separation, never as the only visual hierarchy;
- focus ring: 2px visible ring with sufficient offset.

### 8.2 Spacing

Use a 4px base with a practical 8px rhythm. Key page spacing:

- public content max width: 1200-1280px;
- public horizontal padding: 32px desktop, 20px mobile;
- dashboard content max width: 1440px;
- sidebar width: 248-280px expanded;
- section gap: 72-112px on public pages;
- dashboard section gap: 32-48px;
- form field gap: 20-24px;
- compact table row height: 56-64px.

### 8.3 Responsive behavior

Full mobile adaptation is required. Priorities on mobile:

1. open a technology dossier;
2. see status and next action;
3. receive and process notifications;
4. approve or request clarification;
5. search a technology or partner;
6. submit a short application.

On mobile:

- transform the sidebar into a drawer plus a compact current-section bar;
- keep primary action visible without covering content;
- convert dense tables into stacked records with explicit labels;
- preserve filter access through a bottom sheet or dedicated filter screen;
- keep progress, status, and next action above the fold;
- never hide critical decisions inside hover-only interactions.

## 9. Themes

Themes share component structure, semantic tokens, state meanings, spacing, geometry, and accessibility requirements. They differ in palette, surface treatment, imagery, and accent graphics.

Default theme: system preference through `prefers-color-scheme`. A manual choice is persisted per user/device and can be switched at any time.

### 9.1 Theme contract

Every component must use semantic tokens, never hardcoded theme colors. Required token groups:

- canvas;
- surface;
- elevated surface;
- border subtle / strong;
- text primary / secondary / muted / inverse;
- accent primary / accent soft;
- link;
- focus;
- success / warning / danger / info;
- UGT low / medium / high;
- overlay and scrim.

Status meaning stays constant across themes. Only hue, contrast treatment, and supporting visual language change.

### 9.2 Light theme

Character: open, editorial, institutional, data-rich.

- canvas: warm or neutral near-white, not pure white across every surface;
- surfaces: white and very light cool gray, with spacing and tonal changes doing more work than borders;
- primary text: deep graphite;
- secondary text: slate;
- primary accent: controlled deep blue, not electric blue everywhere;
- secondary accents: used only for status, geography, or a specific data category;
- illustrations: technical diagrams, maps, documents, equipment, and calm photography.

Light pages must not look like a dark UI with its colors inverted.

### 9.3 Dark theme

Character: focused operations, night control room, high contrast without neon.

- canvas: graphite-black with a subtle cool undertone;
- surfaces: separated mostly by tonal steps and whitespace;
- borders: sparse and low contrast;
- primary accent: electric but disciplined blue for primary action or current path only;
- text: warm high-contrast white and restrained gray;
- decoration: dark technical diagrams and subdued map layers, never constant glow.

Dark theme must not turn every card blue or surround every button with a halo.

### 9.4 Udmurt theme

Character: regional, confident, geometric, civic, and technological.

Base palette:

- black / graphite as structural ground;
- white as primary information surface and text contrast;
- red as a deliberate action, current path, or regional emphasis;
- small neutral gray range for hierarchy;
- blue may appear only where it has a semantic reason, not as the default brand accent.

Regional identity is visible through:

- modular geometry derived from the eight-pointed Udmurt star;
- restrained ornamental grid used in section dividers, map markers, and progress paths;
- regional map silhouettes and geographic references;
- custom markers and data nodes;
- photography or research connected to Udmurtia when verified materials become available.

The flag and traditional ornaments must not be pasted onto every surface. The theme is a modern interpretation of regional geometry, not an ethnographic decoration layer.

### 9.5 Theme QA

For every theme, verify:

- readable body text and controls;
- focus states;
- selected and unselected navigation;
- all status colors;
- charts and maps;
- empty, error, loading, and success states;
- mobile surfaces;
- reduced-motion mode.

## 10. Color semantics and UGT

UGT meaning is semantic, not decorative:

- low readiness: 1-3;
- medium readiness: 4-6;
- high readiness: 7-9.

Recommended status hues:

- low: warm orange or a theme-appropriate equivalent;
- medium: yellow or ochre;
- high: green;
- review: blue or neutral information color;
- blocked or rejected: red;
- draft: neutral gray.

These hues must be adapted for each theme while preserving contrast and meaning. Do not make the entire product monochrome blue merely because the current product does.

Do not use color alone to communicate UGT or status. Include number, label, icon or shape, and accessible text.

## 11. Core components

### 11.1 Header

Public header:

- Center/service identity;
- task-based navigation;
- global search;
- theme switcher;
- sign in;
- primary registration or submission action.

Authenticated header:

- current section title or breadcrumb;
- search or command access;
- notifications;
- theme switcher;
- organization/user context;
- profile menu.

### 11.2 Buttons

Hierarchy:

- primary: one dominant action in a local region;
- secondary: supportive action;
- quiet: low-emphasis action;
- destructive: explicit and separated from routine actions.

Button labels must express the result: `Открыть технологию`, `Подать технологию`, `Запросить уточнение`, `Опубликовать`, `Назначить проверку`.

Avoid vague labels such as `Подробнее`, `Продолжить`, or `Начать` when a more precise label fits.

### 11.3 Cards and surfaces

Cards are for a meaningful object, decision, or comparison. Use open layout, dividers, lists, timelines, tables, and whitespace when a card adds no value.

Every card needs a hierarchy:

- what the object is;
- why it matters;
- current state;
- next action or destination.

### 11.4 Registry controls

Registries need:

- global search;
- specialized filters;
- sort;
- result count only when sourced from real data;
- URL-persisted filter state where possible;
- saved search or export only when supported by the backend contract;
- clear publication and verification status;
- empty and partial-result states.

### 11.5 Technology path

Use a horizontal path on desktop and a vertical path on mobile. Each checkpoint shows:

- UGT number;
- checkpoint name;
- evidence state;
- responsible party;
- next required action;
- date or due date when available.

### 11.6 Data visualization

Use charts only when a relationship, change, comparison, or distribution needs visualization. Every chart needs:

- title;
- source or data scope;
- readable labels;
- a textual summary for accessibility;
- empty state when no real data is available.

The radar chart may remain as one view of the four readiness dimensions, but it must be accompanied by a textual breakdown and next actions. It must not be the only explanation of readiness.

## 12. Public page patterns

### 12.1 Home

Composition:

1. identity and task-based header;
2. hero with the ecosystem promise;
3. two equal actions: find a solution / present a technology;
4. real-data preview: technologies, NIOKTR, requests, or organizations;
5. technology path explanation;
6. ecosystem or regional map entry;
7. Center proof: methodology, verification, and project progression;
8. latest verified records or research, only from real data;
9. clear invitation to register or contact the Center.

Do not start with a generic radar chart. The radar may be a secondary interactive explanation of the methodology.

### 12.2 Registry and catalogue

Use a search-first layout:

- page purpose and data freshness;
- search and filters;
- result list or table;
- optional map or visual summary;
- result detail;
- publication state and source;
- next action.

### 12.3 Methodology and UGT

Explain the standard in plain language before showing details. Keep the nine levels, four dimensions, evidence requirements, transition rules, and three-year reporting path. Add examples only when sourced from real or explicitly permitted materials.

### 12.4 About the Center

Use mission, ecosystem, method, team, geography, and real activity. Avoid three identical icon cards as the dominant composition.

## 13. Participant and operations patterns

### 13.1 Participant workspace

Dashboard home uses the combined model:

- current work queue;
- project overview;
- key counts only when backed by real data;
- next actions;
- recent events;
- shortcuts to high-value actions.

The work queue has priority over decorative KPI cards.

### 13.2 Customer workspace

Primary flow:

1. create a technology request;
2. define problem, constraints, sector, implementation context, and desired outcome;
3. receive matched verified technologies or executors when matching data exists;
4. compare evidence and readiness;
5. shortlist;
6. initiate pilot or request clarification;
7. track decisions and documents.

### 13.3 Industrial partner workspace

Primary flow:

1. create or claim a technology dossier;
2. describe solution and capabilities;
3. attach evidence;
4. complete readiness checkpoints;
5. submit for review;
6. respond to clarification;
7. progress from N to N+1;
8. become visible in the public registry after Center verification.

### 13.4 Center operations workspace

Use an operations center with:

- queue of tasks and submissions;
- priority and deadline;
- assigned reviewer;
- current status;
- missing evidence;
- linked technology, organization, request, and document;
- decision history;
- publication control;
- audit trail.

The operations center must support table, queue, and dossier views. Kanban can be an optional view, not the only view.

## 14. Forms and registration

Registration keeps the role-selection model but becomes a clear five-step flow:

1. user data;
2. organization;
3. role and intended use;
4. confirmation and security;
5. approval or pending-review state.

Form rules:

- show progress and current step;
- preserve entered data when navigating back;
- validate at field level and on submission;
- explain why a field is required;
- distinguish user, organization, and role data;
- show what happens after submission;
- provide recovery for rejected or incomplete applications.

The technology submission flow uses progressive disclosure and saves drafts. It must expose the required evidence before the user invests time in a long form.

## 15. Data and frontend-backend boundary

The new frontend is an autonomous parallel contour until visual and scenario acceptance.

Required architecture:

- realistic fixtures loaded through a data layer;
- typed domain models;
- API adapter interface;
- mock adapter and future real adapter with the same method signatures;
- route-level loading, empty, error, and success states;
- no direct backend calls scattered through components;
- no route depending on a hidden hardcoded object;
- visible distinction between real, pending, and unavailable data.

Real data rule:

- use current backend data, especially NIOKTR, where available;
- use records that are actually public or explicitly marked for demonstration;
- do not invent organizations, technologies, metrics, outcomes, dates, or verification decisions;
- if a module has no data, show a designed empty state and explain how data will appear;
- if a temporary image is used, mark it as replaceable content rather than a factual image.

Integration with the current backend happens after frontend verification. The adapter is the only integration boundary.

## 16. Accessibility, motion, and quality

Accessibility is part of the definition of done:

- keyboard navigation for all actions;
- visible focus;
- semantic headings and landmarks;
- labels for form controls;
- text alternative for charts and maps;
- status not communicated only by color;
- contrast suitable for all three themes;
- reduced motion support;
- touch targets appropriate for mobile;
- error messages tied to fields and announced where appropriate.

Motion is functional only:

- show route and section transitions;
- reveal a saved state;
- indicate filtering, loading, or status change;
- animate progress when the value genuinely changes;
- avoid decorative loops, floating particles, parallax, and constant pulses.

## 17. Implementation order

P0 for the first frontend release:

1. semantic token system and three themes;
2. public shell, task-based navigation, global search entry, and responsive header;
3. authenticated shell with sidebar and contextual top bar;
4. customer, industrial partner, and Center employee workspaces;
5. technology dossier and public technology card;
6. UGT path, checkpoints, evidence, and next action;
7. customer requests, documents, statuses, comments, and decision history;
8. mock/data adapter using current real data where available;
9. loading, empty, error, success, permission, and mobile states;
10. role coverage for all remaining roles through truthful route shells and state-complete screens.

P1 modules:

- technology registry;
- organization and executor catalogue;
- request showcase;
- support navigator;
- competitions and pilots;
- NIOKTR and research catalogue;
- investment expertise;
- ecosystem map;
- events and education;
- analytics.

P2 enhancements:

- advanced matching;
- saved searches and subscriptions;
- richer regional map layers;
- full chat;
- advanced exports;
- external data integrations;
- real-time collaboration.

## 18. Completion criteria

The redesign is complete only when:

- all routes in [`ROUTES.md`](./ROUTES.md) have a deliberate screen or a deliberate redirect;
- the three themes use the same semantic state meanings but visibly different visual worlds;
- public, participant, and Center operations interfaces have different density and composition;
- the main user can find a technology, present a technology, or process a task without learning internal navigation;
- real backend/NIOKTR records can appear through the data boundary;
- absent data is handled honestly and visually;
- technology dossiers work in public, participant, and employee contexts;
- all critical forms preserve data and show field-level errors;
- statuses, evidence, decisions, and next actions remain legible on mobile;
- no major screen relies on repetitive blue cards, decorative grids, pervasive monospace labels, or generic AI imagery;
- the frontend can be accepted independently before backend integration;
- every P0 ticket has a browser-verifiable acceptance path.

