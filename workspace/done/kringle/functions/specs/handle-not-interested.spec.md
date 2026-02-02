# Function: handle-not-interested

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | In Flight → Suppression |
| Status | Spec Complete |

## Purpose

Terminate lead when they indicate no interest.

## Trigger

**Type:** Event
**Event:** `response.not_interested`

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
| `lead.terminated` | Always | `{ lead_id, organization_id, reason: 'not_interested', trace_id }` |

## Implementation Steps

### Step 1: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'terminated',
    termination_reason: 'not_interested',
  })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `lead.terminated`.

## Notes

- Does NOT add to suppression list
- "Not interested" doesn't mean "never contact" - they might be interested later
- Different from opt_out (explicit do-not-contact request)

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | (terminal state) |
