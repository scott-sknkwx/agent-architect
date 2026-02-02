# Implementation Order: Agent Output Schemas

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | agent-architect - Create persona-matcher-output.ts |
| 2 | ✅ | agent-architect - Create email-drafter-output.ts |
| 3 | ✅ | agent-architect - Create response-triager-output.ts |
| 4 | ✅ | agent-architect - Create escalation-handler-output.ts |
| 5 | ✅ | agent-architect - Update CLAUDE.md validation |
| 6 | ⏭️ | Test with agent-factory (skipped - will test after related work) |

---

## Overview

**Problem**: The kringle manifest references agent output schema files that don't exist.

## Repository Responsibilities

| Repo | Owns | Role |
|------|------|------|
| **agent-architect** | Kringle workspace, output schemas | The design tool (generates products) |
| **agent-factory** | CLI, scaffold generation | The code generator (consumes manifests) |

**Key insight**: Output schemas live in the product workspace (agent-architect/workspace/kringle). agent-factory reads them during scaffold generation.

| Agent | Referenced Schema | Exists? |
|-------|-------------------|---------|
| persona-matcher | `schemas/persona-matcher-output.ts` | ❌ |
| email-drafter | `schemas/email-drafter-output.ts` | ❌ |
| response-triager | `schemas/response-triager-output.ts` | ❌ |
| escalation-handler | `schemas/escalation-handler-output.ts` | ❌ |

Only `schemas/status-yaml-schema.ts` exists.

**Root Cause**: Agent-Architect Phase 4 (Generation) specifies creating "Real Zod schemas with real fields" but validation step was missing. The static config gap (`config/escalation-actions/`) was the same class of issue.

**Solution**: Create the 4 missing output schemas based on each agent's CLAUDE.md structured output specification.

---

## Design Decisions

### Decision 1: Derive Schemas from CLAUDE.md Output Examples

**Choice**: Use the `Structured output` JSON examples in each agent's CLAUDE.md as the source of truth for schema fields.

**Rationale**:
- CLAUDE.md files contain real output examples with actual field names
- Event payloads in manifest.yaml define what downstream functions expect
- Ensures agent output matches what Inngest functions need

### Decision 2: Make Success/Error Pattern Consistent

**Choice**: All output schemas use a consistent pattern:
- `success: z.boolean()` - Always present
- `error: z.string().optional()` - Present when `success: false`
- Domain-specific fields - Present when `success: true`

**Rationale**:
- Predictable structure for error handling in Inngest functions
- Easy to validate "did this work?" before accessing domain fields

### Decision 3: Use Strict Enums Where Manifest Defines Them

**Choice**: When the manifest's event payload defines an enum (e.g., `classification`, `sentiment`), the output schema uses the same enum values.

**Rationale**:
- Output feeds directly into events
- Type safety end-to-end
- Catches mismatches at compile time

---

## Implementation Order

### Phase 1: agent-architect - Create persona-matcher-output.ts
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/schemas/persona-matcher-output.ts`
**Status**: ✅ Complete

Source: `agents/persona-matcher.md` lines 115-139

**Key fields from CLAUDE.md**:
- `matched: boolean` - Whether a persona match was found
- `persona_id: string | null` - The matched persona UUID
- `confidence_score: number` - Score from 0-1
- `reasoning: string` - Agent's explanation
- `all_scores: array` - All evaluated personas with scores
- `failure_reason?: string` - "no_match" or "insufficient_data"

**Events emitted**:
- `lead.match_passed` when `matched == true`
- `lead.match_failed` when `matched == false`

```typescript
import { z } from "zod";

const PersonaScoreSchema = z.object({
  persona_id: z.string().uuid(),
  score: z.number().min(0).max(1),
});

export const PersonaMatcherOutputSchema = z.object({
  success: z.boolean(),

  // Match result
  matched: z.boolean(),
  persona_id: z.string().uuid().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),

  // Context
  reasoning: z.string(),
  all_scores: z.array(PersonaScoreSchema),

  // Failure details (when matched == false)
  failure_reason: z.enum(["no_match", "insufficient_data"]).optional(),

  // Error case (when success == false)
  error: z.string().optional(),
});

export type PersonaMatcherOutput = z.infer<typeof PersonaMatcherOutputSchema>;
```

---

### Phase 2: agent-architect - Create email-drafter-output.ts
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/schemas/email-drafter-output.ts`
**Status**: ✅ Complete

Source: `agents/email-drafter.md` lines 156-171

**Key fields from CLAUDE.md**:
- `email_type: enum` - Type of email drafted
- `draft_version: number` - Version number
- `draft_path: string` - Path to draft file
- `subject: string` - Email subject line
- `body_preview: string` - Preview text
- `word_count: number` - Body word count
- `personalization_hooks: string[]` - What was personalized

**Events emitted**:
- `draft.completed`

```typescript
import { z } from "zod";

export const EmailDrafterOutputSchema = z.object({
  success: z.boolean(),

  // Draft identification
  email_type: z.enum([
    "initial_outreach",
    "reach_out_followup",
    "eex_1", "eex_2", "eex_3", "eex_4", "eex_5",
    "post_eex_initial",
    "post_eex_followup",
    "reply"
  ]),
  draft_version: z.number().int().positive(),
  draft_path: z.string(),

  // Draft content (for approval UI and Resend)
  subject: z.string().max(100),
  body_preview: z.string().max(500),
  word_count: z.number().int().nonnegative(),

  // Personalization metadata
  personalization_hooks: z.array(z.string()),

  // Error case
  error: z.string().optional(),
});

export type EmailDrafterOutput = z.infer<typeof EmailDrafterOutputSchema>;
```

---

### Phase 3: agent-architect - Create response-triager-output.ts
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/schemas/response-triager-output.ts`
**Status**: ✅ Complete

Source: `agents/response-triager.md` lines 183-226

**Key fields from CLAUDE.md**:
- `classification: enum` - The intent classification
- `sentiment: enum` - Positive/negative/neutral
- `recommended_action: string` - What to do next
- `confidence: number` - Confidence in classification
- `reasoning: string` - Why this classification
- `snooze_until?: string` - For delayed responses
- `snooze_reason?: string` - Why snoozing
- `question_summary?: string` - For question responses

**Events emitted**:
- `triage.completed`
- One of: `response.accept_gift`, `response.request_meeting`, `response.delayed`, `response.opt_out`, `response.not_interested`, `response.question`, `response.unclear`

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

  // Recommendation
  recommended_action: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),

  // For delayed classification
  snooze_until: z.string().datetime().nullable(),
  snooze_reason: z.string().nullable(),

  // For question classification
  question_summary: z.string().nullable(),

  // Error case
  error: z.string().optional(),
});

export type ResponseTriagerOutput = z.infer<typeof ResponseTriagerOutputSchema>;
```

---

### Phase 4: agent-architect - Create escalation-handler-output.ts
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle/schemas/escalation-handler-output.ts`
**Status**: ✅ Complete

Source: `agents/escalation-handler.md` lines 142-191

**Key fields from CLAUDE.md**:
- `action: enum` - The interpreted action
- `email_type?: string` - For revise_draft action
- `feedback?: string` - For revise_draft action
- `snooze_until?: string` - For snooze action
- `snooze_reason?: string` - For snooze action
- `terminate_reason?: string` - For terminate action

**Events emitted** (conditional on action):
- `draft.requested` when action == "revise_draft"
- `lead.terminated` when action == "terminate"
- `lead.snoozed` when action == "snooze"
- `response.request_meeting` when action == "schedule_meeting"

```typescript
import { z } from "zod";

export const EscalationHandlerOutputSchema = z.object({
  success: z.boolean(),

  // Interpreted action
  action: z.enum([
    "revise_draft",
    "terminate",
    "snooze",
    "schedule_meeting"
  ]),

  // For revise_draft
  email_type: z.string().nullable(),
  feedback: z.string().nullable(),

  // For snooze
  snooze_until: z.string().datetime().nullable(),
  snooze_reason: z.string().nullable(),

  // For terminate
  terminate_reason: z.string().nullable(),

  // Error case
  error: z.string().optional(),
});

export type EscalationHandlerOutput = z.infer<typeof EscalationHandlerOutputSchema>;
```

---

### Phase 5: agent-architect - Update CLAUDE.md Validation
**Location**: `/Users/scottstrang/agent-architect/CLAUDE.md`
**Status**: ✅ Complete

Add explicit schema validation step to Phase 4:

```markdown
### Phase 4: Generation

3. **Output schemas** - Real Zod schemas with real fields (per `docs/guides/structured-outputs.md`)

   **Output Schema Checklist:**
   For each agent in the manifest:
   - [ ] Schema file exists at path specified in `contract.output_schema`
   - [ ] Schema includes `success: z.boolean()` field
   - [ ] Schema includes `error: z.string().optional()` field
   - [ ] Schema fields match the "Structured output" examples in agent's CLAUDE.md
   - [ ] Enum values match event payload enums in manifest
```

---

### Phase 6: Test
**Location**: `/Users/scottstrang/agent-architect/workspace/kringle`
**Status**: ⏭️ Skipped - will test after related work

Test using agent-factory CLI to verify schemas are correctly consumed.

```bash
# From kringle directory
cd /Users/scottstrang/agent-architect/workspace/kringle

# Dry run to verify no schema errors
npx tsx ../../../agent-factory/src/cli.ts init \
  --manifest manifest.yaml \
  --merge-content . \
  --dry-run \
  --verbose
```

**Verify**:
- [ ] No "file not found" errors for output schemas
- [ ] Schema paths resolve correctly
- [ ] Generated agent functions import the schemas
- [ ] TypeScript compiles without errors

---

## Files to Modify Summary

### agent-architect
| File | Action | Phase | Status |
|------|--------|-------|--------|
| `workspace/kringle/schemas/persona-matcher-output.ts` | Create new | 1 | ✅ |
| `workspace/kringle/schemas/email-drafter-output.ts` | Create new | 2 | ✅ |
| `workspace/kringle/schemas/response-triager-output.ts` | Create new | 3 | ✅ |
| `workspace/kringle/schemas/escalation-handler-output.ts` | Create new | 4 | ✅ |
| `CLAUDE.md` | Add schema validation checklist | 5 | ✅ |

---

## Relationship to Other Plans

This plan extracts Phase 6 from `/plans/resend-schema/implementation-order.md` as a standalone fix.

**Why separate?**
- Output schemas are blocking (agent-factory references them)
- Typed integrations (resend-schema Phases 1-5) are additive improvements
- Can ship schema fix independently

**After this plan completes**, the resend-schema plan's Phase 6 can be marked complete.

---

## Runtime Behavior After Implementation

### At Build Time (agent-factory init)
```
$ npx tsx agent-factory/src/cli.ts init --manifest manifest.yaml --merge-content .

✓ Merged: schemas/persona-matcher-output.ts
✓ Merged: schemas/email-drafter-output.ts
✓ Merged: schemas/response-triager-output.ts
✓ Merged: schemas/escalation-handler-output.ts
```

### At Runtime (Inngest function)
```typescript
// Generated: inngest/functions/persona-matcher.ts
import { PersonaMatcherOutputSchema } from '../schemas/persona-matcher-output';

// After agent completes
const rawOutput = await agent.run(workspace);

// Validate before emitting events
const output = PersonaMatcherOutputSchema.parse(rawOutput);
// → Throws ZodError if agent produces invalid output

// Safe to emit
if (output.matched) {
  await inngest.send({ name: 'kringle/lead.match_passed', data: {...} });
} else {
  await inngest.send({ name: 'kringle/lead.match_failed', data: {...} });
}
```
