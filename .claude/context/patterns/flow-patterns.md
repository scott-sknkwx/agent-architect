# Flow Patterns

Reusable patterns for agent, function, and human steps in Agent Factory systems. Reference during Phase 2.5 (lifecycle visualization) to classify each step.

---

## The Universal Loop

Every step follows the same pattern regardless of executor type:

```
┌─────────────────────────────────────────────────────────────┐
│  Event Listen → Validate Input → ACTION → Validate Output → Event Emit  │
└─────────────────────────────────────────────────────────────┘
```

The only difference is WHO performs the ACTION:
- 🤖 Agent — Claude reasons and decides
- 👤 Human — Person reviews and acts
- ⚙️ Function — Deterministic TypeScript

---

## Executor Types

| Type | Symbol | Characteristics | Manifest Section |
|------|--------|-----------------|------------------|
| **Agent** | 🤖 | Judgment required, output varies by context | `agents` |
| **Function** | ⚙️ | Deterministic, same input → same output | `functions` |
| **Human** | 👤 | Approval, escalation, manual action | Events that humans trigger |

---

## Classification Heuristics

### Use 🤖 Agent When:
- Task requires **judgment** or interpretation
- Multiple valid approaches exist
- Output **quality** matters more than speed
- Need to "figure out the right answer"
- Context must be **weighed**, not just checked
- Failure modes need **reasoning** to handle

### Use ⚙️ Function When:
- Logic is **fully deterministic**
- Same input **always** produces same output
- Rules can be expressed as code (if/then/else)
- **Speed or cost** matters more than nuance
- Failure modes are **binary** (success/fail)
- No interpretation needed—just execution

### Use 👤 Human When:
- **Approval** or sign-off required
- **Escalation** from automated process
- Manual **correction** needed
- Legal/compliance **checkpoint**
- High-stakes decision beyond agent authority

### Quick Test
> If complete logic fits a flowchart with **no "it depends" nodes** → Function

---

## Common Flow Patterns

### Webhook Ingestion (⚙️ Function)

Receives external data, validates, and stores.

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function |
| **Trigger** | External webhook (via Hookdeck → Inngest) |
| **Input Validation** | Schema valid, required fields present, signature verified |
| **Steps** | Parse payload → Normalize data → Lookup org → Check for duplicate |
| **Output Validation** | Record created or duplicate identified |
| **Persist** | Insert into table OR update existing |
| **Emit** | `{entity}.received` |

```yaml
functions:
  ingest-rb2b-webhook:
    trigger:
      event: webhook/rb2b.visitor
    integrations: [hookdeck]  # NOT supabase/inngest - those are infrastructure
    emit:
      - lead.received
```

---

### Enrichment (⚙️ Function or 🤖 Agent)

Fetches additional data from external sources.

**Use ⚙️ Function when:** Simple API call, no interpretation needed
**Use 🤖 Agent when:** Must decide what to look up, interpret results

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function (simple) or 🤖 Agent (complex) |
| **Trigger** | `{entity}.received` or `{entity}.created` |
| **Input Validation** | Entity exists, not already enriched, has minimum fields |
| **Steps** | Call enrichment API → Parse response → Map to schema |
| **Output Validation** | Required fields populated |
| **Persist** | Update entity with enrichment data, set enriched_at |
| **Emit** | `{entity}.enriched` |

---

### Qualification (🤖 Agent)

Evaluates entity against criteria to determine fit.

| Field | Value |
|-------|-------|
| **Executor** | 🤖 Agent |
| **Trigger** | `{entity}.enriched` or `{entity}.received` |
| **Input Validation** | Entity exists, status = 'new' or 'enriched', has required context |
| **Steps** | Load ICP criteria → Evaluate entity → Score fit → Decide qualified/not |
| **Output Validation** | Decision made, reasoning captured |
| **Persist** | Update status, store score and reasoning |
| **Emit** | `{entity}.qualified` or `{entity}.disqualified` |

```yaml
agents:
  qualifier:
    trigger:
      event: lead.enriched
    contract:
      output_schema: schemas/qualifier-output.ts
    emit:
      - when: result.qualified
        event: lead.qualified
      - when: not result.qualified
        event: lead.disqualified
```

---

### Content Generation (🤖 Agent)

Drafts personalized content using context.

| Field | Value |
|-------|-------|
| **Executor** | 🤖 Agent |
| **Trigger** | `{entity}.qualified` |
| **Input Validation** | Entity exists, has required context (persona, enrichment) |
| **Steps** | Load context → Select template/approach → Draft content → Self-review |
| **Output Validation** | Content meets length/format requirements |
| **Persist** | Store draft, update status to 'drafted' |
| **Emit** | `{entity}.drafted` |

---

### Batch Assembly (⚙️ Function)

Groups items for human review.

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function |
| **Trigger** | Cron schedule or threshold reached |
| **Input Validation** | Items exist in 'drafted' status |
| **Steps** | Query pending items → Group by criteria → Create batch record |
| **Output Validation** | Batch created with items |
| **Persist** | Insert batch, update items to 'pending_review' |
| **Emit** | `batch.ready` |

---

### Batch Approval (👤 Human)

Human reviews and approves/rejects items.

| Field | Value |
|-------|-------|
| **Executor** | 👤 Human |
| **Trigger** | `batch.ready` (notification) → Manual dashboard action |
| **Input Validation** | Batch exists, items in 'pending_review' status |
| **Steps** | Human reviews each item → Approves/rejects/edits |
| **Output Validation** | All items have decision |
| **Persist** | Update item statuses |
| **Emit** | `batch.approved` → Fans out to individual `{entity}.approved` |

---

### Send/Execute (⚙️ Function)

Executes the approved action (send email, create CRM record, etc.).

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function |
| **Trigger** | `{entity}.approved` |
| **Input Validation** | Entity approved, not already sent |
| **Steps** | Build API request → Call external service → Handle response |
| **Output Validation** | Delivery confirmed or error captured |
| **Persist** | Update status to 'sent' or 'failed', store response |
| **Emit** | `{entity}.sent` or `{entity}.failed` |

```yaml
functions:
  send-email:
    trigger:
      event: outreach.approved
    integrations: [resend]
    emit:
      - outreach.sent
      - outreach.failed
```

---

### Response Handling (⚙️ Function or 🤖 Agent)

Processes replies or callbacks.

**Use ⚙️ Function when:** Routing based on explicit signals (unsubscribe link, specific keywords)
**Use 🤖 Agent when:** Must interpret intent (positive/negative/neutral response)

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ or 🤖 depending on complexity |
| **Trigger** | `reply.received` (webhook from email service) |
| **Input Validation** | Reply matches a sent message |
| **Steps** | Parse reply → Classify intent → Determine next action |
| **Output Validation** | Classification made |
| **Persist** | Update entity status, store reply |
| **Emit** | `{entity}.replied.positive`, `{entity}.replied.negative`, etc. |

---

### Timeout Check (⚙️ Function, Cron)

Monitors for stale items and takes action.

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function |
| **Trigger** | Cron schedule |
| **Input Validation** | N/A (queries for candidates) |
| **Steps** | Find items past threshold → Determine action → Execute |
| **Output Validation** | N/A |
| **Persist** | Update statuses, increment retry counts |
| **Emit** | `{entity}.timed_out`, `{entity}.retry`, or re-queue |

```yaml
functions:
  check-stale-leads:
    trigger:
      cron: "0 */6 * * *"  # Every 6 hours
    emit:
      - lead.timed_out
```

---

### Escalation (⚙️ Function → 👤 Human)

Routes exceptional cases to humans.

| Field | Value |
|-------|-------|
| **Executor** | ⚙️ Function (routing) → 👤 Human (handling) |
| **Trigger** | Error event or threshold breach |
| **Input Validation** | Escalation criteria met |
| **Steps** | Create escalation record → Notify human → Await resolution |
| **Output Validation** | Human provided resolution |
| **Persist** | Store escalation and resolution |
| **Emit** | `{entity}.escalation_resolved` |

---

## Flow Definition Template

Use this when documenting each step during Phase 2.5:

| Field | Description |
|-------|-------------|
| **Name** | Short identifier (e.g., "qualify-lead") |
| **Executor** | 🤖 Agent / ⚙️ Function / 👤 Human |
| **Trigger** | Event name or cron expression |
| **Input Validation** | What must be true before starting |
| **Steps** | What happens during processing |
| **Output Validation** | What must be true after |
| **Persist** | Database changes |
| **Emit** | Next event(s) |

---

## Emit Patterns

| Pattern | Description | Example |
|---------|-------------|---------|
| **Immediate** | Triggers next step now | `lead.qualified` → Starts Writer |
| **Conditional** | Different events based on outcome | `qualified` vs `disqualified` |
| **Delayed** | Triggers after time passes | `followup.scheduled` in 3 days |
| **Fan-out** | Triggers multiple parallel steps | Enrich from 3 sources |
| **Fan-in** | Waits for multiple steps | Combine when all enrichments done |
| **Human gate** | Pauses until human action | `approval.requested` → dashboard |

---

## Anti-Patterns

| Anti-Pattern | Problem | Instead |
|--------------|---------|---------|
| Everything is an agent | Expensive, slow for simple tasks | Use functions for deterministic logic |
| No validation | Silent failures, bad data | Always validate input and output |
| Direct calls between steps | Tight coupling, no retry | Event-driven with Inngest |
| Missing persist | State lost on failure | Persist before emit |
| Monolithic agents | Hard to test, debug, iterate | Single responsibility per agent |
