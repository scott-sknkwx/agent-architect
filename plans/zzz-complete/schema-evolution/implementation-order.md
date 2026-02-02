# Implementation Order: Schema Evolution

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ Complete | Schema Updates (agent-factory) |
| 2 | ✅ Complete | Generator Updates (agent-factory) |
| 3 | ✅ Complete | Template Updates (agent-factory) |
| 4 | ✅ Complete | Sync Reference Schema (agent-architect) |
| 5 | ✅ Complete | Test & Validate |

### Phase 5 Results
- ✅ 5.1 Schema typecheck passes
- ✅ 5.2 Manifest validation passes (dry-run)
- ✅ 5.3 Project generation succeeds
- ✅ 5.4 Event schemas compile correctly
- ⚠️ Pre-existing template issues remain (agent SDK imports, output types) - not in scope

---

## Overview

Extend the manifest schema to support:
1. **Object types** in event payloads (for webhook raw data)
2. **Inngest-first webhook routing** (Hookdeck → Inngest, bypassing API routes)
3. **`inngest-first-webhook` function pattern** (structured steps with error handling)

This spans **two repos** with a specific dependency order.

## Repository Responsibilities

| Repo | Owns | Role |
|------|------|------|
| **agent-factory** | Schema, templates, generators | The code generator (source of truth) |
| **agent-architect** | Schema reference, manifests, plans | The design tool (syncs from agent-factory) |

---

## Implementation Order

### Phase 1: agent-factory - Schema Updates
**Location**: `/Users/scottstrang/agent-factory/src/manifest/schema.ts`
**Effort**: ~45 min

#### 1.1 Add `"object"` to EventFieldSchema

```typescript
// Line ~22-28: Update EventFieldSchema
const EventFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean", "object"]),  // Add "object"
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),  // Add for documentation
});
```

#### 1.2 Create Hookdeck Config Schema

```typescript
// Add after WebhookHandlerSchema (~line 155)

/**
 * Hookdeck configuration for inngest-first webhooks
 */
const HookdeckConfigSchema = z.object({
  source: z.string().describe("Hookdeck source name, e.g., 'RB2B'"),
  destination_port: z.number().describe("Local Inngest dev server port, typically 8288"),
  path: z.string().describe("Inngest event path, e.g., '/e/rb2b'"),
  transformation: z.string().describe("Path to Hookdeck transformation file"),
});
```

#### 1.3 Create Discriminated Union for Webhooks

```typescript
// Replace current WebhookSchema with discriminated union

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

#### 1.4 Add `inngest-first-webhook` Function Pattern

```typescript
// Add after FunctionSchema trigger union (~line 216)

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

// Update FunctionSchema pattern enum and add new fields
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing", "inngest-first-webhook"]),  // Add pattern
  trigger: z.union([RoutingTriggerSchema, FanInTriggerSchema, CronTriggerSchema, SimpleTriggerSchema]),
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

#### 1.5 Export New Types

```typescript
// Add to exports section (~line 450+)
export type TraditionalWebhook = z.infer<typeof TraditionalWebhookSchema>;
export type InngestFirstWebhook = z.infer<typeof InngestFirstWebhookSchema>;
export type HookdeckConfig = z.infer<typeof HookdeckConfigSchema>;
export type FunctionStep = z.infer<typeof FunctionStepSchema>;
export type FunctionConfig = z.infer<typeof FunctionConfigSchema>;
```

---

### Phase 2: agent-factory - Generator Updates
**Location**: `/Users/scottstrang/agent-factory/src/commands/init.ts`
**Effort**: ~30 min

#### 2.1 Update PayloadFieldDef Type

```typescript
// Line ~1239-1245: Update type definition
type PayloadFieldDef = {
  type: "string" | "number" | "boolean" | "object";  // Add "object"
  required?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
  description?: string;  // Add for documentation
};
```

#### 2.2 Update generateEventSchemas Function

```typescript
// Line ~1247-1276: Handle object type in Zod generation
function generateEventSchemas(manifest: Manifest): string {
  let code = `import { z } from "zod";\n\n`;

  for (const event of manifest.events.definitions) {
    const schemaName = pascalCase(event.name.replace(/\./g, "-")) + "EventSchema";

    code += `export const ${schemaName} = z.object({\n`;
    for (const [key, def] of Object.entries(event.payload) as [string, PayloadFieldDef][]) {
      let zodType: string;

      // Handle object type specially
      if (def.type === "object") {
        zodType = `z.record(z.string(), z.unknown())`;
      } else if (def.enum) {
        zodType = `z.enum([${def.enum.map(e => `"${e}"`).join(", ")}])`;
      } else {
        zodType = `z.${def.type}()`;
      }

      if (def.min !== undefined) zodType += `.min(${def.min})`;
      if (def.max !== undefined) zodType += `.max(${def.max})`;
      if (!def.required) zodType += `.optional()`;
      code += `  ${key}: ${zodType},\n`;
    }
    code += `});\n\n`;
  }
  // ... rest of function
}
```

#### 2.3 Update Webhook Processing Loop

```typescript
// Line ~261-278: Handle both webhook routing types
if (manifest.webhooks && manifest.webhooks.length > 0) {
  console.log(chalk.gray(`  → app/api/webhooks/ (${manifest.webhooks.length} webhook handlers)`));

  for (const webhook of manifest.webhooks) {
    // Only generate handler for traditional webhooks with handler config
    if (webhook.routing === "traditional" && webhook.handler) {
      log.verbose(`    → ${webhook.path}/route.ts`);
      const webhookDir = join(projectDir, "app/api/webhooks", webhook.path);
      if (!dryRun) {
        mkdirSync(webhookDir, { recursive: true });
      }
      writeFile(
        join(webhookDir, "route.ts"),
        generateWebhookHandler(webhook, manifest)
      );
    } else if (webhook.routing === "inngest-first") {
      // Inngest-first webhooks don't need API routes
      log.verbose(`    → ${webhook.name} (inngest-first, no route needed)`);
    }
  }
}
```

#### 2.4 Update generateFunction Call (Pass New Fields)

```typescript
// In src/generators/function.ts: Ensure steps, config, schema are passed to template
export function generateFunction(func: Function, manifest: Manifest): string {
  const template = loadTemplate("function.hbs");

  return template({
    ...func,
    namespace: manifest.events.namespace,
    generatedAt: new Date().toISOString(),
    // Existing fields already passed: trigger, actions, emits, etc.
    // New fields: steps, config, schema (already in func object)
  });
}
```

---

### Phase 3: agent-factory - Template Updates
**Location**: `/Users/scottstrang/agent-factory/templates/function.hbs`
**Effort**: ~40 min

#### 3.1 Add inngest-first-webhook Pattern Block

Add after the routing pattern section (~line 379):

```handlebars
{{#if (eq pattern "inngest-first-webhook")}}
export const {{camelCase name}}Function = inngest.createFunction(
  {
    id: "{{name}}",
{{#if config}}
    retries: {{#if config.retries}}{{config.retries}}{{else}}3{{/if}},
{{/if}}
  },
  { event: "{{namespace}}/{{trigger.event}}" },

  async ({ event, step }) => {
    const traceId = event.data.trace_id ?? crypto.randomUUID();

    logger.info("function.started", {
      traceId,
      function: "{{name}}",
      pattern: "inngest-first-webhook",
    });

{{#if schema}}
    // ═══════════════════════════════════════════════════════════════════════
    // VALIDATION SCHEMA
    // Import: import { {{pascalCase name}}PayloadSchema } from "../../schemas/{{schema}}";
    // ═══════════════════════════════════════════════════════════════════════
{{/if}}

    // ═══════════════════════════════════════════════════════════════════════
    // STEPS
    // ═══════════════════════════════════════════════════════════════════════
{{#each steps}}

    // STEP: {{this.name}}
    // {{this.action}}
{{#if this.on_failure}}
    // On failure: {{this.on_failure}}
{{/if}}
{{#if this.notes}}
    // Notes:
{{#each this.notes}}
    //   - {{this}}
{{/each}}
{{/if}}
    const {{camelCase this.name}}Result = await step.run("{{this.name}}", async () => {
      // TODO: Implement {{this.action}}
{{#if this.on_failure}}
{{#if (contains this.on_failure "NonRetriableError")}}
      // import { NonRetriableError } from "inngest";
      // throw new NonRetriableError("Validation failed: ...");
{{/if}}
{{/if}}
      throw new Error("DRAFT: Step '{{this.name}}' not implemented");
    });

{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{#if emits}}
    // ═══════════════════════════════════════════════════════════════════════
    // EMIT EVENTS
    // ═══════════════════════════════════════════════════════════════════════
{{#each emits}}
    //
    // await step.sendEvent("emit-{{kebabCase this}}", {
    //   name: "{{../namespace}}/{{this}}",
    //   data: { /* result from steps */ }
    // });
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{/if}}
    throw new Error("DRAFT: {{name}} not yet implemented");
  }
);
{{/if}}
```

#### 3.2 Add Handlebars Helper: `contains`

In `src/generators/function.ts`, add helper:

```typescript
Handlebars.registerHelper("contains", function(str: string, substr: string) {
  return str && str.includes(substr);
});
```

---

### Phase 4: agent-architect - Sync Reference Schema
**Location**: `/Users/scottstrang/agent-architect/context/manifest-schema.ts`
**Effort**: ~15 min

Apply identical changes from Phase 1:

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
- [ ] Export new types

**Note**: This is a reference copy for Agent Architect. The agent-factory schema is the source of truth for validation.

---

### Phase 5: Test & Validate
**Effort**: ~20 min

#### 5.1 Validate Schema Changes

```bash
# In agent-factory
cd /Users/scottstrang/agent-factory
npm run typecheck
```

#### 5.2 Test Manifest Validation

```bash
cd /Users/scottstrang/agent-architect/workspace/kringle
npx tsx ../../../agent-factory/src/cli.ts init --manifest manifest.yaml --dry-run
```

**Expected**:
- No validation errors
- All 24 previous errors resolved

#### 5.3 Generate Project

```bash
cd /Users/scottstrang/agent-architect/workspace/kringle
npx tsx ../../../agent-factory/src/cli.ts init --manifest manifest.yaml --output ./generated
```

#### 5.4 Verify Generated Code

```bash
cd /Users/scottstrang/agent-architect/workspace/kringle/generated
npm install
npm run typecheck
```

**Verify**:
- [ ] Event schemas include `z.record()` for object types
- [ ] Inngest-first webhooks don't generate API routes
- [ ] `inngest-first-webhook` functions have step structure
- [ ] Functions index exports all functions
- [ ] No TypeScript errors

---

## Files to Modify Summary

### agent-factory (DO FIRST)
| File | Action |
|------|--------|
| `src/manifest/schema.ts` | Add object type, webhook union, function pattern |
| `src/commands/init.ts` | Update PayloadFieldDef, event schema gen, webhook loop |
| `src/generators/function.ts` | Add `contains` helper |
| `templates/function.hbs` | Add `inngest-first-webhook` pattern block |

### agent-architect (DO SECOND)
| File | Action |
|------|--------|
| `context/manifest-schema.ts` | Sync with agent-factory schema |

---

## Design Decisions

### 1. Discriminated Union for Webhooks (No Backwards Compatibility)

Per schema-evo.md: "No backwards compatibility required. All webhooks must specify their routing type."

**Rationale**: Clean discriminated union is simpler, more explicit, and type-safe. Existing manifests will fail validation until updated with `routing: traditional` or `routing: inngest-first`.

### 2. Object Type Maps to `z.record(z.string(), z.unknown())`

For webhook raw payloads that are opaque JSON blobs passed through to Inngest functions for processing.

### 3. Steps vs Actions

- `actions` - Free-text descriptions for simple/fan-in/cron/routing patterns
- `steps` - Structured definitions with name/action/on_failure/notes for inngest-first-webhook

This keeps backwards compatibility with existing patterns while adding structure for the new pattern.

### 4. NonRetriableError Integration

The template generates commented hints for `NonRetriableError` when `on_failure` contains that keyword, helping developers remember the Inngest error handling pattern.

---

## Open Questions (Deferred)

1. **Hookdeck transformation file generation**: Not implemented. These are manually authored and checked into the project.

2. **Validation schema file generation**: Not implemented. The `schema` field references files that are manually authored.

3. **Hookdeck CLI integration**: Future enhancement - could generate Hookdeck source/destination configs.
