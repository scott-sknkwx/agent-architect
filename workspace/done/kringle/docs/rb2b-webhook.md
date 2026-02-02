# RB2B Webhook Reference

Website visitor identification. Turns anonymous traffic into leads.

## Webhook Configuration

RB2B requires a simple HTTPS URL with no custom headers. Authentication must be embedded as query parameters in the URL.

**Settings:**
- `Sync company-only profiles`: Send company-level visitor info (no person data)
- `Send repeat visitor data`: Send all subsequent visits (includes `is_repeat_visit: true`)

## Webhook Payload

```json
{
  "LinkedIn URL": "https://www.linkedin.com/in/retentionadam/",
  "First Name": "Adam",
  "Last Name": "Robinson",
  "Title": "CEO @ Retention.com. We help Ecomm brands grow & monetize their first-party audience",
  "Company Name": "Retention.com",
  "Business Email": "adam@retention.com",
  "Website": "https://retention.com",
  "Industry": "Internet Technology & Services",
  "Employee Count": "1-10",
  "Estimate Revenue": "$22M rev",
  "City": "Austin",
  "State": "Texas",
  "Zipcode": "73301",
  "Seen At": "2024-01-01T12:34:56:00.00+00.00",
  "Referrer": "https://retention.com",
  "Captured URL": "https://rb2b.com/pricing",
  "Tags": "Hot Page, Hot Lead",
  "is_repeat_visit": true
}
```

## Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| LinkedIn URL | string (URL) | Yes* | Primary identifier |
| First Name | string, null | Yes* | Required for payload to send |
| Last Name | string, null | No | |
| Title | string, null | No | May be stale |
| Company Name | string, null | No | Lead's company |
| Business Email | string, null | No | May not always be present |
| Website | string (URL), null | No | Lead's company website |
| Industry | string, null | No | |
| Employee Count | integer/string, null | No | e.g., "1-10" |
| Estimate Revenue | string, null | No | e.g., "$22M rev" |
| City | string | Yes* | Never null |
| State | string | Yes* | Never null |
| Zipcode | string | Yes* | Never null |
| Seen At | datetime (ISO 8601) | Yes* | Never null |
| Referrer | string (URL), null | No | Where they came from |
| Captured URL | string (URL) | Yes* | **Page they visited on YOUR site** |
| Tags | string, null | No | Comma-separated |
| is_repeat_visit | boolean | No | Only present for repeat visitors |

*Never null

## Key Insight: Captured URL vs Website

- **Captured URL**: The page on YOUR customer's website the visitor was on (e.g., `https://acme.com/pricing`)
- **Website**: The visitor's OWN company website (e.g., `https://retention.com`)

**Org lookup uses Captured URL** - this tells us which customer's site they visited.

## Field Mapping to Leads Table

| RB2B Field | Leads Column |
|------------|--------------|
| LinkedIn URL | linkedin_url |
| First Name | first_name |
| Last Name | last_name |
| Title | title |
| Company Name | company_name |
| Business Email | email |
| Website | company_url |
| Captured URL | captured_url |
| Seen At | created_at (or visit timestamp) |
| is_repeat_visit | (handle as upsert) |

## Ingestion Flow

```
RB2B → Hookdeck (transform) → /e/rb2b → Inngest → ingest-rb2b-webhook → lead.ingested
```

See `webhook-routing.md` for the Inngest-first pattern details.

### Inngest Function Steps

1. **validate** - Parse RB2B payload, check required fields (LinkedIn URL, First Name, Captured URL)
2. **lookup-org** - Extract domain from `Captured URL`, match to organization
3. **check-suppression** - Check BOTH org-level AND global suppression lists
4. **upsert-lead** - Create/update lead record with fingerprint
5. **emit-ingested** - Fire `lead.ingested` event to start enrichment

### Organization Lookup

```typescript
// Extract domain from Captured URL (the site they visited)
const capturedUrl = new URL(payload["Captured URL"]);
const domain = capturedUrl.hostname.replace('www.', '');

// Match against organizations table
const org = await db.from('organizations')
  .select('id')
  .eq('domain', domain)
  .single();
```

### Suppression Check (Dual Scope)

```typescript
// Check org-level suppression (opt-outs, complaints for THIS org)
const orgSuppressed = await db.from('suppressions')
  .select('id')
  .eq('organization_id', org.id)
  .eq('email', payload["Business Email"])
  .eq('scope', 'organization')
  .maybeSingle();

// Check global suppression (hard bounces - undeliverable for ALL orgs)
const globalSuppressed = await db.from('suppressions')
  .select('id')
  .eq('email', payload["Business Email"])
  .eq('scope', 'global')
  .maybeSingle();

if (orgSuppressed || globalSuppressed) {
  // Log and return early - no lead.ingested event
  return { suppressed: true, reason: orgSuppressed ? 'org' : 'global' };
}
```

## Deduplication

Fingerprint = `hash(email + organization_id)`

Same visitor returning updates existing lead record (upsert on fingerprint). The `is_repeat_visit` flag from RB2B confirms this is a returning visitor.

## Authentication

RB2B doesn't support custom headers. Include auth in URL query params:
```
https://hooks.example.com/e/rb2b?org_key=xxx
```

Or use Hookdeck's source verification.
