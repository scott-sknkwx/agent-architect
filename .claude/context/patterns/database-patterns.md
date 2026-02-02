# Database Patterns

Reusable database column patterns for Agent Factory manifests. Reference during discovery Phase 2 (domain modeling) and Phase 3 (deep dive).

---

## Auto-Generated Columns (Never Ask About)

Supabase handles these automatically for every table:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, auto-generated |
| `created_at` | timestamptz | Set on insert |
| `updated_at` | timestamptz | Trigger-maintained on update |

**Discovery rule:** Skip these entirely. Don't include in schema discussions—they're infrastructure, not business logic.

---

## Common Business Columns

### Tenancy & Scoping

Multi-tenant isolation patterns. Choose based on access control needs.

| Column | Type | When to Use | RLS Pattern |
|--------|------|-------------|-------------|
| `org_id` | uuid | Multi-tenant apps, org-scoped data | `org_id = auth.jwt()->>'org_id'` |
| `user_id` | uuid | User-scoped personal data | `user_id = auth.uid()` |
| `team_id` | uuid | Team-scoped within org | Join through team_members |
| `workspace_id` | uuid | Project/workspace isolation | Similar to org_id |

**Discovery question:** "Who owns this data—an organization, a user, or both?"

---

### Ownership & Attribution

Track who created, owns, or is responsible for records.

| Column | Type | When to Use |
|--------|------|-------------|
| `created_by` | uuid | Audit trail—who created this record |
| `assigned_to` | uuid | Current owner/assignee (can change) |
| `owned_by` | uuid | Business ownership (distinct from creator) |
| `last_modified_by` | uuid | Audit trail—who last changed this |

**Discovery question:** "Do we need to track who created or is responsible for each [entity]?"

---

### State & Status

State machine support. Use enum constraints for valid states.

| Column | Type | When to Use |
|--------|------|-------------|
| `status` | text | State machine state (constrained by enum) |
| `previous_status` | text | Audit trail for state changes |
| `status_changed_at` | timestamptz | When state last changed |
| `archived_at` | timestamptz | Soft delete (null = active) |
| `deleted_at` | timestamptz | Soft delete with audit intent |

**Discovery question:** "What states can a [entity] be in? What triggers transitions?"

**Manifest pattern:**
```yaml
columns:
  status:
    type: text
    nullable: false
    default: "'new'"
    check: "status IN ('new', 'processing', 'completed', 'failed')"
```

---

### External References

Link to external systems for provenance and deduplication.

| Column | Type | When to Use |
|--------|------|-------------|
| `external_id` | text | ID from external system (unique per source) |
| `source` | text | Which system the data came from |
| `source_url` | text | Link back to original source |
| `source_data` | jsonb | Raw payload from external system |
| `synced_at` | timestamptz | Last sync with external system |

**Discovery question:** "Where does this data come from? Do we need to link back to the source?"

**Uniqueness pattern:** `UNIQUE(source, external_id)` prevents duplicate imports.

---

### Content & Artifacts

For entities that produce or store content.

| Column | Type | When to Use |
|--------|------|-------------|
| `content` | text | Main text content (email body, message, etc.) |
| `subject` | text | Title/subject line |
| `content_type` | text | MIME type or content format |
| `metadata` | jsonb | Flexible key-value pairs |
| `attachments` | jsonb | File references (storage paths) |

---

### Scheduling & Timing

For entities with time-based behavior.

| Column | Type | When to Use |
|--------|------|-------------|
| `scheduled_at` | timestamptz | When to execute/send |
| `sent_at` | timestamptz | When actually sent |
| `expires_at` | timestamptz | TTL / expiration |
| `completed_at` | timestamptz | When finished |
| `retry_count` | integer | Number of retry attempts |
| `next_retry_at` | timestamptz | When to retry next |

---

### Relationships

Common foreign key patterns.

| Pattern | Columns | When to Use |
|---------|---------|-------------|
| **Belongs-to** | `parent_id` | Single parent relationship |
| **Polymorphic** | `related_type`, `related_id` | Reference different entity types |
| **Self-referential** | `parent_id` (same table) | Tree/hierarchy structure |
| **Many-to-many** | Junction table | Multiple associations |

**Discovery questions:**
- "Does a [entity] belong to anything? (org, user, campaign, etc.)"
- "Can a [entity] have multiple [other entities]?"
- "Is there a hierarchy or parent-child relationship?"

---

## Discovery Workflow

### Step 1: Core Fields
> "For a [lead], what information do we need to track beyond the basics?"
> (Skip: id, created_at, updated_at)

### Step 2: Relationships
> "Does a [lead] belong to anything? (org, user, campaign)"
> "Can a [lead] have multiple [X]? (one-to-many)"

### Step 3: Constraints
> "Which fields are required vs optional?"
> "Any fields with specific allowed values? (status = draft|sent|delivered)"

### Step 4: Confirm
> "Here's what I have for the [leads] table: [list columns]. Does this capture everything for MVP?"

---

## Anti-Patterns

| Anti-Pattern | Problem | Instead |
|--------------|---------|---------|
| Asking about `id`, `created_at`, `updated_at` | Wastes time, Supabase handles it | Skip entirely |
| Kitchen-sink schemas | "We might need this later" bloat | MVP columns only |
| Missing tenancy | No org_id means data leaks | Always ask about ownership |
| String status without constraint | Invalid states possible | Use check constraint or enum |
| Soft delete without index | Slow queries on active records | `WHERE deleted_at IS NULL` partial index |

---

## Example: Lead Table

From discovery conversation:
- Belongs to org (multi-tenant)
- Has status state machine
- Came from external source (RB2B webhook)
- Needs enrichment data

```yaml
tables:
  leads:
    columns:
      # Tenancy
      org_id:
        type: uuid
        nullable: false
        references: orgs(id)

      # Core business data
      email:
        type: text
        nullable: false
      name:
        type: text
        nullable: true
      company:
        type: text
        nullable: true

      # State machine
      status:
        type: text
        nullable: false
        default: "'new'"
        check: "status IN ('new', 'enriching', 'qualified', 'disqualified', 'contacted')"

      # External reference
      source:
        type: text
        nullable: false
      external_id:
        type: text
        nullable: true
      source_data:
        type: jsonb
        nullable: true

      # Enrichment results
      enrichment_data:
        type: jsonb
        nullable: true
      enriched_at:
        type: timestamptz
        nullable: true

    access:
      - policy: "tenant_isolation"
        for: all
        using: "org_id = auth.jwt()->>'org_id'"
```
