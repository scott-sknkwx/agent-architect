# Function: send-reach-out-followup

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Reach Out |
| Status | Spec Complete |

## Purpose

Send followup email when no response within timeout period.

## Trigger

**Type:** Event
**Event:** `timeout.response_wait`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  campaign_item_id: string;  // The item that timed out
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `email.send_requested` | Followup sent | `{ campaign_item_id, lead_id, trace_id }` |
| `reach_out.timeout` | No more followups | `{ lead_id, campaign_id, trace_id }` |

## Implementation Steps

### Step 1: check-phase
**Primitive:** `step.run()`

Verify lead is still in reach_out phase (not responded, not terminated).

### Step 2: find-next-item
**Primitive:** `step.run()`

```typescript
const { data: nextItem } = await db
  .from('campaign_items')
  .select('id, subject, body, sequence')
  .eq('campaign_id', event.data.campaign_id)
  .eq('phase', 'reach_out')
  .eq('status', 'approved')
  .order('sequence')
  .limit(1)
  .single();

if (!nextItem) {
  // No more followups - emit timeout
  return { no_more_followups: true };
}
```

### Step 3: send-email
**Primitive:** `step.run()`

Same as `send-reach-out-initial` step 3.

### Step 4: update-campaign-item
**Primitive:** `step.run()`

Update sent item with `status: 'sent'`, `sent_at`, `resend_message_id`.

### Step 5: emit
**Primitive:** `step.sendEvent()`

Emit `email.send_requested` or `reach_out.timeout` if no more followups.

## Notes

- Timeout events come from `check-response-timeouts` cron
- Only sends if there are pending items in the reach_out phase
- After last followup times out, emits `reach_out.timeout` → terminates lead

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `check-response-timeouts` | Resend webhook → response handling |
