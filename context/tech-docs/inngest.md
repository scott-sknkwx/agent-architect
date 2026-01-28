# Inngest

Event-driven orchestration layer. Handles durability, retries, and scheduling.

## When Agent Architect Uses This

- Designing event flows between agents
- Deciding retry/timeout strategies
- Implementing delays and scheduling
- Fan-out/fan-in patterns

## Event Naming
```
{namespace}/{entity}.{action}

Examples:
- kringle/lead.received
- kringle/lead.matched
- kringle/approval.requested
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

## Limits

- Event payload max: 512KB
- Step output max: 4MB
- Function timeout: 2 hours (default)

## TODO: Add More

- [ ] Rate limiting patterns
- [ ] Batch processing
- [ ] Cancellation
- [ ] Prioritization
