# Function: process-snoozed-leads

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | cron |
| Phase | Cross-cutting → Scheduling |
| Status | Spec Complete |

## Purpose

Wake up snoozed leads whose snooze period has expired. Resume their campaign at the appropriate phase (reach_out or post_eex depending on where they were when snoozed).

## Trigger

**Type:** Cron
**Schedule:** `0 9 * * *` (daily at 9am)
**Config:** `config/schedules.ts → CRON_SCHEDULES.SNOOZE_WAKEUP`

## Input

**Cron — No Event Payload**

Function queries database. See [Database Operations](#database-operations) for query details.

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `reach_out.started` | Lead was in reach_out phase when snoozed | `{ lead_id, campaign_id, organization_id, trace_id }` |
| `post_eex.started` | Lead was in post_eex phase when snoozed | `{ lead_id, campaign_id, organization_id, trace_id }` |

### Return Value

```typescript
{ processed: number; resumed_reach_out: number; resumed_post_eex: number; }
```

## Implementation Steps

### Step 1: query-expired-snoozes
**Primitive:** `step.run()`

```typescript
const now = new Date();
const { data: leads } = await db
  .from('leads')
  .select(`
    id,
    organization_id,
    campaigns!inner(id, current_phase),
    snooze_metadata
  `)
  .eq('current_state', 'snoozed')
  .lte('snoozed_until', now.toISOString())
  .limit(LIMITS.BATCH_SIZE);
```

**Returns:** `Lead[]` with campaign context

### Step 2: emit-resume-events
**Primitive:** `step.sendEvent()` in loop

For each lead, determine which event to emit based on `campaigns.current_phase`:

```typescript
for (const lead of leads) {
  const resumeEvent = lead.campaigns.current_phase === 'reach_out'
    ? 'reach_out.started'
    : 'post_eex.started';

  await step.sendEvent(`resume-${lead.id}`, {
    name: `kringle/${resumeEvent}`,
    data: {
      lead_id: lead.id,
      campaign_id: lead.campaigns.id,
      organization_id: lead.organization_id,
      resumed_from_snooze: true,
      trace_id: traceId,
    },
  });
}
```

### Step 3: update-lead-states
**Primitive:** `step.run()`

```typescript
const leadIds = leads.map(l => l.id);
await db
  .from('leads')
  .update({
    current_state: 'reach_out_active', // or appropriate state
    snoozed_until: null,
  })
  .in('id', leadIds);
```

## Database Operations

### Read: `leads`

| Field | Type | Notes |
|-------|------|-------|
| `current_state` | enum | Filter: `= 'snoozed'` |
| `snoozed_until` | timestamp | Filter: `<= now()` |
| `snooze_metadata` | jsonb | Contains original state, reason |

### Read: `campaigns` (joined)

| Field | Type | Notes |
|-------|------|-------|
| `current_phase` | enum | `'reach_out'` or `'post_eex'` |

### Write: `leads`

| Field | Update |
|-------|--------|
| `current_state` | `'reach_out_active'` or `'post_eex_active'` |
| `snoozed_until` | `null` |

**Indexes:** `idx_leads_snoozed_until` (partial index where `current_state = 'snoozed'`)

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Database query failure | Transient | Retry (default) |
| Empty result set | Expected | Return `{ processed: 0 }` |
| Event emit failure | Transient | Retry specific step |
| State update failure | Transient | Retry; events may re-emit (idempotent handlers) |

## Configuration

| Name | File | Value | Description |
|------|------|-------|-------------|
| `CRON_SCHEDULE` | `config/schedules.ts` | `0 9 * * *` | Run at 9am daily |
| `BATCH_SIZE` | `config/limits.ts` | `100` | Max leads per run |

## Edge Cases

1. **Lead snoozed during EEX** - EEX phase doesn't support snooze; shouldn't happen
2. **Campaign deleted while snoozed** - Handle null campaign gracefully
3. **Multiple snoozes** - Only process most recent; previous snoozed_until is overwritten

## Test Cases

### Test 1: Wake Up Reach Out Lead

**Setup:**
```typescript
await db.from('leads').insert({
  id: 'lead_123',
  current_state: 'snoozed',
  snoozed_until: hoursAgo(1),
});
await db.from('campaigns').insert({
  id: 'camp_123',
  lead_id: 'lead_123',
  current_phase: 'reach_out',
});
```

**Expected Events:**
```typescript
[{ name: "reach_out.started", data: { lead_id: "lead_123", resumed_from_snooze: true } }]
```

### Test 2: No Expired Snoozes

**Setup:** All snoozed leads have `snoozed_until` in the future

**Expected Events:** `[]`

**Expected Return:** `{ processed: 0, resumed_reach_out: 0, resumed_post_eex: 0 }`

### Test 3: Mixed Phase Resumption

**Setup:** 3 leads - 2 in reach_out, 1 in post_eex

**Expected:** 2 `reach_out.started` events, 1 `post_eex.started` event

## Related Functions

### Upstream

| Function | Event | Relationship |
|----------|-------|--------------|
| `handle-snooze` | Sets `snoozed_until` | Creates the data this function reads |

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `reach_out.started` | `send-reach-out-initial` | Resumes email sequence |
| `post_eex.started` | `send-post-eex` | Resumes post-EEX emails |
