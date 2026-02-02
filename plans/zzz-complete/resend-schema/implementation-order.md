# Implementation Order: Agent Output Schemas

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Output Schema Validation in Templates (agent-factory) |
| 2 | ✅ | Update Reference Schema (agent-architect) |
| 3 | ✅ | Create Agent Output Schemas (agent-architect) |
| 4 | ⏭️ | Test (skipped - parallel work in progress) |

---

## Overview

Agent output schemas are referenced in the Kringle manifest but don't exist. These schemas define the structured output each agent must produce, enabling runtime validation before events are emitted.

## Repository Responsibilities

| Repo | Owns | Role |
|------|------|------|
| **agent-factory** | Templates, generators | Generates code that validates output |
| **agent-architect** | Output schema files | Defines what each agent must return |

---

## Design Decision: Validate Agent Output and Throw on Mismatch

**Choice**: Generated Inngest functions validate agent output against the declared schema before emitting events. Validation failures throw, causing Inngest to handle as function failure.

**Rationale**:
- Fail fast - don't propagate bad data downstream
- Agent errors become visible immediately
- Inngest handles retries/dead-letter based on config
- Guarantees downstream functions receive valid data

**Implementation**: Update agent function template to import output schema and call `.parse()` after `agent.run()`.

---

## Problem Statement

### Current State

Manifest references these files that don't exist:

| Agent | Referenced Schema | Exists? |
|-------|-------------------|---------|
| persona-matcher | `schemas/persona-matcher-output.ts` | ❌ |
| email-drafter | `schemas/email-drafter-output.ts` | ❌ |
| response-triager | `schemas/response-triager-output.ts` | ❌ |
| escalation-handler | `schemas/escalation-handler-output.ts` | ❌ |

Only `schemas/status-yaml-schema.ts` exists.

### What Each Schema Needs

**persona-matcher-output.ts**
- Emits: `lead.match_passed` or `lead.match_failed`
- Needs: matched (bool), persona_id, confidence_score, agent_reasoning, scores array

**email-drafter-output.ts**
- Emits: `draft.completed`
- Needs: draft_path, draft_version, email_type, subject, html_body, body_preview
- Note: Resend requires subject + html/text body. Other fields (from, to, reply_to, tags) injected at send time by `send-on-approval` function.

**response-triager-output.ts**
- Emits: `triage.completed` + specific response events
- Needs: classification (enum), sentiment (enum), recommended_action, agent_reasoning

**escalation-handler-output.ts**
- Emits: varies by action (draft.requested, lead.terminated, lead.snoozed, response.request_meeting)
- Needs: action (enum), draft_feedback, snooze_until, snooze_reason

---

## Implementation Order

### Phase 1: agent-factory - Output Schema Validation in Templates
**Location**: `/Users/scottstrang/agent-factory/templates/inngest-function.hbs`
**Status**: ✅ Complete
**PR**: https://github.com/scott-sknkwx/agent-factory/pull/3

The template already had output schema validation. Enhanced with detailed error logging:

```typescript
import { ZodError } from "zod";

// ...

const rawOutput = (result as any).structured_output;

const output = await step.run("validate-output", async () => {
  try {
    const parsed = {{pascalCase name}}OutputSchema.parse(rawOutput);
    validateStateTransition(workspace.currentState, "{{stateOut}}");
    return parsed;
  } catch (validationError) {
    if (validationError instanceof ZodError) {
      logger.error("agent.output.validation_failed", {
        traceId,
        agent: "{{name}}",
        errors: validationError.errors,
        rawOutput,
      });
      throw new Error(
        `Agent '{{name}}' produced invalid output: ${validationError.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ")}`
      );
    }
    throw validationError;
  }
});
```

**What was implemented**:
- ZodError import for type-safe error handling
- Try-catch wrapper around `.parse()` call
- Detailed error logging with traceId, agent name, validation errors, and raw output
- Formatted error message showing which fields failed validation

---

### Phase 2: agent-architect - Update Reference Schema
**Location**: `/Users/scottstrang/agent-architect/context/manifest-schema.ts`
**Status**: ✅ Complete (verified)

Verified the `output_schema` field in ContractSchema (line 69) properly accepts a string path:

```typescript
const ContractSchema = z.object({
  // ...
  output_schema: z.string(),
});
```

**Verification notes:**
- Field exists at correct location in ContractSchema
- Required field (not optional) - enforces that all agents must declare an output schema
- String type is appropriate - file existence validation happens at generation/runtime, not schema validation
- No changes needed to the schema

---

### Phase 3: agent-architect - Create Agent Output Schemas
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/schemas/`
**Status**: ✅ Complete

Create 4 files:

#### 3a. persona-matcher-output.ts
```typescript
import { z } from "zod";

const PersonaScoreSchema = z.object({
  persona_id: z.string().uuid(),
  persona_name: z.string(),
  score: z.number().min(0).max(1),
  passed_threshold: z.boolean(),
});

export const PersonaMatcherOutputSchema = z.object({
  success: z.boolean(),
  matched: z.boolean(),

  // If matched
  persona_id: z.string().uuid().nullable(),
  persona_name: z.string().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),

  // Always present
  scores: z.array(PersonaScoreSchema),
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type PersonaMatcherOutput = z.infer<typeof PersonaMatcherOutputSchema>;
```

#### 3b. email-drafter-output.ts
```typescript
import { z } from "zod";

export const EmailDrafterOutputSchema = z.object({
  success: z.boolean(),

  // Required for draft.completed event
  draft_path: z.string(),
  draft_version: z.number().int().positive(),
  email_type: z.enum([
    "initial_outreach",
    "reach_out_followup",
    "eex_1", "eex_2", "eex_3", "eex_4", "eex_5",
    "post_eex_initial",
    "post_eex_followup",
    "reply"
  ]),

  // Draft content (what Resend needs at send time)
  subject: z.string(),
  html_body: z.string(),
  text_body: z.string().optional(),

  // For approval UI
  body_preview: z.string().max(500),

  // Agent metadata
  personalization_applied: z.array(z.string()),
  revision_incorporated: z.boolean().optional(),

  // Error case
  error: z.string().optional(),
});

export type EmailDrafterOutput = z.infer<typeof EmailDrafterOutputSchema>;
```

#### 3c. response-triager-output.ts
```typescript
import { z } from "zod";

export const ResponseTriagerOutputSchema = z.object({
  success: z.boolean(),

  // Classification result
  classification: z.enum([
    "accept_gift",
    "request_meeting",
    "delayed",
    "opt_out",
    "not_interested",
    "question",
    "continue",
    "unclear"
  ]),
  sentiment: z.enum(["positive", "negative", "neutral"]),

  // Action guidance
  recommended_action: z.string(),

  // For delayed responses
  snooze_until: z.string().datetime().optional(),
  snooze_reason: z.string().optional(),

  // For question responses
  question_summary: z.string().optional(),

  // Agent reasoning
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type ResponseTriagerOutput = z.infer<typeof ResponseTriagerOutputSchema>;
```

#### 3d. escalation-handler-output.ts
```typescript
import { z } from "zod";

export const EscalationHandlerOutputSchema = z.object({
  success: z.boolean(),

  // What action to take
  action: z.enum([
    "revise_draft",
    "terminate",
    "snooze",
    "schedule_meeting"
  ]),

  // For revise_draft
  draft_feedback: z.string().optional(),
  email_type: z.string().optional(),

  // For snooze
  snooze_until: z.string().datetime().optional(),
  snooze_reason: z.string().optional(),
  resume_at_phase: z.enum(["reach_out", "eex", "post_eex"]).optional(),

  // For terminate
  termination_reason: z.string().optional(),

  // Agent reasoning
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type EscalationHandlerOutput = z.infer<typeof EscalationHandlerOutputSchema>;
```

---

### Phase 4: Test

```bash
# Validate schema changes work
cd /Users/scottstrang/agent-architect/workspace/kringle
npx tsx ../../../agent-factory/src/cli.ts init --manifest manifest.yaml --dry-run
```

Verify:
- [ ] Output schema paths resolve correctly
- [ ] Generated agent functions include schema validation
- [ ] Generated code compiles with output schema imports
- [ ] Schema validation catches missing required fields

---

## Files to Modify Summary

### agent-factory (DO FIRST)
| File | Action | Phase | Status |
|------|--------|-------|--------|
| `templates/inngest-function.hbs` | Add enhanced error logging for output schema validation | 1 | ✅ |

### agent-architect (DO SECOND)
| File | Action | Phase | Status |
|------|--------|-------|--------|
| `context/manifest-schema.ts` | Verify output_schema field | 2 | ✅ |
| `workspace/kringle/schemas/persona-matcher-output.ts` | Create new | 3 | ✅ |
| `workspace/kringle/schemas/email-drafter-output.ts` | Create new | 3 | ✅ |
| `workspace/kringle/schemas/response-triager-output.ts` | Create new | 3 | ✅ |
| `workspace/kringle/schemas/escalation-handler-output.ts` | Create new | 3 | ✅ |

---

## Runtime Behavior

### Output Schema Validation (Runtime)
```typescript
// Generated code in inngest/functions/email-drafter.ts
const rawOutput = await agent.run(workspace);

// This throws if output doesn't match schema
const output = EmailDrafterOutputSchema.parse(rawOutput);
// → ZodError if missing required fields like draft_path, subject, etc.

// Only emits if validation passed
await inngest.send({ name: 'kringle/draft.completed', data: { ...output, ... }});
```

### Failure Handling
If validation fails, Inngest sees a function error and can:
- Retry (based on your retry config)
- Move to dead-letter queue
- Alert via observability

This ensures downstream functions (like `request-approval`) never receive malformed data.

### Example Validation Error
```
Agent 'email-drafter' produced invalid output: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["subject"],
    "message": "Required"
  }
]
```

---

## Related Plans

- **Infrastructure Integrations**: See `/plans/integration-schema/implementation-order.md` for adding resend, hookdeck, clay, firecrawl to the manifest schema.
