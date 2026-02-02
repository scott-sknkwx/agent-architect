# Manifest Reference

This document provides reference material for the `manifest.yaml` schema, including contract definitions, access control patterns, and function integration rules.

For the schema source of truth, see: `context/manifest-schema.ts`

---

## Agent Contract

An agent contract defines the input/output specification for an agent—what context it receives and what structured output it produces.

### Contract Schema

```typescript
const ContractSchema = z.object({
  state_in: z.union([z.string(), z.array(z.string())]),  // Which state(s) trigger this agent
  state_out: z.string(),                                  // What state agent sets on completion
  context_in: z.object({                                  // What data agent receives
    from_db: z.array(DbSourceSchema).optional(),          // Database queries
    static: z.array(StaticSourceSchema).optional(),       // Config files
  }).optional(),
  context_out: z.object({                                 // What agent produces
    artifacts: z.array(ArtifactSchema).optional(),        // Files it creates
  }).optional(),
  output_schema: z.string(),                              // Path to Zod schema for structured output
});
```

### Contract Fields

| Field | Type | Purpose |
|-------|------|---------|
| `state_in` | `string \| string[]` | State(s) that trigger this agent |
| `state_out` | `string` | State the agent transitions the entity to |
| `context_in.from_db` | `DbSource[]` | Database tables to query for context |
| `context_in.static` | `StaticSource[]` | Config files to include |
| `context_out.artifacts` | `Artifact[]` | Files the agent produces |
| `output_schema` | `string` | Path to Zod schema file for structured output |

### Context Sources

**Database Source (`from_db`):**
```yaml
from_db:
  - table: leads
    as: "lead.md"           # Filename in context
    template: "lead-context.md.hbs"  # Optional Handlebars template
    must_have: ["email", "company"]  # Required fields
```

**Static Source (`static`):**
```yaml
static:
  - source: personas        # → config/personas/
    dest: personas/         # Where to place in agent context
```

---

## Access Control Pattern

Every table MUST have at least one access policy. RLS is mandatory, not optional.

### Defining Actors

Actors are the identities that access data. Define them once in `database.actors`:

```yaml
database:
  actors:
    - name: tenant
      identifier: "current_setting('app.current_tenant')::uuid"
      description: "The organization/tenant making the request"
    - name: authenticated_user
      identifier: "auth.uid()"
      description: "The logged-in user from Supabase Auth"
    - name: owner
      identifier: "auth.uid()"
      description: "The user who created/owns the record"
```

### Defining Access Policies

Each table declares who can do what using the `:actor` placeholder:

```yaml
tables:
  - name: leads
    columns: [...]
    access:
      - actor: tenant
        operations: [SELECT, INSERT, UPDATE, DELETE]
        condition: "org_id = :actor"
        description: "Users can only access leads in their org"
      - actor: owner
        operations: [UPDATE, DELETE]
        condition: "created_by = :actor"
        description: "Only the creator can modify their leads"
```

### Common Access Patterns

| Pattern | Actor | Condition |
|---------|-------|-----------|
| Tenant isolation | tenant | `org_id = :actor` |
| Owner only | owner | `user_id = :actor` OR `created_by = :actor` |
| Team membership | team_member | `team_id IN (SELECT team_id FROM memberships WHERE user_id = :actor)` |
| Public read | public | `true` (for SELECT only) |
| Admin override | admin | `EXISTS (SELECT 1 FROM users WHERE id = :actor AND role = 'admin')` |

Agent Factory translates these into Postgres RLS policies.

---

## Function Integrations Rule

When defining functions in the manifest, be mindful of what goes in the `integrations` array.

### Core Infrastructure (DO NOT list)

These are always available to every function—they're the platform:
- `supabase` - Database access
- `inngest` - Event orchestration
- `anthropic` - LLM access

### External Integrations (DO list)

Only list external/optional integrations that the function actually calls:

```yaml
functions:
  - name: send-outreach-email
    integrations:
      - resend          # Email sending
    # ...

  - name: enrich-lead-data
    integrations:
      - clay            # Lead enrichment
      - firecrawl       # Web scraping
    # ...

  - name: ingest-visitor-webhook
    integrations:
      - hookdeck        # Webhook routing
      - rb2b            # Visitor identification
    # ...
```

### Integration Reference

| Integration | Purpose | When to Include |
|-------------|---------|-----------------|
| `resend` | Email sending | Function sends email |
| `clay` | Lead enrichment | Function calls Clay API |
| `firecrawl` | Web scraping | Function scrapes URLs |
| `hookdeck` | Webhook infrastructure | Function handles webhooks |
| `rb2b` | Visitor identification | Function processes RB2B data |
| `assemblyai` | Transcription | Function transcribes audio |
| `exa` | Semantic search | Function uses Exa search |
| `parallel` | Browser automation | Function automates browsers |
| `merge` | Unified integrations | Function uses Merge API |
| `stripe` | Payments | Function handles payments |

---

## Output Schema Requirements

Every agent must have an output schema. These are Zod schemas that define the structured output.

### Required Fields

```typescript
import { z } from "zod";

export const AgentOutputSchema = z.object({
  success: z.boolean(),           // REQUIRED
  error: z.string().optional(),   // REQUIRED (for failure cases)
  // ... agent-specific fields
});
```

### Schema Checklist

For each agent in the manifest:
- [ ] Schema file exists at path specified in `contract.output_schema`
- [ ] Schema includes `success: z.boolean()` field
- [ ] Schema includes `error: z.string().optional()` field
- [ ] Schema fields match the "Structured output" examples in agent's CLAUDE.md
- [ ] Enum values match event payload enums in manifest
