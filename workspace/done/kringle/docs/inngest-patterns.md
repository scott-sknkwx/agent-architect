# Inngest Patterns

Event-driven orchestration layer. Handles durability, retries, and scheduling.

## Event Naming

```
{namespace}/{entity}.{action}

Examples:
- kringle/lead.received
- kringle/lead.matched
- kringle/approval.requested
- webhook/rb2b.received (for raw webhooks)
```

## Key Patterns

### Step Functions
```typescript
await step.run("step-name", async () => {
  // This is retried independently
});
```

### Delays
```typescript
await step.sleep("wait-3-days", "3 days");
// or
await inngest.send({ name: "event", delay: "3 days" });
```

### Concurrency Control
```typescript
inngest.createFunction(
  {
    id: "processor",
    concurrency: { limit: 5 }  // max 5 concurrent
  },
  ...
)
```

### Retries
```typescript
inngest.createFunction(
  {
    id: "processor",
    retries: 3  // retry up to 3 times on failure
  },
  ...
)
```

### Non-Retriable Errors

For errors that shouldn't be retried (invalid data, not found, etc.):

```typescript
import { NonRetriableError } from 'inngest';

await step.run('validate', () => {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new NonRetriableError('Invalid payload');
  }
  return parsed.data;
});
```

### Emitting Events from Steps

```typescript
await step.sendEvent('emit-lead-created', {
  name: 'lead.ingested',
  data: { lead_id, organization_id, trace_id }
});
```

## Limits

- Event payload max: 512KB
- Step output max: 4MB
- Function timeout: 2 hours (default)

## Related Docs

- `webhook-routing.md` - Inngest-first webhook architecture
- `rb2b-webhook.md` - RB2B payload reference and ingestion flow
