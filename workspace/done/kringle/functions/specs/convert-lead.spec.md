# Function: convert-lead

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Completed → Terminal |
| Status | Spec Complete |

## Purpose

Mark lead as converted when a meeting is successfully booked.

## Trigger

**Type:** Event
**Event:** `meeting.booked`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  meeting_details: {
    scheduled_at: string;
    calendar_link?: string;
  };
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.converted` | Always | `{ lead_id, organization_id, trace_id }` |
| `lead.journey_completed` | Always | `{ lead_id, organization_id, outcome: 'converted', trace_id }` |

## Implementation Steps

### Step 1: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'converted',
    converted_at: new Date().toISOString(),
    meeting_scheduled_at: event.data.meeting_details.scheduled_at,
  })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `lead.converted` and `lead.journey_completed`.

## Notes

- This is the SUCCESS outcome 🎉
- Triggers analytics and possibly CRM sync

## Related Functions

| Upstream | Downstream |
|----------|------------|
| Calendar booking integration | `aggregate-journey` |
