# Function: check-response-timeouts

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | cron |
| Phase | Cross-cutting → Scheduling |
| Status | Spec Complete |

## Purpose

Detect leads that have been waiting for a response beyond the configured timeout threshold, emitting timeout events so the next outreach step can proceed automatically.

## Trigger

**Type:** Cron
**Schedule:** `*/30 * * * *` (every 30 minutes)
**Config:** `config/schedules.ts → CRON_SCHEDULES.TIMEOUT_CHECK`

## Input

**Cron — No Event Payload**

Function queries database. See [Database Operations](#database-operations) for query details.

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `kringle/timeout.response_wait` | For each timed-out item | `{ lead_id, campaign_id, campaign_item_id, trace_id }` |

### Return Value

```typescript
{ checked: number; emitted: number; }
```

## Implementation Steps

### Step 1: query-timed-out-items
**Primitive:** `step.run()`

Query `campaign_items` for items past timeout threshold.

```typescript
const cutoff = new Date(Date.now() - TIMEOUTS.RESPONSE_WAIT_HOURS * 60 * 60 * 1000);
const { data: items, error } = await db
  .from("campaign_items")
  .select("id, lead_id, campaign_id, sent_at")
  .eq("status", "sent")
  .lt("sent_at", cutoff.toISOString())
  .limit(LIMITS.BATCH_SIZE);
```

**Returns:** `CampaignItem[]` (may be empty)

### Step 2: emit-timeout-events
**Primitive:** `step.sendEvent()` in loop

For each item, emit timeout event with unique step ID.

```typescript
for (const item of items) {
  await step.sendEvent(`emit-timeout-${item.id}`, {
    name: "kringle/timeout.response_wait",
    data: {
      lead_id: item.lead_id,
      campaign_id: item.campaign_id,
      campaign_item_id: item.id,
      trace_id: traceId,
    },
  });
}
```

### Step 3: return
**Primitive:** Function return

```typescript
return { checked: items.length, emitted: items.length };
```

## Database Operations

### Read: `campaign_items`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | Primary key |
| `lead_id` | UUID | FK to `leads` |
| `campaign_id` | UUID | FK to `campaigns` |
| `status` | `'pending' \| 'sent' \| 'delivered' \| 'replied'` | Current state |
| `sent_at` | `timestamp` | When email was sent (null if pending) |

**Query conditions:**
- `status = 'sent'` — Only items that have been sent but not yet delivered/replied
- `sent_at < cutoff` — Sent longer ago than the timeout threshold

**Indexes used:** `idx_campaign_items_status_sent_at` (composite index recommended)

### Write: None

This function is read-only. State changes happen in downstream handlers.

## Error Handling

| Error | Type | Behavior | Notes |
|-------|------|----------|-------|
| Database query failure | Transient | Retry (default) | Supabase connection issues |
| Empty result set | Expected | Return `{ checked: 0, emitted: 0 }` | Normal during low activity |
| Event emit failure | Transient | Retry the specific step | Each emit is independent |

## Configuration

| Name | File | Value | Description |
|------|------|-------|-------------|
| `RESPONSE_WAIT_HOURS` | `config/timeouts.ts` | `48` | Hours before timeout |
| `BATCH_SIZE` | `config/limits.ts` | `100` | Max items per cron run |
| `CRON_SCHEDULE` | `config/schedules.ts` | `*/30 * * * *` | Run frequency |

## Test Cases

### Test 1: Normal Timeout Detection

**Setup:**
```typescript
// Insert test data
await db.from("campaign_items").insert([
  { id: "ci_123", lead_id: "lead_abc", campaign_id: "camp_1", status: "sent", sent_at: hoursAgo(50) },
  { id: "ci_456", lead_id: "lead_def", campaign_id: "camp_1", status: "sent", sent_at: hoursAgo(20) },
  { id: "ci_789", lead_id: "lead_ghi", campaign_id: "camp_1", status: "replied", sent_at: hoursAgo(60) },
]);
```

**Expected Events:**
```typescript
[{ name: "kringle/timeout.response_wait", data: { lead_id: "lead_abc", campaign_item_id: "ci_123" } }]
```

**Expected Return:**
```typescript
{ checked: 1, emitted: 1 }
```

### Test 2: No Timeouts

**Setup:**
```typescript
await db.from("campaign_items").insert([
  { id: "ci_123", status: "sent", sent_at: hoursAgo(20) },  // Not yet timed out
  { id: "ci_456", status: "replied", sent_at: hoursAgo(60) },  // Already replied
]);
```

**Expected Events:** `[]`

**Expected Return:**
```typescript
{ checked: 0, emitted: 0 }
```

### Test 3: Batch Limit Respected

**Setup:** Insert 150 items past threshold.

**Expected:** Only 100 processed (BATCH_SIZE).

**Expected Return:**
```typescript
{ checked: 100, emitted: 100 }
```

## Related Functions

### Upstream (What creates data this function reads)

| Function | Event/Action | Relationship |
|----------|--------------|--------------|
| `send-reach-out-*` | Creates `campaign_items` with `status='sent'` | Source of data |

### Downstream (What this function triggers)

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `timeout.response_wait` | `handle-timeout` | Advances lead to next step or terminates |
