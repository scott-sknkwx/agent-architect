# Implementation Order: Non-Agentic Function Generation

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Done | Schema Extension |
| 2 | ✅ Done | Templates |
| 3 | ✅ Done | Generators |
| 4 | ✅ Done | Update Reference Schema (agent-architect) |
| 5 | ✅ Done | Update Kringle Manifest (agent-architect) |
| 6 | ⬚ | Test |

---

## Overview

Add support for generating non-agentic function scaffolds from manifest declarations. This spans **two repos** with a specific dependency order.

## Repository Responsibilities

| Repo | Owns | Role |
|------|------|------|
| **agent-factory** | Schema, templates, generators | The code generator |
| **agent-architect** | Schema reference, kringle manifest, plans | The design tool |

**Key insight**: agent-factory's schema is the source of truth. agent-architect's `context/manifest-schema.ts` is a reference copy.

---

## Implementation Order

### Phase 1: agent-factory - Schema Extension ✅
**Location**: `/Users/scottstrang/agent-factory/src/manifest/schema.ts`
**Status**: Complete (2025-01-29)

Added to existing schema:

```typescript
// Function trigger variants
const SimpleTriggerSchema = z.object({ event: z.string() });
const FanInTriggerSchema = z.object({
  primary: z.string(),
  wait_for: z.array(z.string()),
  correlation_key: z.string(),
  timeout: z.string().optional(),
});
const CronTriggerSchema = z.object({
  cron: z.string(),
  schedule: z.string(),
});
const RoutingTriggerSchema = z.object({
  event: z.string(),
  route_on: z.string(),
  routes: z.record(z.string(), z.object({
    emit: z.string(),
    then: z.string().optional(),
  })),
  default_route: z.string().optional(),
});

// Function schema
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing"]),
  trigger: z.union([SimpleTriggerSchema, FanInTriggerSchema, CronTriggerSchema, RoutingTriggerSchema]),
  emits: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  context: z.string().optional(),
  open_questions: z.array(z.string()).optional(),
});

// Webhook handler extension
const WebhookHandlerSchema = z.object({
  validation: z.array(z.string()).optional(),
  transform: z.array(z.string()).optional(),
});
// Add handler field to existing WebhookSchema
```

Update ManifestSchema to include `functions: z.array(FunctionSchema).optional()`

**Exported types added**: `Function`, `SimpleTrigger`, `FanInTrigger`, `CronTrigger`, `RoutingTrigger`, `WebhookHandler`

---

### Phase 2: agent-factory - Templates ✅
**Location**: `/Users/scottstrang/agent-factory/templates/`
**Status**: Complete (2025-01-29)

Created three new templates:

1. **`function.hbs`** - Scaffold for non-agentic functions (all 4 patterns: simple, fan-in, cron, routing)
2. **`webhook-handler.hbs`** - HTTP route handler with auth (hmac, api_key, bearer, none), validation, transform
3. **`functions-index.hbs`** - Export file combining agents and functions for Inngest route

---

### Phase 3: agent-factory - Generators ✅
**Location**: `/Users/scottstrang/agent-factory/src/`
**Status**: Complete (2025-01-29)

**Files created/modified:**

1. `src/generators/function.ts` - Compiles function.hbs with Handlebars helpers (eq, splitLines, kebabCase)
2. `src/generators/webhook.ts` - Compiles webhook-handler.hbs with constantCase helper
3. `src/generators/functions-index.ts` - Compiles functions-index.hbs combining agents + functions
4. `src/commands/init.ts` - Added generation loops for functions, webhook handlers, and functions index

**Changes to init.ts:**
- Added imports for new generators
- Added NON-AGENTIC FUNCTIONS section (generates function scaffolds)
- Added WEBHOOK HANDLERS section (generates route handlers for webhooks with handler config)
- Added FUNCTIONS INDEX section (generates centralized export)
- Updated `generateInngestRoute()` to use centralized functions index

**Note**: Validation (src/manifest/validate.ts) deferred as optional per plan

---

### Phase 4: agent-architect - Update Reference Schema ✅
**Location**: `/Users/scottstrang/agent-architect/context/manifest-schema.ts`
**Status**: Complete (2025-01-29)

Synced with agent-factory's updated schema. Changes:

1. **Added WebhookHandlerSchema** - validation and transform step arrays
2. **Added `handler` field** to WebhookSchema
3. **Added function trigger schemas**:
   - `SimpleTriggerSchema` - single event trigger
   - `FanInTriggerSchema` - primary + wait_for with correlation
   - `CronTriggerSchema` - cron expression + schedule description
   - `RoutingTriggerSchema` - event with route_on and routes map
4. **Added FunctionSchema** - 4 patterns: simple, fan-in, cron, routing
5. **Added `functions` field** to ManifestSchema
6. **Added type exports**: `WebhookHandler`, `Function`, `SimpleTrigger`, `FanInTrigger`, `CronTrigger`, `RoutingTrigger`, `Actor`, `AccessPolicy`

---

### Phase 5: agent-architect - Update Kringle Manifest ✅
**Location**: `/Users/scottstrang/agent-architect/workspace/done/kringle/manifest.yaml`
**Status**: Complete (2025-01-29)

Added `functions:` section with 17 non-agentic functions:

**Enrichment (3)**:
- `request-clay` (simple) - POST to Clay via Hookdeck
- `request-firecrawl` (simple) - Scrape company homepage
- `consolidate-enrichment` (fan-in) - Merge Clay + Firecrawl data

**Campaign (2)**:
- `create-campaign` (simple) - Create campaign from persona match
- `request-approval` (simple) - Create approval after draft

**Email (1)**:
- `send-on-approval` (simple) - Send via Resend after approval

**Routing (4)**:
- `route-triage` (routing) - Route by classification to handlers
- `handle-accept-gift` (simple) - Start EEX sequence
- `handle-meeting` (simple) - Handle meeting requests
- `handle-snooze` (simple) - Handle delayed/snooze

**Cron (3)**:
- `check-pending-approvals` (cron) - Every 4 hours
- `process-snoozed-leads` (cron) - Daily at 9am
- `check-response-timeouts` (cron) - Every 30 minutes

**Lifecycle (3)**:
- `terminate-lead` (simple) - Negative outcome
- `archive-lead` (simple) - Neutral outcome (no match)
- `convert-lead` (simple) - Positive outcome (meeting booked)

**Analytics (1)**:
- `aggregate-journey` (simple) - Compute journey stats

Updated `webhooks:` section with handler definitions:
- `rb2b-inbound` - Added validation (HMAC, required fields) + transform steps
- `clay-enrichment-callback` - Added validation + transform steps
- `resend-delivery-status` - Added validation (Svix) + transform steps
- `resend-inbound` (NEW) - Handles inbound email replies → email.replied

---

### Phase 6: Test
```bash
cd /Users/scottstrang/agent-architect/workspace/done/kringle
npx tsx ../../../agent-factory/src/cli.ts init --manifest manifest.yaml --dry-run
```

Verify:
- [ ] Function scaffolds generated in `inngest/functions/`
- [ ] Webhook handlers generated in `app/api/webhooks/`
- [ ] Functions index exports all functions
- [ ] No schema validation errors
- [ ] Warnings shown for undefined events (if any)

---

## Files to Modify Summary

### agent-factory (DO FIRST)
| File | Action | Status |
|------|--------|--------|
| `src/manifest/schema.ts` | Add FunctionSchema, extend WebhookSchema | ✅ |
| `src/commands/init.ts` | Add function/webhook generation loops | ✅ |
| `src/generators/function.ts` | Create new | ✅ |
| `src/generators/webhook.ts` | Create new | ✅ |
| `src/generators/functions-index.ts` | Create new | ✅ |
| `src/manifest/validate.ts` | Create new (optional) | ⏭️ deferred |
| `templates/function.hbs` | Create new | ✅ |
| `templates/webhook-handler.hbs` | Create new | ✅ |
| `templates/functions-index.hbs` | Create new | ✅ |

### agent-architect (DO SECOND)
| File | Action | Status |
|------|--------|--------|
| `context/manifest-schema.ts` | Sync with agent-factory | ✅ |
| `workspace/done/kringle/manifest.yaml` | Add functions + update webhooks | ✅ |

---

## Design Decisions (documented in manifest-extension-plan.md)

1. **Scaffolds, not transpilation** - Actions are free-text, not a DSL
2. **Cron for timeouts** - No delayed events, cron polling handles cancellation
3. **Parallel via multiple simple functions** - No fan-out pattern needed
4. **Validation as warnings** - Don't block generation for missing event refs
