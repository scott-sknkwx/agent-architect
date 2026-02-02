# Function Spec Format

This document defines the `{function-name}.spec.md` format that Agent Architect generates during the interview phase.

## Design Principles

1. **Comprehensive over minimal** — Give the implementer MORE context than they might need; they can skip sections, but they can't invent missing information
2. **Structured for scanning** — Consistent headings so implementers can jump to what they need
3. **Examples are test cases** — Every example should be implementable as a test
4. **Capture uncertainty explicitly** — Open questions block implementation until resolved
5. **Single source of truth** — No duplicated information that can drift

---

## Pattern Definitions

Every function has a pattern that determines which Inngest primitives it uses.

| Pattern | Description | Primary Primitives | When to Use |
|---------|-------------|-------------------|-------------|
| **simple** | Single event trigger, sequential steps, emit events | `step.run()`, `step.sendEvent()` | Most event handlers |
| **cron** | Time-based trigger, query and process | `step.run()`, `step.sendEvent()` in loop | Scheduled jobs, cleanup, polling |
| **fan-in** | Wait for multiple events before proceeding | `step.waitForEvent()`, correlation matching | Aggregation, multi-step workflows |
| **routing** | Conditional event emission based on payload | `step.run()` with switch/if, `step.sendEvent()` | Classification, branching flows |
| **inngest-first-webhook** | External webhook → validate → process → emit | `step.run()` per step, `NonRetriableError` for validation | All external integrations |

### Pattern → Inngest Primitive Mapping

```typescript
// SIMPLE: Sequential steps, emit at end
async ({ event, step }) => {
  const data = await step.run("fetch-data", async () => { ... });
  const result = await step.run("process", async () => { ... });
  await step.sendEvent("emit-result", { name: "...", data: result });
}

// CRON: Query, loop with step.sendEvent per item
async ({ step }) => {
  const items = await step.run("query-items", async () => { ... });
  for (const item of items) {
    await step.sendEvent(`emit-${item.id}`, { name: "...", data: item });
  }
}

// FAN-IN: Wait for correlated events
async ({ event, step }) => {
  const enrichment = await step.waitForEvent("wait-enrichment", {
    event: "enrichment/completed",
    timeout: "30m",
    if: `async.data.lead_id == '${event.data.lead_id}'`
  });
  if (!enrichment) throw new Error("Timeout");
  // proceed with merged data
}

// ROUTING: Conditional emit
async ({ event, step }) => {
  const type = event.data.classification;
  const routes = { accept: "response.accepted", reject: "response.rejected" };
  await step.sendEvent("route", { name: routes[type] ?? "response.unknown", data: event.data });
}

// INNGEST-FIRST-WEBHOOK: Validate early, fail fast
async ({ event, step }) => {
  const payload = await step.run("validate", async () => {
    const result = schema.safeParse(event.data.raw);
    if (!result.success) throw new NonRetriableError("Invalid payload");
    return result.data;
  });
  // subsequent steps...
}
```

---

## Project Conventions

Every spec assumes these conventions from the generated project. Link to this section rather than repeating.

### Imports

```typescript
import { inngest } from "../client";                    // Inngest client
import { db } from "../../lib/database";                // Supabase client (service role)
import { logger } from "../../lib/logger";              // Structured logger
import { NonRetriableError, RetryAfterError } from "inngest";  // Error types
```

### trace_id Convention

Every event payload should include a `trace_id` for end-to-end observability.

```typescript
// If event has trace_id, use it; otherwise generate one
const traceId = event.data.trace_id ?? crypto.randomUUID();

// Pass trace_id to all emitted events
await step.sendEvent("emit", {
  name: "kringle/lead.processed",
  data: { ...payload, trace_id: traceId }
});

// Include trace_id in all log calls
logger.info("function.step.completed", { traceId, step: "validate" });
```

### Configuration Location

All configuration lives in `config/` with typed exports:

```typescript
// config/timeouts.ts
export const TIMEOUTS = {
  RESPONSE_WAIT_HOURS: 48,
  ENRICHMENT_TIMEOUT_MINUTES: 30,
} as const;

// Usage in function:
import { TIMEOUTS } from "../../config/timeouts";
const cutoff = new Date(Date.now() - TIMEOUTS.RESPONSE_WAIT_HOURS * 60 * 60 * 1000);
```

Environment variables are only for secrets and infrastructure (API keys, URLs). Business logic values go in config files.

### Idempotency

All functions must be idempotent — running the same event twice should produce the same result.

**Strategies:**
- Use `step.run()` — Inngest memoizes step results automatically
- For database writes, use upsert with unique constraints
- For external API calls, check if action was already taken before calling
- Store idempotency keys in `agent_idempotency` table for cross-function deduplication

```typescript
// Example: Check before sending email
const alreadySent = await step.run("check-sent", async () => {
  const { data } = await db.from("emails").select("id").eq("idempotency_key", key).single();
  return !!data;
});
if (alreadySent) return { skipped: true };
```

**Note:** The `agent_idempotency` table is an infrastructure table generated by Agent Factory. It has RLS enabled with no policies (service role only). Schema:

```sql
CREATE TABLE agent_idempotency (
  id UUID PRIMARY KEY,
  agent VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(500) NOT NULL,
  result JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent, idempotency_key)
);
```

### Test Location

All function tests live in `__tests__/functions/`:

```
__tests__/
└── functions/
    ├── check-response-timeouts.test.ts
    ├── ingest-rb2b-webhook.test.ts
    └── helpers.ts  ← Shared test utilities
```

### Test Helpers

Standard test helpers in `__tests__/functions/helpers.ts`:

```typescript
// Time helpers
export const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

// Database helpers
export const cleanTable = async (table: string) =>
  await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");

// Event capture helper (for asserting emitted events)
export const captureEvents = () => {
  const events: any[] = [];
  // Mock step.sendEvent to capture calls
  return { events, mock: (name: string, data: any) => events.push({ name, data }) };
};
```

### Config File Bootstrapping

**Who creates config files?**

1. **Agent Factory** generates `config/` directory with stub files based on manifest
2. **Spec** references specific values (e.g., `TIMEOUTS.RESPONSE_WAIT_HOURS = 48`)
3. **Implementer** fills in stubs OR Agent Factory pre-populates from manifest

**Workflow:**

```
Manifest (manifest.yaml)
├── functions:
│   - name: check-response-timeouts
│     config_values:           ← Interview captures these
│       timeout_hours: 48
│       batch_limit: 100
        ↓
Agent Factory generates:
├── config/
│   ├── timeouts.ts           ← Stub or pre-populated
│   ├── limits.ts
│   └── schedules.ts
        ↓
Spec references:
├── | `RESPONSE_WAIT_HOURS` | `config/timeouts.ts` | `48` |
```

**If Agent Factory doesn't pre-populate**, config stubs look like:

```typescript
// config/timeouts.ts
// TODO: Set values from spec or manifest
export const TIMEOUTS = {
  RESPONSE_WAIT_HOURS: 48,  // From spec: check-response-timeouts.spec.md
} as const;
```

---

## Spec Sections

### Required Sections (All Complexities)

| Section | Purpose |
|---------|---------|
| **Header** | Function name, complexity tier, pattern type |
| **Purpose** | Why this function exists (1-2 sentences) |
| **Trigger** | What causes this function to run |
| **Input** | Data the function receives |
| **Output** | Events emitted or data returned |
| **Implementation Steps** | Ordered steps with Inngest primitive type (brief for Trivial) |
| **Error Handling** | What's retryable, what's not (brief for Trivial) |
| **Test Cases** | Executable scenarios (1-2 for Trivial, more for Complex) |

### Standard Sections (Simple+)

| Section | Purpose |
|---------|---------|
| **Database Operations** | Schema reference only (no query duplication) |
| **Configuration** | Values from config files, with file paths |

### Extended Sections (Complex)

| Section | Purpose |
|---------|---------|
| **Integration Calls** | External APIs, request/response shapes |
| **Idempotency** | How this function ensures safe re-runs |
| **Edge Cases** | What-ifs discovered during interview |
| **Test Cases** | Concrete scenarios that double as tests |
| **Related Functions** | Upstream/downstream in the event flow |
| **Open Questions** | Unresolved decisions — BLOCKS implementation |

---

## Section Specifications

### Header

```markdown
# Function: {function-name}

| Property | Value |
|----------|-------|
| Complexity | Trivial / Simple / Complex |
| Pattern | simple / fan-in / cron / routing / inngest-first-webhook |
| Phase | {lifecycle phase} |
| Status | Spec Complete / **BLOCKED: Has Open Questions** |
```

**Property definitions:**

| Property | Values | Source |
|----------|--------|--------|
| Complexity | `Trivial`, `Simple`, `Complex` | Classification criteria |
| Pattern | `simple`, `fan-in`, `cron`, `routing`, `inngest-first-webhook` | Manifest pattern field |
| Phase | Product-specific (e.g., `Processing → Enrich`) | Lifecycle diagram from Phase 2.5 |
| Status | `Spec Complete`, `BLOCKED: Has Open Questions` | Interview completeness |

**Phase values:**
- Phases are **product-specific** — they come from the lifecycle visualization created during Phase 2.5
- Use the format: `{Major Phase} → {Sub-phase}` (e.g., `Processing → Enrich`, `In Flight → Response Handling`)
- For cross-cutting functions (crons, utilities), use: `Cross-cutting → {category}`
- Reference the product's `docs/lead-lifecycle-architecture.md` (or equivalent) for phase names

### Purpose

One to two sentences explaining WHY this function exists.

```markdown
## Purpose

Detect leads that have been waiting for a response beyond the configured timeout threshold, advancing them to the next outreach step automatically.
```

### Trigger

```markdown
## Trigger

**Type:** Cron
**Schedule:** `*/30 * * * *` (every 30 minutes)
**Config:** `config/schedules.ts → CRON_SCHEDULES.TIMEOUT_CHECK`
```

Or for events:

```markdown
## Trigger

**Type:** Event
**Event:** `kringle/lead.enriched`
**Source:** Emitted by `consolidate-enrichment` after Clay + Firecrawl data merged
```

### Input

```markdown
## Input

**Event Payload:** (see `schemas/events.ts → LeadEnrichedEvent`)

```typescript
{
  lead_id: string;
  organization_id: string;
  enrichment_data: EnrichmentData;  // See schemas/enrichment.ts
  trace_id: string;
}
```
```

For cron (no event payload):

```markdown
## Input

**Cron — No Event Payload**

Function queries database. See [Database Operations](#database-operations) for query details.
```

### Output

```markdown
## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `kringle/timeout.response_wait` | For each timed-out item | `{ lead_id, campaign_id, campaign_item_id, trace_id }` |

### Return Value

```typescript
{ checked: number; emitted: number; }
```
```

### Implementation Steps

Each step specifies the Inngest primitive and what it does. **This is the authoritative source for logic.**

```markdown
## Implementation Steps

### Step 1: query-timed-out-items
**Primitive:** `step.run()`

Query `campaign_items` for items past timeout threshold. See [Database Operations](#database-operations) for table schema.

```typescript
const cutoff = new Date(Date.now() - TIMEOUTS.RESPONSE_WAIT_HOURS * 60 * 60 * 1000);
const { data, error } = await db
  .from("campaign_items")
  .select("id, lead_id, campaign_id, sent_at")
  .eq("status", "sent")
  .lt("sent_at", cutoff.toISOString())
  .limit(CONFIG.BATCH_LIMIT);
```

**Returns:** `CampaignItem[]` (may be empty)

### Step 2: emit-timeout-events
**Primitive:** `step.sendEvent()` in loop

For each item, emit timeout event with unique step ID.

```typescript
for (const item of items) {
  await step.sendEvent(`emit-timeout-${item.id}`, {
    name: "kringle/timeout.response_wait",
    data: {
      lead_id: item.lead_id,
      campaign_id: item.campaign_id,
      campaign_item_id: item.id,
      trace_id: traceId,
    },
  });
}
```

### Step 3: (implicit) return
**Primitive:** Function return

```typescript
return { checked: items.length, emitted: items.length };
```
```

### Database Operations

**Schema reference only.** Don't duplicate query logic — that lives in Implementation Steps.

```markdown
## Database Operations

### Read: `campaign_items`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `lead_id` | UUID | FK to `leads` |
| `campaign_id` | UUID | FK to `campaigns` |
| `status` | `'pending' \| 'sent' \| 'delivered' \| 'replied'` | Current state |
| `sent_at` | `timestamp` | When email was sent (null if pending) |

**Indexes used:** `idx_campaign_items_status_sent_at`

### Write: None

This function is read-only. State changes happen in downstream handlers.
```

### Error Handling

```markdown
## Error Handling

| Error | Type | Behavior | Notes |
|-------|------|----------|-------|
| Database query failure | Transient | Retry (default) | Supabase connection issues |
| Empty result set | Expected | Return `{ checked: 0, emitted: 0 }` | Normal during low activity |
| Event emit failure | Transient | Retry the specific step | Each emit is independent |
```

### Configuration

```markdown
## Configuration

| Name | File | Value | Description |
|------|------|-------|-------------|
| `RESPONSE_WAIT_HOURS` | `config/timeouts.ts` | `48` | Hours before timeout |
| `BATCH_LIMIT` | `config/limits.ts` | `100` | Max items per cron run |
| `CRON_SCHEDULE` | `config/schedules.ts` | `*/30 * * * *` | Run frequency |
```

### Integration Calls

```markdown
## Integration Calls

### Clay Enrichment API

**Client:** `lib/integrations/clay.ts`
**Method:** `clay.enrich(params)`

**Request:**
```typescript
{ email: string; linkedin_url?: string; company_domain?: string; }
```

**Response:**
```typescript
{ person: { full_name: string; title: string; company: CompanyData; }; enrichment_id: string; }
```

**Errors:**
| Status | Error Type | Behavior |
|--------|------------|----------|
| 429 | `RetryAfterError` | Retry after header value |
| 404 | `NonRetriableError` | Person not found |
| 5xx | Transient | Retry (default) |
```

### Idempotency

```markdown
## Idempotency

**Strategy:** Inngest step memoization

Each `step.run()` result is memoized. If the function restarts:
- Step 1 (query) will re-execute (queries should be stable)
- Step 2 (emit loop) will skip already-completed emits

**Note:** This function is naturally idempotent because:
- Emitting the same event twice is harmless (downstream handler is idempotent)
- No database writes in this function
```

### Edge Cases

```markdown
## Edge Cases

### Lead Has Multiple Pending Campaign Items

**Scenario:** Lead has 3 emails sent, all past threshold.
**Expected:** Emit 3 separate events, one per campaign item.
**Rationale:** Each campaign item tracks independently.

### Campaign Cancelled Mid-Flight

**Scenario:** Campaign cancelled after emails sent but before timeout check.
**Expected:** Still emit timeout event.
**Rationale:** This function doesn't check campaign state; downstream handler filters.
```

### Test Cases

**These are executable specifications.** Each test case should become an actual test.

```markdown
## Test Cases

### Test 1: Normal Timeout Detection

**Setup:**
```typescript
// Insert test data
await db.from("campaign_items").insert([
  { id: "ci_123", lead_id: "lead_abc", campaign_id: "camp_1", status: "sent", sent_at: hoursAgo(50) },
  { id: "ci_456", lead_id: "lead_def", campaign_id: "camp_1", status: "sent", sent_at: hoursAgo(20) },
  { id: "ci_789", lead_id: "lead_ghi", campaign_id: "camp_1", status: "replied", sent_at: hoursAgo(60) },
]);
```

**Expected Events:**
```typescript
[{ name: "kringle/timeout.response_wait", data: { lead_id: "lead_abc", campaign_item_id: "ci_123" } }]
```

**Expected Return:**
```typescript
{ checked: 1, emitted: 1 }
```

### Test 2: No Timeouts

**Setup:**
```typescript
await db.from("campaign_items").insert([
  { id: "ci_123", status: "sent", sent_at: hoursAgo(20) },  // Not yet timed out
  { id: "ci_456", status: "replied", sent_at: hoursAgo(60) },  // Already replied
]);
```

**Expected Events:** `[]`

**Expected Return:**
```typescript
{ checked: 0, emitted: 0 }
```

### Test 3: Batch Limit Respected

**Setup:** Insert 150 items past threshold.

**Expected:** Only 100 processed (BATCH_LIMIT).

**Expected Return:**
```typescript
{ checked: 100, emitted: 100 }
```
```

### Related Functions

```markdown
## Related Functions

### Upstream (What triggers this or creates data it reads)

| Function | Event/Action | Relationship |
|----------|--------------|--------------|
| `send-campaign-email` | Creates `campaign_items` with `status='sent'` | Source of data |

### Downstream (What this function triggers)

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `timeout.response_wait` | `handle-timeout` | Advances lead or terminates |
```

### Open Questions

**IMPORTANT: If this section has items, the spec status is `BLOCKED: Has Open Questions`.**

Implementers should NOT proceed until questions are resolved. Escalate to product/design.

```markdown
## Open Questions

> ⚠️ **This spec is BLOCKED until these questions are resolved.**

1. **Track timeout count?**
   Should we count how many times a lead times out and eventually give up?
   - **Option A:** No tracking, let downstream decide
   - **Option B:** Add `timeout_count` to campaign_items, emit `lead.exhausted` after N timeouts

2. **Exclude weekends?**
   Should the 48-hour threshold pause over weekends?
   - **Option A:** No, simple UTC calculation
   - **Option B:** Yes, use business hours library
```

---

## Complete Template

```markdown
# Function: {function-name}

| Property | Value |
|----------|-------|
| Complexity | Trivial / Simple / Complex |
| Pattern | simple / fan-in / cron / routing / inngest-first-webhook |
| Phase | {lifecycle phase from Phase 2.5 diagram} |
| Status | Spec Complete / BLOCKED: Has Open Questions |

## Purpose

{1-2 sentences: why this function exists}

## Trigger

**Type:** Event / Cron
**Event/Schedule:** {event name or cron expression}
**Config:** {config file path if cron}

## Input

{Event payload type reference or "Cron — queries database"}

## Output

### Events Emitted

| Event | When | Payload |

### Return Value

{TypeScript type}

## Implementation Steps

### Step 1: {step-name}
**Primitive:** step.run() / step.sendEvent() / step.waitForEvent()

{Description and code example}

## Database Operations

### Read: `{table}`

| Field | Type | Notes |

### Write: `{table}` (or "None")

## Error Handling

| Error | Type | Behavior | Notes |

## Configuration

| Name | File | Value | Description |

## Integration Calls

### {Integration}

**Client:** {file path}
**Errors:** {table}

## Idempotency

{Strategy and rationale}

## Edge Cases

### {Scenario}

**Scenario:** {description}
**Expected:** {behavior}

## Test Cases

### Test 1: {scenario}

**Setup:** {code}
**Expected Events:** {array}
**Expected Return:** {value}

## Related Functions

### Upstream
| Function | Event/Action | Relationship |

### Downstream
| Event Emitted | Handler | What Happens |

## Open Questions

> ⚠️ **BLOCKED** if any questions exist.

1. {Question with options}
```

---

## Spec Index (README.md)

When generating specs for a project, also create a `specs/README.md` that:

1. **Groups specs by lifecycle phase** from the Phase 2.5 diagram
2. **Lists each function** with its pattern and complexity
3. **Links to each spec file** for navigation
4. **Notes which components are agents** (not specs)

**Structure:**

```markdown
# {Product} Function Specs

## Quick Stats
| Metric | Count |
|--------|-------|
| Total Specs | {n} |
| Trivial | {n} |
| Simple | {n} |
| Complex | {n} |

## Specs by Phase

### {Major Phase 1}

#### {Sub-phase A}
| Function | Pattern | Complexity |
|----------|---------|------------|
| [function-name](function-name.spec.md) | simple | Trivial |

### {Major Phase 2}
...

## Agents (Not in Specs)

| Agent | Location | Purpose |
|-------|----------|---------|
| agent-name | `agents/agent-name/` | Brief description |
```

This README serves as:
- **Navigation** for implementers browsing specs
- **Architecture documentation** showing the lifecycle phases
- **Completeness check** ensuring all functions are accounted for

---

## Complexity-Based Section Requirements

| Section | Trivial | Simple | Complex |
|---------|:-------:|:------:|:-------:|
| Header | ✅ | ✅ | ✅ |
| Purpose | ✅ | ✅ | ✅ |
| Trigger | ✅ | ✅ | ✅ |
| Input | ✅ | ✅ | ✅ |
| Output | ✅ | ✅ | ✅ |
| Implementation Steps | ✅ (brief) | ✅ | ✅ |
| Database Operations | ⚪ | ✅ | ✅ |
| Error Handling | ✅ (brief) | ✅ | ✅ |
| Configuration | ⚪ | ⚪ | ✅ |
| Integration Calls | ⚪ | ⚪ | ✅ |
| Idempotency | ⚪ | ⚪ | ✅ |
| Edge Cases | — | ⚪ | ✅ |
| Test Cases | ✅ (1-2) | ✅ | ✅ |
| Related Functions | — | ⚪ | ✅ |
| Open Questions | ⚪ | ⚪ | ⚪ |

✅ = Required | ✅ (brief) = Required but shorter | ⚪ = If applicable | — = Not needed

### Trivial Function Example

Even trivial functions get Implementation Steps, just shorter:

```markdown
# Function: ingest-rb2b-webhook

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | inngest-first-webhook |
| Phase | Processing → Ingest |
| Status | Spec Complete |

## Purpose

Validate incoming RB2B visitor identification webhook and emit lead.ingested event.

## Trigger

**Type:** Event
**Event:** `webhook/rb2b.received`
**Source:** Hookdeck transformation of RB2B webhook

## Input

**Event Payload:** Raw RB2B webhook (see `schemas/rb2b-webhook.ts`)

## Output

| Event | When | Payload |
|-------|------|---------|
| `kringle/lead.ingested` | Valid payload | `{ lead_id, org_id, visitor_data, trace_id }` |

## Implementation Steps

### Step 1: validate
**Primitive:** `step.run()`

Parse and validate payload against `Rb2bWebhookSchema`. Throw `NonRetriableError` if invalid.

### Step 2: emit-lead-ingested
**Primitive:** `step.sendEvent()`

Emit `kringle/lead.ingested` with validated payload + trace_id.

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Invalid payload | `NonRetriableError` | Don't retry; log and discard |

## Test Cases

### Test 1: Valid RB2B Payload

**Setup:** Send valid RB2B webhook payload
**Expected Events:** `[{ name: "kringle/lead.ingested", data: { ... } }]`

### Test 2: Invalid Payload

**Setup:** Send malformed JSON
**Expected:** `NonRetriableError` thrown, no events emitted
```
