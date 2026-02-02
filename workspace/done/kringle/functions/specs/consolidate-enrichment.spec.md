# Function: consolidate-enrichment

| Property | Value |
|----------|-------|
| Complexity | Complex |
| Pattern | fan-in |
| Phase | Processing → Enrich |
| Status | Spec Complete |

## Purpose

Waits for both Clay enrichment data and Firecrawl scrape to complete, then marks the lead as enriched and transitions to persona matching. Handles partial enrichment gracefully.

## Trigger

**Type:** Fan-in (wait for multiple events)
**Primary Event:** `clay/enrichment.completed`
**Wait For:** `lead.scraped`
**Correlation Key:** `lead_id`
**Timeout:** 30 minutes

## Input

**Primary Event Payload:** `clay/enrichment.completed`
```typescript
{
  lead_id: string;
  organization_id: string;
  enrichment_data: object;  // Clay person data
  trace_id: string;
}
```

**Wait-for Event Payload:** `lead.scraped`
```typescript
{
  lead_id: string;
  organization_id: string;
  homepage_context_path: string;  // Supabase storage path
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.enriched` | Both sources complete OR timeout with partial data | `{ lead_id, organization_id, enrichment_status, trace_id }` |
| `enrichment.failed` | Both sources failed | `{ lead_id, organization_id, reason, trace_id }` |

### Return Value

```typescript
{
  success: boolean;
  enrichment_status: 'complete' | 'partial' | 'failed';
  clay_received: boolean;
  firecrawl_received: boolean;
}
```

## Implementation Steps

### Step 1: wait-for-events
**Primitive:** `step.waitForEvent()` (Inngest fan-in)

```typescript
const firecrawlResult = await step.waitForEvent('wait-for-firecrawl', {
  event: 'kringle/lead.scraped',
  match: 'data.lead_id',
  timeout: '30m',
});
```

**Returns:** Event payload or `null` if timeout

### Step 2: assess-completion
**Primitive:** `step.run()`

Determine enrichment status based on which events arrived:
- Clay complete + Firecrawl complete → `complete`
- Clay complete + Firecrawl timeout → `partial`
- Clay complete + Firecrawl failed → `partial`
- Both failed/timeout → `failed`

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads').update({
  current_state: enrichmentStatus === 'failed' ? 'enrichment_failed' : 'enriched',
  enrichment_status: enrichmentStatus,
  clay_data: event.data.enrichment_data,
  homepage_context_path: firecrawlResult?.data?.homepage_context_path,
}).eq('id', event.data.lead_id);
```

### Step 4: emit-result
**Primitive:** `step.sendEvent()`

Emit `lead.enriched` or `enrichment.failed` based on assessment.

## Database Operations

### Write: `leads`

| Field | Type | Update |
|-------|------|--------|
| `current_state` | enum | `'enriched'` or `'enrichment_failed'` |
| `enrichment_status` | enum | `'complete'`, `'partial'`, `'failed'` |
| `clay_data` | jsonb | Enrichment data from Clay |
| `homepage_context_path` | string | Supabase storage path to scraped content |

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Clay event never arrives | N/A | Primary trigger - function won't start |
| Firecrawl timeout | Expected | Continue with partial enrichment |
| DB update failure | Transient | Retry (default) |

## Configuration

| Name | File | Value | Description |
|------|------|-------|-------------|
| `FAN_IN_TIMEOUT` | `config/timeouts.ts` | `30m` | Max wait for second event |

## Edge Cases

1. **Firecrawl arrives first** - Won't trigger this function. Clay is primary.
2. **Both arrive simultaneously** - Inngest handles; wait-for returns immediately.
3. **Lead already enriched** - Check `current_state` before update to avoid overwriting.

## Test Cases

### Test 1: Both Sources Complete

**Setup:**
- Emit `clay/enrichment.completed` with lead_id
- Emit `lead.scraped` with same lead_id within timeout

**Expected Events:**
```typescript
[{ name: "lead.enriched", data: { enrichment_status: "complete" } }]
```

### Test 2: Firecrawl Timeout

**Setup:**
- Emit `clay/enrichment.completed`
- Do NOT emit `lead.scraped`
- Wait 30+ minutes

**Expected:**
```typescript
{ enrichment_status: "partial", firecrawl_received: false }
```

### Test 3: Correlation Key Mismatch

**Setup:**
- Emit `clay/enrichment.completed` with lead_id = "abc"
- Emit `lead.scraped` with lead_id = "xyz"

**Expected:** Firecrawl event ignored; timeout occurs for "abc"

## Related Functions

### Upstream

| Function | Event | Relationship |
|----------|-------|--------------|
| `ingest-clay-webhook` | `clay/enrichment.completed` | Primary trigger |
| `request-firecrawl` | `lead.scraped` | Secondary event |

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `lead.enriched` | `start-matching` | Triggers persona matching |
| `enrichment.failed` | (terminal handler) | Marks lead terminated |
