# Function: handle-unclear

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Escalate to human when response-triager can't determine intent.

## Trigger

**Type:** Event
**Event:** `response.unclear`

## Input

```typescript
{
  lead_id: string;
  campaign_id: string;
  organization_id: string;
  reply_content: string;
  triage_reasoning: string;  // Why the agent was uncertain
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.escalated` | Always | `{ lead_id, organization_id, escalation_id, trace_id }` |

## Implementation Steps

### Step 1: create-escalation
**Primitive:** `step.run()`

```typescript
const { data: escalation } = await db.from('escalations').insert({
  lead_id: event.data.lead_id,
  organization_id: event.data.organization_id,
  type: 'unclear_response',
  context: {
    reply_content: event.data.reply_content,
    triage_reasoning: event.data.triage_reasoning,
  },
  status: 'pending',
  created_at: new Date().toISOString(),
}).select().single();
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'escalated' })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `lead.escalated`.

## Notes

- Human resolves escalation via UI
- Resolution triggers `escalation-handler` agent
- Lead remains paused until resolved

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `response-triager` (agent) | `escalation-handler` (agent) |
