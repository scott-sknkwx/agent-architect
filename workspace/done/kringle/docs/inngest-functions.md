# Kringle Inngest Functions

## Architecture

All external webhooks flow through Hookdeck before reaching Inngest:

```
┌─────────────┐     ┌───────────┐     ┌─────────┐     ┌──────────────────┐
│ RB2B/Clay/  │────▶│ Hookdeck  │────▶│ Inngest │────▶│ Function handles │
│ Resend      │     │ transform │     │ event   │     │ event            │
└─────────────┘     └───────────┘     └─────────┘     └──────────────────┘
```

There are NO HTTP webhook handlers in this codebase. Hookdeck handles:
- HTTP reception
- HMAC verification
- Payload transformation (via `transforms/*.ts`)
- Forwarding to Inngest as typed events

## Function Inventory

### Method
For each event in the manifest, I asked:
1. What produces this event? (Hookdeck, agent, function, human action, cron)
2. What consumes this event? (agent, function, nothing)
3. Should the consumer be standalone or part of an orchestration?

---

## 1. External Event Handlers

External systems send webhooks to Hookdeck. Hookdeck transforms them and sends events to Inngest. These functions handle those external-origin events.

```
RB2B → Hookdeck → transforms/rb2b-to-lead.ts → Inngest event: webhook.received
Clay → Hookdeck → transforms/clay-enrichment.ts → Inngest event: clay/enrichment.completed
Firecrawl → Hookdeck → transforms/firecrawl-scrape.ts → Inngest event: lead.scraped
Resend → Hookdeck → transforms/resend-event.ts → Inngest event: email.*
```

| Function | Trigger Event | Emits | Notes |
|----------|---------------|-------|-------|
| `external/process-rb2b-visitor` | `webhook.received` | `lead.ingested` | Validate, dedupe, upsert lead |
| `external/process-clay-enrichment` | `clay/enrichment.completed` | (updates DB, checks if enrichment complete) | Store Clay data |
| `external/process-firecrawl-scrape` | `lead.scraped` | (updates DB, checks if enrichment complete) | Store scraped homepage context |
| `external/process-resend-event` | `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained` | varies | Route delivery events |

**Count: 4 functions**

---

## 2. Cron Functions

Scheduled functions for time-based operations.

| Function | Schedule | Emits | Notes |
|----------|----------|-------|-------|
| `cron/approval-reminder` | `0 */4 * * *` | `approval.reminder` | Check pending approvals |
| `cron/snooze-wakeup` | `0 9 * * *` | `draft.requested` | Wake snoozed leads |
| `cron/timeout-checker` | `*/30 * * * *` | `timeout.response_wait` | Check for timeouts |

**Count: 3 functions**

---

## 3. Agent Runners

Each agent gets a dedicated function that:
- Prepares workspace and context
- Runs the Claude agent
- Parses output and emits events

| Function | Trigger Event | Emits | Agent |
|----------|---------------|-------|-------|
| `agents/persona-matcher` | `lead.enriched` | `lead.match_passed` or `lead.match_failed` | persona-matcher |
| `agents/email-drafter` | `draft.requested` | `draft.completed` | email-drafter |
| `agents/response-triager` | `email.replied` | `triage.completed` + response.* | response-triager |
| `agents/escalation-handler` | `escalation.resolved` | varies by resolution | escalation-handler |

**Count: 4 functions**

---

## 4. Orchestrators (step.run patterns)

These coordinate multiple operations that are tightly coupled.

### `orchestrators/enrichment-pipeline`
**Trigger:** `lead.ingested`
**Why orchestrator:** Fan-out to Clay + Firecrawl, fan-in when both complete. Classic parallel coordination.

```
Steps:
1. step.run("request-clay") → call Clay API, emit clay/enrichment.requested
2. step.run("request-firecrawl") → call Firecrawl API, emit firecrawl/scrape.requested
3. step.waitForEvent("clay-complete", { event: "clay/enrichment.completed" })
4. step.waitForEvent("firecrawl-complete", { event: "lead.scraped" })
5. step.run("merge-enrichment") → combine data, update lead
6. Emit: lead.enriched OR enrichment.failed
```

### `orchestrators/approval-flow`
**Trigger:** `draft.completed`
**Why orchestrator:** Approval has reminder loop and timeout logic that's tightly coupled.

```
Steps:
1. step.run("create-approval") → insert approval record
2. step.run("notify-approver") → send notification
3. Loop up to 3 times:
   - step.waitForEvent("approval-decision", { event: "approval.*", timeout: "4h" })
   - If timeout: step.run("send-reminder"), emit approval.reminder
4. If still no response: emit approval.timeout
5. If approved: emit approval.approved
6. If rejected: emit approval.rejected
```

**Count: 2 functions**

---

## 5. Workflow Handlers (Single-purpose)

These handle one event and emit one or more events. Standalone for reusability.

### Matching Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/handle-match-passed` | `lead.match_passed` | `campaign.created` | Create campaign, snapshot templates |
| `workflow/handle-match-failed` | `lead.match_failed` | `lead.archived` | Archive lead, record reason |

### Campaign Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/start-campaign` | `campaign.created` | `reach_out.started`, `draft.requested` | Initialize campaign, request first draft |

### Email Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/send-email` | `approval.approved` | `email.send_requested`, `email.sent` | Call Resend API |
| `workflow/handle-rejection` | `approval.rejected` | `draft.requested` | Re-request draft with feedback |
| `workflow/process-delivery-event` | `email.delivered`, `email.opened`, `email.clicked` | (none) | Update tracking in DB |
| `workflow/handle-bounce` | `email.bounced` | `lead.terminated` | Mark lead as bounced |
| `workflow/handle-complaint` | `email.complained` | `lead.terminated` | Mark lead as complained, suppress |

### Response Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/route-triage-result` | `triage.completed` | varies | Route based on classification |
| `workflow/handle-accept-gift` | `response.accept_gift` | `eex.started`, `draft.requested` | Start EEX sequence |
| `workflow/handle-meeting-request` | `response.request_meeting` | `meeting.requested` | Trigger meeting booking flow |
| `workflow/handle-delayed` | `response.delayed` | `lead.snoozed` | Snooze lead |
| `workflow/handle-opt-out` | `response.opt_out` | `lead.terminated` | Terminate, suppress |
| `workflow/handle-not-interested` | `response.not_interested` | `lead.terminated` | Terminate |
| `workflow/handle-question` | `response.question` | `draft.requested` | Request reply draft |
| `workflow/handle-unclear` | `response.unclear` | `lead.escalated` | Escalate for human review |

### Phase Transitions

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/handle-eex-step-sent` | `eex.step_sent` | `draft.requested` or `eex.completed` | Schedule next EEX step or complete |
| `workflow/handle-eex-completed` | `eex.completed` | `post_eex.started`, `draft.requested` | Start post-EEX phase |
| `workflow/handle-timeout` | `timeout.response_wait` | varies | Handle based on phase |

### Escalation Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/create-escalation` | `lead.escalated` | (none) | Create escalation record, notify |
| `workflow/handle-approval-timeout` | `approval.timeout` | `lead.escalated` | Escalate stale approvals |

### Outcomes Domain

| Function | Trigger | Emits | Logic |
|----------|---------|-------|-------|
| `workflow/handle-meeting-booked` | `meeting.booked` | `lead.converted` | Mark as converted |
| `workflow/complete-journey` | `lead.converted`, `lead.terminated`, `lead.archived` | `lead.journey_completed` | Record analytics |

**Count: 24 functions**

---

## Summary

| Category | Count |
|----------|-------|
| External Event Handlers | 4 |
| Cron Functions | 3 |
| Agent Runners | 4 |
| Orchestrators | 2 |
| Workflow Handlers | 23 |
| **Total** | **36** |

---

## Recommended File Structure

```
src/inngest/
├── client.ts                 # Inngest client config
├── index.ts                  # Export all functions
│
├── external/                 # Events originating from external systems (via Hookdeck)
│   ├── process-rb2b-visitor.ts      # webhook.received
│   ├── process-clay-enrichment.ts   # clay/enrichment.completed
│   ├── process-firecrawl-scrape.ts  # lead.scraped
│   └── process-resend-event.ts      # email.* delivery events
│
├── cron/                     # Scheduled functions
│   ├── approval-reminder.ts
│   ├── snooze-wakeup.ts
│   └── timeout-checker.ts
│
├── agents/                   # Agent runners
│   ├── persona-matcher.ts
│   ├── email-drafter.ts
│   ├── response-triager.ts
│   └── escalation-handler.ts
│
├── orchestrators/            # Multi-step coordination (step.run patterns)
│   ├── enrichment-pipeline.ts
│   └── approval-flow.ts
│
└── workflow/                 # Single-purpose event handlers
    ├── matching/
    │   ├── handle-match-passed.ts
    │   └── handle-match-failed.ts
    ├── campaign/
    │   └── start-campaign.ts
    ├── email/
    │   ├── send-email.ts
    │   ├── handle-rejection.ts
    │   ├── handle-bounce.ts
    │   └── handle-complaint.ts
    ├── response/
    │   ├── route-triage-result.ts
    │   ├── handle-accept-gift.ts
    │   ├── handle-meeting-request.ts
    │   ├── handle-delayed.ts
    │   ├── handle-opt-out.ts
    │   ├── handle-not-interested.ts
    │   ├── handle-question.ts
    │   └── handle-unclear.ts
    ├── phase/
    │   ├── handle-eex-step-sent.ts
    │   ├── handle-eex-completed.ts
    │   └── handle-timeout.ts
    ├── escalation/
    │   ├── create-escalation.ts
    │   └── handle-approval-timeout.ts
    └── outcomes/
        ├── handle-meeting-booked.ts
        └── complete-journey.ts
```

---

## Open Questions

1. **Consolidation opportunities?** Some handlers are very thin (e.g., `handle-opt-out` just emits `lead.terminated`). Could consolidate into `handle-negative-response.ts` with a switch.

2. **Should delivery events be one function or three?** `email.delivered`, `email.opened`, `email.clicked` all just update tracking. Could be one `process-delivery-event.ts`.

3. **Response routing:** Is `route-triage-result` necessary or should each `response.*` event directly trigger its handler? Direct is more event-driven, router is more explicit.
