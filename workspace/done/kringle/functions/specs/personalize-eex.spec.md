# Function: personalize-eex

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Campaign Setup |
| Status | Spec Complete |

## Purpose

Personalize EEX (Educational Email Experience) templates with lead data. This is NOT agent-drafted - it's deterministic template substitution.

## Trigger

**Type:** Event
**Event:** `wrapper_emails.drafted`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  campaign_id: string;
  draft_paths: string[];  // Paths to drafted wrapper emails
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `eex.personalized` | All 5 EEX emails personalized | `{ lead_id, organization_id, campaign_id, trace_id }` |

## Implementation Steps

### Step 1: fetch-context
**Primitive:** `step.run()`

```typescript
const { data: lead } = await db
  .from('leads')
  .select('first_name, last_name, company_name, title, personas(eex_template_path)')
  .eq('id', event.data.lead_id)
  .single();
```

### Step 2: load-templates
**Primitive:** `step.run()`

Load EEX templates from persona's configured path:

```typescript
const templates = await storage
  .from('templates')
  .list(lead.personas.eex_template_path);
// Expected: eex_1.md, eex_2.md, eex_3.md, eex_4.md, eex_5.md
```

### Step 3: personalize
**Primitive:** `step.run()`

For each template, substitute placeholders:

```typescript
const placeholders = {
  '{{first_name}}': lead.first_name,
  '{{last_name}}': lead.last_name,
  '{{company}}': lead.company_name,
  '{{title}}': lead.title,
};

const personalizedContent = template.replace(
  /\{\{(\w+)\}\}/g,
  (_, key) => placeholders[`{{${key}}}`] || ''
);
```

### Step 4: update-campaign-items
**Primitive:** `step.run()`

```typescript
for (const [index, content] of personalizedEmails.entries()) {
  await db.from('campaign_items')
    .update({
      subject: content.subject,
      body: content.body,
      status: 'ready',
    })
    .eq('campaign_id', event.data.campaign_id)
    .eq('type', `eex_${index + 1}`);
}
```

### Step 5: emit
**Primitive:** `step.sendEvent()`

Emit `eex.personalized`.

## Notes

- EEX content is template-sourced, NOT agent-drafted
- Templates are stored per-persona in Supabase Storage
- Personalization is deterministic - same input always produces same output

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `email-drafter` (agent) | `mark-ready-for-review` |
