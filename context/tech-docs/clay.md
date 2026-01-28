# Clay

Data enrichment platform. Takes basic info, returns rich profiles.

## When Agent Architect Uses This

- Lead enrichment before qualification
- Company research
- Contact discovery

## Webhook Integration (RB2B → Clay → Your App)

Typical flow:
```
RB2B identifies visitor
    ↓
RB2B webhook → your app
    ↓
Your app sends to Clay for enrichment
    ↓
Clay webhook → your app (enriched data)
    ↓
Emit lead.enriched event
```

## Enrichment Fields Available

### Person
- Full name, title, seniority
- LinkedIn URL, profile data
- Email (work, personal)
- Phone numbers
- Employment history

### Company
- Company name, domain
- Industry, size, revenue
- Funding info
- Technologies used
- Social profiles
- Employee count

## Clay Table Webhook Format
```json
{
  "data": {
    "email": "person@company.com",
    "first_name": "John",
    "last_name": "Doe",
    "title": "VP Engineering",
    "company": "Acme Corp",
    "company_size": "51-200",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    // ... many more fields
  },
  "metadata": {
    "table_id": "...",
    "row_id": "..."
  }
}
```

## Agent Patterns

### Enrichment as Separate Step
```
lead.received → Enricher agent → lead.enriched → Qualifier agent
```

Don't combine enrichment with qualification. Enrichment is slow/expensive.

### Caching
Store enrichment results. Don't re-enrich the same person.
```sql
CREATE TABLE enrichment_cache (
  email VARCHAR(255) PRIMARY KEY,
  data JSONB,
  enriched_at TIMESTAMPTZ,
  source VARCHAR(50) -- 'clay', 'clearbit', etc.
);
```

## Limits

- Rate limits vary by plan
- Credits consumed per enrichment
- Some fields require premium

## TODO: Add More

- [ ] Specific Clay API endpoints
- [ ] Error handling for missing data
- [ ] Fallback enrichment sources
