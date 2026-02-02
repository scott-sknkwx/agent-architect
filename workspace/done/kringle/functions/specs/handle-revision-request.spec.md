# Function: handle-revision-request

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Approval |
| Status | Spec Complete |

## Purpose

Route back to email drafter with revision feedback when human requests changes.

## Trigger

**Type:** Event
**Event:** `campaign.revision_requested`

## Input

```typescript
{
  campaign_id: string;
  lead_id: string;
  organization_id: string;
  feedback: string;  // Human's revision instructions
  email_types?: string[];  // Which emails need revision (optional - defaults to all wrapper)
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `wrapper_emails.draft_requested` | Always | `{ ..., revision_feedback, trace_id }` |

## Implementation Steps

### Step 1: update-campaign
**Primitive:** `step.run()`

```typescript
await db.from('campaigns')
  .update({ status: 'revision_requested' })
  .eq('id', event.data.campaign_id);
```

### Step 2: emit
**Primitive:** `step.sendEvent()`

```typescript
await step.sendEvent('request-revision', {
  name: 'kringle/wrapper_emails.draft_requested',
  data: {
    lead_id: event.data.lead_id,
    organization_id: event.data.organization_id,
    campaign_id: event.data.campaign_id,
    email_types: event.data.email_types || ['reach_out_initial', 'reach_out_followup', 'post_eex_initial', 'post_eex_followup'],
    revision_feedback: event.data.feedback,
    trace_id: event.data.trace_id,
  },
});
```

## Notes

- Feedback goes to email-drafter agent for re-drafting
- After re-draft, flow continues through personalize-eex → mark-ready-for-review

## Related Functions

| Upstream | Downstream |
|----------|------------|
| Human revision request | `email-drafter` (agent) |
