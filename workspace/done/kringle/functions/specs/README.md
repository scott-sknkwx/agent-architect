# Kringle Function Specs

This directory contains implementation specifications for all non-agentic Inngest functions in Kringle.

> **See also:** [Lead Lifecycle Architecture](../../docs/lead-lifecycle-architecture.md) for the visual flow diagram.

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Specs | 36 |
| Trivial | 14 |
| Simple | 20 |
| Complex | 2 |

---

## Specs by Phase

### Processing

Functions that run before human approval.

#### Ingest
| Function | Pattern | Complexity |
|----------|---------|------------|
| [ingest-rb2b-webhook](ingest-rb2b-webhook.spec.md) | inngest-first-webhook | Trivial |

#### Enrich
| Function | Pattern | Complexity |
|----------|---------|------------|
| [start-enrichment](start-enrichment.spec.md) | simple | Trivial |
| [request-clay](request-clay.spec.md) | simple | Simple |
| [ingest-clay-webhook](ingest-clay-webhook.spec.md) | inngest-first-webhook | Trivial |
| [request-firecrawl](request-firecrawl.spec.md) | simple | Simple |
| [consolidate-enrichment](consolidate-enrichment.spec.md) | fan-in | Complex |

#### Qualify
| Function | Pattern | Complexity |
|----------|---------|------------|
| [start-matching](start-matching.spec.md) | simple | Trivial |

#### Campaign Setup
| Function | Pattern | Complexity |
|----------|---------|------------|
| [create-campaign](create-campaign.spec.md) | simple | Simple |
| [request-wrapper-drafts](request-wrapper-drafts.spec.md) | simple | Trivial |
| [personalize-eex](personalize-eex.spec.md) | simple | Simple |
| [mark-ready-for-review](mark-ready-for-review.spec.md) | simple | Trivial |

#### Approval
| Function | Pattern | Complexity |
|----------|---------|------------|
| [approve-campaign-items](approve-campaign-items.spec.md) | simple | Simple |
| [handle-revision-request](handle-revision-request.spec.md) | simple | Trivial |
| [handle-persona-change](handle-persona-change.spec.md) | simple | Simple |
| [handle-rejection](handle-rejection.spec.md) | simple | Trivial |

---

### In Flight

Functions that run autonomously after approval.

#### Reach Out
| Function | Pattern | Complexity |
|----------|---------|------------|
| [send-reach-out-initial](send-reach-out-initial.spec.md) | simple | Simple |
| [send-reach-out-followup](send-reach-out-followup.spec.md) | simple | Simple |

#### EEX
| Function | Pattern | Complexity |
|----------|---------|------------|
| [send-eex-step](send-eex-step.spec.md) | simple | Simple |
| [handle-accept-gift](handle-accept-gift.spec.md) | simple | Trivial |

#### Post-EEX
| Function | Pattern | Complexity |
|----------|---------|------------|
| [send-post-eex](send-post-eex.spec.md) | simple | Simple |

#### Response Handling
| Function | Pattern | Complexity |
|----------|---------|------------|
| [ingest-resend-webhook](ingest-resend-webhook.spec.md) | inngest-first-webhook | Trivial |
| [ingest-resend-inbound-webhook](ingest-resend-inbound-webhook.spec.md) | inngest-first-webhook | Simple |
| [route-resend-event](route-resend-event.spec.md) | routing | Simple |
| [handle-meeting-request](handle-meeting-request.spec.md) | simple | Trivial |
| [handle-snooze](handle-snooze.spec.md) | simple | Simple |
| [handle-unclear](handle-unclear.spec.md) | simple | Simple |

#### Suppression
| Function | Pattern | Complexity |
|----------|---------|------------|
| [handle-opt-out](handle-opt-out.spec.md) | simple | Simple |
| [handle-bounce](handle-bounce.spec.md) | simple | Simple |
| [handle-complaint](handle-complaint.spec.md) | simple | Simple |
| [handle-not-interested](handle-not-interested.spec.md) | simple | Trivial |

---

### Completed

Functions that handle terminal states.

#### Terminal
| Function | Pattern | Complexity |
|----------|---------|------------|
| [handle-cancel](handle-cancel.spec.md) | simple | Trivial |
| [archive-lead](archive-lead.spec.md) | simple | Trivial |
| [convert-lead](convert-lead.spec.md) | simple | Trivial |
| [aggregate-journey](aggregate-journey.spec.md) | simple | Simple |

---

### Cross-cutting

Functions that operate across phases.

#### Scheduling
| Function | Pattern | Complexity |
|----------|---------|------------|
| [check-response-timeouts](check-response-timeouts.spec.md) | cron | Simple |
| [process-snoozed-leads](process-snoozed-leads.spec.md) | cron | Simple |

---

## Spec Format

Each spec follows the template in `plans/function-capability/spec-format.md`:

```markdown
# Function: {name}

| Property | Value |
|----------|-------|
| Complexity | Trivial / Simple / Complex |
| Pattern | simple / cron / fan-in / routing / inngest-first-webhook |
| Phase | {lifecycle phase} |
| Status | Spec Complete / BLOCKED: Has Open Questions |

## Purpose
## Trigger
## Input
## Output
## Implementation Steps
## Database Operations (if applicable)
## Error Handling
## Test Cases
## Related Functions
```

## Complexity Guide

| Tier | Criteria | Sections Required |
|------|----------|-------------------|
| **Trivial** | 1-2 steps, no DB writes, no conditionals | Purpose, Trigger, Input, Output, Steps |
| **Simple** | 3-5 steps, may have DB ops, linear flow | + DB Operations, Error Handling, Test Cases |
| **Complex** | Fan-in/routing, multiple integrations, conditionals | + Edge Cases, Configuration, Open Questions |

## Agents (Not in Specs)

These components are agents with CLAUDE.md files, not non-agentic functions:

| Agent | Location | Purpose |
|-------|----------|---------|
| persona-matcher | `agents/persona-matcher/` | Score leads against personas |
| email-drafter | `agents/email-drafter/` | Draft wrapper emails |
| response-triager | `agents/response-triager/` | Classify response intent |
| escalation-handler | `agents/escalation-handler/` | Interpret human guidance |
