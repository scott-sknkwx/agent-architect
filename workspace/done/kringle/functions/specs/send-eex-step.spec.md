# Function: send-eex-step

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → EEX |
| Status | Spec Complete |

## Purpose

Send the next EEX (Educational Email Experience) step in the sequence.

## Trigger

**Type:** Event
**Event:** `eex.started`

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
| `eex.step_sent` | Email sent | `{ campaign_item_id, lead_id, step_number, trace_id }` |
| `eex.completed` | All 5 steps sent | `{ lead_id, campaign_id, trace_id }` |

## Implementation Steps

### Step 1: find-next-eex-item
**Primitive:** `step.run()`

```typescript
const { data: nextItem } = await db
  .from('campaign_items')
  .select('id, subject, body, sequence, type')
  .eq('campaign_id', event.data.campaign_id)
  .eq('phase', 'eex')
  .eq('status', 'approved')
  .order('sequence')
  .limit(1)
  .single();
```

### Step 2: check-completion
**Primitive:** `step.run()`

If no more EEX items, emit `eex.completed` instead.

### Step 3: send-email
**Primitive:** `step.run()`

Send via Resend (same pattern as reach-out).

### Step 4: update-campaign-item
**Primitive:** `step.run()`

```typescript
await db.from('campaign_items')
  .update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    resend_message_id: sent.id,
  })
  .eq('id', nextItem.id);
```

### Step 5: schedule-next
**Primitive:** `step.sleepUntil()` or external scheduling

Schedule next EEX step (typically 2-3 days apart).

### Step 6: emit
**Primitive:** `step.sendEvent()`

Emit `eex.step_sent` with step number.

## Notes

- EEX has 5 steps sent over ~2 weeks
- Steps are template-sourced, not agent-drafted
- Lead can respond at any point, which triggers response-triager

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `handle-accept-gift` | Next EEX step or `send-post-eex` |
