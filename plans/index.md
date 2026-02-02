# Plans Index

Track active and completed planning efforts.

## Plan Workflow

This is for working ON agent-architect itself, not for building projects within the framework.

**Flow:**
```
feature-description.md → implementation-order.md → execute → complete
```

1. **Create plan directory:** `plans/{plan-name}/`
2. **Write `feature-description.md`** — What and why. Problem statement, proposed solution, scope boundaries.
3. **Build `implementation-order.md`** — How. Phased steps, file changes, acceptance criteria.
4. **Execute phases** — Update status in implementation-order.md as you go.
5. **Update this index** — Add to Active Plans table with current status.
6. **Complete** — Move directory to `zzz-complete/`, move row to Completed Plans table.


## Active Plans

| Name | Description | Status |
|------|-------------|--------|
| context-relocation | Move context/ into .claude/context/ so generated projects receive full copy without version drift | drafting |
| manifest-coverage | Identify gaps between discovery process and manifest schema requirements; proposes THE LOOP framework | discovery |


### Status Key

- **discovery** — Gathering requirements, interviewing stakeholders
- **drafting** — Writing initial plan document
- **review** — Plan under review, collecting feedback
- **approved** — Ready for implementation
- **in-progress** — Implementation underway
- **testing** — Implementation done, validating results
- **complete** — Finished and archived
- **abandoned** — Stopped, documented why


## Completed Plans

Located in `zzz-complete/`. Kept for reference.

| Name | Description | Completed |
|------|-------------|-----------|
| agent-output-schema | Create missing Zod output schemas for Kringle agents (persona-matcher, email-drafter, response-triager, escalation-handler) | 2026-02-02 |
| claude-refactor | Restructure CLAUDE.md, extract /discovery skill, create workspace-structure and manifest-reference docs | 2025-02-01 |
| function-capability | Enable Agent Architect to capture function implementation context during interviews and generate structured spec files | 2025-02-01 |
| integration-schema | Add typed integration schemas to manifest (resend, hookdeck, clay, firecrawl, etc.) with validation | 2026-02-02 |
| nonagentic | Generate non-agentic function scaffolds (simple, fan-in, cron, routing patterns) from manifest declarations | 2026-02-02 |
| resend-schema | Add output schema validation to agent-factory templates, create agent output schemas for Kringle | 2025-02-01 |
| schema-evolution | Add object types, inngest-first webhooks, and webhook discriminated union to manifest schema | 2026-01-31 |
