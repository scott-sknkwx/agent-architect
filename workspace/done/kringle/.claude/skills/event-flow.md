# Event Flow

Understand and extend event flows in the system.

## When to Use

- Tracing how data flows through the system
- Adding new events to an existing flow
- Understanding what triggers what
- Debugging event chains

## Event Naming Conventions

**External webhooks:**
```
webhook/{source}.received
```
Examples: `webhook/rb2b.received`, `webhook/resend.received`, `webhook/clay.received`

**Domain events:**
```
kringle/{entity}.{action}
```
Examples: `kringle/lead.ingested`, `kringle/campaign.approved`, `kringle/email.sent`

**Internal routing events:**
```
{service}/{entity}.{action}
```
Examples: `resend/event.received`, `clay/enrichment.completed`

## Core Flows

### Lead Ingestion Flow
```
webhook/rb2b.received
    ↓ ingest-rb2b-webhook
lead.ingested
    ↓ start-enrichment
enrichment.started
    ↓ request-clay (parallel)
    ↓ request-firecrawl (parallel)
clay/enrichment.completed + lead.scraped
    ↓ consolidate-enrichment (fan-in)
lead.enriched
    ↓ start-matching
matching.started
    ↓ persona-matcher (agent)
lead.matched
    ↓ ...continues to campaign setup
```

### Email Response Flow
```
webhook/resend-inbound.received
    ↓ ingest-resend-inbound-webhook
email.replied
    ↓ response-triager (agent)
triage.completed
    ↓ (routes based on classification)
response.accept_gift → eex.started
response.request_meeting → meeting.requested
response.opt_out → lead.terminated + suppression added
response.unclear → lead.escalated
```

### Suppression Flow
```
response.opt_out
    ↓ handle-opt-out
    → INSERT suppressions (scope='organization')
    → UPDATE leads SET suppressed=true
    → EMIT lead.terminated

email.bounced (permanent)
    ↓ handle-bounce
    → INSERT suppressions (scope='global', org_id=NULL)
    → UPDATE leads SET suppressed=true
    → EMIT lead.terminated
```

## Finding Events

**Event type definitions:**
```
src/inngest/events.ts
```

**Functions that emit events:**
```bash
# Find all sendEvent calls
grep -r "sendEvent" src/inngest/functions/
```

**Functions that trigger on events:**
```bash
# Find all event triggers
grep -r "event:" src/inngest/functions/
```

## Adding to a Flow

### 1. Identify Insertion Point

Find where in the flow your new logic belongs:
- After which event should it trigger?
- What event should it emit?

### 2. Create or Modify Function

**Option A: New function in the chain**
```typescript
// Triggers on existing event, emits new event
export const newStep = inngest.createFunction(
  { id: 'new-step' },
  { event: 'kringle/entity.previous-action' },
  async ({ event, step }) => {
    // Your logic
    await step.sendEvent('emit-next', {
      name: 'kringle/entity.next-action',
      data: { ... },
    });
  }
);
```

**Option B: Add step to existing function**
```typescript
// Add a new step within an existing function
const extraResult = await step.run('extra-processing', async () => {
  // New logic
});
```

### 3. Update Event Types

Add new events to `src/inngest/events.ts`:

```typescript
export type Events = {
  // ... existing
  'kringle/entity.next-action': {
    data: {
      entity_id: string;
      organization_id: string;
      trace_id: string;
      // New fields
    };
  };
};
```

## Tracing Events

### In Inngest Dashboard

1. Go to Inngest dashboard
2. Find the function run
3. View step-by-step execution
4. See emitted events and downstream triggers

### With trace_id

All events should include `trace_id` for correlation:

```typescript
await step.sendEvent('emit', {
  name: 'kringle/lead.processed',
  data: {
    lead_id: '...',
    trace_id: event.data.trace_id,  // Pass through from upstream
  },
});
```

Query logs/events by trace_id to see full journey.

## Common Patterns

**Fan-out (one event triggers multiple):**
```typescript
// Single function emits multiple events
await step.sendEvent('fan-out', [
  { name: 'kringle/notification.email', data: { ... } },
  { name: 'kringle/notification.slack', data: { ... } },
]);
```

**Fan-in (wait for multiple events):**
```typescript
// Use Inngest's waitForEvent
const [clayResult, scrapeResult] = await Promise.all([
  step.waitForEvent('wait-clay', {
    event: 'clay/enrichment.completed',
    match: 'data.lead_id',
    timeout: '30m',
  }),
  step.waitForEvent('wait-scrape', {
    event: 'lead.scraped',
    match: 'data.lead_id',
    timeout: '30m',
  }),
]);
```

**Conditional branching:**
```typescript
if (result.classification === 'accept_gift') {
  await step.sendEvent('route-accept', {
    name: 'response.accept_gift',
    data: { ... },
  });
} else if (result.classification === 'opt_out') {
  await step.sendEvent('route-opt-out', {
    name: 'response.opt_out',
    data: { ... },
  });
}
```

## Checklist

- [ ] Event names follow conventions (webhook/ or kringle/)
- [ ] trace_id passed through entire flow
- [ ] Event types defined in events.ts
- [ ] Triggering function(s) identified
- [ ] Downstream handlers exist for emitted events
- [ ] No orphaned events (emitted but never handled)
