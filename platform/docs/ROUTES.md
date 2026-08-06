# Route and screen inventory

This inventory is the minimum coverage target for the new frontend. A route may initially be backed by a real data adapter, a real NIOKTR query, or a truthful empty state. A route is not complete if it only renders a static title.

## Route conventions

- Public routes are crawlable only when their records are verified and public.
- Authenticated routes require an explicit role and permission context.
- `/app` is the authenticated shell root; role-specific default destinations are resolved after login.
- `/operations` is the Center employee shell root.
- `/technology/:id` is the public dossier; `/workspace/technologies/:id` is the participant view; `/operations/technologies/:id` is the review view.
- URL query parameters preserve public search, filters, sort, and pagination where practical.

## Public routes

| Route | Purpose | Primary states |
| --- | --- | --- |
| `/` | ecosystem entry and two primary actions | success, partial data, no published records |
| `/find` | task-based discovery hub | success, no results |
| `/technologies` | verified technology registry | loading, results, no results, error |
| `/technology/:id` | public technology dossier | verified, pending publication, unavailable |
| `/requests` | customer request showcase | results, no published requests |
| `/request/:id` | public customer request | published, closed, unavailable |
| `/partners` | organization and executor catalogue | results, no results |
| `/partner/:id` | organization profile and capabilities | published, limited data |
| `/support` | support measure navigator | results, no current measures |
| `/competitions` | competitions and calls | active, archive, no current calls |
| `/pilots` | pilot and implementation showcase | results, no public pilots |
| `/research` | research and NIOKTR catalogue | real NIOKTR results, no results |
| `/research/:id` | research/NIOKTR detail | public, restricted, unavailable |
| `/investments` | investment and expertise entry | content, no active offer |
| `/events` | events and education | upcoming, archive, no events |
| `/map` | ecosystem map | map with data, map without records, map error |
| `/about` | Center mission, method, ecosystem | content |
| `/methodology` | readiness method explanation | content |
| `/levels` | UGT 1-9 reference | content |
| `/roadmap` | platform and ecosystem roadmap | content, archived milestones |
| `/customers` | customer-specific entry page | content |
| `/performers` | executor-specific entry page | content |

## Authentication routes

| Route | Purpose | Required states |
| --- | --- | --- |
| `/login` | sign in | initial, validation error, invalid credentials, locked, success |
| `/register` | start registration | initial, validation, saved draft |
| `/register/organization` | organization details | validation, duplicate organization, success |
| `/register/role` | role selection | role explanation, invalid choice |
| `/register/confirm` | review and submit | editable, submitted |
| `/register/pending` | approval waiting state | pending, rejected, clarification requested |
| `/forgot-password` | password recovery | sent, invalid email, error |
| `/reset-password` | set a new password | invalid token, success, error |

## Authenticated shared routes

| Route | Purpose |
| --- | --- |
| `/app` | role-aware workspace entry |
| `/app/notifications` | notification center |
| `/app/documents` | user/organization document workspace |
| `/app/profile` | user profile |
| `/app/organization` | organization profile and access |
| `/app/settings` | preferences and theme |
| `/app/help` | task-based help and methodology |

## Customer routes

| Route | Purpose |
| --- | --- |
| `/app/customer` | customer workspace home |
| `/app/customer/requests` | customer requests |
| `/app/customer/requests/new` | create a customer request |
| `/app/customer/requests/:id` | request dossier and progress |
| `/app/customer/search` | search verified solutions and partners |
| `/app/customer/shortlists` | saved comparisons and shortlists |
| `/app/customer/pilots` | customer pilots |
| `/app/customer/pilots/:id` | pilot detail, tasks, evidence, decisions |

## Industrial partner / executor routes

| Route | Purpose |
| --- | --- |
| `/app/partner` | partner workspace home |
| `/app/partner/technologies` | organization technology dossiers |
| `/app/partner/technologies/new` | create technology dossier |
| `/app/partner/technologies/:id` | editable dossier |
| `/app/partner/technologies/:id/evidence` | evidence and documents |
| `/app/partner/technologies/:id/path` | UGT checkpoints and N -> N+1 |
| `/app/partner/applications` | applications to requests and pilots |
| `/app/partner/requests` | browse customer requests |
| `/app/partner/pilots` | partner pilot work |

## Scientific organization routes

| Route | Purpose |
| --- | --- |
| `/app/science` | research organization workspace |
| `/app/science/research` | organization research and NIOKTR |
| `/app/science/research/new` | submit a research record |
| `/app/science/partners` | relevant organizations and requests |

## Investor routes

| Route | Purpose |
| --- | --- |
| `/app/investor` | investor workspace |
| `/app/investor/technologies` | verified technology opportunities |
| `/app/investor/expertise` | expertise requests and outcomes |
| `/app/investor/watchlist` | saved opportunities |

## Expert / auditor routes

| Route | Purpose |
| --- | --- |
| `/app/expert` | assigned review workspace |
| `/app/expert/queue` | assigned verification queue |
| `/app/expert/reviews/:id` | evidence review and recommendation |
| `/app/expert/history` | completed reviews |

## Center operations routes

| Route | Purpose |
| --- | --- |
| `/operations` | unified operations center |
| `/operations/queue` | all operational tasks |
| `/operations/submissions` | technology and request submissions |
| `/operations/verification` | verification queue |
| `/operations/technology` | technology registry management |
| `/operations/technology/:id` | review dossier |
| `/operations/requests` | customer request moderation and matching |
| `/operations/organizations` | organization records and verification |
| `/operations/research` | research and NIOKTR management |
| `/operations/pilots` | pilot oversight |
| `/operations/decisions` | decision and publication history |
| `/operations/analytics` | data-backed analytics |
| `/operations/settings` | administrative configuration |

## Cross-cutting screens

The following are required inside the relevant routes, not necessarily separate URL paths:

- loading skeleton;
- empty state with a next action;
- no-permission state;
- not-found state;
- server/data error with retry;
- validation error;
- save-in-progress;
- saved successfully;
- submission pending review;
- clarification requested;
- rejected with reason;
- archived or closed;
- unsaved changes confirmation;
- document upload failure;
- offline or stale-data notice where applicable.

## Route acceptance rule

For every route, the implementation ticket must specify:

1. role and entry point;
2. primary object;
3. primary action;
4. real-data source or explicit empty state;
5. success, error, loading, and permission behavior;
6. mobile transformation;
7. next route after the primary action.

