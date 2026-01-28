# Supabase

Database (Postgres) + Auth + Storage + Realtime.

## When Agent Architect Uses This

- Designing database schema for entities
- Deciding what goes in DB vs Storage
- Multi-tenant isolation (RLS)
- File/artifact storage

## Database Patterns

### Multi-Tenant RLS
```sql
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON leads
  FOR ALL
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

### Status Tracking Table
```sql
CREATE TABLE status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES leads(id),
  org_id UUID NOT NULL,
  state VARCHAR(50) NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Storage Patterns

### Artifact Storage
```
artifacts/
  {org_id}/
    {entity_id}/
      {agent_name}/
        campaign-plan.yaml
        draft-email.md
```

### Upload
```typescript
await supabase.storage
  .from("artifacts")
  .upload(path, content, { upsert: true });
```

### Download
```typescript
const { data } = await supabase.storage
  .from("artifacts")
  .download(path);
```

## Limits

- Row size max: 1GB (but keep small)
- Storage file max: 5GB
- Realtime payload: 1MB

## TODO: Add More

- [ ] Edge functions integration
- [ ] Realtime subscriptions for dashboards
- [ ] Backup/restore patterns
