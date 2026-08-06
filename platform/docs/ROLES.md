# Roles, permissions, and primary scenarios

This document defines what each audience comes to do. The UI may share components, but it must not force every role through the same dashboard.

## Role matrix

| Role | Main job | P0 coverage | Main object |
| --- | --- | --- | --- |
| Public visitor | understand the Center and discover verified records | complete public shell | technology, research, request |
| Industry customer | find a solution, create a need, compare, pilot | complete | customer request |
| Industrial partner / executor | present a technology and progress it | complete | technology dossier |
| Scientific organization | publish research and connect it to technologies | route and credible states | NIOKTR/research |
| Serial manufacturer | evaluate and implement production-ready technology | route and credible states | technology/pilot |
| Investor | inspect verified opportunities and expertise | route and credible states | technology opportunity |
| Expert / auditor | review evidence and recommend a decision | route and credible states | review |
| Center employee | operate queues, verify, publish, coordinate | complete | operational task |
| Center manager | make decisions and control progression | complete through operations views | decision/checkpoint |
| Center administrator | manage access, roles, settings, and data quality | route and credible states | organization/user/configuration |
| Regulatory organization | review relevant compliance or evidence | route and credible states | evidence/checkpoint |

## Customer scenario

### Goal

Move from an industrial problem to a verified shortlist, pilot, or implementation decision.

### Journey

1. Land on `Find a solution`.
2. Search by problem, industry, capability, readiness, geography, and evidence.
3. Open a technology dossier.
4. Compare the current UGT and readiness dimensions.
5. Create a customer request if an existing solution is insufficient.
6. Review matched technologies or executors.
7. Build a shortlist.
8. Request clarification or initiate a pilot.
9. Track documents, tasks, decisions, and next actions.

### Customer dashboard priority

1. urgent tasks and requests for action;
2. active requests and pilots;
3. latest relevant verified technologies;
4. shortlists and saved searches;
5. organization profile and documents.

## Industrial partner scenario

### Goal

Present a technology, prove its current readiness, and progress it toward the next verified stage.

### Journey

1. Start `Present a technology`.
2. Complete organization and technology identity.
3. Describe the problem, solution, application, and maturity.
4. Attach evidence and documents.
5. Save a draft.
6. Submit for Center verification.
7. Respond to clarification requests.
8. Receive a decision and publication state.
9. Complete the next checkpoint and submit N -> N+1.
10. Participate in a customer request or pilot.

### Partner dashboard priority

1. current technology path and next checkpoint;
2. action-required evidence and clarifications;
3. applications and customer requests;
4. active pilots;
5. documents and organization data.

## Center employee scenario

### Goal

Turn incoming data and submissions into verified, traceable, public, and actionable ecosystem records.

### Journey

1. Open the operations center.
2. See prioritized queue by deadline, risk, missing evidence, and role.
3. Open a technology, request, organization, or NIOKTR record.
4. Assign or claim a task.
5. Review fields and evidence.
6. Request clarification, approve, reject, publish, archive, or move to the next checkpoint.
7. Record the decision reason.
8. Notify the responsible participant.
9. Inspect related requests, partners, pilots, and historical decisions.
10. Monitor data quality and backlog.

### Operations dashboard priority

1. queue and overdue work;
2. items requiring decision;
3. missing evidence and clarification requests;
4. newly submitted or changed records;
5. verified publication candidates;
6. data-backed trends.

## Secondary role behavior

### Scientific organization

The interface emphasizes research records, NIOKTR, intellectual property, project links, and possible technology paths. Do not represent a research record as an industrial technology unless the data and workflow support that relationship.

### Serial manufacturer

The interface emphasizes production readiness, manufacturing capability, supplier context, pilot requirements, and implementation evidence.

### Investor

The interface emphasizes verified technology, market/application context, evidence, team, maturity, and expertise status. Never display investment outcomes as factual unless present in real data.

### Expert or auditor

The interface emphasizes assigned scope, evidence checklist, comments, recommendation, conflict flag, and history. It must not expose unrelated private data.

### Administrator

The interface emphasizes access, role assignment, organization verification, data quality, system configuration, and audit logs. Administrative actions need explicit confirmation.

## Role-based visibility

| Object | Public | Participant | Center staff |
| --- | --- | --- | --- |
| Verified technology summary | yes | yes | yes |
| Draft technology | no | owner/team | staff if permitted |
| Evidence details | selected public docs | full owner access | full review access |
| Internal comments | no | relevant participants | authorized staff |
| Decision history | public summary when published | own project | full audit history |
| Customer request | published summary | relevant applicants | full moderation data |
| User data | public organization data only | organization scope | permission-based |
| NIOKTR | public where permitted | linked records | full data management |

