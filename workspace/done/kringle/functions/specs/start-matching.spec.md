# Function: start-matching

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | simple |
| Phase | Processing → Qualify |
| Status | Spec Complete |

## Purpose

Transition lead to matching state and trigger persona matching agent.

## Trigger

**Type:** Event
**Event:** `lead.enriched`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  enrichment_status: 'complete' | 'partial';
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `matching.started` | Always | `{ lead_id, organization_id, active_persona_count, trace_id }` |

## Implementation Steps

### Step 1: update-state
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'matching' })
  .eq('id', event.data.lead_id);
```

### Step 2: count-personas
**Primitive:** `step.run()`

```typescript
const { count } = await db
  .from('personas')
  .select('*', { count: 'exact', head: true })
  .eq('organization_id', event.data.organization_id)
  .eq('active', true);
```

### Step 3: emit
**Primitive:** `step.sendEvent()`

Emit `matching.started` with persona count for agent context.

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `consolidate-enrichment` | `persona-matcher` (agent) |
