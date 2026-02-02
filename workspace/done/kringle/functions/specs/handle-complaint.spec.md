# Function: handle-complaint

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | In Flight → Suppression |
| Status | Spec Complete |

## Purpose

Terminate lead and add to ORG-LEVEL suppression list on spam complaint.

## Trigger

**Type:** Event
**Event:** `email.complained`

## Input

```typescript
{
  campaign_item_id: string;
  lead_id: string;
  organization_id: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `lead.terminated` | Always | `{ lead_id, organization_id, reason: 'complained', trace_id }` |

## Implementation Steps

### Step 1: add-to-suppression
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db.from('leads').select('email').eq('id', event.data.lead_id).single();

await db.from('suppressions').upsert({
  organization_id: event.data.organization_id,
  email: lead.email,
  scope: 'organization',  // Org-level, not global
  reason: 'complained',
  source_lead_id: event.data.lead_id,
  created_at: new Date().toISOString(),
}, { onConflict: 'organization_id,email' });
```

### Step 2: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({
    current_state: 'terminated',
    suppressed: true,
    suppressed_reason: 'complained',
  })
  .eq('id', event.data.lead_id);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `lead.terminated`.

## Notes

- **Scope = 'organization'**: Person marked THIS org's email as spam
- They may still be willing to hear from other orgs
- Consider alerting org admin on complaints (high impact signal)

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `route-resend-event` | (terminal state) |
