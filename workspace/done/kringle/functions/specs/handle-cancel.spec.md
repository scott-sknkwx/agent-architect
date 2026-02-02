# Function: handle-cancel

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Completed → Terminal |
| Status | Spec Complete |

## Purpose

Handle user cancellation of an in-flight campaign.

## Trigger

**Type:** Event
**Event:** `campaign.canceled`

## Input

```typescript
{
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  canceled_by: string;  // User ID
  reason?: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.canceled` | Always | `{ lead_id, organization_id, trace_id }` |
| `lead.journey_completed` | Always | `{ lead_id, organization_id, outcome: 'canceled', trace_id }` |

## Implementation Steps

### Step 1: update-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .update({
    status: 'canceled',
    canceled_by: event.data.canceled_by,
    canceled_at: new Date().toISOString(),
    cancellation_reason: event.data.reason,
  })
  .eq('id', event.data.campaign_id);
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'canceled' })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `lead.canceled` and `lead.journey_completed`.

## Notes

- User can cancel at any point during in-flight phase
- Does NOT add to suppression list
- Analytics should track cancellation rate by phase

## Related Functions

| Upstream | Downstream |
|----------|------------|
| User action (UI) | `aggregate-journey` |
