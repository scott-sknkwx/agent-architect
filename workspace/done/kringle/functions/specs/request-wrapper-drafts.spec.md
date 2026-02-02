# Function: request-wrapper-drafts

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Campaign Setup |
| Status | Spec Complete |

## Purpose

Trigger the email-drafter agent to draft the 4 wrapper emails (reach_out_initial, reach_out_followup, post_eex_initial, post_eex_followup).

## Trigger

**Type:** Event
**Event:** `campaign.setup_started`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  campaign_id: string;
  persona_id: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `wrapper_emails.draft_requested` | Always | `{ lead_id, organization_id, campaign_id, email_types, revision_feedback?, trace_id }` |

## Implementation Steps

### Step 1: emit
**Primitive:** `step.sendEvent()`

```typescript
await step.sendEvent('request-drafts', {
  name: 'kringle/wrapper_emails.draft_requested',
  data: {
    lead_id: event.data.lead_id,
    organization_id: event.data.organization_id,
    campaign_id: event.data.campaign_id,
    email_types: ['reach_out_initial', 'reach_out_followup', 'post_eex_initial', 'post_eex_followup'],
    trace_id: event.data.trace_id,
  },
});
```

## Notes

- This is a simple pass-through function
- The `email_types` array tells the agent which emails to draft
- `revision_feedback` is populated when re-drafting after revision request

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `create-campaign` | `email-drafter` (agent) |
| `handle-revision-request` | `email-drafter` (agent) |
