# Function: ingest-resend-webhook

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | inngest-first-webhook |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Validate incoming Resend delivery status webhook, look up the campaign_item by message ID, and emit `resend/event.received` for routing.

## Trigger

**Type:** Event
**Event:** `webhook/resend.received`
**Source:** Hookdeck transformation of Resend webhook

## Input

**Event Payload:**
```typescript
{
  raw: ResendWebhookPayload;
  headers: Record<string, string>;
  received_at: string;
}
```

**Resend Webhook Structure:**
```typescript
{
  type: 'email.sent' | 'email.delivered' | 'email.opened' | 'email.clicked' | 'email.bounced' | 'email.complained';
  created_at: string;
  data: {
    email_id: string;        // Resend's message ID
    from: string;
    to: string[];
    subject: string;
    // Bounce-specific fields
    bounce?: {
      type: 'permanent' | 'transient';
      message: string;
    };
  };
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `resend/event.received` | Valid payload, campaign_item found | `{ campaign_item_id, lead_id, organization_id, event_type, metadata, trace_id }` |

### Return Value

```typescript
{ success: boolean; campaign_item_id?: string; skipped_reason?: string; }
```

## Implementation Steps

### Step 1: validate
**Primitive:** `step.run()`

Parse and validate Resend webhook payload against expected structure.

### Step 2: lookup-campaign-item
**Primitive:** `step.run()`

```typescript
const { data: item } = await db
  .from('campaign_items')
  .select('id, lead_id, campaign_id, campaigns(organization_id)')
  .eq('resend_message_id', payload.data.email_id)
  .single();
```

**Returns:** `campaign_item` with joined `organization_id`, or null if not found.

### Step 3: emit-event
**Primitive:** `step.sendEvent()`

```typescript
await step.sendEvent('emit-resend-event', {
  name: 'kringle/resend/event.received',
  data: {
    campaign_item_id: item.id,
    lead_id: item.lead_id,
    organization_id: item.campaigns.organization_id,
    event_type: payload.type.replace('email.', ''),  // 'sent', 'delivered', etc.
    metadata: {
      resend_message_id: payload.data.email_id,
      timestamp: payload.created_at,
      bounce_type: payload.data.bounce?.type,
    },
    trace_id,
  },
});
```

## Database Operations

### Read: `campaign_items`

| Field | Type | Join |
|-------|------|------|
| `resend_message_id` | string | Match on Resend's email_id |
| `campaigns.organization_id` | uuid | FK join for org context |

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Invalid payload | `NonRetriableError` | Don't retry |
| campaign_item not found | Expected | Log warning, return early (external email) |
| DB error | Transient | Retry |

## Notes

- **Signature validation**: Hookdeck validates webhook signatures before forwarding
- **Idempotency**: Resend may send duplicate webhooks; handle gracefully
- **External emails**: campaign_item lookup may fail for non-Kringle emails; skip silently

## Test Cases

### Test 1: Valid Delivered Event

**Setup:** Send `email.delivered` webhook with known resend_message_id
**Expected Events:** `[{ name: "resend/event.received", data: { event_type: "delivered" } }]`

### Test 2: Unknown Message ID

**Setup:** Send webhook with unknown email_id
**Expected:** Return `{ success: true, skipped_reason: "unknown_message" }`

### Test 3: Bounce Event

**Setup:** Send `email.bounced` with `bounce.type: 'permanent'`
**Expected:** Event includes `metadata.bounce_type: 'permanent'`

## Related Functions

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `resend/event.received` | `route-resend-event` | Routes to typed handlers |
