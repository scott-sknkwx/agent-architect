# Schema Evolution: Object Types, Inngest-First Webhooks, and Function Patterns

## Status: READY FOR IMPLEMENTATION

**Created:** 2026-01-30
**Triggered by:** Manifest validation failure when running agent-factory CLI
**Blocking:** Cannot generate kringle product until schema is updated

---

## Problem Statement

Running the agent-factory CLI on the kringle manifest produces 24 validation errors:

```
npx tsx ~/agent-factory/src/cli.ts init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  ...

Manifest validation failed:
  events.definitions.0.payload.raw.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.0.payload.headers.type: Invalid option: expected one of "string"|"number"|"boolean"
  webhooks.0.path: Invalid input: expected string, received undefined
  webhooks.0.auth: Invalid option: expected one of "hmac"|"api_key"|"bearer"|"none"
  webhooks.0.transform: Invalid input: expected string, received undefined
  functions.0.pattern: Invalid option: expected one of "simple"|"fan-in"|"cron"|"routing"
  ... (24 errors total)
```

The manifest uses patterns that the schema doesn't yet support.

---

## Root Cause Analysis

### Schema Files Location

There are **two copies** of the schema that must stay in sync:

| File | Purpose |
|------|---------|
| `agent-architect/context/manifest-schema.ts` | Documentation/reference for Agent Architect |
| `agent-factory/src/manifest/schema.ts` | **Actual validation** (this is what failed) |

Both files are nearly identical. The agent-factory copy is authoritative for validation.

### Three Categories of Missing Support

#### 1. Event Payload Object Types

**Current schema (line 22-28 in both files):**
```typescript
const EventFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),  // Missing "object"
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
```

**Manifest usage:**
```yaml
- name: webhook/rb2b.received
  payload:
    raw:
      type: object          # ❌ Not valid
      required: true
    headers:
      type: object          # ❌ Not valid
      required: true
    received_at:
      type: string
      required: true
```

**Why this exists:** Webhook payloads contain raw JSON from external services (RB2B, Clay, Resend). These are opaque objects that get passed through to Inngest functions for processing.

#### 2. Inngest-First Webhook Pattern

**Current schema (lines 148-166):**
```typescript
const WebhookSchema = z.object({
  name: z.string(),
  path: z.string(),                                    // Required
  auth: z.enum(["hmac", "api_key", "bearer", "none"]), // Required
  secret: z.string().optional(),
  emits: z.string(),
  transform: z.string(),                               // Required
  description: z.string().optional(),
  handler: WebhookHandlerSchema.optional(),
});
```

**Manifest usage:**
```yaml
- name: rb2b-inbound
  routing: inngest-first                    # ❌ Not in schema
  hookdeck:                                 # ❌ Not in schema
    source: "RB2B"
    destination_port: 8288
    path: "/e/rb2b"
    transformation: "hookdeck/transformations/rb2b.js"
  emits: "webhook/rb2b.received"
  description: "RB2B visitor data routed directly to Inngest via Hookdeck"
  notes:                                    # ❌ Not in schema
    - "Hookdeck transforms raw payload into Inngest event format"
    - "No API route needed - Inngest receives event directly"
```

**Why this exists:** The "inngest-first" pattern routes external webhooks directly to Inngest via Hookdeck transformation, bypassing Next.js API routes entirely. This provides:
- Better observability (full trace from first byte in Inngest dashboard)
- No custom API route code to maintain
- Hookdeck handles retries, rate limiting, transformation

#### 3. Inngest-First-Webhook Function Pattern

**Current schema (lines 216-228):**
```typescript
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing"]),  // Missing "inngest-first-webhook"
  trigger: z.union([...]),
  emits: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  context: z.string().optional(),
  open_questions: z.array(z.string()).optional(),
});
```

**Manifest usage:**
```yaml
- name: ingest-rb2b-webhook
  description: "Validates RB2B payload, resolves org, checks suppression, upserts lead"
  pattern: inngest-first-webhook            # ❌ Not valid
  trigger:
    event: webhook/rb2b.received
  emits:
    - lead.ingested
  steps:                                     # ❌ Not in schema (uses "actions" currently)
    - name: validate
      action: "Parse and validate RB2B payload against schema"
      on_failure: "NonRetriableError - don't retry invalid payloads"
      notes:
        - "RB2B field names have spaces and title case"
        - "Required fields: LinkedIn URL, First Name, Captured URL..."
    - name: lookup-org
      action: "Extract domain from 'Captured URL', match against organizations.domain"
      on_failure: "NonRetriableError - unknown org, log and discard"
    # ... more steps
  config:                                    # ❌ Not in schema
    retries: 3
    timeout: "30s"
  schema: "schemas/rb2b-webhook.ts"          # ❌ Not in schema
```

**Why this exists:** The `inngest-first-webhook` pattern is a specialized function that:
- Receives pre-transformed events from Hookdeck→Inngest
- Has structured `steps` with `on_failure` handling (not just `actions`)
- References a validation schema
- Has retry/timeout configuration

---

## Generator Impact Analysis

### Files That Generate Code From Schema

| Generator | Location | What It Generates |
|-----------|----------|-------------------|
| `generateEventSchemas` | `agent-factory/src/commands/init.ts:1247-1276` | `schemas/events.ts` |
| `generateWebhookHandler` | `agent-factory/src/generators/webhook.ts` | `app/api/webhooks/*/route.ts` |
| `generateFunction` | `agent-factory/src/generators/function.ts` | `inngest/functions/*.ts` |
| Template | `agent-factory/templates/function.hbs` | Function code via Handlebars |
| Template | `agent-factory/templates/webhook-handler.hbs` | Webhook handler code |

### Generator Changes Required

#### 1. Event Schema Generator (`init.ts:1247-1276`)

**Current code:**
```typescript
type PayloadFieldDef = {
  type: "string" | "number" | "boolean";  // Missing "object"
  // ...
};

function generateEventSchemas(manifest: Manifest): string {
  for (const [key, def] of Object.entries(event.payload)) {
    let zodType = `z.${def.type}()`;  // Works for primitives only
    // ...
  }
}
```

**Required change:**
```typescript
type PayloadFieldDef = {
  type: "string" | "number" | "boolean" | "object";
  // ...
};

// In generateEventSchemas:
let zodType: string;
if (def.type === "object") {
  zodType = `z.record(z.string(), z.unknown())`;
} else {
  zodType = `z.${def.type}()`;
}
```

#### 2. Webhook Processing (`init.ts:261-278`)

**Current behavior:**
```typescript
if (manifest.webhooks && manifest.webhooks.length > 0) {
  for (const webhook of manifest.webhooks) {
    if (webhook.handler) {  // Only generates if handler exists
      // Generate API route
    }
  }
}
```

**Required change:** Inngest-first webhooks don't have `handler` - they have `hookdeck`. Options:
- Skip API route generation for inngest-first (current behavior already does this - fine)
- Optionally generate Hookdeck transformation files (nice-to-have, not required)

#### 3. Function Template (`templates/function.hbs`)

**Current patterns handled:**
- `simple` (lines 93-135)
- `fan-in` (lines 136-205)
- `fan-out` (lines 206-266)
- `cron` (lines 267-315)
- `routing` (lines 316-379)

**Required addition:** New `{{#if (eq pattern "inngest-first-webhook")}}` section that:
- Uses `steps` array instead of `actions`
- Generates step.run() calls with proper names
- Includes NonRetriableError handling for validation failures
- References the `schema` field for import

---

## Recommended Schema Changes

### Decision: No Backwards Compatibility Required

Per user confirmation, we can use a **clean discriminated union** where all webhooks must specify their routing type. This is simpler and more explicit.

### 1. EventFieldSchema

```typescript
const EventFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object"]),
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),  // Add for documentation
});
```

**TypeScript mapping:**
- `string` → `z.string()`
- `number` → `z.number()`
- `boolean` → `z.boolean()`
- `object` → `z.record(z.string(), z.unknown())`

### 2. WebhookSchema (Discriminated Union)

```typescript
/**
 * Traditional webhook: Next.js API route handles request
 */
const TraditionalWebhookSchema = z.object({
  name: z.string(),
  routing: z.literal("traditional"),
  path: z.string(),
  auth: z.enum(["hmac", "api_key", "bearer", "none"]),
  secret: z.string().optional(),
  emits: z.string(),
  transform: z.string(),
  description: z.string().optional(),
  handler: WebhookHandlerSchema.optional(),
});

/**
 * Hookdeck configuration for inngest-first webhooks
 */
const HookdeckConfigSchema = z.object({
  source: z.string().describe("Hookdeck source name, e.g., 'RB2B'"),
  destination_port: z.number().describe("Local Inngest dev server port, typically 8288"),
  path: z.string().describe("Inngest event path, e.g., '/e/rb2b'"),
  transformation: z.string().describe("Path to Hookdeck transformation file"),
});

/**
 * Inngest-first webhook: Hookdeck routes directly to Inngest
 */
const InngestFirstWebhookSchema = z.object({
  name: z.string(),
  routing: z.literal("inngest-first"),
  hookdeck: HookdeckConfigSchema,
  emits: z.string(),
  description: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

/**
 * Webhook definition - discriminated on "routing" field
 */
const WebhookSchema = z.discriminatedUnion("routing", [
  TraditionalWebhookSchema,
  InngestFirstWebhookSchema,
]);
```

### 3. FunctionSchema

```typescript
/**
 * Step definition for inngest-first-webhook functions
 */
const FunctionStepSchema = z.object({
  name: z.string().describe("Step identifier, e.g., 'validate', 'lookup-org'"),
  action: z.string().describe("Human-readable description of what this step does"),
  on_failure: z.string().optional().describe("Error handling strategy"),
  notes: z.array(z.string()).optional().describe("Implementation notes"),
});

/**
 * Function configuration for retry/timeout
 */
const FunctionConfigSchema = z.object({
  retries: z.number().optional().default(3),
  timeout: z.string().optional().default("30s"),
});

/**
 * Non-agentic function schema
 * Supports 5 patterns: simple, fan-in, cron, routing, inngest-first-webhook
 */
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing", "inngest-first-webhook"]),
  trigger: z.union([
    RoutingTriggerSchema,
    FanInTriggerSchema,
    CronTriggerSchema,
    SimpleTriggerSchema,
  ]),
  emits: z.array(z.string()).optional(),

  // For simple, fan-in, cron, routing patterns
  actions: z.array(z.string()).optional(),

  // For inngest-first-webhook pattern
  steps: z.array(FunctionStepSchema).optional(),
  config: FunctionConfigSchema.optional(),
  schema: z.string().optional().describe("Path to validation schema file"),

  // Common fields
  integrations: z.array(z.string()).optional(),
  context: z.string().optional(),
  open_questions: z.array(z.string()).optional(),
});
```

---

## Implementation Checklist

### Phase 1: Schema Updates

- [ ] **agent-factory/src/manifest/schema.ts**
  - [ ] Add `"object"` to `EventFieldSchema.type` enum
  - [ ] Add `description` field to `EventFieldSchema`
  - [ ] Create `HookdeckConfigSchema`
  - [ ] Create `TraditionalWebhookSchema` with `routing: z.literal("traditional")`
  - [ ] Create `InngestFirstWebhookSchema` with `routing: z.literal("inngest-first")`
  - [ ] Update `WebhookSchema` to use `z.discriminatedUnion("routing", [...])`
  - [ ] Add `"inngest-first-webhook"` to `FunctionSchema.pattern` enum
  - [ ] Create `FunctionStepSchema`
  - [ ] Create `FunctionConfigSchema`
  - [ ] Add `steps`, `config`, `schema` fields to `FunctionSchema`
  - [ ] Export new types: `TraditionalWebhook`, `InngestFirstWebhook`, `FunctionStep`, `FunctionConfig`, `HookdeckConfig`

- [ ] **agent-architect/context/manifest-schema.ts**
  - [ ] Apply identical changes to keep in sync

### Phase 2: Generator Updates

- [ ] **agent-factory/src/commands/init.ts**
  - [ ] Update `PayloadFieldDef` type to include `"object"`
  - [ ] Update `generateEventSchemas` to handle `type: "object"` → `z.record(z.string(), z.unknown())`
  - [ ] Update webhook processing loop to handle both routing types
  - [ ] (Optional) Add Hookdeck config file generation for inngest-first webhooks

- [ ] **agent-factory/templates/function.hbs**
  - [ ] Add `{{#if (eq pattern "inngest-first-webhook")}}` section
  - [ ] Generate step.run() calls from `steps` array
  - [ ] Include NonRetriableError import and usage
  - [ ] Reference `schema` field for payload validation

- [ ] **agent-factory/src/generators/function.ts**
  - [ ] Pass `steps`, `config`, `schema` to template context

### Phase 3: Manifest Migration

- [ ] **agent-architect/workspace/kringle/manifest.yaml**
  - [ ] Add `routing: traditional` to any traditional webhooks (if any exist)
  - [ ] Verify inngest-first webhooks already have `routing: inngest-first`

### Phase 4: Validation

- [ ] Run `npx tsx ~/agent-factory/src/cli.ts init --manifest ... --dry-run` to verify validation passes
- [ ] Generate kringle project successfully
- [ ] Verify generated code compiles (`npm run typecheck`)

---

## File Locations Quick Reference

```
agent-architect/
├── context/
│   └── manifest-schema.ts          # Schema copy (keep in sync)
├── workspace/
│   └── kringle/
│       └── manifest.yaml           # Failing manifest
└── plans/
    └── schema-evolution/
        └── README.md               # This file

agent-factory/
├── src/
│   ├── manifest/
│   │   └── schema.ts               # PRIMARY schema (validation happens here)
│   ├── commands/
│   │   └── init.ts                 # Event schema generator, webhook loop
│   └── generators/
│       ├── function.ts             # Function generator
│       └── webhook.ts              # Webhook handler generator
└── templates/
    ├── function.hbs                # Function template (needs new pattern)
    └── webhook-handler.hbs         # Webhook handler template
```

---

## Open Questions

1. **Hookdeck config generation:** Should agent-factory generate `hookdeck/transformations/*.js` files, or are these manually authored? The manifest references them but they're not generated.

2. **Schema file generation:** The manifest references `schema: "schemas/rb2b-webhook.ts"` for validation. Should agent-factory generate stub schemas for these, or are they manually authored in agent-architect workspace?

3. **Type exports:** Should the new types (`InngestFirstWebhook`, `FunctionStep`, etc.) be exported from agent-factory for consumers to use?

---

## Appendix: Full Error Output

```
Manifest validation failed:

  events.definitions.0.payload.raw.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.0.payload.headers.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.2.payload.raw.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.2.payload.headers.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.3.payload.raw.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.3.payload.headers.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.4.payload.raw.type: Invalid option: expected one of "string"|"number"|"boolean"
  events.definitions.4.payload.headers.type: Invalid option: expected one of "string"|"number"|"boolean"
  webhooks.0.path: Invalid input: expected string, received undefined
  webhooks.0.auth: Invalid option: expected one of "hmac"|"api_key"|"bearer"|"none"
  webhooks.0.transform: Invalid input: expected string, received undefined
  webhooks.1.path: Invalid input: expected string, received undefined
  webhooks.1.auth: Invalid option: expected one of "hmac"|"api_key"|"bearer"|"none"
  webhooks.1.transform: Invalid input: expected string, received undefined
  webhooks.2.path: Invalid input: expected string, received undefined
  webhooks.2.auth: Invalid option: expected one of "hmac"|"api_key"|"bearer"|"none"
  webhooks.2.transform: Invalid input: expected string, received undefined
  webhooks.3.path: Invalid input: expected string, received undefined
  webhooks.3.auth: Invalid option: expected one of "hmac"|"api_key"|"bearer"|"none"
  webhooks.3.transform: Invalid input: expected string, received undefined
  functions.0.pattern: Invalid option: expected one of "simple"|"fan-in"|"cron"|"routing"
  functions.2.pattern: Invalid option: expected one of "simple"|"fan-in"|"cron"|"routing"
  functions.3.pattern: Invalid option: expected one of "simple"|"fan-in"|"cron"|"routing"
  functions.4.pattern: Invalid option: expected one of "simple"|"fan-in"|"cron"|"routing"
```
