# Function: approve-campaign-items

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Approval |
| Status | Spec Complete |

## Purpose

Fan-out approval: mark all campaign items as approved and transition to autonomous execution phase.

## Trigger

**Type:** Event
**Event:** `campaign.approved`

## Input

```typescript
{
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  approved_by: string;  // User ID
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `reach_out.started` | Always | `{ lead_id, campaign_id, organization_id, trace_id }` |

## Implementation Steps

### Step 1: approve-items
**Primitive:** `step.run()`

```typescript
await db.from('campaign_items')
  .update({ status: 'approved', approved_at: new Date().toISOString() })
  .eq('campaign_id', event.data.campaign_id);
```

### Step 2: update-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .update({
    status: 'approved',
    approved_by: event.data.approved_by,
    approved_at: new Date().toISOString(),
  })
  .eq('id', event.data.campaign_id);
```

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'approved' })
  .eq('id', event.data.lead_id);
```

### Step 4: emit
**Primitive:** `step.sendEvent()`

Emit `reach_out.started` to begin autonomous email sequence.

## Notes

- This is the LAST human touchpoint
- After this, everything runs autonomously until lead responds or sequence completes
- All 9 campaign_items are approved in one batch

## Related Functions

| Upstream | Downstream |
|----------|------------|
| Human approval UI | `send-reach-out-initial` |
