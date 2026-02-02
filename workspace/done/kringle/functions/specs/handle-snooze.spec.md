# Function: handle-snooze

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Handle when lead asks to be contacted later (snooze request).

## Trigger

**Type:** Event
**Event:** `response.delayed`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  organization_id: string;
  snooze_until?: string;  // ISO date if specified
  snooze_reason?: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.snoozed` | Always | `{ lead_id, organization_id, snoozed_until, trace_id }` |

## Implementation Steps

### Step 1: calculate-snooze-date
**Primitive:** `step.run()`

```typescript
const snoozedUntil = event.data.snooze_until
  || new Date(Date.now() + DEFAULTS.SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString();
```

### Step 2: fetch-current-phase
**Primitive:** `step.run()`

Get current campaign phase for later resumption.

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'snoozed',
    snoozed_until: snoozedUntil,
    snooze_metadata: {
      previous_state: currentState,
      campaign_phase: campaign.current_phase,
      reason: event.data.snooze_reason,
    },
  })
  .eq('id', event.data.lead_id);
```

### Step 4: emit
**Primitive:** `step.sendEvent()`

Emit `lead.snoozed`.

## Configuration

| Name | Value | Description |
|------|-------|-------------|
| `DEFAULTS.SNOOZE_DAYS` | `14` | Default snooze period |

## Notes

- Lead will be woken up by `process-snoozed-leads` cron
- `snooze_metadata` stores context for resumption

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | `process-snoozed-leads` |
