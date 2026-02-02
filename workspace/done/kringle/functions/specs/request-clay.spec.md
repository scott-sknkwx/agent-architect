# Function: request-clay

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Enrich |
| Status | Spec Complete |

## Purpose

Send lead data to Clay for enrichment. Passes lead_id as row_id so Clay callback can be correlated.

## Trigger

**Type:** Event
**Event:** `enrichment.started`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `clay/enrichment.requested` | Request sent | `{ lead_id, organization_id, linkedin_url, trace_id }` |

## Implementation Steps

### Step 1: fetch-lead
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db
  .from('leads')
  .select('linkedin_url, email, first_name, last_name, company_name')
  .eq('id', event.data.lead_id)
  .single();
```

### Step 2: send-to-clay
**Primitive:** `step.run()`

POST to Clay table webhook via Hookdeck:

```typescript
await fetch(CLAY_TABLE_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    row_id: event.data.lead_id,  // For callback correlation
    linkedin_url: lead.linkedin_url,
    email: lead.email,
    first_name: lead.first_name,
    last_name: lead.last_name,
    company_name: lead.company_name,
  }),
});
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `clay/enrichment.requested`.

## Integrations

- **Hookdeck**: Routes request to Clay
- **Clay**: Performs enrichment, calls back on completion

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Lead not found | `NonRetriableError` | Log and skip |
| HTTP 4xx | `NonRetriableError` | Bad request |
| HTTP 5xx | Transient | Retry |

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `start-enrichment` | `ingest-clay-webhook` (via Clay callback) |
