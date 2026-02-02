# Content Sourcing Pattern

## Overview

The Content Sourcing pattern distinguishes between content that requires creative generation (agent-drafted) and content that can be deterministically personalized from templates (template-sourced). This distinction affects who creates the content, whether it's editable, and how it's processed.

## Two Content Sources

### Agent-Drafted (`agent_drafted`)

Content that requires **creative judgment** - understanding context, making decisions about tone, selecting what to emphasize.

**Characteristics:**
- Created by Claude agent
- Unique per lead (even for same persona)
- Human can edit before approval
- Token cost per generation
- May need revision based on feedback

**Examples:**
- Personalized outreach emails
- Replies to lead questions
- Custom proposals

### Template-Sourced (`template_sourced`)

Content that follows a **fixed structure** with variable substitution - the template is pre-written, only personalization fields change.

**Characteristics:**
- Created by non-agentic function
- Same structure for all leads in persona
- Human can preview but typically not edit
- No token cost (just string interpolation)
- Pre-approved with persona/template

**Examples:**
- Educational course emails (EEX)
- Welcome sequences
- Compliance notices
- Transactional emails

## Template Hierarchy

For template-sourced content, templates typically inherit from a hierarchy:

```
Organization
└── Buyer Persona
    └── Campaign Template
        └── Individual Items
            └── Personalized with lead data
```

Example for Kringle:
```
Acme Corp (Organization)
└── Senior DevOps Leader (Buyer Persona)
    └── Kubernetes Course (EEX Campaign)
        └── EEX Step 1 Template
            └── Personalized: "Hi {{first_name}}, ..."
```

## Implementation

### Database Schema

```yaml
campaign_items:
  columns:
    - content_source: text  # "agent_drafted" or "template_sourced"
    - template_id: text     # Reference to template (if template_sourced)
    - personalization_data: jsonb  # Variables used for interpolation
```

### Agent Contract

Agents should only draft `agent_drafted` items:

```yaml
email-drafter:
  description: "Drafts the 4 wrapper emails"  # NOT EEX
  triggers:
    - event: wrapper_emails.draft_requested
```

### Personalization Function

Template-sourced items use a non-agentic function:

```yaml
personalize-eex:
  description: "Personalizes EEX templates with lead data (non-agentic)"
  pattern: simple
  trigger:
    event: wrapper_emails.drafted
  actions:
    - "Load EEX templates from persona.eex_template_path"
    - "Substitute {{first_name}}, {{company}}, etc."
    - "Update campaign_items SET body = personalized_content"
```

## Approval Implications

| Source | In Approval Bundle | Human Action |
|--------|-------------------|--------------|
| `agent_drafted` | Fully displayed | Can edit |
| `template_sourced` | Preview only | View (already approved with persona) |

The rationale: Template-sourced content was approved when the persona/template was created. The human is just confirming it's appropriate for this lead.

## When to Use Each

### Use `agent_drafted` when:
- Content requires understanding lead-specific context
- Tone/approach should vary based on enrichment data
- Human oversight of the specific content is valuable
- The content is a response to something unique

### Use `template_sourced` when:
- Content follows a standard structure
- The "creative" work was done once (in the template)
- Consistency across leads is more important than uniqueness
- Content is educational/informational rather than persuasive
- High volume would make per-item agent drafting expensive

## Cost Considerations

```
Agent-Drafted:
- Token cost: ~$0.01-0.05 per email
- Latency: 5-15 seconds
- Quality: Higher personalization

Template-Sourced:
- Token cost: $0
- Latency: <100ms
- Quality: Consistent, pre-vetted
```

For a 9-email campaign:
- 4 agent-drafted + 5 template-sourced = ~$0.04-0.20
- All agent-drafted = ~$0.09-0.45

## Related Patterns

- **Bundle Approval Pattern** - How both sources are reviewed together
- **Template Hierarchy** - How templates inherit and override
