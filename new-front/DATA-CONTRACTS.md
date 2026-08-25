# Frontend data contracts and real-data boundary

## 1. Boundary principle

The frontend is built as a parallel application. It must be visually and scenarily verifiable before it is connected to the current backend.

Use this shape:

```text
UI components
    ↓
route loaders and actions
    ↓
typed domain data layer
    ↓
mock adapter | real API adapter
```

Components must not call backend URLs directly. The adapter is the replacement point after acceptance.

## 2. Data truth policy

The product owner requires real data for examples and public content.

Allowed sources:

- current backend records;
- NIOKTR data already present in the backend;
- verified organization, technology, request, or project records explicitly supplied by the Center;
- content marked as unavailable or pending when no record exists.

Not allowed:

- invented companies;
- invented technologies;
- invented research results;
- invented metrics, counts, dates, outcomes, pilots, or investment results;
- fake testimonials or fake Center activity;
- AI images presented as real organizations or events.

If there is no real data, the UI must communicate one of:

- `Пока нет опубликованных записей`;
- `Данные проходят проверку`;
- `Раздел готов к наполнению`;
- `Нет доступа к этой информации`;
- `Источник данных временно недоступен`.

## 3. Adapter interface shape

The implementation may choose the exact language and framework types, but the methods must correspond to product use cases:

```ts
type ListQuery = {
  search?: string
  filters?: Record<string, string | string[] | undefined>
  sort?: string
  page?: number
  pageSize?: number
}

interface PlatformDataAdapter {
  getHomeSummary(): Promise<HomeSummary>
  listTechnologies(query: ListQuery): Promise<Page<TechnologySummary>>
  getTechnology(id: string, scope: VisibilityScope): Promise<TechnologyDossier | null>
  listCustomerRequests(query: ListQuery): Promise<Page<CustomerRequestSummary>>
  getCustomerRequest(id: string, scope: VisibilityScope): Promise<CustomerRequest | null>
  listOrganizations(query: ListQuery): Promise<Page<OrganizationSummary>>
  listResearch(query: ListQuery): Promise<Page<ResearchRecord>>
  getResearch(id: string, scope: VisibilityScope): Promise<ResearchRecord | null>
  getUgtMethodology(): Promise<UgtMethodology>
  getWorkspace(role: Role): Promise<WorkspaceSnapshot>
  getOperationsQueue(query: QueueQuery): Promise<Page<OperationalTask>>
  saveDraft(input: DraftInput): Promise<SaveResult>
  submitForReview(input: SubmissionInput): Promise<SubmissionResult>
  addComment(input: CommentInput): Promise<Comment>
  recordDecision(input: DecisionInput): Promise<Decision>
}
```

The exact contract may evolve through integration interviews with the backend agent, but UI code should depend on product operations, not storage tables.

## 4. Core data shapes

### TechnologySummary

- `id`
- `title`
- `shortDescription`
- `industry`
- `organizationName`
- `ugtLevel`
- `ugtBand`
- `verificationStatus`
- `publicationStatus`
- `lastUpdatedAt`
- `availableEvidenceCount` only if real
- `imageOrVisualReference` only if real or explicitly replaceable

### TechnologyDossier

- identity and title;
- problem;
- solution;
- application areas;
- industries;
- organization;
- team and partners where permitted;
- UGT level and history;
- four readiness dimensions;
- checkpoints;
- evidence;
- documents;
- customer requests and matches;
- pilots;
- decision history;
- visibility and publication metadata.

### CustomerRequest

- title;
- problem statement;
- customer organization;
- industry;
- constraints;
- desired capability or result;
- implementation context;
- request status;
- publication status;
- deadline only if real;
- matched technologies or partners;
- related pilot.

### ResearchRecord / NIOKTR

- title;
- source identifier;
- organization;
- research type;
- subject or technology area;
- region relation where known;
- publication or access status;
- date only if sourced;
- linked technology/project IDs when known;
- source URL or provenance metadata.

### OperationalTask

- id;
- object type and object ID;
- task type;
- priority;
- status;
- assignee;
- due date;
- missing evidence summary;
- last event;
- next action.

## 5. Mock adapter rules

The mock adapter is for interaction development, not for inventing a fake market.

- Prefer current backend snapshots or fixture exports.
- Use a small representative set of real records for P0.
- Preserve source identifiers.
- Preserve publication and verification status.
- Include records with incomplete fields to test real empty/partial states.
- Include at least one record in each required workflow state when such records exist in source data.
- If a state does not exist in source data, use a controlled state fixture named as a UI test fixture, never as a public production record.

## 6. API integration checklist

Before replacing the mock adapter:

1. map each adapter method to an API operation;
2. document authentication and role requirements;
3. document pagination and filter semantics;
4. document publication and visibility rules;
5. map backend statuses to [`STATES.md`](./STATES.md);
6. define missing/null field behavior;
7. preserve source and updated timestamps;
8. test permission failures and stale data;
9. verify uploads and document processing;
10. run the same browser acceptance flows against mock and real adapters.

