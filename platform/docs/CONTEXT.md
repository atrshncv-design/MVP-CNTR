# Domain context and canonical vocabulary

This file is the single source of truth for product terms. Use these terms in routes, components, labels, fixtures, API adapters, and documentation.

## Organization

A legal or institutional participant in the ecosystem: customer, executor, scientific organization, manufacturer, investor, regulatory body, or Center unit.

An organization is not the same as a user. One organization may have multiple users and roles.

## User

A person authenticated in the platform. A user acts on behalf of an organization or the Center.

## Role

A permission and workflow context assigned to a user. A role changes available actions and workspace views; it does not change the underlying technology object.

## Technology

A scientific, engineering, digital, production, or other technological solution that may progress toward implementation.

## Technology project

The development and implementation work around a technology. It includes goals, team, milestones, resources, evidence, and planned transitions.

## Technology dossier

The canonical product object representing a technology project across public, participant, and Center contexts. A dossier combines identity, description, UGT, evidence, documents, organizations, requests, pilots, and decisions.

## Customer request

A structured description of an industrial or public-sector problem for which the customer seeks a technology, executor, pilot, or implementation path.

## Executor / industrial partner

An organization capable of developing, adapting, supplying, implementing, or producing a technology.

## Readiness assessment

An assessment of how close a technology is to a specified implementation result, based on evidence and verified criteria.

## UGT

Уровень готовности технологии. The product uses levels 1 through 9, grouped into low, medium, and high readiness. A UGT value is not a general quality score and must not be presented as one.

## Readiness dimension

One of four dimensions used in the current methodology:

- scientific;
- technical;
- organizational;
- production.

## Checkpoint

A verifiable stage gate in the technology path. A checkpoint has criteria, required evidence, an owner, and a resulting decision or next action.

## Evidence

A document, result, test, record, or other verifiable material supporting a claim or checkpoint.

## N -> N+1

The transition from the current readiness stage to the next stage. The arrow describes a controlled progression, not an automatic success.

## Verification

Review by the Center or an authorized expert of claims, evidence, documents, and readiness criteria.

## Publication

The act of making a verified record visible in a public registry. Draft or unverified data remains private or restricted.

## Pilot

A controlled trial of a technology in a relevant customer or production environment.

## NIOKTR

Научно-исследовательские и опытно-конструкторские работы. NIOKTR records are a real data source for research and technology discovery when present in the backend and permitted for display.

## Decision

A recorded Center or authorized reviewer outcome: approve, request clarification, reject, publish, archive, or move to the next stage.

## Registry

A searchable collection of records with defined visibility, publication, verification, and data-quality rules.

## Ecosystem map

A visual and searchable representation of relationships between organizations, technologies, research, requests, pilots, and support. It is not required to be geographic in every view.

## Product language rules

- Use `технология` for the object and `технологический проект` for the work around it.
- Use `организация` for the legal/institutional participant and `пользователь` for the person.
- Use `запрос заказчика`, not a vague `заявка`, when the object describes an industrial need.
- Use `подача`, `проверка`, `уточнение`, `решение`, and `публикация` as distinct workflow actions.
- Use `уровень УГТ` or `уровень готовности`, never only `оценка`, when the readiness meaning matters.
- Use `доказательства` for the supporting materials of a claim or checkpoint.
