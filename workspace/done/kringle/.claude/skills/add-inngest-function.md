# Add Inngest Function

Create a new Inngest function following established project patterns.

## When to Use

- Adding a new event handler
- Creating a new webhook ingestion function
- Adding automation logic triggered by events

## Process

### 1. Identify the Pattern

Look at existing functions in `src/inngest/functions/` to find a similar pattern:

| Pattern | Example | Use When |
|---------|---------|----------|
| Webhook ingestion | `ingest-rb2b-webhook.ts` | Processing external webhooks |
| Simple handler | `handle-opt-out.ts` | Single action in response to event |
| Multi-step | `create-campaign.ts` | Sequential operations with retries |
| Routing | `route-resend-event.ts` | Dispatching to different handlers |

### 2. Create the Function File

```typescript
// src/inngest/functions/{function-name}.ts
import { inngest } from '../client';
import { NonRetriableError } from 'inngest';

export const functionName = inngest.createFunction(
  {
    id: 'function-name',  // kebab-case, unique
    retries: 3,
  },
  { event: 'kringle/entity.action' },  // or 'webhook/source.received'
  async ({ event, step }) => {
    // Step 1: Validate
    const validated = await step.run('validate', async () => {
      // Validation logic
      // Throw NonRetriableError for bad data
      if (!event.data.required_field) {
        throw new NonRetriableError('Missing required field');
      }
      return event.data;
    });

    // Step 2: Business logic
    const result = await step.run('process', async () => {
      // Your logic here
      // This step retries independently on failure
    });

    // Step 3: Emit downstream event
    await step.sendEvent('emit-result', {
      name: 'kringle/entity.completed',
      data: {
        // Include trace_id for observability
        trace_id: event.data.trace_id,
        // Your payload
      },
    });

    return { success: true };
  }
);
```

### 3. Register the Function

Add to `src/inngest/functions/index.ts`:

```typescript
export { functionName } from './function-name';
```

And to the Inngest serve handler (usually in `app/api/inngest/route.ts`):

```typescript
import { functionName } from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // ... existing functions
    functionName,
  ],
});
```

### 4. Add Event Types

If introducing a new event, add to `src/inngest/events.ts`:

```typescript
export type Events = {
  // ... existing events
  'kringle/entity.action': {
    data: {
      entity_id: string;
      organization_id: string;
      trace_id: string;
    };
  };
};
```

## Step Patterns

**Validation step:**
```typescript
await step.run('validate', () => {
  const parsed = schema.safeParse(event.data);
  if (!parsed.success) {
    throw new NonRetriableError(`Invalid payload: ${parsed.error.message}`);
  }
  return parsed.data;
});
```

**Database operation step:**
```typescript
await step.run('upsert-record', async () => {
  const { data, error } = await supabase
    .from('table')
    .upsert({ ... })
    .select()
    .single();

  if (error) throw error;  // Will retry
  return data;
});
```

**Conditional emit:**
```typescript
if (result.shouldNotify) {
  await step.sendEvent('emit-notification', {
    name: 'kringle/notification.requested',
    data: { ... },
  });
}
```

## Checklist

- [ ] Function ID is unique and kebab-case
- [ ] Event trigger matches existing naming convention
- [ ] Steps have descriptive names
- [ ] NonRetriableError used for bad data (won't retry)
- [ ] Regular errors for transient failures (will retry)
- [ ] trace_id passed through for observability
- [ ] Function registered in index and serve handler
- [ ] Event types added if new events introduced
