# ARCHIVED: Function Code Generation Approach

> **Status:** SUPERSEDED
> **Superseded By:** Spec-based approach (see [README.md](./README.md))
> **Reason:** Generating TypeScript code in Agent Architect violates separation of concerns. Agent Architect should capture context (specs), not write implementation code.

---

# Original Plan: Function Generation Capability

Enable Agent Architect to generate working Inngest function implementations that Agent Factory merges into generated projects, eliminating draft stubs for trivial and simple functions.

## Overview

**Problem:** Agent Factory generates draft function stubs with `throw new Error("DRAFT: ...")`. Every function requires manual implementation, even trivial webhook handlers that follow predictable patterns.

**Solution:** Extend both Agent Architect and Agent Factory to support function implementation generation:
- Agent Architect generates working TypeScript implementations for trivial/simple functions
- Agent Factory merges these into `inngest/functions/`, overwriting draft stubs

**Scope:** Phase 1 focuses on the merge infrastructure + manual function authoring. Phase 2 adds automatic generation for trivial functions. Phase 3 extends to simple functions with interview capture.

---

## Current State

| Component | Generates | To Destination |
|-----------|-----------|----------------|
| Agent Architect | `manifest.yaml` | (read by Agent Factory) |
| Agent Architect | `agents/*.md` | `agents/*/context/CLAUDE.md` |
| Agent Architect | `config/` | `config/` |
| Agent Architect | `templates/` | `templates/` |
| Agent Architect | `schemas/*.ts` | `schemas/` |
| Agent Factory | Draft function stubs | `inngest/functions/*.ts` |
| **NEW** | `functions/*.ts` | `inngest/functions/*.ts` |

---

## Architecture

```
Agent Architect                          Agent Factory
─────────────────                        ─────────────

workspace/{product}/                     projects/{product}/
├── manifest.yaml ──────────────────────▶ (parsed)
├── agents/*.md ─────────────────────────▶ agents/*/context/CLAUDE.md
├── config/ ─────────────────────────────▶ config/
├── templates/ ──────────────────────────▶ templates/
├── schemas/*.ts ────────────────────────▶ schemas/
│
└── functions/          ┌─ generates ──▶ inngest/functions/*.ts (DRAFT stubs)
    └── *.ts ───────────┴─ overwrites ─▶ inngest/functions/*.ts (working code)
```

---

## Phase 1: Merge Infrastructure (MVP)

**Goal:** Allow manually-authored function implementations in `workspace/{product}/functions/` to be merged into generated projects.

### 1.1 Agent Factory: Add Functions Merge Path

**File:** `/Users/scottstrang/agent-factory/src/utils/merge-content.ts`

**Changes:**

1. Update `detectContentTypes()` to detect `functions/` directory:

```typescript
export function detectContentTypes(sourcePath: string): {
  hasAgents: boolean;
  hasConfig: boolean;
  hasTemplates: boolean;
  hasSchemas: boolean;
  hasFunctions: boolean;  // NEW
} {
  const result = {
    hasAgents: false,
    hasConfig: false,
    hasTemplates: false,
    hasSchemas: false,
    hasFunctions: false,  // NEW
  };
  // ... existing logic ...
  if (entry === "functions") result.hasFunctions = true;  // NEW
}
```

2. Update `isStubFile()` to detect DRAFT pattern:

```typescript
export function isStubFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  const content = readFileSync(filePath, "utf-8");
  return (
    content.includes("TODO:") ||
    content.includes("// TODO") ||
    content.includes('throw new Error("DRAFT:') ||  // NEW
    content.includes("STATUS: DRAFT")                // NEW
  );
}
```

3. Add `MERGE FUNCTIONS` section to `mergeContent()`:

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MERGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

if (contentTypes.hasFunctions) {
  const functionsSource = join(source, "functions");
  const functionsDest = join(dest, "inngest/functions");

  if (!dryRun) {
    mkdirSync(functionsDest, { recursive: true });
  }

  // Recursively find all .ts files (supports nested directories)
  const functionFiles = findFunctionFiles(functionsSource);

  for (const funcFile of functionFiles) {
    const relativePath = relative(functionsSource, funcFile);
    const destPath = join(functionsDest, relativePath);

    // Only overwrite if dest is a stub (or doesn't exist)
    if (!existsSync(destPath) || isStubFile(destPath)) {
      if (!dryRun) {
        mkdirSync(dirname(destPath), { recursive: true });
        copyFileSync(funcFile, destPath);
      }
      result.copied.push(relative(process.cwd(), destPath));
    } else {
      result.skipped.push(relative(process.cwd(), destPath));
    }
  }
}
```

4. Add helper function:

```typescript
function findFunctionFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}
```

### 1.2 Update Documentation

**File:** `/Users/scottstrang/agent-architect/HOW-TO-USE.md`

Add to Merge Content Behavior table:

```markdown
| `functions/*.ts` | `inngest/functions/` | Copy, overwrite stubs |
```

### 1.3 Create Example Function Implementation

**File:** `/Users/scottstrang/agent-architect/workspace/done/kringle/functions/check-response-timeouts.ts`

```typescript
// inngest/functions/check-response-timeouts.ts
// STATUS: IMPLEMENTED
// PATTERN: cron

import { inngest } from "../client";
import { db } from "../../lib/database";
import { logger } from "../../lib/logger";

const TIMEOUT_HOURS = 48;

export const checkResponseTimeoutsFunction = inngest.createFunction(
  { id: "check-response-timeouts" },
  { cron: "*/30 * * * *" },

  async ({ step }) => {
    const traceId = crypto.randomUUID();

    logger.info("cron.started", {
      traceId,
      function: "check-response-timeouts",
    });

    // Query campaign items that are waiting for response past threshold
    const timedOutItems = await step.run("query-timed-out-items", async () => {
      const cutoff = new Date(Date.now() - TIMEOUT_HOURS * 60 * 60 * 1000);

      const { data, error } = await db
        .from("campaign_items")
        .select("id, lead_id, campaign_id, sent_at")
        .eq("status", "sent")
        .lt("sent_at", cutoff.toISOString())
        .limit(100);

      if (error) throw error;
      return data ?? [];
    });

    logger.info("cron.queried", {
      traceId,
      count: timedOutItems.length
    });

    // Emit timeout events for each item
    for (const item of timedOutItems) {
      await step.sendEvent(`emit-timeout-${item.id}`, {
        name: "kringle/timeout.response_wait",
        data: {
          lead_id: item.lead_id,
          campaign_id: item.campaign_id,
          campaign_item_id: item.id,
          trace_id: traceId,
        },
      });
    }

    logger.info("cron.completed", {
      traceId,
      function: "check-response-timeouts",
      emitted: timedOutItems.length,
    });

    return { checked: timedOutItems.length };
  }
);
```

### 1.4 Acceptance Criteria

- [ ] `detectContentTypes()` returns `hasFunctions: true` when `functions/` exists
- [ ] `isStubFile()` returns `true` for files containing `throw new Error("DRAFT:`
- [ ] `mergeContent()` copies `.ts` files from `functions/` to `inngest/functions/`
- [ ] Nested directories are preserved (`functions/cron/x.ts` → `inngest/functions/cron/x.ts`)
- [ ] Non-stub files in destination are NOT overwritten (preserved)
- [ ] HOW-TO-USE.md documents the new merge path
- [ ] Kringle rebuild includes working `check-response-timeouts.ts`

---

## Phase 2: Trivial Function Generation

**Goal:** Agent Architect automatically generates working implementations for trivial functions (webhook handlers with parse → validate → emit pattern).

### 2.1 Define Complexity Classification

**File:** `/Users/scottstrang/agent-architect/context/manifest-schema.ts` (documentation)

```typescript
/**
 * Function Complexity Classification
 *
 * TRIVIAL:
 * - Pattern: inngest-first-webhook OR simple
 * - Actions: Parse, validate, emit only (no DB writes, no conditional logic)
 * - Integrations: 0-1
 * - Steps: 1-2
 * - No open_questions
 *
 * SIMPLE:
 * - Pattern: simple, cron
 * - Actions: 3-5 sequential steps, linear control flow
 * - Integrations: 0-1
 * - May include DB read/write
 * - No wait_for, no routing
 *
 * COMPLEX:
 * - Pattern: fan-in, routing, OR any with wait_for
 * - Integrations: 2+
 * - Steps: 4+ OR conditional logic
 * - Has open_questions
 */
```

### 2.2 Add Generation Templates

**File:** `/Users/scottstrang/agent-architect/context/templates/function-webhook.ts.hbs`

```handlebars
// inngest/functions/{{name}}.ts
// STATUS: IMPLEMENTED
// PATTERN: {{pattern}}
// GENERATED: {{generatedAt}}

import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { logger } from "../../lib/logger";
{{#if schema}}
import { {{schemaName}} } from "../../schemas/{{schema}}";
{{/if}}

export const {{camelCase name}}Function = inngest.createFunction(
  {
    id: "{{name}}",
    retries: {{config.retries}}
  },
  { event: "{{namespace}}/{{trigger.event}}" },

  async ({ event, step }) => {
    const traceId = event.data.trace_id ?? crypto.randomUUID();

    logger.info("webhook.received", {
      traceId,
      function: "{{name}}",
      source: "{{webhookSource}}",
    });

    // Step 1: Validate payload
    const payload = await step.run("validate", async () => {
      {{#if schema}}
      const parsed = {{schemaName}}.safeParse(event.data.raw);
      if (!parsed.success) {
        logger.warn("webhook.validation-failed", {
          traceId,
          errors: parsed.error.errors
        });
        throw new NonRetriableError("Invalid payload: " + parsed.error.message);
      }
      return parsed.data;
      {{else}}
      // TODO: Add validation schema
      return event.data.raw;
      {{/if}}
    });

    {{#each steps}}
    {{#unless (eq name "validate")}}
    // Step: {{name}}
    {{#if (eq ../pattern "inngest-first-webhook")}}
    const {{camelCase name}}Result = await step.run("{{name}}", async () => {
      // {{action}}
      {{#if notes}}
      {{#each notes}}
      // Note: {{this}}
      {{/each}}
      {{/if}}
      {{#if on_failure}}
      // On failure: {{on_failure}}
      {{/if}}
    });
    {{/if}}
    {{/unless}}
    {{/each}}

    // Emit downstream events
    {{#each emits}}
    await step.sendEvent("emit-{{this}}", {
      name: "{{../namespace}}/{{this}}",
      data: {
        ...payload,
        trace_id: traceId,
      },
    });
    {{/each}}

    logger.info("webhook.processed", {
      traceId,
      function: "{{name}}",
    });
  }
);
```

### 2.3 Update Agent Architect CLAUDE.md

Add to Phase 4 (Generation):

```markdown
### Function Implementation Generation

For each function in the manifest, classify and generate:

| Complexity | Output |
|------------|--------|
| Trivial | Working `.ts` implementation in `workspace/{product}/functions/` |
| Simple | Working `.ts` implementation (Phase 3) |
| Complex | Detailed `.spec.md` in `workspace/{product}/functions/specs/` |

**Trivial function criteria:**
- Pattern: `inngest-first-webhook` or `simple`
- Steps: 1-2 (validate + emit)
- No database writes
- No conditional logic
- No `open_questions`

**Example trivial functions:**
- `ingest-rb2b-webhook` (parse RB2B payload → emit lead.ingested)
- `ingest-resend-webhook` (parse Resend event → emit appropriate event)
```

### 2.4 Acceptance Criteria

- [ ] Agent Architect classifies functions as trivial/simple/complex
- [ ] Trivial functions generate working `.ts` files
- [ ] Complex functions generate `.spec.md` files with implementation guidance
- [ ] Generated code compiles without TypeScript errors
- [ ] Generated code follows project import conventions

---

## Phase 3: Simple Function Generation + Interview Capture

**Goal:** Extend generation to simple functions by capturing implementation details during the interview phase.

### 3.1 Interview Questions for Function Details

Add to Phase 3 (Deep Dive) in Agent Architect:

```markdown
For each non-agentic function, ask:

1. **Database Operations:**
   - "What tables does this function read from?"
   - "What tables does this function write to?"
   - "What are the query conditions?"

2. **Business Logic:**
   - "What transformations happen to the data?"
   - "What validation rules apply?"
   - "What error conditions should abort (non-retryable)?"

3. **Configuration:**
   - "What timeout threshold? (e.g., 48 hours for response timeout)"
   - "How many items to process per batch? (e.g., 100)"

4. **Integration Details:**
   - "What API endpoints are called?"
   - "What fields map from source to destination?"
```

### 3.2 Enhanced Manifest Schema

Extend `FunctionSchema` to capture implementation details:

```typescript
const FunctionImplementationSchema = z.object({
  db_read: z.array(z.object({
    table: z.string(),
    select: z.array(z.string()).optional(),
    where: z.record(z.string()).optional(),
    limit: z.number().optional(),
  })).optional(),

  db_write: z.array(z.object({
    table: z.string(),
    operation: z.enum(["insert", "update", "upsert", "delete"]),
    fields: z.array(z.string()).optional(),
  })).optional(),

  config_values: z.record(z.union([z.string(), z.number()])).optional(),

  field_mappings: z.record(z.string()).optional(),
});

const FunctionSchema = z.object({
  // ... existing fields ...
  implementation: FunctionImplementationSchema.optional(),
});
```

### 3.3 Example with Implementation Details

```yaml
- name: check-response-timeouts
  description: "Checks for leads that have timed out waiting for response"
  pattern: cron
  trigger:
    cron: "*/30 * * * *"
    schedule: "Every 30 minutes"
  emits:
    - timeout.response_wait

  # NEW: Implementation details captured during interview
  implementation:
    config_values:
      timeout_hours: 48
      batch_limit: 100
    db_read:
      - table: campaign_items
        select: [id, lead_id, campaign_id, sent_at]
        where:
          status: "sent"
          sent_at: "< now() - {timeout_hours} hours"
        limit: "{batch_limit}"
```

### 3.4 Acceptance Criteria

- [ ] Interview phase captures implementation details for simple functions
- [ ] Manifest schema supports `implementation` field
- [ ] Simple functions generate working `.ts` with real queries
- [ ] Config values are extracted to constants
- [ ] Generated queries match database schema

---

## Technical Specifications

### File Locations

| Purpose | Path |
|---------|------|
| Merge content utility | `/Users/scottstrang/agent-factory/src/utils/merge-content.ts` |
| Stub detection | `/Users/scottstrang/agent-factory/src/utils/merge-content.ts:122-129` |
| Function generator | `/Users/scottstrang/agent-factory/src/generators/function.ts` |
| Function template | `/Users/scottstrang/agent-factory/templates/function.hbs` |
| Manifest schema | `/Users/scottstrang/agent-architect/context/manifest-schema.ts` |
| Agent Architect instructions | `/Users/scottstrang/agent-architect/CLAUDE.md` |
| How-to guide | `/Users/scottstrang/agent-architect/HOW-TO-USE.md` |

### Merge Strategy

| Source | Destination | When to Overwrite |
|--------|-------------|-------------------|
| `functions/*.ts` | `inngest/functions/*.ts` | Dest is stub OR doesn't exist |
| `functions/cron/*.ts` | `inngest/functions/cron/*.ts` | Dest is stub OR doesn't exist |
| `functions/specs/*.md` | `inngest/functions/specs/*.md` | Always (docs) |

### Stub Detection Patterns

```typescript
// Patterns that indicate a file is a stub (should be overwritten):
const STUB_PATTERNS = [
  "TODO:",
  "// TODO",
  'throw new Error("DRAFT:',
  "STATUS: DRAFT",
  "Requires implementation",
];
```

---

## Open Questions

1. **Should complex function specs be `.md` or `.yaml`?**
   - `.md` is more readable for humans
   - `.yaml` could be machine-parseable for future automation

2. **How to handle functions removed from manifest?**
   - Option A: Warn about orphaned files in workspace
   - Option B: Ignore (no cleanup)
   - Recommendation: Option B for Phase 1

3. **Should generated functions include unit test stubs?**
   - Could generate `__tests__/check-response-timeouts.test.ts`
   - Adds complexity; defer to Phase 4

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Functions requiring manual implementation | Reduce from 100% to <30% |
| Time from manifest to working project | Reduce by 40% |
| TypeScript errors after generation | 0 |
| Kringle cron job errors on startup | 0 |

---

## References

### Internal
- `/Users/scottstrang/agent-architect/context/tech-docs/inngest.md` - Inngest patterns
- `/Users/scottstrang/agent-architect/context/manifest-schema.ts` - Function schema
- `/Users/scottstrang/agent-factory/templates/function.hbs` - Current stub template

### External
- [Inngest Step Functions](https://www.inngest.com/docs/features/inngest-functions/steps-workflows)
- [Inngest Error Handling](https://www.inngest.com/docs/features/inngest-functions/error-retries)
- [Supabase Query Patterns](https://supabase.com/docs/reference/javascript/select)
