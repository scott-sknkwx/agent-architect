# Implementation Order: Infrastructure Integrations

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ⬚ | Schema Extension - Typed Integrations (agent-factory) |
| 2 | ⬚ | Integration Usage Validation (agent-factory) |
| 3 | ⬚ | Update Reference Schema (agent-architect) |
| 4 | ⬚ | Update Kringle Manifest (agent-architect) |
| 5 | ⬚ | Test |

---

## Overview

Infrastructure integrations are hard-coded in the manifest schema. The schema only supports inngest, supabase, anthropic, and deployment. There's no way to declare external services like resend, hookdeck, clay, or firecrawl.

## Repository Responsibilities

| Repo | Owns | Role |
|------|------|------|
| **agent-factory** | Schema, validation | The code generator (source of truth) |
| **agent-architect** | Schema reference, kringle manifest | The design tool |

**Key insight**: agent-factory's schema is the source of truth. agent-architect's `context/manifest-schema.ts` is a reference copy.

---

## Design Decisions

### Decision 1: Typed Integration Schemas with Passthrough

**Choice**: Define explicit schemas for known integrations (resend, hookdeck, clay, firecrawl) while allowing unknown integrations via `.passthrough()`.

**Rationale**:
- Type safety for integrations we know we'll use
- IDE autocomplete for known integration fields
- Catches missing required fields (e.g., `resend.api_key`)
- Still extensible for future integrations without schema changes

**Implementation**: Use `z.object({...}).passthrough()` pattern.

### Decision 2: Warn on Undeclared Integration Usage

**Choice**: When generating function scaffolds, emit a warning if a function declares an integration that isn't in `infrastructure.integrations`.

**Rationale**:
- Surfaces configuration issues early
- Doesn't block generation during iterative development
- Developer can proceed knowing there's a gap to fill

**Implementation**: Add validation step in `init.ts` that cross-references `function.integrations` against `infrastructure.integrations`.

---

## Problem Statement

### Current State

```typescript
// agent-factory/src/manifest/schema.ts (lines 302-322)
infrastructure: z.object({
  inngest: z.object({...}),      // required
  supabase: z.object({...}),     // required
  anthropic: z.object({...}),    // required
  deployment: z.object({...}),   // required
  // No way to add resend, hookdeck, clay, etc.
})
```

### Known Integrations

Based on `context/tech-docs/`, these are all supported integrations:

| Integration | Purpose | Required Fields | Optional Fields |
|-------------|---------|-----------------|-----------------|
| assemblyai | Transcription | api_key | |
| clay | Lead enrichment | api_key | table_webhook_url, webhook_secret |
| exaai | Semantic search | api_key | |
| firecrawl | Web scraping | api_key | |
| honcho | AI memory layer | api_key | |
| hookdeck | Webhook routing | api_key | webhook_secret (for destination signing) |
| merge | Unified integrations | api_key | webhook_signing_key |
| parallel | Browser automation | api_key | |
| rb2b | Visitor identification | | webhook_secret (for custom validation) |
| resend | Email sending | api_key, webhook_secret | from_domain |
| stripe | Payments & billing | secret_key, webhook_secret | |

**Note**: `inngest` and `supabase` are core infrastructure, not integrations.

### Solution: Typed Integrations with Passthrough

```typescript
const IntegrationsSchema = z.object({
  // Transcription
  assemblyai: z.object({
    api_key: z.string(),
  }).optional(),

  // Lead enrichment
  clay: z.object({
    api_key: z.string(),
    table_webhook_url: z.string().optional(),
    webhook_secret: z.string().optional(),
  }).optional(),

  // Semantic search
  exaai: z.object({
    api_key: z.string(),
  }).optional(),

  // Web scraping
  firecrawl: z.object({
    api_key: z.string(),
  }).optional(),

  // AI memory layer
  honcho: z.object({
    api_key: z.string(),
  }).optional(),

  // Webhook routing (webhook_secret is for Hookdeck's destination signing)
  hookdeck: z.object({
    api_key: z.string(),
    webhook_secret: z.string().optional(),
  }).optional(),

  // Unified CRM/ATS/HRIS integrations
  merge: z.object({
    api_key: z.string(),
    webhook_signing_key: z.string().optional(),
  }).optional(),

  // Browser automation
  parallel: z.object({
    api_key: z.string(),
  }).optional(),

  // Visitor identification (inbound webhooks only, auth can be URL params)
  rb2b: z.object({
    webhook_secret: z.string().optional(),
  }).optional(),

  // Email sending
  resend: z.object({
    api_key: z.string(),
    webhook_secret: z.string(),
    from_domain: z.string().optional(),
  }).optional(),

  // Payments & billing
  stripe: z.object({
    secret_key: z.string(),
    webhook_secret: z.string(),
  }).optional(),

}).passthrough().optional();  // allows unknown integrations
```

---

## Implementation Order

### Phase 1: agent-factory - Typed Integration Schemas
**Location**: `/Users/scottstrang/agent-factory/src/manifest/schema.ts`
**Status**: Not started

Add typed integration schemas before the ManifestSchema (around line 290):

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Typed schemas for known integrations.
 * Uses .passthrough() to allow unknown integrations without schema changes.
 *
 * Source of truth: agent-architect/context/tech-docs/
 */

// Transcription
const AssemblyAIIntegrationSchema = z.object({
  api_key: z.string().describe("AssemblyAI API key for transcription"),
});

// Lead enrichment
const ClayIntegrationSchema = z.object({
  api_key: z.string().describe("Clay API key"),
  table_webhook_url: z.string().optional().describe("Webhook URL for Clay table"),
  webhook_secret: z.string().optional().describe("Secret for verifying Clay webhook signatures"),
});

// Semantic search
const ExaAIIntegrationSchema = z.object({
  api_key: z.string().describe("Exa AI API key for semantic search"),
});

// Web scraping
const FirecrawlIntegrationSchema = z.object({
  api_key: z.string().describe("Firecrawl API key"),
});

// AI memory layer
const HonchoIntegrationSchema = z.object({
  api_key: z.string().describe("Honcho API key for AI memory"),
});

// Webhook routing (webhook_secret is for Hookdeck's destination signing)
const HookdeckIntegrationSchema = z.object({
  api_key: z.string().describe("Hookdeck API key"),
  webhook_secret: z.string().optional().describe("Secret for verifying Hookdeck destination signatures"),
});

// Unified CRM/ATS/HRIS integrations
const MergeIntegrationSchema = z.object({
  api_key: z.string().describe("Merge API key for unified integrations"),
  webhook_signing_key: z.string().optional().describe("Key for verifying Merge webhook signatures"),
});

// Browser automation
const ParallelIntegrationSchema = z.object({
  api_key: z.string().describe("Parallel API key for browser automation"),
});

// Visitor identification (inbound webhooks only, auth can also be URL params)
const RB2BIntegrationSchema = z.object({
  webhook_secret: z.string().optional().describe("Secret for custom validation of RB2B webhooks"),
});

// Email sending
const ResendIntegrationSchema = z.object({
  api_key: z.string().describe("Resend API key"),
  webhook_secret: z.string().describe("Secret for verifying Resend webhook signatures"),
  from_domain: z.string().optional().describe("Domain for sending emails, e.g., 'mail.kringle.io'"),
});

// Payments & billing
const StripeIntegrationSchema = z.object({
  secret_key: z.string().describe("Stripe secret key"),
  webhook_secret: z.string().describe("Secret for verifying Stripe webhook signatures"),
});

const IntegrationsSchema = z.object({
  assemblyai: AssemblyAIIntegrationSchema.optional(),
  clay: ClayIntegrationSchema.optional(),
  exaai: ExaAIIntegrationSchema.optional(),
  firecrawl: FirecrawlIntegrationSchema.optional(),
  honcho: HonchoIntegrationSchema.optional(),
  hookdeck: HookdeckIntegrationSchema.optional(),
  merge: MergeIntegrationSchema.optional(),
  parallel: ParallelIntegrationSchema.optional(),
  rb2b: RB2BIntegrationSchema.optional(),
  resend: ResendIntegrationSchema.optional(),
  stripe: StripeIntegrationSchema.optional(),
}).passthrough().optional().describe("External service integrations");
```

Update infrastructure in ManifestSchema (around line 302):

```typescript
infrastructure: z.object({
  inngest: z.object({
    app_id: z.string(),
    signing_key: z.string(),
    event_key: z.string(),
  }),
  supabase: z.object({
    project_ref: z.string(),
    url: z.string(),
    anon_key: z.string(),
    service_key: z.string(),
  }),
  anthropic: z.object({
    api_key: z.string(),
    default_model: z.enum(["haiku", "sonnet", "opus"]),
  }),
  deployment: z.object({
    platform: z.enum(["vercel", "railway", "docker"]),
    region: z.string().optional(),
  }),
  integrations: IntegrationsSchema,  // NEW
}),
```

Export types:
```typescript
export type Integrations = z.infer<typeof IntegrationsSchema>;
export type AssemblyAIIntegration = z.infer<typeof AssemblyAIIntegrationSchema>;
export type ClayIntegration = z.infer<typeof ClayIntegrationSchema>;
export type ExaAIIntegration = z.infer<typeof ExaAIIntegrationSchema>;
export type FirecrawlIntegration = z.infer<typeof FirecrawlIntegrationSchema>;
export type HonchoIntegration = z.infer<typeof HonchoIntegrationSchema>;
export type HookdeckIntegration = z.infer<typeof HookdeckIntegrationSchema>;
export type MergeIntegration = z.infer<typeof MergeIntegrationSchema>;
export type ParallelIntegration = z.infer<typeof ParallelIntegrationSchema>;
export type RB2BIntegration = z.infer<typeof RB2BIntegrationSchema>;
export type ResendIntegration = z.infer<typeof ResendIntegrationSchema>;
export type StripeIntegration = z.infer<typeof StripeIntegrationSchema>;
```

---

### Phase 2: agent-factory - Integration Usage Validation
**Location**: `/Users/scottstrang/agent-factory/src/commands/init.ts`
**Status**: Not started

Add validation function that warns when functions reference undeclared integrations:

```typescript
function validateIntegrationUsage(manifest: Manifest): void {
  const declaredIntegrations = new Set(
    Object.keys(manifest.infrastructure.integrations || {})
  );

  for (const fn of manifest.functions || []) {
    for (const integration of fn.integrations || []) {
      if (!declaredIntegrations.has(integration)) {
        console.warn(
          `⚠️  Function '${fn.name}' uses integration '${integration}' ` +
          `but it's not declared in infrastructure.integrations`
        );
      }
    }
  }
}
```

Call this early in the `init` command, after parsing the manifest.

---

### Phase 3: agent-architect - Update Reference Schema
**Location**: `/Users/scottstrang/agent-architect/context/manifest-schema.ts`
**Status**: Not started

Sync with agent-factory's updated schema:
- Add `IntegrationsSchema` and individual integration schemas
- Add `integrations` field to infrastructure
- Add type exports

---

### Phase 4: agent-architect - Update Kringle Manifest
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/manifest.yaml`
**Status**: Not started

Add integrations section:

```yaml
infrastructure:
  inngest:
    app_id: "kringle"
    signing_key: "${INNGEST_SIGNING_KEY}"
    event_key: "${INNGEST_EVENT_KEY}"
  supabase:
    project_ref: "${SUPABASE_PROJECT_REF}"
    url: "${SUPABASE_URL}"
    anon_key: "${SUPABASE_ANON_KEY}"
    service_key: "${SUPABASE_SERVICE_KEY}"
  anthropic:
    api_key: "${ANTHROPIC_API_KEY}"
    default_model: "sonnet"
  deployment:
    platform: "vercel"
    region: "iad1"
  integrations:
    resend:
      api_key: "${RESEND_API_KEY}"
      webhook_secret: "${RESEND_WEBHOOK_SECRET}"
      from_domain: "${RESEND_FROM_DOMAIN}"
    hookdeck:
      api_key: "${HOOKDECK_API_KEY}"
      webhook_secret: "${HOOKDECK_WEBHOOK_SECRET}"
    clay:
      api_key: "${CLAY_API_KEY}"
      table_webhook_url: "${CLAY_TABLE_WEBHOOK_URL}"
    firecrawl:
      api_key: "${FIRECRAWL_API_KEY}"
```

---

### Phase 5: Test

```bash
# Validate schema changes work
cd /Users/scottstrang/agent-architect/workspace/kringle
npx tsx ../../../agent-factory/src/cli.ts init --manifest manifest.yaml --dry-run
```

Verify:
- [ ] No schema validation errors on `infrastructure.integrations`
- [ ] Typed integration fields validated (missing api_key throws)
- [ ] Warning emitted for functions using undeclared integrations
- [ ] Unknown integrations allowed via passthrough

---

## Files to Modify Summary

### agent-factory (DO FIRST)
| File | Action | Phase | Status |
|------|--------|-------|--------|
| `src/manifest/schema.ts` | Add typed integration schemas | 1 | ⬚ |
| `src/commands/init.ts` | Add integration usage validation | 2 | ⬚ |

### agent-architect (DO SECOND)
| File | Action | Phase | Status |
|------|--------|-------|--------|
| `context/manifest-schema.ts` | Sync with agent-factory | 3 | ⬚ |
| `workspace/kringle/manifest.yaml` | Add integrations section | 4 | ⬚ |

---

## Runtime Behavior

### Integration Validation (Build Time)
```
$ npx tsx agent-factory/src/cli.ts init --manifest manifest.yaml

⚠️  Function 'send-on-approval' uses integration 'resend' but it's not declared in infrastructure.integrations
⚠️  Function 'request-clay' uses integration 'clay' but it's not declared in infrastructure.integrations

✓ Generated 4 agent functions
✓ Generated 17 non-agentic functions
```

### Schema Validation
```
# If resend declared without api_key:
❌ infrastructure.integrations.resend.api_key: Required

# If unknown integration added:
✓ Passes (passthrough allows unknown keys)
```

---

## Maintenance

### Adding New Integrations

When adding support for a new integration:

1. Create `context/tech-docs/{integration}.md` with API patterns
2. Add typed schema to `agent-factory/src/manifest/schema.ts`
3. Add type export
4. Sync to `agent-architect/context/manifest-schema.ts`

The `.passthrough()` allows using integrations before they're typed, but typing them provides validation and IDE support.

---

## Verification Sources

Schema fields verified against official documentation (2026-01-29):

| Integration | Source | Notes |
|-------------|--------|-------|
| AssemblyAI | [AssemblyAI Docs](https://www.assemblyai.com/docs/api-reference/overview) | Authorization header with API key |
| Clay | [Clay University](https://university.clay.com/docs/http-api-integration-overview) | HTTP API + optional webhooks |
| Exa AI | [Exa Docs](https://docs.exa.ai/reference/exa-mcp) | EXA_API_KEY env var |
| Firecrawl | [Firecrawl Docs](https://docs.firecrawl.dev/api-reference/introduction) | Bearer token (fc-* prefix) |
| Honcho | [Honcho Docs](https://docs.honcho.dev/api-reference/endpoint/users/get-user) | Bearer token auth |
| Hookdeck | [Hookdeck Docs](https://hookdeck.com/docs/authentication) | API key + destination signing |
| Merge | [Merge Docs](https://docs.merge.dev/basics/authentication/) | Bearer token + webhook signing key |
| Parallel | [Parallel Docs](https://docs.parallel.ai/home) | x-api-key header |
| RB2B | [RB2B Support](https://support.rb2b.com/en/articles/8976614-setup-guide-webhook) | Inbound only, auth via URL params |
| Resend | [Resend Docs](https://resend.com/docs/api-reference/introduction) | API key + webhook signatures |
| Stripe | [Stripe Docs](https://docs.stripe.com/api/authentication) | Secret key + webhook signatures |

---

## Related Plans

- **Agent Output Schemas**: See `/plans/resend-schema/implementation-order.md` for output schema validation (depends on this plan for template updates)
