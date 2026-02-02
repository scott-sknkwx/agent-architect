# Extend Database

Add tables, columns, or RLS policies following project patterns.

## When to Use

- Adding a new entity/table
- Adding columns to existing tables
- Modifying Row Level Security policies
- Working with the suppressions system

## Migration Pattern

### 1. Create Migration File

Migrations live in `supabase/migrations/`. Name format:
```
{timestamp}_{description}.sql
```

Generate timestamp:
```bash
date +%Y%m%d%H%M%S
# e.g., 20240130160000_add_webhooks_table.sql
```

### 2. Table Structure

Follow existing patterns:

```sql
-- supabase/migrations/20240130160000_add_example_table.sql

CREATE TABLE example_table (
  -- Standard fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),

  -- Your fields
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  data JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant isolation (almost always needed)
CREATE INDEX idx_example_table_org ON example_table(organization_id);

-- Additional indexes for common queries
CREATE INDEX idx_example_table_status ON example_table(status);
```

### 3. Row Level Security (RLS)

**Always enable RLS** on tables with tenant data:

```sql
-- Enable RLS
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (most common)
CREATE POLICY "Tenant isolation" ON example_table
  FOR ALL
  USING (organization_id = current_setting('app.current_tenant')::uuid);

-- Or for authenticated user access
CREATE POLICY "Users access own org data" ON example_table
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );
```

### 4. Updated_at Trigger

Add trigger for automatic timestamp updates:

```sql
-- Create trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to table
CREATE TRIGGER update_example_table_updated_at
  BEFORE UPDATE ON example_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

## Suppression Table Pattern

The project uses dual-scope suppression. Reference implementation:

```sql
CREATE TABLE suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),  -- NULL for global scope
  email TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'organization',  -- 'organization' or 'global'
  reason TEXT NOT NULL,  -- 'opt_out', 'complained', 'hard_bounce', 'manual'
  source_lead_id UUID REFERENCES leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique per org+email+scope
  UNIQUE(organization_id, email, scope)
);

-- Fast lookup indexes
CREATE INDEX idx_suppressions_email_scope ON suppressions(email, scope);
CREATE INDEX idx_suppressions_org_email ON suppressions(organization_id, email);
```

**Scope rules:**
- `organization` scope: org_id is set, only suppresses for that org
- `global` scope: org_id is NULL, suppresses for ALL orgs

## Adding Columns

```sql
-- supabase/migrations/20240130160000_add_column_to_leads.sql

ALTER TABLE leads
  ADD COLUMN new_field TEXT,
  ADD COLUMN another_field JSONB DEFAULT '{}';

-- Add index if queried frequently
CREATE INDEX idx_leads_new_field ON leads(new_field);
```

## Type Generation

After migration, regenerate TypeScript types:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```

## Querying Patterns

**With tenant context (RLS):**
```typescript
// Set tenant context first
await supabase.rpc('set_tenant', { tenant_id: organizationId });

// Then query - RLS automatically filters
const { data } = await supabase
  .from('leads')
  .select('*')
  .eq('status', 'active');
```

**Service role (bypasses RLS):**
```typescript
// Use only in backend/Inngest functions
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!  // Service key bypasses RLS
);
```

## Checklist

- [ ] Migration file created with timestamp prefix
- [ ] Table has `id`, `organization_id`, `created_at`, `updated_at`
- [ ] Foreign keys reference parent tables
- [ ] RLS enabled and policies created
- [ ] Indexes added for common query patterns
- [ ] `updated_at` trigger added
- [ ] Types regenerated after migration
- [ ] Tested with RLS (not just service role)
