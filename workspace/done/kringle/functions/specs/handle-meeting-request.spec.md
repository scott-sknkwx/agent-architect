# Function: handle-meeting-request

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Transition lead to meeting_requested state when they ask to schedule.

## Trigger

**Type:** Event
**Event:** `response.request_meeting`

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
| `meeting.requested` | Always | `{ lead_id, organization_id, trace_id }` |

## Implementation Steps

### Step 1: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'meeting_requested' })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `meeting.requested`.

## Notes

- This is a success signal - lead wants to talk!
- Downstream: notification to sales team, calendar booking flow

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | Calendar/notification integration |
