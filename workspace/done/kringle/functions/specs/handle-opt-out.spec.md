# Function: handle-opt-out

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Suppression |
| Status | Spec Complete |

## Purpose

Terminate lead and add to ORG-LEVEL suppression list when they opt out.

## Trigger

**Type:** Event
**Event:** `response.opt_out`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  organization_id: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.terminated` | Always | `{ lead_id, organization_id, reason: 'opt_out', trace_id }` |

## Implementation Steps

### Step 1: add-to-suppression
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db.from('leads').select('email').eq('id', event.data.lead_id).single();

await db.from('suppressions').upsert({
  organization_id: event.data.organization_id,
  email: lead.email,
  scope: 'organization',  // NOT global - only this org
  reason: 'opt_out',
  source_lead_id: event.data.lead_id,
  created_at: new Date().toISOString(),
}, { onConflict: 'organization_id,email' });
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'terminated',
    suppressed: true,
    suppressed_reason: 'opt_out',
  })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `lead.terminated`.

## Notes

- **Scope = 'organization'**: Person opted out of THIS org only
- They may still receive emails from OTHER orgs using Kringle
- This is different from hard bounce (global suppression)

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | (terminal state) |
