# Template Layer

Three-tier template inheritance for configuration and content.

## Definition

**Template Layers** provide a cascading configuration system where each layer can override or extend the layer above it. This enables platform defaults, organization customization, and instance-specific variations without code changes.

## The Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  PLATFORM TEMPLATE                                          │
│  ─────────────────                                          │
│  • Defined by platform administrators                       │
│  • Sensible defaults for all tenants                        │
│  • Rarely changed, represents "the product"                 │
│                                                             │
│  Examples: Default email sequences, standard phases,        │
│            base agent configurations, global settings       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ inherits + overrides
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ORGANIZATION TEMPLATE                                      │
│  ─────────────────────                                      │
│  • Defined by tenant/organization administrators            │
│  • Customizes platform defaults for their context           │
│  • Often tied to personas, products, or departments         │
│                                                             │
│  Examples: Buyer persona templates, org-specific email      │
│            tone, custom phase sequences, branding           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ instantiates + personalizes
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LIVE INSTANCE                                              │
│  ─────────────────                                          │
│  • Created per entity (lead, order, etc.)                   │
│  • Contains runtime state and entity-specific data          │
│  • Personalizes org template with entity variables          │
│                                                             │
│  Examples: Lead-specific email with {{first_name}},         │
│            order-specific fulfillment steps                 │
└─────────────────────────────────────────────────────────────┘
```

## Schema

### Platform Template
```yaml
platform_template:
  id: uuid
  name: string
  version: string                 # Versioned for migrations

  # What this template defines
  template_type: string           # campaign, phase, email_sequence, etc.

  # The actual content/configuration
  definition: json                # Structure depends on template_type

  # Metadata
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
```

### Organization Template
```yaml
org_template:
  id: uuid
  org_id: uuid                    # Tenant ownership

  # Inheritance
  platform_template_id: uuid?     # Which platform template this extends

  # Identity
  name: string                    # "Senior DevOps Leader", "Enterprise Fulfillment"
  description: text?

  # The customizations/content
  definition: json                # Overrides + additions to platform template

  # Metadata
  is_active: boolean
  created_by: uuid
  created_at: timestamp
  updated_at: timestamp
```

### Live Instance
```yaml
live_instance:
  id: uuid
  org_template_id: uuid           # Which org template this instantiates

  # What entity this instance is for
  entity_type: string
  entity_id: uuid

  # Resolved configuration (merged from all layers)
  resolved_config: json

  # Entity-specific variables for personalization
  variables: json                 # { first_name: "Jane", company: "Acme" }

  # Runtime state
  status: enum
  created_at: timestamp
```

## Resolution Algorithm

```python
def resolve_template(entity, field):
    """
    Look up a field value using three-layer resolution.
    Most specific wins.
    """
    # Layer 3: Live instance (most specific)
    instance = get_live_instance(entity.id)
    if instance and field in instance.resolved_config:
        return personalize(instance.resolved_config[field], instance.variables)

    # Layer 2: Organization template
    org_template = get_org_template(instance.org_template_id)
    if org_template and field in org_template.definition:
        return org_template.definition[field]

    # Layer 1: Platform template (fallback)
    if org_template.platform_template_id:
        platform = get_platform_template(org_template.platform_template_id)
        if platform and field in platform.definition:
            return platform.definition[field]

    # No value found at any layer
    raise TemplateResolutionError(f"No value for {field}")
```

## Examples

### Email Sequence Template Layers

**Platform Template (Layer 1)**
```yaml
platform_template:
  name: "Default Outreach Sequence"
  definition:
    phases: ["reach_out", "nurture", "close"]
    reach_out:
      email_count: 2
      delay_between: "3d"
    nurture:
      email_count: 5
      delay_between: "2d"
```

**Organization Template (Layer 2)**
```yaml
org_template:
  name: "Senior DevOps Leader"
  platform_template_id: "pt_default_outreach"
  definition:
    # Override: shorter delays for this persona
    reach_out:
      delay_between: "2d"
    # Add: persona-specific EEX content
    nurture:
      eex_sequence:
        - subject: "Infrastructure as Code Deep Dive"
          body_template: "eex_iac_lesson_1.html"
        - subject: "Kubernetes Best Practices"
          body_template: "eex_k8s_lesson_2.html"
```

**Live Instance (Layer 3)**
```yaml
live_instance:
  org_template_id: "ot_senior_devops"
  entity_type: "lead"
  entity_id: "lead_jane_smith"
  variables:
    first_name: "Jane"
    company: "Acme Corp"
    title: "VP of Platform Engineering"
  resolved_config:
    # Merged from all layers + personalized
    reach_out:
      delay_between: "2d"  # From org template
    nurture:
      eex_sequence:
        - subject: "Infrastructure as Code Deep Dive"
          body: "Hi Jane, ..."  # Personalized
```

## Best Practices

### What Goes Where

| Layer | Put Here | Don't Put Here |
|-------|----------|----------------|
| **Platform** | Default workflows, base configurations, standard fields | Tenant-specific content, branding |
| **Organization** | Persona definitions, custom sequences, branding, tone | Entity-specific data |
| **Instance** | Personalization variables, runtime state | Reusable configurations |

### Merging Strategy

- **Scalar values**: Lower layer wins (org overrides platform)
- **Objects**: Deep merge (org extends platform)
- **Arrays**: Usually replace entirely (org replaces platform array)

Document your merging strategy in the template definition.

## Events Emitted

| Event | When |
|-------|------|
| `platform_template.created` | New platform template |
| `platform_template.updated` | Platform template changed |
| `org_template.created` | New org template |
| `org_template.updated` | Org template changed |
| `instance.created` | Live instance instantiated |
| `instance.resolved` | Template resolution completed |
