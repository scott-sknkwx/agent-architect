# Add Webhook Source

Add a new external webhook integration following the Inngest-first pattern.

## When to Use

- Integrating a new external service that sends webhooks
- Adding a callback endpoint for an API you're calling
- Any external data that arrives via HTTP POST

## The Pattern

```
External Service → Hookdeck (transform) → /e/{source} → Inngest → Your Function
```

**Why Inngest-first:**
- Automatic retries on failure
- Full event history and replay
- Observability from first byte
- No silent failures

See `docs/webhook-routing.md` for detailed rationale.

## Process

### 1. Configure Hookdeck

In Hookdeck dashboard, create:

**Source:** Name it after the service (e.g., `Stripe`, `Calendly`)

**Destination:**
- Port: `8288` (Inngest)
- Path: `/e/{source-name}` (e.g., `/e/stripe`)

**Transformation:** Wrap payload in Inngest event format:

```javascript
addHandler('transform', (request, context) => {
  return {
    ...request,
    body: {
      name: 'webhook/{source}.received',  // e.g., 'webhook/stripe.received'
      data: {
        raw: request.body,
        headers: request.headers,
        received_at: new Date().toISOString()
      }
    }
  };
});
```

### 2. Define the Event Type

Add to `src/inngest/events.ts`:

```typescript
export type Events = {
  // ... existing events
  'webhook/{source}.received': {
    data: {
      raw: Record<string, unknown>;
      headers: Record<string, string>;
      received_at: string;
    };
  };
};
```

### 3. Create the Ingestion Function

Follow the pattern from `ingest-rb2b-webhook.ts`:

```typescript
// src/inngest/functions/ingest-{source}-webhook.ts
import { inngest } from '../client';
import { NonRetriableError } from 'inngest';
import { z } from 'zod';

// Define schema for the raw payload
const sourcePayloadSchema = z.object({
  // Fields from the external service
});

export const ingestSourceWebhook = inngest.createFunction(
  {
    id: 'ingest-{source}-webhook',
    retries: 3,
  },
  { event: 'webhook/{source}.received' },
  async ({ event, step }) => {
    // 1. Validate payload
    const payload = await step.run('validate', () => {
      const parsed = sourcePayloadSchema.safeParse(event.data.raw);
      if (!parsed.success) {
        throw new NonRetriableError(`Invalid payload: ${parsed.error.message}`);
      }
      return parsed.data;
    });

    // 2. Lookup organization (if applicable)
    const org = await step.run('lookup-org', async () => {
      // Your org lookup logic
      // Throw NonRetriableError if unknown org
    });

    // 3. Process the webhook
    const result = await step.run('process', async () => {
      // Your business logic
    });

    // 4. Emit domain event
    await step.sendEvent('emit-processed', {
      name: 'kringle/{entity}.{action}',  // e.g., 'kringle/payment.received'
      data: {
        organization_id: org.id,
        trace_id: crypto.randomUUID(),
        // ... relevant data
      },
    });

    return { success: true };
  }
);
```

### 4. Register the Function

Add to `src/inngest/functions/index.ts` and the serve handler.

### 5. Document the Integration

Add a doc file `docs/{source}-webhook.md` with:
- Payload format
- Field reference
- Any special handling notes

Use `docs/rb2b-webhook.md` as a template.

## Suppression Check (If Applicable)

If the webhook involves contacts/leads, include suppression check:

```typescript
const suppressed = await step.run('check-suppression', async () => {
  // Check org-level
  const orgSuppressed = await supabase
    .from('suppressions')
    .select('id')
    .eq('organization_id', org.id)
    .eq('email', payload.email)
    .eq('scope', 'organization')
    .maybeSingle();

  // Check global (hard bounces)
  const globalSuppressed = await supabase
    .from('suppressions')
    .select('id')
    .eq('email', payload.email)
    .eq('scope', 'global')
    .maybeSingle();

  return !!(orgSuppressed?.data || globalSuppressed?.data);
});

if (suppressed) {
  return { success: false, reason: 'suppressed' };
}
```

## Checklist

- [ ] Hookdeck source created
- [ ] Hookdeck destination points to Inngest (port 8288)
- [ ] Hookdeck transformation wraps in Inngest event format
- [ ] Event type added to `events.ts`
- [ ] Ingestion function created with proper steps
- [ ] Function registered in index and serve handler
- [ ] Documentation added to `docs/`
- [ ] Suppression check included (if contact-related)

## Local Development

Run Hookdeck CLI:
```bash
hookdeck listen 8288 {Source-Name}
```

Or for multiple sources:
```bash
hookdeck listen 8288 RB2B,Clay-Enrichment,Resend-Webhooks,{New-Source}
```
