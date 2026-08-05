# Issue tracker: Local Markdown

Issues and specs live as Markdown files under `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Tickets are numbered from `01` in dependency order
- Each ticket records triage state in a `Status:` line
- Comments and conversation history append under `## Comments`

## Publishing

When a skill says to publish a spec or ticket, create the corresponding file under `.scratch/<feature-slug>/`.

## Fetching

When a skill says to fetch a ticket, read the referenced file in `.scratch/<feature-slug>/issues/`.
