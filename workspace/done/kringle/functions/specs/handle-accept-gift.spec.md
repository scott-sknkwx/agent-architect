# Function: handle-accept-gift

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | In Flight → EEX |
| Status | Spec Complete |

## Purpose

Start EEX sequence when lead accepts the educational gift offer.

## Trigger

**Type:** Event
**Event:** `response.accept_gift`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  organization_id: string;
  campaign_item_id: string;  // The email they replied to
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `eex.started` | Always | `{ lead_id, campaign_id, organization_id, trace_id }` |

## Implementation Steps

### Step 1: update-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .update({ current_phase: 'eex' })
  .eq('id', event.data.campaign_id);
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'eex_active' })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `eex.started` to begin educational sequence.

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | `send-eex-step` |
