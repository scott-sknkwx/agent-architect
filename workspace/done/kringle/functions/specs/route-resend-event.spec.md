# Function: route-resend-event

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | routing |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Routes incoming Resend webhook events to specific handlers based on event type. Acts as a dispatcher that transforms generic `resend/event.received` into typed domain events (`email.sent`, `email.delivered`, etc.).

## Trigger

**Type:** Event with routing
**Event:** `resend/event.received`
**Route On:** `payload.event_type`

## Input

**Event Payload:**
```typescript
{
  campaign_item_id: string;
  lead_id: string;
  organization_id: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  metadata: {
    resend_message_id: string;
    timestamp: string;
    // Additional fields vary by event type
  };
  trace_id: string;
}
```

## Output

### Events Emitted

| Input `event_type` | Output Event | Notes |
|--------------------|--------------|-------|
| `sent` | `email.sent` | Email accepted by Resend |
| `delivered` | `email.delivered` | Email delivered to recipient |
| `opened` | `email.opened` | Recipient opened email |
| `clicked` | `email.clicked` | Recipient clicked a link |
| `bounced` | `email.bounced` | Email bounced (includes `bounce_type`) |
| `complained` | `email.complained` | Recipient marked as spam |

### Return Value

```typescript
{ routed_to: string; }
```

## Implementation Steps

### Step 1: route
**Primitive:** `step.run()` with switch/match

```typescript
const eventType = event.data.event_type;
const outputEvent = {
  sent: 'email.sent',
  delivered: 'email.delivered',
  opened: 'email.opened',
  clicked: 'email.clicked',
  bounced: 'email.bounced',
  complained: 'email.complained',
}[eventType];

if (!outputEvent) {
  throw new NonRetriableError(`Unknown event type: ${eventType}`);
}
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

```typescript
await step.sendEvent('emit-typed-event', {
  name: `kringle/${outputEvent}`,
  data: {
    campaign_item_id: event.data.campaign_item_id,
    lead_id: event.data.lead_id,
    organization_id: event.data.organization_id,
    metadata: event.data.metadata,
    trace_id: event.data.trace_id,
  },
});
```

## Database Operations

### Read/Write: None

This function is a pure router. It doesn't query or modify the database.

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Unknown event_type | `NonRetriableError` | Log warning, don't retry |
| Missing required fields | `NonRetriableError` | Validation failure |

## Configuration

| Name | File | Value | Description |
|------|------|-------|-------------|
| `SUPPORTED_RESEND_EVENTS` | `config/constants.ts` | Array of supported types | For validation |

## Test Cases

### Test 1: Route Delivered Event

**Setup:**
```typescript
{ event_type: 'delivered', campaign_item_id: 'ci_123', ... }
```

**Expected Events:**
```typescript
[{ name: "email.delivered", data: { campaign_item_id: "ci_123" } }]
```

### Test 2: Route Bounce Event

**Setup:**
```typescript
{ event_type: 'bounced', metadata: { bounce_type: 'permanent' }, ... }
```

**Expected Events:**
```typescript
[{ name: "email.bounced", data: { metadata: { bounce_type: "permanent" } } }]
```

### Test 3: Unknown Event Type

**Setup:**
```typescript
{ event_type: 'unknown_type', ... }
```

**Expected:** `NonRetriableError` thrown

## Related Functions

### Upstream

| Function | Event | Relationship |
|----------|-------|--------------|
| `ingest-resend-webhook` | `resend/event.received` | Trigger source |

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `email.delivered` | `update-delivery-status` | Updates campaign_item status |
| `email.bounced` | `handle-bounce` | Suppression + termination |
| `email.complained` | `handle-complaint` | Suppression + termination |
| `email.opened` | `track-engagement` | Analytics |
| `email.clicked` | `track-engagement` | Analytics |
