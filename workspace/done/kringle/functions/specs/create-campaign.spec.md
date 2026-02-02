# Function: create-campaign

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Campaign Setup |
| Status | Spec Complete |

## Purpose

Create campaign structure after persona match. Sets up 9 campaign_items (4 agent-drafted wrapper emails + 5 template-sourced EEX emails).

## Trigger

**Type:** Event
**Event:** `lead.matched`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  persona_id: string;
  confidence_score: number;
  agent_reasoning: string;
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `campaign.setup_started` | Campaign created | `{ lead_id, organization_id, campaign_id, persona_id, trace_id }` |

## Implementation Steps

### Step 1: create-campaign
**Primitive:** `step.run()`

```typescript
const { data: campaign } = await db
  .from('campaigns')
  .insert({
    lead_id: event.data.lead_id,
    organization_id: event.data.organization_id,
    persona_id: event.data.persona_id,
    status: 'drafting',
    current_phase: 'setup',
  })
  .select()
  .single();
```

### Step 2: create-campaign-items
**Primitive:** `step.run()`

Create 9 campaign_items with correct sequence and content_source:

```typescript
const items = [
  // Agent-drafted (wrapper emails)
  { sequence: 1, type: 'reach_out_initial', content_source: 'agent_drafted', phase: 'reach_out' },
  { sequence: 2, type: 'reach_out_followup', content_source: 'agent_drafted', phase: 'reach_out' },
  // Template-sourced (EEX)
  { sequence: 3, type: 'eex_1', content_source: 'template_sourced', phase: 'eex' },
  { sequence: 4, type: 'eex_2', content_source: 'template_sourced', phase: 'eex' },
  { sequence: 5, type: 'eex_3', content_source: 'template_sourced', phase: 'eex' },
  { sequence: 6, type: 'eex_4', content_source: 'template_sourced', phase: 'eex' },
  { sequence: 7, type: 'eex_5', content_source: 'template_sourced', phase: 'eex' },
  // Agent-drafted (post-EEX)
  { sequence: 8, type: 'post_eex_initial', content_source: 'agent_drafted', phase: 'post_eex' },
  { sequence: 9, type: 'post_eex_followup', content_source: 'agent_drafted', phase: 'post_eex' },
];

await db.from('campaign_items').insert(
  items.map(item => ({
    ...item,
    campaign_id: campaign.id,
    lead_id: event.data.lead_id,
    status: 'pending',
  }))
);
```

### Step 3: update-lead
**Primitive:** `step.run()`

```typescript
await db.from('leads')
  .update({ current_state: 'campaign_setup', persona_id: event.data.persona_id })
  .eq('id', event.data.lead_id);
```

### Step 4: emit
**Primitive:** `step.sendEvent()`

Emit `campaign.setup_started`.

## Database Operations

### Write: `campaigns`
Creates new campaign record linked to lead and persona.

### Write: `campaign_items`
Creates 9 items with sequence numbers 1-9.

### Write: `leads`
Updates `current_state` and `persona_id`.

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `persona-matcher` (agent) | `request-wrapper-drafts` |
