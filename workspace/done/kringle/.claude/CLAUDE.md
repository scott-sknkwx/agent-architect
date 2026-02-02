# Kringle

Lead-gifting platform that converts anonymous website visitors into sales opportunities through Educational Email Experiences (EEX).

## Architecture Overview

```
RB2B (visitor ID) → Hookdeck → Inngest → Enrichment → Persona Matching → Campaign Setup → Approval → Autonomous Execution
```

**Core flow:**
1. Anonymous visitor identified by RB2B
2. Enriched via Clay + Firecrawl
3. Matched to buyer persona by AI agent
4. Campaign drafted (4 wrapper emails by agent + 5 EEX emails from templates)
5. Human approves bundle ONCE
6. Autonomous execution: reach-out → EEX sequence → post-EEX → meeting

**Key patterns:**
- **Inngest-first webhooks**: All external webhooks route through Inngest before processing
- **Dual-scope suppression**: Org-level (opt-outs) vs global (hard bounces)
- **Single approval touchpoint**: Human reviews everything once, then autonomous
- **Executor model**: 🤖 Agents, 👤 Humans, ⚙️ Automated functions

## Tech Stack

| Layer | Technology |
|-------|------------|
| Event orchestration | Inngest |
| Database | Supabase (Postgres + RLS) |
| Storage | Supabase Storage |
| Email | Resend |
| Webhooks | Hookdeck → Inngest |
| AI Agents | Claude via Agent SDK |

## Directory Structure

```
src/
├── inngest/
│   ├── client.ts           # Inngest client setup
│   ├── functions/          # All Inngest functions
│   └── events.ts           # Event type definitions
├── lib/
│   ├── supabase.ts         # Database client
│   └── resend.ts           # Email client
├── agents/                 # Agent configurations
└── schemas/                # Zod schemas
```

## Skills Reference

| Skill | When to Use |
|-------|-------------|
| `/add-inngest-function` | Creating a new Inngest function |
| `/add-webhook-source` | Adding a new external webhook integration |
| `/extend-database` | Adding tables, migrations, or RLS policies |
| `/event-flow` | Understanding or extending event flows |

## Key Documentation

| Doc | Purpose |
|-----|---------|
| `docs/rb2b-webhook.md` | RB2B payload reference |
| `docs/webhook-routing.md` | Inngest-first pattern |
| `docs/inngest-patterns.md` | Step functions, retries, delays |
| `docs/executor-model-pattern.md` | 🤖/👤/⚙️ executor types |
| `docs/resend.md` | Email sending patterns |
| `docs/supabase.md` | Database patterns |
| `docs/agent-sdk-docs/` | Full Agent SDK reference |

## Conventions

**Event naming:**
- `webhook/{source}.received` - Raw external webhooks
- `kringle/{entity}.{action}` - Internal domain events
- Examples: `webhook/rb2b.received`, `kringle/lead.matched`, `kringle/email.sent`

**Function naming:**
- `ingest-{source}-webhook` - Webhook ingestion functions
- `handle-{event}` - Event handlers
- `{verb}-{noun}` - Action functions (e.g., `send-email`, `create-campaign`)

**Step naming within functions:**
- Use descriptive names: `validate`, `lookup-org`, `check-suppression`, `upsert-lead`, `emit-ingested`
- Steps are retried independently - keep them atomic
