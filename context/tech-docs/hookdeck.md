# Hookdeck

Webhook infrastructure. Receives, queues, retries, delivers webhooks.

## When Agent Architect Uses This

- Buffering external webhooks before they hit your app
- Replay failed deliveries
- Audit trail of all inbound webhooks

## Architecture Position
```
External Service → Hookdeck → Your App → Inngest
     (RB2B)        (buffer)   (transform)  (orchestrate)
```

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

## TODO: Add More

- [ ] API for programmatic replay
- [ ] Filtering rules
- [ ] Signature verification config
