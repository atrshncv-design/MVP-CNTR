# Statuses and interface states

## 1. Universal status vocabulary

Use one canonical status system across technologies, requests, documents, organizations, reviews, and pilots. A domain object may expose a domain-specific label, but its underlying semantic state must map to this vocabulary.

| Canonical status | Russian label | Meaning | Typical next action |
| --- | --- | --- | --- |
| `draft` | Черновик | started but not submitted | continue editing |
| `action_required` | Нужно действие | participant or staff must act | open task |
| `under_review` | На проверке | submitted and being reviewed | wait or inspect request |
| `clarification` | Нужны уточнения | reviewer requested missing or unclear information | provide evidence |
| `approval` | На согласовании | decision is being finalized | wait for decision |
| `approved` | Одобрено | approved for the relevant workflow stage | continue or publish |
| `rejected` | Отклонено | rejected with a reason | read reason and revise |
| `published` | Опубликовано | visible in the allowed public registry | open public record |
| `active` | В работе | active project/request/pilot | complete next task |
| `blocked` | Заблокировано | cannot progress because of a dependency | resolve blocker |
| `archived` | Архив | no longer active or public by default | view archive |
| `closed` | Завершено | workflow completed | inspect result |

Do not introduce synonyms such as `В работе`, `Активно`, `Процесс`, and `На этапе` as interchangeable status labels. Choose the canonical meaning and use supporting text for nuance.

## 2. UGT state

UGT has two separate concepts:

1. **Current UGT level** - the latest verified level.
2. **Transition progress** - whether the project is preparing, reviewing, or approved for N -> N+1.

Never show an unverified draft level as if it were a final verified UGT.

Required UGT display:

- number;
- level name;
- band: low, medium, high;
- verification date when available;
- evidence summary;
- next checkpoint;
- textual explanation.

## 3. Standard screen states

Every data-dependent screen must define these states.

### Initial loading

Show structure-preserving skeletons. Use text such as `Загружаем данные` where helpful. Do not display a fake count during loading.

### Empty

Explain why the list is empty and offer the next meaningful action.

Examples:

- public registry: `Пока нет опубликованных технологий по этому фильтру`;
- customer workspace: `У вашей организации пока нет запросов`;
- employee queue: `Очередь пуста` plus date/time of last refresh when available;
- NIOKTR: `По заданным условиям записи не найдены`.

### Partial data

Show the available data and identify missing fields. Do not fill gaps with plausible text.

### Error

Explain what failed, preserve the user's inputs, offer retry, and provide a fallback route when possible.

### Permission

Explain that the record exists or the section is restricted when that fact is known. Provide a route to request access or contact the Center when supported.

### Success

Confirm the actual operation and show the next action. Example: `Черновик сохранён` with `Открыть проект` and `Продолжить позже`.

### Stale data

When data may be outdated, show the last update timestamp and avoid implying real-time accuracy.

## 4. Decision states

All decisions require:

- actor or role, where visible;
- date and time;
- decision label;
- reason or summary;
- linked evidence or comment where applicable;
- next action;
- visibility scope.

Reject and clarification actions must require a reason. Approval and publication must show a confirmation step.

## 5. Comment and notification states

Comments are contextual, not a full chat in P0. A comment belongs to a technology, request, document, checkpoint, or decision.

Notifications include:

- object;
- event;
- urgency;
- required action;
- deadline when available;
- read/unread state;
- direct destination.

## 6. Upload states

- waiting to choose;
- selected;
- uploading;
- uploaded and scanning;
- accepted;
- rejected by format or security check;
- failed with retry;
- removed from draft;
- submitted and locked.

Never report a document as accepted before backend or mock validation has completed.

