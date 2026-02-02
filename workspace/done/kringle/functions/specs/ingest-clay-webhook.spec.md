# Function: ingest-clay-webhook

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | inngest-first-webhook |
| Phase | Processing → Enrich |
| Status | Spec Complete |

## Purpose

Validate incoming Clay enrichment callback, extract lead_id from metadata, and emit `clay/enrichment.completed` for downstream processing.

## Trigger

**Type:** Event
**Event:** `webhook/clay.received`
**Source:** Hookdeck transformation of Clay callback webhook

## Input

**Event Payload:**
```typescript
{
  raw: ClayCallbackPayload;  // Original Clay response
  headers: Record<string, string>;
  received_at: string;
}
```

**Clay Callback Structure:**
```typescript
{
  row_id: string;           // Our lead_id passed in the request
  status: 'success' | 'error';
  data: {
    // Enriched person data from Clay
    full_name?: string;
    company_name?: string;
    company_domain?: string;
    linkedin_url?: string;
    // ... additional enrichment fields
  };
  error?: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `clay/enrichment.completed` | Valid payload with data | `{ lead_id, organization_id, enrichment_data, trace_id }` |

### Return Value

```typescript
{ success: boolean; lead_id?: string; }
```

## Implementation Steps

### Step 1: validate
**Primitive:** `step.run()`

Parse and validate Clay callback payload. Check `status` field.

### Step 2: extract-lead-id
**Primitive:** `step.run()`

Extract `lead_id` from `row_id` field (we passed it when making the request).

### Step 3: lookup-lead
**Primitive:** `step.run()`

Fetch lead record to get `organization_id` for the event payload.

### Step 4: emit-completed
**Primitive:** `step.sendEvent()`

Emit `clay/enrichment.completed` with enrichment data.

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Invalid payload | `NonRetriableError` | Don't retry; log and discard |
| Clay status = 'error' | `NonRetriableError` | Log Clay error, emit failure event |
| Lead not found | `NonRetriableError` | Orphaned callback; log and discard |

## Test Cases

### Test 1: Valid Clay Callback

**Setup:** Send valid Clay callback with lead_id in row_id
**Expected Events:** `[{ name: "clay/enrichment.completed", data: { ... } }]`

### Test 2: Clay Error Status

**Setup:** Send callback with `status: 'error'`
**Expected:** Log error, no event emitted (or emit failure event)

## Related Functions

### Upstream

| Function | Event | Relationship |
|----------|-------|--------------|
| `request-clay` | HTTP request | Initiated the Clay enrichment |

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `clay/enrichment.completed` | `consolidate-enrichment` | Waits for this + Firecrawl |
