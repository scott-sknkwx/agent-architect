# Plan: Non-Agentic Function Generation for Agent Factory

## Executive Summary

The manifest currently only generates **agent functions** (Claude-powered Inngest functions). Between events, there are ~27 "plumbing" functions that don't require AI—they do deterministic work like API calls, database updates, and event routing.

**The approach**: Generate **scaffolds with rich context**, not a DSL that transpiles to code. The manifest captures **intent and relationships**. A coding agent (or human) implements each scaffold later.

---

## The Problem

| Gap | Example | Current State |
|-----|---------|---------------|
| Event → Event | `draft.completed` → `approval.requested` | ❌ No way to declare |
| Event → API | `enrichment.started` → Clay request | ❌ No way to declare |
| Fan-in | Clay + Firecrawl → `lead.enriched` | ❌ No way to declare |
| Webhook Handler | RB2B payload → `lead.ingested` | ⚠️ Path defined, no logic |
| Cron Batch | Daily → wake snoozed leads | ⚠️ Schedule defined, no impl |

---

## Why Scaffolds, Not Transpilation

The original plan tried to encode business logic in YAML:

```yaml
# ❌ BAD: Building a mini programming language
actions:
  - type: api_call
    integration: resend
    endpoint: "/emails"
    body:
      to: "{{ lead.email }}"
      subject: "{{ draft.subject }}"
```

This requires:
- Expression parser for `{{ template.syntax }}`
- Action type system with validation
- Generated API clients
- Handling every edge case declaratively

**Instead**, we generate scaffolds:

```yaml
# ✅ GOOD: Capture intent, let agents implement
actions:
  - "Fetch draft content from drafts table"
  - "Call Resend /emails endpoint"
  - "Update email_events with resend_message_id"
open_questions:
  - "Retry logic for rate limits?"
```

The generator produces TypeScript files with:
- Rich header comment (description, trigger, emits, context, open questions)
- Commented-out code blocks showing expected shape
- `throw new Error("DRAFT: not yet implemented")` at the end

A coding agent then reads the context, asks clarifying questions, and implements properly.

---

## The Five Function Patterns

| Pattern | Trigger Shape | Use Case |
|---------|---------------|----------|
| `simple` | Single event | Most functions — trigger → actions → emit |
| `fan-in` | Primary + wait_for events | Wait for multiple events, merge data, emit |
| `cron` | Schedule | Batch process on schedule |
| `routing` | Event + route_on field | Route to different handlers based on data |
| `webhook` | HTTP request | Transform external payload → emit event |

**Note**: The original plan had a `fan-out` pattern. This is unnecessary—two `simple` functions triggered by the same event achieves the same result using Inngest's natural parallelism:

```yaml
# Instead of fan-out, use two simple functions:
- name: request-clay-enrichment
  pattern: simple
  trigger: { event: enrichment.started }
  emits: [clay/enrichment.requested]

- name: request-firecrawl-scrape
  pattern: simple
  trigger: { event: enrichment.started }
  emits: [firecrawl/scrape.requested]
```

---

## Schema Definition

### Function Schema

```typescript
// src/manifest/function-schema.ts
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const SimpleTriggerSchema = z.object({
  event: z.string(),
});

const FanInTriggerSchema = z.object({
  primary: z.string(),
  wait_for: z.array(z.string()),
  correlation_key: z.string(),
  timeout: z.string().optional(),
});

const CronTriggerSchema = z.object({
  cron: z.string(),        // References crons[].name
  schedule: z.string(),    // Cron expression for documentation
});

const RoutingTriggerSchema = z.object({
  event: z.string(),
  route_on: z.string(),    // Field name in event.data
  routes: z.record(z.string(), z.object({
    emit: z.string(),
    then: z.string().optional(),  // Follow-up event (e.g., lead.terminated)
  })),
  default_route: z.string().optional(),
});

const FunctionTriggerSchema = z.union([
  SimpleTriggerSchema,
  FanInTriggerSchema,
  CronTriggerSchema,
  RoutingTriggerSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing"]),
  trigger: FunctionTriggerSchema,
  emits: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),        // Free-text descriptions
  integrations: z.array(z.string()).optional(),   // Names for documentation
  context: z.string().optional(),                 // Notes for implementing agent
  open_questions: z.array(z.string()).optional(), // Questions to resolve
});

export const FunctionsArraySchema = z.array(FunctionSchema);
export type FunctionDefinition = z.infer<typeof FunctionSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Detect pattern from trigger shape
// ═══════════════════════════════════════════════════════════════════════════

export function detectPattern(trigger: z.infer<typeof FunctionTriggerSchema>): string {
  if ("wait_for" in trigger) return "fan-in";
  if ("cron" in trigger) return "cron";
  if ("route_on" in trigger) return "routing";
  return "simple";
}
```

### Extended Webhook Schema

```typescript
// Extend existing WebhookSchema
const WebhookHandlerSchema = z.object({
  validation: z.array(z.string()).optional(),   // Free-text validation steps
  transform: z.array(z.string()).optional(),    // Free-text transform steps
});

const WebhookSchema = z.object({
  name: z.string(),
  path: z.string(),
  auth: z.enum(["hmac", "api_key", "bearer", "none"]),
  secret: z.string().optional(),
  emits: z.string(),
  handler: WebhookHandlerSchema.optional(),     // NEW
  description: z.string().optional(),
});
```

### Updated Manifest Schema

```typescript
export const ManifestSchema = z.object({
  // ... existing fields ...

  functions: FunctionsArraySchema.optional(),   // NEW
  webhooks: z.array(WebhookSchema).optional(),  // ENHANCED
});
```

---

## Template: function.hbs

Single template handles all four patterns via conditionals:

```handlebars
// inngest/functions/{{name}}.ts
// STATUS: DRAFT - Requires implementation
// GENERATED: {{generatedAt}}
// PATTERN: {{pattern}}

import { inngest } from "../client.js";
import { db } from "../../lib/database.js";
import { logger } from "../../lib/logger.js";

/**
 * FUNCTION: {{name}}
 * DESCRIPTION: {{description}}
 * PATTERN: {{pattern}}
 *
{{#if (eq pattern "simple")}}
 * TRIGGER:
 *   - Event: {{trigger.event}}
{{/if}}
{{#if (eq pattern "fan-in")}}
 * TRIGGER:
 *   - Primary: {{trigger.primary}}
 *   - Waits for:
{{#each trigger.wait_for}}
 *       - {{this}}
{{/each}}
 *   - Correlation: {{trigger.correlation_key}}
{{#if trigger.timeout}}
 *   - Timeout: {{trigger.timeout}}
{{/if}}
{{/if}}
{{#if (eq pattern "cron")}}
 * TRIGGER:
 *   - Cron: {{trigger.cron}}
 *   - Schedule: {{trigger.schedule}}
{{/if}}
{{#if (eq pattern "routing")}}
 * TRIGGER:
 *   - Event: {{trigger.event}}
 *   - Routes on: {{trigger.route_on}}
 *   - Routes:
{{#each trigger.routes}}
 *       {{@key}} → {{this.emit}}{{#if this.then}} (then: {{this.then}}){{/if}}
{{/each}}
{{#if trigger.default_route}}
 *   - Default: {{trigger.default_route}}
{{/if}}
{{/if}}
 *
{{#if actions}}
 * EXPECTED ACTIONS:
{{#each actions}}
 *   - {{this}}
{{/each}}
 *
{{/if}}
{{#if emits}}
 * EXPECTED EMITS:
{{#each emits}}
 *   - {{this}}
{{/each}}
 *
{{/if}}
{{#if integrations}}
 * INTEGRATIONS:
{{#each integrations}}
 *   - {{this}}
{{/each}}
 *
{{/if}}
{{#if context}}
 * CONTEXT:
{{#each (splitLines context)}}
 *   {{this}}
{{/each}}
 *
{{/if}}
{{#if open_questions}}
 * OPEN QUESTIONS:
{{#each open_questions}}
 *   - [ ] {{this}}
{{/each}}
{{/if}}
 */

{{#if (eq pattern "simple")}}
export const {{camelCase name}}Function = inngest.createFunction(
  { id: "{{name}}" },
  { event: "{{namespace}}/{{trigger.event}}" },

  async ({ event, step }) => {
    const traceId = event.data.trace_id ?? crypto.randomUUID();
    const leadId = event.data.lead_id;

    logger.info("function.started", {
      traceId,
      function: "{{name}}",
      leadId,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Implement actions
    // ═══════════════════════════════════════════════════════════════════════
{{#each actions}}
    //
    // TODO: {{this}}
    //
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{#if emits}}
    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Emit events
    // ═══════════════════════════════════════════════════════════════════════
{{#each emits}}
    //
    // await step.sendEvent("emit-{{kebabCase this}}", {
    //   name: "{{../namespace}}/{{this}}",
    //   data: { lead_id: leadId, trace_id: traceId }
    // });
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{/if}}
    throw new Error("DRAFT: {{name}} not yet implemented");
  }
);
{{/if}}

{{#if (eq pattern "fan-in")}}
export const {{camelCase name}}Function = inngest.createFunction(
  { id: "{{name}}" },
  { event: "{{namespace}}/{{trigger.primary}}" },

  async ({ event, step }) => {
    const traceId = event.data.trace_id ?? crypto.randomUUID();
    const leadId = event.data.lead_id;

    logger.info("function.started", {
      traceId,
      function: "{{name}}",
      pattern: "fan-in",
      leadId,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Wait for additional events
    // ═══════════════════════════════════════════════════════════════════════
{{#each trigger.wait_for}}
    //
    // const {{camelCase this}}Data = await step.waitForEvent("wait-{{kebabCase this}}", {
    //   event: "{{../namespace}}/{{this}}",
    //   match: "data.{{../trigger.correlation_key}}",
    //   timeout: "{{../trigger.timeout}}",
    // });
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Merge data from all sources
    // ═══════════════════════════════════════════════════════════════════════
    //
    // const primaryData = event.data;
    // const mergedData = {
    //   ...primaryData,
    //   // ...additional fields from waited events
    // };
    // ═══════════════════════════════════════════════════════════════════════

{{#if actions}}
    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Implement actions
    // ═══════════════════════════════════════════════════════════════════════
{{#each actions}}
    //
    // TODO: {{this}}
    //
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{/if}}
{{#if emits}}
    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Emit events
    // ═══════════════════════════════════════════════════════════════════════
{{#each emits}}
    //
    // await step.sendEvent("emit-{{kebabCase this}}", {
    //   name: "{{../namespace}}/{{this}}",
    //   data: { lead_id: leadId, trace_id: traceId, ...mergedData }
    // });
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{/if}}
    throw new Error("DRAFT: {{name}} not yet implemented");
  }
);
{{/if}}

{{#if (eq pattern "cron")}}
export const {{camelCase name}}Function = inngest.createFunction(
  { id: "{{name}}" },
  { cron: "{{trigger.schedule}}" },

  async ({ step }) => {
    const traceId = crypto.randomUUID();

    logger.info("cron.started", {
      traceId,
      function: "{{name}}",
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Query items to process
    // ═══════════════════════════════════════════════════════════════════════
    //
    // const items = await step.run("query-items", async () => {
    //   return db.from("TABLE_NAME")
    //     .select("*")
    //     // TODO: Add WHERE conditions
    //     .limit(100);
    // });
    //
    // logger.info("cron.queried", { traceId, count: items.length });
    // ═══════════════════════════════════════════════════════════════════════

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Process each item
    // ═══════════════════════════════════════════════════════════════════════
    //
    // for (const item of items) {
{{#each actions}}
    //   // TODO: {{this}}
{{/each}}
    //
{{#each emits}}
    //   await step.sendEvent(`emit-{{kebabCase this}}-${item.id}`, {
    //     name: "{{../namespace}}/{{this}}",
    //     data: { ...item, trace_id: traceId }
    //   });
{{/each}}
    // }
    // ═══════════════════════════════════════════════════════════════════════

    throw new Error("DRAFT: {{name}} not yet implemented");
  }
);
{{/if}}

{{#if (eq pattern "routing")}}
export const {{camelCase name}}Function = inngest.createFunction(
  { id: "{{name}}" },
  { event: "{{namespace}}/{{trigger.event}}" },

  async ({ event, step }) => {
    const traceId = event.data.trace_id ?? crypto.randomUUID();
    const leadId = event.data.lead_id;
    const routeValue = event.data.{{trigger.route_on}};

    logger.info("function.started", {
      traceId,
      function: "{{name}}",
      pattern: "routing",
      leadId,
      routeValue,
    });

    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Define routing table
    // ═══════════════════════════════════════════════════════════════════════
    //
    // const ROUTES: Record<string, { emit: string; then?: string }> = {
{{#each trigger.routes}}
    //   "{{@key}}": { emit: "{{this.emit}}"{{#if this.then}}, then: "{{this.then}}"{{/if}} },
{{/each}}
    // };
    //
    // const route = ROUTES[routeValue] ?? { emit: "{{trigger.default_route}}" };
    // ═══════════════════════════════════════════════════════════════════════

{{#if actions}}
    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Implement actions
    // ═══════════════════════════════════════════════════════════════════════
{{#each actions}}
    //
    // TODO: {{this}}
    //
{{/each}}
    // ═══════════════════════════════════════════════════════════════════════

{{/if}}
    // ═══════════════════════════════════════════════════════════════════════
    // DRAFT: Emit routed event
    // ═══════════════════════════════════════════════════════════════════════
    //
    // await step.sendEvent("emit-routed", {
    //   name: `{{namespace}}/${route.emit}`,
    //   data: { lead_id: leadId, trace_id: traceId }
    // });
    //
    // if (route.then) {
    //   await step.sendEvent("emit-followup", {
    //     name: `{{namespace}}/${route.then}`,
    //     data: { lead_id: leadId, trace_id: traceId, reason: routeValue }
    //   });
    // }
    // ═══════════════════════════════════════════════════════════════════════

    throw new Error("DRAFT: {{name}} not yet implemented");
  }
);
{{/if}}
```

---

## Template: webhook-handler.hbs

Webhook handlers are HTTP route handlers, not Inngest functions:

```handlebars
// app/api/webhooks/{{kebabCase name}}/route.ts
// STATUS: DRAFT - Requires implementation
// GENERATED: {{generatedAt}}

import { inngest } from "@/inngest/client";
import { logger } from "@/lib/logger";

/**
 * WEBHOOK: {{name}}
 * DESCRIPTION: {{description}}
 * PATH: {{path}}
 * AUTH: {{auth}}
 * EMITS: {{emits}}
 *
{{#if handler.validation}}
 * VALIDATION:
{{#each handler.validation}}
 *   - {{this}}
{{/each}}
 *
{{/if}}
{{#if handler.transform}}
 * TRANSFORM:
{{#each handler.transform}}
 *   - {{this}}
{{/each}}
{{/if}}
 */

export async function POST(request: Request) {
  const traceId = crypto.randomUUID();

  // ═══════════════════════════════════════════════════════════════════════
  // DRAFT: Verify signature
  // ═══════════════════════════════════════════════════════════════════════
{{#if (eq auth "hmac")}}
  //
  // const signature = request.headers.get("x-webhook-signature");
  // const body = await request.text();
  //
  // if (!verifyHmac(body, signature, process.env.{{secret}})) {
  //   logger.warn("webhook.invalid_signature", { traceId, webhook: "{{name}}" });
  //   return new Response("Invalid signature", { status: 401 });
  // }
  //
  // const payload = JSON.parse(body);
{{/if}}
{{#if (eq auth "api_key")}}
  //
  // const apiKey = request.headers.get("x-api-key");
  // if (apiKey !== process.env.{{secret}}) {
  //   return new Response("Invalid API key", { status: 401 });
  // }
  //
  // const payload = await request.json();
{{/if}}
{{#if (eq auth "none")}}
  //
  // const payload = await request.json();
{{/if}}
  // ═══════════════════════════════════════════════════════════════════════

  logger.info("webhook.received", {
    traceId,
    webhook: "{{name}}",
  });

{{#if handler.validation}}
  // ═══════════════════════════════════════════════════════════════════════
  // DRAFT: Validate payload
  // ═══════════════════════════════════════════════════════════════════════
{{#each handler.validation}}
  //
  // TODO: {{this}}
  //
{{/each}}
  // ═══════════════════════════════════════════════════════════════════════

{{/if}}
{{#if handler.transform}}
  // ═══════════════════════════════════════════════════════════════════════
  // DRAFT: Transform payload to event data
  // ═══════════════════════════════════════════════════════════════════════
{{#each handler.transform}}
  //
  // TODO: {{this}}
  //
{{/each}}
  //
  // const eventData = {
  //   // transformed fields
  //   trace_id: traceId,
  // };
  // ═══════════════════════════════════════════════════════════════════════

{{/if}}
  // ═══════════════════════════════════════════════════════════════════════
  // DRAFT: Emit event
  // ═══════════════════════════════════════════════════════════════════════
  //
  // await inngest.send({
  //   name: "{{namespace}}/{{emits}}",
  //   data: eventData,
  // });
  //
  // logger.info("webhook.emitted", {
  //   traceId,
  //   webhook: "{{name}}",
  //   event: "{{namespace}}/{{emits}}",
  // });
  // ═══════════════════════════════════════════════════════════════════════

  throw new Error("DRAFT: {{name}} webhook not yet implemented");

  // return new Response("OK", { status: 200 });
}
```

---

## Template: functions-index.hbs

Index file that exports all functions for the Inngest route:

```handlebars
// inngest/functions/index.ts
// GENERATED: {{generatedAt}}

{{#each agentFunctions}}
export { {{camelCase name}}Function } from "./{{name}}.js";
{{/each}}

{{#each functions}}
export { {{camelCase name}}Function } from "./{{name}}.js";
{{/each}}

// All functions for Inngest serve()
export const allFunctions = [
  // Agent functions
{{#each agentFunctions}}
  {{camelCase name}}Function,
{{/each}}

  // Non-agentic functions
{{#each functions}}
  {{camelCase name}}Function,
{{/each}}
];
```

---

## Generator Implementation

### Function Generator

```typescript
// src/generators/function.ts
import Handlebars from "handlebars";
import { FunctionDefinition, detectPattern } from "../manifest/function-schema.js";
import { writeFile, readFile } from "fs/promises";

// Register helpers
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("camelCase", (str) => /* camelCase impl */);
Handlebars.registerHelper("kebabCase", (str) => /* kebabCase impl */);
Handlebars.registerHelper("splitLines", (str) => str?.split("\n") ?? []);

export async function generateFunction(
  func: FunctionDefinition,
  manifest: Manifest
): Promise<void> {
  const template = await readFile("templates/function.hbs", "utf-8");
  const compiled = Handlebars.compile(template);

  const content = compiled({
    ...func,
    pattern: func.pattern ?? detectPattern(func.trigger),
    namespace: manifest.events.namespace,
    generatedAt: new Date().toISOString(),
  });

  await writeFile(`inngest/functions/${func.name}.ts`, content);
}
```

### Webhook Generator

```typescript
// src/generators/webhook.ts
export async function generateWebhookHandler(
  webhook: Webhook,
  manifest: Manifest
): Promise<void> {
  const template = await readFile("templates/webhook-handler.hbs", "utf-8");
  const compiled = Handlebars.compile(template);

  const content = compiled({
    ...webhook,
    namespace: manifest.events.namespace,
    generatedAt: new Date().toISOString(),
  });

  // Convert path like "/api/webhooks/rb2b" to "app/api/webhooks/rb2b/route.ts"
  const routePath = `app${webhook.path}/route.ts`;
  await writeFile(routePath, content);
}
```

### Index Generator

```typescript
// src/generators/functions-index.ts
export async function generateFunctionsIndex(manifest: Manifest): Promise<void> {
  const template = await readFile("templates/functions-index.hbs", "utf-8");
  const compiled = Handlebars.compile(template);

  const content = compiled({
    agentFunctions: manifest.agents,
    functions: manifest.functions ?? [],
    generatedAt: new Date().toISOString(),
  });

  await writeFile("inngest/functions/index.ts", content);
}
```

### Updated init.ts

```typescript
// src/commands/init.ts
export async function generateProject(manifest: Manifest): Promise<void> {
  // Validate manifest
  const warnings = validateManifest(manifest);
  warnings.forEach(w => console.warn(`⚠️  ${w}`));

  // Generate agent functions (existing)
  for (const agent of manifest.agents) {
    await generateAgentFunction(agent, manifest);
  }

  // NEW: Generate non-agentic function scaffolds
  if (manifest.functions) {
    for (const func of manifest.functions) {
      await generateFunction(func, manifest);
    }
  }

  // NEW: Generate webhook handler scaffolds
  if (manifest.webhooks) {
    for (const webhook of manifest.webhooks) {
      await generateWebhookHandler(webhook, manifest);
    }
  }

  // NEW: Generate functions index
  await generateFunctionsIndex(manifest);

  // Generate Inngest route (updated to use index)
  await generateInngestRoute(manifest);
}
```

---

## Validation

Validate as **warnings**, not errors—don't block scaffold generation:

```typescript
// src/manifest/validate.ts
export function validateManifest(manifest: Manifest): string[] {
  const warnings: string[] = [];

  const eventNames = new Set(manifest.events.definitions.map(e => e.name));
  const stateNames = new Set(manifest.state_machine.states.map(s => s.name));
  const cronNames = new Set(manifest.crons?.map(c => c.name) ?? []);

  for (const func of manifest.functions ?? []) {
    // Check trigger events exist
    if ("event" in func.trigger && !eventNames.has(func.trigger.event)) {
      warnings.push(`Function "${func.name}": trigger event "${func.trigger.event}" not defined in events`);
    }

    if ("primary" in func.trigger && !eventNames.has(func.trigger.primary)) {
      warnings.push(`Function "${func.name}": primary event "${func.trigger.primary}" not defined in events`);
    }

    // Check emits reference valid events
    for (const emit of func.emits ?? []) {
      if (!eventNames.has(emit)) {
        warnings.push(`Function "${func.name}": emit "${emit}" not defined in events`);
      }
    }

    // Check cron references
    if ("cron" in func.trigger && !cronNames.has(func.trigger.cron)) {
      warnings.push(`Function "${func.name}": cron "${func.trigger.cron}" not defined in crons`);
    }

    // Check routing emit targets
    if ("routes" in func.trigger) {
      for (const [key, route] of Object.entries(func.trigger.routes)) {
        if (!eventNames.has(route.emit)) {
          warnings.push(`Function "${func.name}": route "${key}" emit "${route.emit}" not defined`);
        }
        if (route.then && !eventNames.has(route.then)) {
          warnings.push(`Function "${func.name}": route "${key}" then "${route.then}" not defined`);
        }
      }
    }
  }

  return warnings;
}
```

---

## Example Manifest Functions Section

```yaml
functions:
  # ─────────────────────────────────────────────────────────────────────────
  # INGESTION & ENRICHMENT
  # ─────────────────────────────────────────────────────────────────────────
  - name: request-clay-enrichment
    description: "Send enrichment request to Clay"
    pattern: simple
    trigger:
      event: enrichment.started
    emits:
      - clay/enrichment.requested
    actions:
      - "Fetch lead data if not in event payload"
      - "Call Clay /enrichment endpoint with linkedin_url, email"
      - "Store Clay request_id for webhook correlation"
    integrations:
      - clay
    context: |
      Clay returns async via webhook callback, not in HTTP response.
      Lead must have email OR linkedin_url for Clay to work.
    open_questions:
      - "What if linkedin_url is null? Skip Clay or try email-only?"

  - name: request-firecrawl-scrape
    description: "Scrape company homepage via Firecrawl"
    pattern: simple
    trigger:
      event: enrichment.started
    emits:
      - firecrawl/scrape.requested
    actions:
      - "Determine company URL from lead data"
      - "Call Firecrawl /scrape endpoint"
      - "Handle async callback via webhook"
    integrations:
      - firecrawl
    context: |
      Firecrawl needs company_domain or can extract from captured_url.
      Returns async via webhook.
    open_questions:
      - "Fallback if no company URL available?"

  - name: consolidate-enrichment
    description: "Wait for Clay + Firecrawl, then emit lead.enriched"
    pattern: fan-in
    trigger:
      primary: clay/enrichment.completed
      wait_for:
        - lead.scraped
      correlation_key: lead_id
      timeout: "5m"
    emits:
      - lead.enriched
    actions:
      - "Merge data from Clay and Firecrawl"
      - "Update leads table with enrichment data"
      - "Update lead state to 'enriched'"
    context: |
      Clay provides: job_title, company_name, linkedin_data
      Firecrawl provides: homepage_content, meta_description
      Both write to leads table before emitting.
    open_questions:
      - "If Firecrawl times out, proceed with partial data?"

  # ─────────────────────────────────────────────────────────────────────────
  # CAMPAIGN & DRAFTING
  # ─────────────────────────────────────────────────────────────────────────
  - name: create-campaign
    description: "Create campaign from matched lead"
    pattern: simple
    trigger:
      event: lead.match_passed
    emits:
      - campaign.created
      - draft.requested
    actions:
      - "Lookup persona template chain"
      - "Merge templates into campaign snapshot"
      - "Insert campaign record"
      - "Update lead state"

  - name: request-approval
    description: "Create approval record when draft completes"
    pattern: simple
    trigger:
      event: draft.completed
    emits:
      - approval.requested
    actions:
      - "Determine approver from persona owner"
      - "Insert approval record"
      - "Send notification to approver"
      - "Update lead state"
    context: |
      EEX emails 2-5 may auto-approve based on config.
      Check platform-campaign-template.yaml for rules.

  # ─────────────────────────────────────────────────────────────────────────
  # EMAIL DELIVERY
  # ─────────────────────────────────────────────────────────────────────────
  - name: send-email-on-approval
    description: "Send email via Resend when approved"
    pattern: simple
    trigger:
      event: approval.approved
    emits:
      - email.sent
    actions:
      - "Fetch draft content from email_events"
      - "Call Resend /emails endpoint"
      - "Update email_events with resend_message_id"
      - "Update lead state"
    integrations:
      - resend
    open_questions:
      - "Retry logic for rate limits?"

  # ─────────────────────────────────────────────────────────────────────────
  # RESPONSE ROUTING
  # ─────────────────────────────────────────────────────────────────────────
  - name: route-triage-result
    description: "Route triage classification to handler"
    pattern: routing
    trigger:
      event: triage.completed
      route_on: classification
      routes:
        accept_gift:
          emit: response.accept_gift
        request_meeting:
          emit: response.request_meeting
        delayed:
          emit: response.delayed
        question:
          emit: response.question
        unclear:
          emit: response.unclear
        opt_out:
          emit: response.opt_out
          then: lead.terminated
        not_interested:
          emit: response.not_interested
          then: lead.terminated
      default_route: response.unclear
    actions:
      - "Store classification for analytics"
    context: |
      Triage agent provides: classification, confidence, reasoning
      Low confidence might need different handling.

  - name: handle-accept-gift
    description: "Start EEX when lead accepts gift"
    pattern: simple
    trigger:
      event: response.accept_gift
    emits:
      - eex.started
    actions:
      - "Update campaign phase to 'eex'"
      - "Update lead state"

  - name: handle-snooze
    description: "Snooze lead for later follow-up"
    pattern: simple
    trigger:
      event: response.delayed
    emits:
      - lead.snoozed
    actions:
      - "Calculate snooze_until from response"
      - "Store snooze record with resume_at_phase"
      - "Update lead state"

  # ─────────────────────────────────────────────────────────────────────────
  # CRON JOBS
  # ─────────────────────────────────────────────────────────────────────────
  - name: check-pending-approvals
    description: "Send reminders for pending approvals"
    pattern: cron
    trigger:
      cron: approval-reminder
      schedule: "0 */4 * * *"
    emits:
      - approval.reminder
      - approval.timeout
    actions:
      - "Query approvals needing reminder"
      - "Send reminder notification"
      - "Increment reminder_count"
      - "Escalate if max reminders exceeded"
    context: |
      Config: reminder_interval=4h, max_reminders=3
      After max reminders, emit approval.timeout

  - name: process-snoozed-leads
    description: "Wake up snoozed leads"
    pattern: cron
    trigger:
      cron: snooze-wakeup
      schedule: "0 9 * * *"
    emits:
      - lead.snooze_expired
    actions:
      - "Query leads where snoozed_until < now()"
      - "Update lead state based on resume_at_phase"
      - "Emit appropriate phase.started event"

  - name: check-response-timeouts
    description: "Check for leads that have timed out waiting for response"
    pattern: cron
    trigger:
      cron: timeout-checker
      schedule: "*/30 * * * *"
    emits:
      - timeout.response_wait
    actions:
      - "Query leads in 'sent' states (reach_out_sent, eex_sent, etc.)"
      - "Filter where last_email_sent_at + phase_timeout < now()"
      - "Exclude leads that have already replied"
      - "Emit timeout event for each with wait_type and waited_hours"
    context: |
      Cron polling handles cancellation automatically - if lead replied,
      the query condition won't match. No separate cancellation logic needed.
      Phase timeouts are defined in platform-campaign-template.yaml.
    open_questions:
      - "Different timeout durations per phase?"

  # ─────────────────────────────────────────────────────────────────────────
  # LIFECYCLE
  # ─────────────────────────────────────────────────────────────────────────
  - name: terminate-lead
    description: "End lead journey (negative outcome)"
    pattern: simple
    trigger:
      event: lead.terminated
    emits:
      - lead.journey_completed
    actions:
      - "Update lead state to terminal"
      - "Record termination reason"
      - "Trigger analytics aggregation"

  - name: convert-lead
    description: "Mark lead as converted"
    pattern: simple
    trigger:
      event: meeting.booked
    emits:
      - lead.converted
      - lead.journey_completed
    actions:
      - "Update lead state to 'converted'"
      - "Record conversion path"
      - "Trigger analytics aggregation"

  - name: aggregate-journey
    description: "Record journey analytics"
    pattern: simple
    trigger:
      event: lead.journey_completed
    actions:
      - "Calculate journey duration"
      - "Count emails sent/opened/clicked"
      - "Insert journey_analytics record"
```

---

## Enhanced Webhooks Section

```yaml
webhooks:
  - name: rb2b-inbound
    path: "/api/webhooks/rb2b"
    auth: hmac
    secret: "${HOOKDECK_WEBHOOK_SECRET}"
    emits: webhook.received
    handler:
      validation:
        - "Verify HMAC signature from Hookdeck"
        - "Check payload.person exists and has email or linkedin"
      transform:
        - "Extract person.email, person.first_name, person.last_name"
        - "Extract company info from person.company"
        - "Parse captured_url from payload.visit.page_url"
        - "Lookup organization_id from rb2b_source_id or domain"
    description: "Receives visitor identification from RB2B via Hookdeck"

  - name: clay-callback
    path: "/api/webhooks/clay"
    auth: hmac
    secret: "${HOOKDECK_WEBHOOK_SECRET}"
    emits: clay/enrichment.completed
    handler:
      validation:
        - "Verify signature"
        - "Check lead_id in callback URL or payload"
      transform:
        - "Extract enrichment fields (job_title, seniority, etc.)"
        - "Update leads table with enrichment data"
    description: "Receives enrichment callback from Clay"

  - name: resend-delivery-webhook
    path: "/api/webhooks/resend/delivery"
    auth: hmac
    secret: "${RESEND_WEBHOOK_SECRET}"
    emits: email.delivery_event
    handler:
      validation:
        - "Verify Svix signature"
        - "Extract resend_message_id"
      transform:
        - "Map Resend event type (delivered, opened, clicked, bounced, complained)"
        - "Lookup email_event_id from resend_message_id"
        - "Update email_events table"
    description: "Receives delivery status events from Resend"

  - name: resend-inbound-webhook
    path: "/api/webhooks/resend/inbound"
    auth: hmac
    secret: "${RESEND_WEBHOOK_SECRET}"
    emits: email.replied
    handler:
      validation:
        - "Verify Svix signature"
        - "Extract In-Reply-To header"
      transform:
        - "Lookup lead_id from In-Reply-To resend_message_id"
        - "Extract reply content"
        - "Store reply for triage"
    description: "Receives inbound reply emails from Resend"
```

---

## Implementation Phases

### Phase 1: Schema Extension (agent-factory)
- [ ] Add `FunctionSchema` to manifest schema
- [ ] Extend `WebhookSchema` with handler definition
- [ ] Add validation function (warnings, not errors)
- [ ] Export new types

### Phase 2: Templates (agent-factory)
- [ ] Create `function.hbs` (all four patterns)
- [ ] Create `webhook-handler.hbs`
- [ ] Create `functions-index.hbs`
- [ ] Register Handlebars helpers

### Phase 3: Generators (agent-factory)
- [ ] Add `generateFunction()`
- [ ] Add `generateWebhookHandler()`
- [ ] Add `generateFunctionsIndex()`
- [ ] Update `init.ts` to call new generators
- [ ] Update `generateInngestRoute()` to use index

### Phase 4: Kringle Manifest (agent-architect)
- [ ] Add `functions:` section (~27 functions)
- [ ] Update `webhooks:` with handler definitions
- [ ] Validate manifest generates without errors

### Phase 5: Implementation
- [ ] Generate scaffolds
- [ ] Implement each function (coding agent or human)
- [ ] Test event flow end-to-end

---

## Function Inventory for Kringle

| Category | Count | Functions |
|----------|-------|-----------|
| Enrichment | 3 | request-clay, request-firecrawl, consolidate |
| Campaign | 2 | create-campaign, request-approval |
| Email | 1 | send-on-approval |
| Routing | 4 | route-triage, handle-accept-gift, handle-meeting, handle-snooze |
| Cron | 3 | check-approvals, process-snoozed, check-timeouts |
| Lifecycle | 3 | terminate-lead, archive-lead, convert-lead |
| Analytics | 1 | aggregate-journey |
| **Total** | **17** | Plus ~10 more for edge cases |

**Note**: Response timeouts are handled by cron polling (`check-response-timeouts`), not delayed events. This simplifies cancellation—if a lead replies, the cron query just doesn't match.

---

## Design Decisions

### Timeouts: Cron Polling, Not Delayed Events

We use **cron polling** for all timeout detection instead of delayed event emission.

| Approach | Pros | Cons |
|----------|------|------|
| **Delayed emit** | Precise timing | Cancellation is complex |
| **Cron polling** | Cancellation is automatic | Up to 30 min late |

With cron polling, if a lead replies before the timeout, the query condition simply doesn't match—no cancellation logic needed. The 30-minute granularity is acceptable for business timeouts (72h, 48h).

### Parallel Execution: Multiple Simple Functions, Not Fan-Out

Instead of a `fan-out` pattern, we trigger multiple `simple` functions on the same event. Inngest handles parallel execution naturally.

```yaml
# Both trigger on enrichment.started → run in parallel
- name: request-clay-enrichment
  trigger: { event: enrichment.started }

- name: request-firecrawl-scrape
  trigger: { event: enrichment.started }
```

---

## What We're NOT Building

- ❌ Expression parser (`{{ lead.email }}`)
- ❌ Action type system (structured upsert/update/api_call)
- ❌ Generated API clients
- ❌ Generated database operations
- ❌ Fan-out pattern (use multiple simple functions instead)
- ❌ Delayed event emission (use cron polling for timeouts)

All implementation details get written by the coding agent when implementing each scaffold.
