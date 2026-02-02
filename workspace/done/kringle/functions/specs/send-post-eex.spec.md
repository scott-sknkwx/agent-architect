# Function: send-post-eex

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Post-EEX |
| Status | Spec Complete |

## Purpose

Send post-EEX emails after the educational sequence completes.

## Trigger

**Type:** Event
**Event:** `post_eex.started`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  organization_id: string;
  resumed_from_snooze?: boolean;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `email.send_requested` | Email sent | `{ campaign_item_id, lead_id, trace_id }` |

## Implementation Steps

### Step 1: load-campaign-item
**Primitive:** `step.run()`

```typescript
const { data: item } = await db
  .from('campaign_items')
  .select('id, subject, body')
  .eq('campaign_id', event.data.campaign_id)
  .eq('type', 'post_eex_initial')
  .single();
```

### Step 2: load-lead
**Primitive:** `step.run()`

Load lead with org email config.

### Step 3: send-email
**Primitive:** `step.run()`

Send via Resend.

### Step 4: update-campaign-item
**Primitive:** `step.run()`

Update with sent status and Resend message ID.

### Step 5: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'post_eex_active' })
  .eq('id', event.data.lead_id);
```

### Step 6: emit
**Primitive:** `step.sendEvent()`

Emit `email.send_requested`.

## Notes

- Similar pattern to `send-reach-out-initial`
- Post-EEX has 2 emails: initial and followup
- Followup sent via timeout mechanism (same as reach-out)

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `eex.completed` event | Resend webhook → response handling |
| `process-snoozed-leads` | |
