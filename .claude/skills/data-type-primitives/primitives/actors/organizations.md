# Organizations

The tenant isolation boundary for multi-tenant systems.

## Why Organizations Matter

Every B2B system we build is multi-tenant. Organizations provide:
- **Data isolation**: Leads, campaigns, templates belong to an org
- **Configuration scope**: Org-level settings, templates, integrations
- **Billing boundary**: Usage tracking, subscription management
- **User containment**: Users belong to orgs, access scoped accordingly

---

## Schema

```yaml
organization:
  id: uuid

  # Identity
  name: string                    # "Acme Corp"
  slug: string                    # "acme-corp" (URL-safe, unique)

  # Classification
  plan: string                    # free, starter, pro, enterprise
  status: active | suspended | canceled

  # Settings
  settings: json                  # Org-specific configuration

  # Integrations (API keys, OAuth tokens stored securely)
  integrations:
    - provider: string            # resend, clay, slack, etc.
      status: connected | disconnected
      config: json                # Provider-specific settings

  # Limits
  limits:
    campaigns_per_month: integer?
    emails_per_month: integer?
    users: integer?

  # Usage (current period)
  usage:
    campaigns_created: integer
    emails_sent: integer
    tokens_used: integer

  # Timestamps
  created_at: timestamp
  trial_ends_at: timestamp?
```

---

## Relationships

```
Organization
    │
    ├── has_many: Users (via memberships)
    ├── has_many: OrgTemplates (buyer personas, etc.)
    ├── has_many: Campaigns
    ├── has_many: Leads/Entities
    │
    └── has_many: Integrations
```

---

## Mapping to Manifest

### Database Tables

```yaml
database:
  tables:
    - name: organizations
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: name, type: text }
        - { name: slug, type: text, unique: true }
        - { name: plan, type: text, default: "free" }
        - { name: status, type: text, default: "active" }
        - { name: settings, type: jsonb, default: "{}" }
        - { name: created_at, type: timestamptz, default: "now()" }
      access:
        - actor: tenant
          operations: [SELECT, UPDATE]
          condition: "id = :actor"
          description: "Orgs can only access their own record"
        - actor: admin
          operations: [SELECT, UPDATE, DELETE]
          condition: "true"
          description: "Platform admins can manage all orgs"

    - name: organization_integrations
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: org_id, type: uuid, references: organizations.id }
        - { name: provider, type: text }
        - { name: status, type: text }
        - { name: encrypted_credentials, type: text }
        - { name: config, type: jsonb }
      access:
        - actor: tenant
          operations: [SELECT, INSERT, UPDATE, DELETE]
          condition: "org_id = :actor"
```

### Actor Definition

```yaml
database:
  actors:
    - name: tenant
      identifier: "current_setting('app.current_org')::uuid"
      description: "The organization context for the request"
```

---

## Common Patterns

### Org Context in Functions

Every function that accesses org-scoped data should:

```typescript
// Set org context at start of function
await supabase.rpc('set_org_context', { org_id: event.data.org_id });

// All subsequent queries are automatically scoped via RLS
const { data: leads } = await supabase
  .from('leads')
  .select('*');  // Only returns leads for this org
```

### Org Settings Resolution

```yaml
# Check org setting, fall back to platform default
settings:
  email_send_delay:
    org_override: organizations.settings.email_send_delay
    platform_default: "3 days"
```

### Multi-Org Users

Some users may belong to multiple orgs (agencies, consultants):

```yaml
memberships:
  - user_id: uuid
    org_id: uuid
    role: owner | admin | member | viewer
    is_default: boolean           # Which org loads on login
```

---

## Events

| Event | When |
|-------|------|
| `organization.created` | New org registered |
| `organization.plan_changed` | Upgrade/downgrade |
| `organization.suspended` | Payment failed, policy violation |
| `organization.integration_connected` | External service linked |
| `organization.limit_reached` | Usage hit plan limit |
