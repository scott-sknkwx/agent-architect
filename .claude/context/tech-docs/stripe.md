# Stripe

Payments infrastructure. Subscriptions, invoices, billing.

## When Agent Architect Uses This

- Billing for agent-powered products
- Usage-based pricing
- Customer subscription management

## Core Concepts

| Concept | Description |
|---------|-------------|
| Customer | Billable entity (your customer) |
| Subscription | Recurring billing |
| Invoice | Bill for a period |
| Usage Record | Metered billing events |
| Webhook | Events from Stripe |

## Basic Operations
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create customer
const customer = await stripe.customers.create({
  email: 'customer@company.com',
  metadata: { org_id: 'org_123' },
});

// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: 'price_xxx' }],
});
```

## Usage-Based Billing

For agent products with per-lead or per-action pricing:
```typescript
// Report usage
await stripe.subscriptionItems.createUsageRecord(
  'si_xxx',  // subscription item ID
  {
    quantity: 1,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment',
  }
);
```

## Webhooks

Key events to handle:

| Event | Use Case |
|-------|----------|
| `customer.subscription.created` | Provision access |
| `customer.subscription.deleted` | Revoke access |
| `invoice.payment_succeeded` | Confirm billing |
| `invoice.payment_failed` | Handle failed payment |
```typescript
// Webhook handler
app.post('/api/webhooks/stripe', async (req, res) => {
  const event = stripe.webhooks.constructEvent(
    req.body,
    req.headers['stripe-signature'],
    process.env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case 'invoice.payment_failed':
      // Pause agent processing for this org
      await inngest.send({
        name: 'billing/payment.failed',
        data: { org_id: event.data.object.customer },
      });
      break;
  }
});
```

## Agent Patterns

### Per-Lead Billing
```
lead.qualified → increment usage
    ↓
Stripe aggregates at end of billing period
    ↓
Customer invoiced automatically
```

### Gated by Plan
```typescript
// Check before expensive operations
const sub = await stripe.subscriptions.retrieve(org.subscription_id);
const plan = sub.items.data[0].price.lookup_key;

if (plan === 'starter' && leadsThisMonth > 100) {
  throw new Error('Plan limit reached');
}
```

### Billing Events in Pipeline
```
lead.received
    ↓
(process normally)
    ↓
lead.qualified → emit billing/lead.qualified
    ↓
Billing agent: stripe.subscriptionItems.createUsageRecord()
```

## Limits

- API rate: 100 requests/second
- Webhook timeout: 30 seconds

## TODO: Add More

- [ ] Checkout session for onboarding
- [ ] Customer portal
- [ ] Proration handling
- [ ] Multi-currency
