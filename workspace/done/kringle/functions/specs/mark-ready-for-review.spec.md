# Function: mark-ready-for-review

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Campaign Setup |
| Status | Spec Complete |

## Purpose

Mark campaign and lead as ready for human review. This is the transition to the single human touchpoint.

## Trigger

**Type:** Event
**Event:** `eex.personalized`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  campaign_id: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `campaign.ready_for_review` | Always | `{ lead_id, organization_id, campaign_id, trace_id }` |

## Implementation Steps

### Step 1: update-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .update({ status: 'pending_approval' })
  .eq('id', event.data.campaign_id);
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'pending_approval' })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `campaign.ready_for_review`.

## Notes

- This triggers notification to human reviewers (separate function/integration)
- Human reviews: lead info, persona match, all 9 emails (4 drafted + 5 personalized)
- Single approval covers everything - no per-email approvals

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `personalize-eex` | Human approval UI → `campaign.approved` |
