# Honcho

AI memory and personalization layer. Persistent user context across sessions.

## When Agent Architect Uses This

- Maintaining memory across conversations
- User preference learning
- Personalization over time

## Core Concepts

| Concept | Description |
|---------|-------------|
| App | Your application |
| User | End user with persistent memory |
| Session | Single conversation |
| Message | Individual exchange |
| Metamessage | Derived insights/memories |

## Basic Usage
```typescript
import { Honcho } from 'honcho-ai';

const honcho = new Honcho({ apiKey: process.env.HONCHO_API_KEY });

// Get or create user
const user = await honcho.apps.users.getOrCreate('app_id', {
  name: 'user_123',
});

// Create session
const session = await honcho.apps.users.sessions.create(
  'app_id',
  user.id,
  {}
);

// Add message
await honcho.apps.users.sessions.messages.create(
  'app_id',
  user.id,
  session.id,
  {
    role: 'user',
    content: 'I prefer detailed technical explanations',
  }
);
```

## Metamessages (Derived Memory)
```typescript
// Store learned fact about user
await honcho.apps.users.sessions.metamessages.create(
  'app_id',
  user.id,
  session.id,
  {
    metamessageType: 'preference',
    content: 'User prefers technical depth over simplicity',
  }
);

// Query memories
const memories = await honcho.apps.users.sessions.metamessages.list(
  'app_id',
  user.id,
  session.id,
  { metamessageType: 'preference' }
);
```

## Agent Patterns

### Personalized Outbound
```
Before writing email to repeat prospect:
1. Query Honcho for past interactions
2. Get their preferences, past objections
3. Tailor message accordingly
```

### Learning Agent
```
After each interaction:
1. Extract insights (what they liked, objected to)
2. Store as metamessages
3. Future agents query this context
```

### Cross-Session Context
```
Session 1: User mentions budget constraints
    → Store: "budget_sensitive: true"

Session 2: Different agent retrieves this
    → Adjusts recommendations accordingly
```

## Limits

- Storage limits vary by plan
- Query complexity limits

## TODO: Add More

- [ ] Dialectic API for reflection
- [ ] Bulk memory operations
- [ ] Memory expiration
