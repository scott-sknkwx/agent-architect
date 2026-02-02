# Firecrawl

Web scraping API. Turns URLs into clean markdown/structured data.

## When Agent Architect Uses This

- Scraping company websites for research
- Extracting content from pages
- Crawling entire sites

## Basic Scrape
```typescript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const result = await firecrawl.scrapeUrl('https://company.com/about', {
  formats: ['markdown', 'html'],
});

// result.markdown = clean markdown content
// result.html = raw HTML
// result.metadata = title, description, etc.
```

## Crawl Entire Site
```typescript
const crawl = await firecrawl.crawlUrl('https://company.com', {
  limit: 50,  // max pages
  scrapeOptions: {
    formats: ['markdown'],
  },
});

// crawl.data = array of page results
```

## Extract Structured Data
```typescript
const result = await firecrawl.scrapeUrl('https://company.com/about', {
  formats: ['extract'],
  extract: {
    schema: {
      company_name: { type: 'string' },
      founded: { type: 'string' },
      employee_count: { type: 'string' },
      description: { type: 'string' },
    },
  },
});

// result.extract = { company_name: "Acme", founded: "2020", ... }
```

## Agent Patterns

### Research Agent
```
prospect.identified → Researcher agent
    ↓
    Firecrawl company website
    Firecrawl LinkedIn page
    Firecrawl recent news
    ↓
prospect.researched (with context)
```

### Pre-Outbound Context
```
Before writing outbound email:
- Scrape prospect's company /about page
- Scrape recent blog posts
- Use as context for personalization
```

## Limits

- Rate limits vary by plan
- Some sites block scraping
- JavaScript rendering supported

## TODO: Add More

- [ ] Handling blocked sites
- [ ] Caching scraped content
- [ ] Map feature for site structure
