# Function: ingest-rb2b-webhook

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | inngest-first-webhook |
| Phase | Processing → Ingest |
| Status | Spec Complete |

## Purpose

Validate incoming RB2B visitor identification webhook and emit lead.ingested event for downstream processing.

## Trigger

**Type:** Event
**Event:** `webhook/rb2b.received`
**Source:** Hookdeck transformation of RB2B webhook

## Input

**Event Payload:** Raw RB2B webhook (see `schemas/rb2b-webhook.ts`)

```typescript
{
  raw: RB2BWebhookPayload;  // Unvalidated payload from Hookdeck
  trace_id?: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `kringle/lead.ingested` | Valid payload, org found, not suppressed | `{ lead_id, organization_id, visitor_data, trace_id }` |

### Return Value

```typescript
{ success: boolean; lead_id?: string; skipped_reason?: string; }
```

## Implementation Steps

### Step 1: validate
**Primitive:** `step.run()`

Parse and validate payload against `Rb2bWebhookSchema`. Throw `NonRetriableError` if invalid.

### Step 2: lookup-org
**Primitive:** `step.run()`

Extract domain from "Captured URL", match against `organizations.domain`. Throw `NonRetriableError` if unknown org.

### Step 3: check-suppression
**Primitive:** `step.run()`

Check BOTH org-level AND global suppression lists. Return early if suppressed.

### Step 4: upsert-lead
**Primitive:** `step.run()`

Insert or update lead record with visitor data.

### Step 5: emit-lead-ingested
**Primitive:** `step.sendEvent()`

Emit `kringle/lead.ingested` with validated payload + trace_id.

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Invalid payload | `NonRetriableError` | Don't retry; log and discard |
| Unknown org | `NonRetriableError` | Don't retry; log and discard |
| Suppressed lead | Expected | Return early with `skipped_reason` |
| DB error | Transient | Retry (default) |

## Test Cases

### Test 1: Valid RB2B Payload

**Setup:** Send valid RB2B webhook payload with known org domain
**Expected Events:** `[{ name: "kringle/lead.ingested", data: { ... } }]`

### Test 2: Invalid Payload

**Setup:** Send malformed JSON
**Expected:** `NonRetriableError` thrown, no events emitted

### Test 3: Unknown Org

**Setup:** Send valid payload but domain doesn't match any org
**Expected:** `NonRetriableError`, no events emitted

### Test 4: Suppressed Lead

**Setup:** Send valid payload but email is in suppression list
**Expected:** Return `{ success: true, skipped_reason: "suppressed" }`, no events emitted
