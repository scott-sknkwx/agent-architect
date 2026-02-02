# Function: send-reach-out-initial

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Reach Out |
| Status | Spec Complete |

## Purpose

Send the first reach-out email to start the campaign sequence.

## Trigger

**Type:** Event
**Event:** `reach_out.started`

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
| `email.send_requested` | Email queued | `{ campaign_item_id, lead_id, trace_id }` |

## Implementation Steps

### Step 1: load-campaign-item
**Primitive:** `step.run()`

```typescript
const { data: item } = await db
  .from('campaign_items')
  .select('id, subject, body')
  .eq('campaign_id', event.data.campaign_id)
  .eq('sequence', 1)
  .single();
```

### Step 2: load-lead
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db
  .from('leads')
  .select('email, first_name, organizations(from_email, from_name)')
  .eq('id', event.data.lead_id)
  .single();
```

### Step 3: send-email
**Primitive:** `step.run()`

```typescript
const { data: sent } = await resend.emails.send({
  from: `${lead.organizations.from_name} <${lead.organizations.from_email}>`,
  to: lead.email,
  subject: item.subject,
  html: item.body,
  headers: {
    'X-Kringle-Campaign-Item': item.id,
    'X-Kringle-Lead': event.data.lead_id,
  },
});
```

### Step 4: update-campaign-item
**Primitive:** `step.run()`

```typescript
await db.from('campaign_items')
  .update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    resend_message_id: sent.id,
  })
  .eq('id', item.id);
```

### Step 5: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'reach_out_active' })
  .eq('id', event.data.lead_id);
```

### Step 6: emit
**Primitive:** `step.sendEvent()`

Emit `email.send_requested` for tracking.

## Integrations

- **Resend**: Email delivery

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Lead email missing | `NonRetriableError` | Can't send without recipient |
| Resend API error | Transient | Retry |
| Already sent | Expected | Check status before sending |

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `approve-campaign-items` | Resend webhook → `ingest-resend-webhook` |
| `process-snoozed-leads` | |
