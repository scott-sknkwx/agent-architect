# RB2B

Website visitor identification. Turns anonymous traffic into leads.

## When Agent Architect Uses This

- Understanding inbound webhook format
- What data is available at lead.received

## Webhook Payload
```json
{
  "email": "person@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "title": "VP Engineering",
  "company": "Acme Corp",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "page_url": "https://yoursite.com/pricing",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Key Fields

| Field | Reliability | Notes |
|-------|-------------|-------|
| email | High | Primary identifier |
| company | High | From email domain or enrichment |
| title | Medium | May be stale |
| linkedin_url | Medium | Not always present |
| page_url | High | What page they visited |

## Agent Patterns

### Webhook → Event
```
RB2B webhook → /api/webhooks/rb2b → lead.received event
```

## TODO: Add More

- [ ] Signature verification
- [ ] Rate limits
- [ ] Deduplication patterns
