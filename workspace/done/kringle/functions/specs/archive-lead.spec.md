# Function: archive-lead

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Completed → Terminal |
| Status | Spec Complete |

## Purpose

Archive lead when no suitable persona match is found.

## Trigger

**Type:** Event
**Event:** `lead.no_match`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  reason: 'no_match' | 'insufficient_data';
  scores: string;  // JSON of persona scores
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.archived` | Always | `{ lead_id, organization_id, trace_id }` |
| `lead.journey_completed` | Always | `{ lead_id, organization_id, outcome: 'archived', trace_id }` |

## Implementation Steps

### Step 1: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'archived',
    archive_reason: event.data.reason,
    persona_scores: event.data.scores,
  })
  .eq('id', event.data.lead_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

Emit `lead.archived` and `lead.journey_completed`.

## Notes

- Archived ≠ terminated - could be re-evaluated later
- Stores persona scores for future analysis
- Consider periodic re-evaluation when new personas added

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `persona-matcher` (agent) | `aggregate-journey` |
