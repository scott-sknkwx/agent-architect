# Hookdeck

Webhook infrastructure. Receives, queues, retries, delivers webhooks.

## When Agent Architect Uses This

- Buffering external webhooks before they hit your app
- Replay failed deliveries
- Audit trail of all inbound webhooks

## Architecture Position

**Preferred: Inngest-First** (see `webhook-routing.md` for full details)
```
External Service → Hookdeck → /e/{source} → Inngest → Your Functions
```

This gives you durability, observability, and retries from the first byte. Use Hookdeck transformations to wrap raw webhooks in Inngest event format.

**Legacy: API Route First** (only when needed)
```
External Service → Hookdeck → /api/webhooks/{service} → Your Code → inngest.send()
```

Only use this pattern when:
- Synchronous response required in webhook body
- Signature validation must return 401/403
- Large payloads exceed Inngest limits

## Why Use It

1. **Durability**: Hookdeck receives even if your app is down
2. **Retries**: Automatic retry with backoff
3. **Replay**: Re-deliver any webhook from dashboard
4. **Logging**: Full audit trail

## Agent Patterns

### Two Layers of Durability
```
Hookdeck = durability BEFORE your code
Inngest = durability AFTER your code emits

Lost webhook = impossible
```

## Related

- **`webhook-routing.md`**: Complete guide to Inngest-first webhook routing
