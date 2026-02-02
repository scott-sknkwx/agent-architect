# Parallel

AI browser automation. Agents that can browse, click, fill forms.

## When Agent Architect Uses This

- Automating web tasks that require interaction
- Filling forms, clicking buttons
- Tasks that can't be done via API

## Basic Usage
```typescript
import { Parallel } from 'parallel-ai';

const parallel = new Parallel({ apiKey: process.env.PARALLEL_API_KEY });

const result = await parallel.run({
  task: 'Go to LinkedIn, search for "VP Engineering at Acme Corp", and extract their profile information',
  url: 'https://linkedin.com',
});
```

## Structured Extraction
```typescript
const result = await parallel.run({
  task: 'Find the pricing page and extract all plan names and prices',
  url: 'https://company.com',
  schema: {
    plans: [{
      name: 'string',
      price: 'string',
      features: ['string'],
    }],
  },
});
```

## Agent Patterns

### When to Use Parallel vs Firecrawl

| Use Firecrawl | Use Parallel |
|---------------|--------------|
| Static content | Dynamic/JS content |
| Public pages | Behind login |
| Bulk scraping | Interactive tasks |
| Structured extraction | Form filling |

### LinkedIn Research
```
Parallel: Log in, search, extract profile
(Firecrawl can't handle LinkedIn's auth/JS)
```

### Booking/Scheduling
```
Parallel: Navigate calendar, select time, fill form, submit
```

## Limits

- Session duration limits
- Rate limits vary by plan
- Some sites detect automation

## TODO: Add More

- [ ] Session persistence
- [ ] Screenshot capture
- [ ] Multi-step workflows
