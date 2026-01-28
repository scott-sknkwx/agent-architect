# Merge

Unified API for integrations. One API to access CRM, ATS, HRIS, etc.

## When Agent Architect Uses This

- Connecting to customer's CRM (HubSpot, Salesforce, Pipedrive)
- Syncing with HR systems
- Accessing various tools through one interface

## Categories

| Category | Systems |
|----------|---------|
| CRM | HubSpot, Salesforce, Pipedrive, Close |
| ATS | Greenhouse, Lever, Workday |
| HRIS | BambooHR, Gusto, Rippling |
| Accounting | QuickBooks, Xero, NetSuite |
| Ticketing | Zendesk, Intercom, Freshdesk |

## Basic Usage
```typescript
import { MergeClient } from '@mergeapi/merge-node-client';

const merge = new MergeClient({
  apiKey: process.env.MERGE_API_KEY,
  accountToken: customerAccountToken,  // per-customer
});

// List contacts (works across all CRMs)
const contacts = await merge.crm.contacts.list();

// Create contact
await merge.crm.contacts.create({
  model: {
    firstName: 'John',
    lastName: 'Doe',
    emailAddresses: [{ emailAddress: 'john@example.com' }],
  },
});
```

## Unified Data Model

Merge normalizes data across platforms:
```typescript
// Same code works for HubSpot, Salesforce, etc.
const deals = await merge.crm.opportunities.list();

// deal.name, deal.amount, deal.stage - consistent fields
```

## Agent Patterns

### CRM Sync
```
lead.qualified → Pipeline agent
    ↓
    merge.crm.contacts.create()
    merge.crm.opportunities.create()
    ↓
opportunity.created
```

### Multi-Tenant
Each customer links their own CRM via Merge Link.
Your agent uses their `accountToken` to access their data.
```typescript
// Customer A uses HubSpot
// Customer B uses Salesforce
// Same code works for both
```

## Limits

- Rate limits per integration
- Some fields may not map perfectly
- Sync frequency varies

## TODO: Add More

- [ ] Merge Link setup flow
- [ ] Webhook subscriptions
- [ ] Field mapping customization
