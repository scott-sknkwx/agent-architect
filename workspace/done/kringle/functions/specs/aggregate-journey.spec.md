# Function: aggregate-journey

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Completed → Terminal |
| Status | Spec Complete |

## Purpose

Compute and store journey analytics when a lead's journey completes (any terminal state).

## Trigger

**Type:** Event
**Event:** `lead.journey_completed`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  outcome: 'converted' | 'terminated' | 'archived' | 'canceled';
  trace_id: string;
}
```

## Output

### Events Emitted

None (terminal analytics function)

### Return Value

```typescript
{ journey_analytics_id: string; }
```

## Implementation Steps

### Step 1: fetch-journey-data
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db
  .from('leads')
  .select(`
    *,
    campaigns(*, campaign_items(*)),
    personas(name)
  `)
  .eq('id', event.data.lead_id)
  .single();
```

### Step 2: compute-metrics
**Primitive:** `step.run()`

```typescript
const metrics = {
  // Timing
  time_to_match: diffMs(lead.created_at, lead.matched_at),
  time_to_approval: diffMs(lead.matched_at, lead.campaigns?.approved_at),
  time_to_outcome: diffMs(lead.created_at, new Date()),

  // Engagement
  emails_sent: lead.campaigns?.campaign_items?.filter(i => i.status === 'sent').length || 0,
  emails_opened: lead.campaigns?.campaign_items?.filter(i => i.opened_at).length || 0,
  emails_clicked: lead.campaigns?.campaign_items?.filter(i => i.clicked_at).length || 0,
  replies_received: lead.campaigns?.campaign_items?.filter(i => i.replied_at).length || 0,

  // Funnel position
  reached_eex: lead.campaigns?.current_phase !== 'reach_out',
  reached_post_eex: lead.campaigns?.current_phase === 'post_eex',
};
```

### Step 3: insert-analytics
**Primitive:** `step.run()`

```typescript
const { data: analytics } = await db.from('journey_analytics').insert({
  lead_id: event.data.lead_id,
  organization_id: event.data.organization_id,
  persona_id: lead.persona_id,
  outcome: event.data.outcome,
  ...metrics,
  created_at: new Date().toISOString(),
}).select().single();
```

## Database Operations

### Read: `leads`, `campaigns`, `campaign_items`, `personas`
Full journey data for metrics computation.

### Write: `journey_analytics`
Aggregated metrics for reporting.

## Notes

- This is the analytics sink for all terminal states
- Powers conversion rate, funnel analysis, A/B testing
- Consider async processing if metrics computation is heavy

## Related Functions

| Upstream | All terminal state handlers |
|----------|------------|
| `convert-lead`, `archive-lead`, `handle-cancel`, terminal handlers | (none - analytics sink) |
