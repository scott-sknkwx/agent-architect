# Function: request-firecrawl

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | simple |
| Phase | Processing → Enrich |
| Status | Spec Complete |

## Purpose

Scrape the lead's company homepage using Firecrawl to gather context for personalization.

## Trigger

**Type:** Event
**Event:** `clay/enrichment.completed`

## Input

```typescript
{
  lead_id: string;
  organization_id: string;
  enrichment_data: object;  // Contains company_url from Clay
  trace_id: string;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `firecrawl/scrape.requested` | Request sent | `{ lead_id, organization_id, company_url, trace_id }` |
| `lead.scraped` | Scrape complete | `{ lead_id, organization_id, homepage_context_path, trace_id }` |

## Implementation Steps

### Step 1: extract-company-url
**Primitive:** `step.run()`

Get company URL from Clay enrichment data or fall back to lead's stored `company_url`.

### Step 2: scrape
**Primitive:** `step.run()`

```typescript
const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: companyUrl,
    formats: ['markdown'],
  }),
});
const { data } = await response.json();
```

### Step 3: store-context
**Primitive:** `step.run()`

Store scraped content in Supabase Storage:

```typescript
const path = `${organization_id}/leads/${lead_id}/homepage.md`;
await storage.from('lead-context').upload(path, data.markdown);
```

### Step 4: emit
**Primitive:** `step.sendEvent()`

Emit `lead.scraped` with storage path.

## Integrations

- **Firecrawl**: Web scraping API
- **Supabase Storage**: Stores scraped content

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| No company URL | `NonRetriableError` | Skip scraping, emit event anyway |
| Firecrawl 4xx | `NonRetriableError` | URL invalid or blocked |
| Firecrawl 5xx | Transient | Retry |
| Storage error | Transient | Retry |

## Related Functions

| Upstream | Downstream |
|----------|------------|
| `ingest-clay-webhook` | `consolidate-enrichment` |
