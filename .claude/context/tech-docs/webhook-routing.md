# Inngest-First Webhook Routing

Route all external webhooks through Inngest's event API before any processing. This ensures durability, observability, and retry logic from the first byte.

## The Pattern

```
External Service → Hookdeck → /e/{source-name} → Inngest → Your Functions
```

Instead of:
```
External Service → Hookdeck → /api/webhooks/{service} → Your Code → inngest.send()
```

## Why Inngest-First

| Concern | API Route First | Inngest First |
|---------|-----------------|---------------|
| Retries on failure | Depends on sender | ✅ Automatic |
| Event history | ❌ Lost if not logged | ✅ Built-in |
| Replay failed events | ❌ Manual | ✅ One click |
| Observability | Scattered logs | ✅ Dashboard |
| Rate limiting | DIY | ✅ Built-in |
| Concurrency control | DIY | ✅ Built-in |
| Code runs if webhook received | ❌ Can fail silently | ✅ Guaranteed |

## Implementation

### 1. Hookdeck Configuration

Create a source for each external service, all routing to Inngest:

| Source | Destination Port | Path |
|--------|------------------|------|
| RB2B | 8288 | `/e/rb2b` |
| Clay-Enrichment | 8288 | `/e/clay` |
| Resend-Webhooks | 8288 | `/e/resend` |

The path after `/e/` is the event key—use descriptive names for logging clarity, but functionally any value works in local dev.

### 2. Hookdeck Transformations

Use Hookdeck transformations to wrap the raw webhook in Inngest's event format:

```javascript
// Hookdeck transformation for RB2B webhooks
addHandler('transform', (request, context) => {
  return {
    ...request,
    body: {
      name: 'webhook/rb2b.received',
      data: {
        raw: request.body,
        headers: request.headers,
        received_at: new Date().toISOString()
      }
    }
  };
});
```

This transforms the raw webhook payload into Inngest's expected format:
```json
{
  "name": "webhook/rb2b.received",
  "data": { "raw": { ... }, "headers": { ... } }
}
```

### 3. Inngest Function

```typescript
export const handleRb2bWebhook = inngest.createFunction(
  {
    id: 'webhook-rb2b-received',
    retries: 3
  },
  { event: 'webhook/rb2b.received' },
  async ({ event, step }) => {
    // Validate
    const payload = await step.run('validate', () => {
      const parsed = rb2bSchema.safeParse(event.data.raw);
      if (!parsed.success) {
        throw new NonRetriableError('Invalid payload');
      }
      return parsed.data;
    });

    // Process
    await step.run('process', async () => {
      // Your logic here—with automatic retries
    });

    // Emit downstream events
    await step.sendEvent('emit-lead-created', {
      name: 'lead/created',
      data: { /* ... */ }
    });
  }
);
```

### 4. Local Development

Run Hookdeck CLI pointing all webhook sources to Inngest:

```bash
# All webhooks go to Inngest on port 8288
hookdeck listen 8288 RB2B,Clay-Enrichment,Resend-Webhooks
```

## When NOT to Use Inngest-First

### 1. Synchronous Response Required

Some services expect data in the response body:

```
Service: POST /webhook → expects { "status": "processed", "id": "123" }
```

Inngest immediately returns `{ "ids": ["..."], "status": 200 }`, so you can't customize the response.

**Workaround:** Use an API route that responds synchronously, then sends to Inngest:

```typescript
// app/api/webhooks/special/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  // Send to Inngest (fire and forget)
  await inngest.send({ name: 'webhook/special.received', data: body });

  // Return expected response
  return Response.json({ status: 'processed', id: body.id });
}
```

### 2. Signature Validation with Rejection

If you need to return 401/403 for invalid signatures so the sender knows to stop retrying:

```typescript
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  try {
    stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response('Invalid signature', { status: 401 });
  }

  await inngest.send({ name: 'webhook/stripe.received', data: JSON.parse(body) });
  return new Response('OK', { status: 200 });
}
```

**Note:** Often you can just validate in Inngest and ignore invalid events—the sender will retry a few times then give up. Only use API-first if the sender's retry behavior is problematic.

### 3. Large Payloads

Inngest has event size limits. For large payloads (file uploads, large data dumps):

```typescript
// app/api/webhooks/large-payload/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  // Store payload in Supabase/S3
  const { id } = await supabase.from('webhook_payloads').insert(body).select('id').single();

  // Send reference to Inngest
  await inngest.send({
    name: 'webhook/large.received',
    data: { payload_id: id }  // Reference, not full payload
  });

  return new Response('OK');
}
```

## Event Naming Convention

Use a consistent naming pattern for webhook events:

```
webhook/{source}.{action}
```

Examples:
- `webhook/rb2b.received`
- `webhook/clay.enrichment-complete`
- `webhook/resend.delivered`
- `webhook/resend.bounced`

## Migration Path

If you have existing API routes handling webhooks:

1. **Create Inngest functions** that handle the new event
2. **Update Hookdeck** to route to `/e/{source}` with transformation
3. **Keep API route temporarily** for any direct integrations
4. **Remove API route** once all traffic flows through Inngest

## Summary

Default to Inngest-first for webhooks. The durability, observability, and retry guarantees outweigh the minor overhead. Only route through API routes when you need synchronous responses or signature rejection at the HTTP level.
