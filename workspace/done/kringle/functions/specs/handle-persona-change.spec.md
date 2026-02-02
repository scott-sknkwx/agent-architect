# Function: handle-persona-change

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Approval |
| Status | Spec Complete |

## Purpose

Handle human request to re-match persona. Deletes current campaign and routes back to persona matching.

## Trigger

**Type:** Event
**Event:** `campaign.persona_change_requested`

## Input

```typescript
{
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  exclude_persona_id?: string;  // Don't match this persona again
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `matching.started` | Always | `{ lead_id, organization_id, active_persona_count, exclude_persona_ids, trace_id }` |

## Implementation Steps

### Step 1: delete-campaign-items
**Primitive:** `step.run()`

```typescript
await db.from('campaign_items')
  .delete()
  .eq('campaign_id', event.data.campaign_id);
```

### Step 2: delete-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .delete()
  .eq('id', event.data.campaign_id);
```

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'matching',
    persona_id: null,
    excluded_persona_ids: db.sql`array_append(excluded_persona_ids, ${event.data.exclude_persona_id})`,
  })
  .eq('id', event.data.lead_id);
```

### Step 4: count-personas
**Primitive:** `step.run()`

Count remaining active personas (excluding any excluded ones).

### Step 5: emit
**Primitive:** `step.sendEvent()`

Emit `matching.started` with exclusion list.

## Notes

- Exclusion list prevents the same bad match from happening again
- If no personas remain after exclusions, will result in `lead.no_match`

## Related Functions

| Upstream | Downstream |
|----------|------------|
| Human persona change request | `persona-matcher` (agent) |
