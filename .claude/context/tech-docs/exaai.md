# Exa AI

Semantic search API. Finds content based on meaning, not just keywords.

## When Agent Architect Uses This

- Finding relevant companies/people
- Research and discovery
- Finding similar content

## Search
```typescript
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

// Semantic search
const results = await exa.search('AI startups building developer tools', {
  numResults: 10,
  type: 'neural',  // semantic search
});

// Keyword search
const results = await exa.search('site:linkedin.com VP Engineering', {
  type: 'keyword',
});
```

## Search + Contents
```typescript
const results = await exa.searchAndContents(
  'companies using AI for sales automation',
  {
    numResults: 10,
    text: true,  // include page text
    highlights: true,  // relevant snippets
  }
);

// results.results[0].text = full page content
// results.results[0].highlights = relevant excerpts
```

## Find Similar
```typescript
const results = await exa.findSimilar('https://anthropic.com', {
  numResults: 10,
});

// Returns companies/pages similar to Anthropic
```

## Agent Patterns

### Prospect Discovery
```
Scout agent:
  1. exa.search("companies struggling with [problem you solve]")
  2. Filter by size, industry
  3. Emit prospect.discovered for each
```

### Podcast Guest Research
```
Researcher agent:
  1. exa.search("[guest name] interviews podcasts")
  2. exa.findSimilar(guest's company URL)
  3. Build context profile
```

### Competitive Intel
```
exa.findSimilar(competitor_url) → find their customers
exa.search("[competitor] case study") → find public wins
```

## Limits

- Results per search: up to 100
- Rate limits vary by plan
- Some content may be paywalled

## TODO: Add More

- [ ] Filtering by date
- [ ] Domain filtering
- [ ] Combining with Firecrawl for full content
