# Function: handle-rejection

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Approval |
| Status | Spec Complete |

## Purpose

Terminate lead when human rejects the campaign.

## Trigger

**Type:** Event
**Event:** `campaign.rejected`

## Input

```typescript
{
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  rejected_by: string;
  reason?: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.terminated` | Always | `{ lead_id, organization_id, reason: 'rejected', trace_id }` |

## Implementation Steps

### Step 1: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'terminated',
    termination_reason: event.data.reason || 'rejected_by_reviewer',
  })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `lead.terminated`.

## Related Functions

| Upstream | Downstream |
|----------|------------|
| Human rejection | (terminal state) |
