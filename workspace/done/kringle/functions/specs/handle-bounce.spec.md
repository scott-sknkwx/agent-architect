# Function: handle-bounce

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Suppression |
| Status | Spec Complete |

## Purpose

Terminate lead and add to GLOBAL suppression list on hard bounce.

## Trigger

**Type:** Event
**Event:** `email.bounced`

## Input

```typescript
{
  campaign_item_id: string;
  lead_id: string;
  organization_id: string;
  metadata: {
    bounce_type: 'permanent' | 'transient';
    message: string;
  };
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.terminated` | Hard bounce | `{ lead_id, organization_id, reason: 'bounced', trace_id }` |

## Implementation Steps

### Step 1: check-bounce-type
**Primitive:** `step.run()`

```typescript
if (event.data.metadata.bounce_type !== 'permanent') {
  // Soft bounce - don't suppress, might retry
  return { skipped: true, reason: 'soft_bounce' };
}
```

### Step 2: add-to-global-suppression
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db.from('leads').select('email').eq('id', event.data.lead_id).single();

await db.from('suppressions').upsert({
  organization_id: null,  // NULL = global suppression
  email: lead.email,
  scope: 'global',
  reason: 'hard_bounce',
  source_lead_id: event.data.lead_id,
  created_at: new Date().toISOString(),
}, { onConflict: 'email', ignoreDuplicates: true });
```

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'terminated',
    suppressed: true,
    suppressed_reason: 'bounced',
  })
  .eq('id', event.data.lead_id);
```

### Step 4: emit
**Primitive:** `step.sendEvent()`

Emit `lead.terminated`.

## Notes

- **Scope = 'global'** with **organization_id = NULL**
- Hard bounce means email is undeliverable for ALL orgs
- Only suppress on permanent bounces, NOT transient (soft) bounces
- Soft bounces may be temporary issues (full mailbox, server down)

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `route-resend-event` | (terminal state) |
