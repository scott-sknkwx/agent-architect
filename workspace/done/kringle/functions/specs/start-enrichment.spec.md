# Function: start-enrichment

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Enrich |
| Status | Spec Complete |

## Purpose

Transition lead to enriching state and emit event to start the enrichment pipeline (Clay + Firecrawl).

## Trigger

**Type:** Event
**Event:** `lead.ingested`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  fingerprint: string;
  captured_url: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `enrichment.started` | Always | `{ lead_id, organization_id, trace_id }` |

## Implementation Steps

### Step 1: update-state
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'enriching' })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `enrichment.started` with lead context.

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `ingest-rb2b-webhook` | `request-clay`, `request-firecrawl` |
