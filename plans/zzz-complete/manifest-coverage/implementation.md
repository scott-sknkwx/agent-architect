# Manifest Coverage Gaps Implementation

**Status**: Complete (Phases 1-5 Full, Phase 6 Lightweight)
**Created**: 2026-02-02
**Source**: `plans/manifest-coverage/README.md` analysis + design discussion

---

## Overview

Close the gaps between what discovery captures and what the manifest schema requires. Improve the discovery process to gather complete information for manifest generation without requiring assumptions.

## Problem Statement

The current discovery process doesn't gather enough information to fully populate a manifest. This leads to:
- Incomplete database schemas (missing columns, relationships)
- All processing steps assumed to be agents (functions never explored)
- Model selection assumed rather than chosen
- Validation and persistence logic undocumented

## Decisions Made

| Gap | Decision |
|-----|----------|
| **Database Schema** | Common patterns library, MVP columns only, infer → confirm, logical schema only |
| **Agent vs Function** | Integrated into Phase 2 visualization, inferred judgment, confirm with user |
| **Flow Framework** | Keep in manifest, SQL-like validation, declarative persist |
| **Model Selection** | Explicitly ask during Phase 3 deep dive |
| **Observability** | Keep defaults, low priority |

**Key Constraints:**
- Supabase auto-generates `id` (UUID), `created_at`, `updated_at` — DO NOT include in schema discussions
- Only ask about business-relevant columns
- Infer first, confirm second (reduce cognitive load)

---

## Implementation Phases

### Phase 1: Common Patterns Library

**Goal:** Create reusable database and flow patterns to accelerate discovery.

#### 1.1 Database Column Patterns

Create `context/patterns/database-patterns.md`:

```markdown
# Database Patterns

## Auto-Generated (Never Ask About)
Supabase handles these automatically:
- `id` (UUID, primary key)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone, trigger-maintained)

## Common Business Columns

### Tenancy
| Column | Type | When to Use |
|--------|------|-------------|
| `org_id` | uuid | Multi-tenant, references orgs table |
| `user_id` | uuid | User-scoped data, references auth.users |
| `team_id` | uuid | Team-scoped, references teams table |

### Ownership & Attribution
| Column | Type | When to Use |
|--------|------|-------------|
| `created_by` | uuid | Track who created record |
| `assigned_to` | uuid | Current owner/assignee |
| `owned_by` | uuid | Business ownership (vs creator) |

### State & Status
| Column | Type | When to Use |
|--------|------|-------------|
| `status` | text | State machine state (use enum constraint) |
| `archived_at` | timestamp | Soft delete pattern |
| `deleted_at` | timestamp | Soft delete with audit |

### External References
| Column | Type | When to Use |
|--------|------|-------------|
| `external_id` | text | ID from external system |
| `source` | text | Where data originated |
| `source_url` | text | Link back to source |
```

#### 1.2 Flow Patterns Library

Create `context/patterns/flow-patterns.md`:

```markdown
# Flow Patterns

## Executor Types
| Type | Symbol | When to Use |
|------|--------|-------------|
| Agent | 🤖 | Judgment required, output varies by context |
| Function | ⚙️ | Deterministic, same input → same output |
| Human | 👤 | Approval, escalation, manual action |

## Common Flow Patterns

### Webhook Ingestion (⚙️ Function)
- Trigger: External webhook
- Validate: Schema, required fields, signature
- Process: Parse, normalize, lookup org
- Persist: Insert record, log event
- Emit: `{entity}.received`

### Qualification (🤖 Agent)
- Trigger: `{entity}.received`
- Validate: Entity exists, status = 'new'
- Process: Evaluate against criteria, score
- Persist: Update status, store reasoning
- Emit: `{entity}.qualified` or `{entity}.disqualified`

### Content Generation (🤖 Agent)
- Trigger: `{entity}.qualified`
- Validate: Entity exists, has required context
- Process: Draft content using context + templates
- Persist: Store draft, update status
- Emit: `{entity}.drafted`

### Batch Approval (👤 Human)
- Trigger: `batch.ready` (or manual dashboard action)
- Validate: Items exist, all in 'pending_review' status
- Process: Human reviews, approves/rejects each
- Persist: Update statuses
- Emit: `batch.approved` (fans out to individual items)

### Send/Execute (⚙️ Function)
- Trigger: `{entity}.approved`
- Validate: Entity approved, not already sent
- Process: Call external API (email, CRM, etc.)
- Persist: Update status, store response
- Emit: `{entity}.sent` or `{entity}.failed`

### Timeout Check (⚙️ Function, Cron)
- Trigger: Cron schedule
- Validate: N/A (queries for candidates)
- Process: Find stale items, determine action
- Persist: Update status if needed
- Emit: `{entity}.timed_out` or re-queue
```

#### 1.3 Deliverables

- [x] `context/patterns/database-patterns.md` — Column patterns with guidance
- [x] `context/patterns/flow-patterns.md` — Common flow patterns with executor types
- [x] Update `CLAUDE.md` patterns reference table

---

### Phase 2: Enhanced Discovery Questions

**Goal:** Add structured questions to capture database schema and integrations.

#### 2.1 Update Discovery Skill

Edit `.claude/skills/discovery/SKILL.md` to add:

```markdown
### 10. Database Schema (Progressive Disclosure)

For each entity identified in Domain (question 3):

**Step 1: Core Fields**
> "For a [lead], what information do we need to track beyond the basics?"
> (Skip: id, created_at, updated_at — Supabase handles these)

**Step 2: Relationships**
> "Does a [lead] belong to anything? (org, user, campaign, etc.)"
> "Can a [lead] have multiple [X]? (one-to-many)"

**Step 3: Constraints**
> "Which fields are required vs optional?"
> "Any fields with specific allowed values? (status = draft|sent|delivered)"

**Confirm before moving on:**
> "Here's what I have for the [leads] table: [list columns]. Does this capture everything for MVP?"

### 11. Integrations

> "What external services will this connect to?"
> - Email sending? (Resend)
> - Lead enrichment? (Clay)
> - Webhooks from? (RB2B, Stripe, etc.)
> - Payments? (Stripe)
> - Browser automation? (Parallel)
> - Other?
```

#### 2.2 Update Output Checklist

Add to discovery output checklist:

```markdown
- [ ] Database tables with columns (MVP only, logical schema)
- [ ] Relationships between tables
- [ ] Required vs optional fields
- [ ] External integrations needed
```

#### 2.3 Deliverables

- [x] Updated `.claude/skills/discovery/SKILL.md` with questions 10-11
- [x] Updated output checklist

---

### Phase 3: Integrated Flow Classification (Phase 2.5 Enhancement)

**Goal:** During lifecycle visualization, classify each step as agent/function/human with full flow details.

#### 3.1 Update Phase 2.5 Process

Edit `CLAUDE.md` Phase 2.5 section and `.claude/skills/discovery/retrospective.md`:

```markdown
### Phase 2.5: Lifecycle Visualization with Flow Classification

For each step in the lifecycle:

1. **Draw the step** with executor symbol:
   - 🤖 = Agent (judgment required)
   - ⚙️ = Function (deterministic)
   - 👤 = Human (approval/manual)

2. **Define the flow** for each step:
   | Field | Description |
   |-------|-------------|
   | Executor | 🤖 Agent / ⚙️ Function / 👤 Human |
   | Trigger | Event name (e.g., `lead.qualified`) |
   | Input Validation | What must be true before starting |
   | Steps | What happens during processing |
   | Output Validation | What must be true after |
   | Persist | What database changes occur |
   | Emit | What event(s) fire next |

3. **Present and confirm:**
   > "Here's how I've classified each step. Does this match your mental model?"
   > [Show table with all steps]

4. **Iterate** until alignment (expect 2-3 rounds)
```

#### 3.2 Flow Classification Heuristics

Add to `context/patterns/flow-patterns.md`:

```markdown
## Classification Heuristics

**Use 🤖 Agent when:**
- Task requires judgment or interpretation
- Multiple valid approaches exist
- Output quality matters more than speed
- "Figure out the right answer"

**Use ⚙️ Function when:**
- Logic is fully deterministic
- Same input always produces same output
- Rules can be expressed as code (if/then/else)
- Speed or cost matters more than nuance

**Use 👤 Human when:**
- Approval or sign-off required
- Escalation from automated process
- Manual correction needed
- Legal/compliance checkpoint

**Quick Test:** If complete logic fits a flowchart with no "it depends" nodes → Function
```

#### 3.3 Deliverables

- [x] Updated `CLAUDE.md` Phase 2.5 with flow classification
- [x] Updated `.claude/skills/discovery/retrospective.md`
- [x] Flow classification heuristics in patterns (included in Phase 1 flow-patterns.md)

---

### Phase 4: Manifest Schema Extensions

**Goal:** Add validation and persist fields to manifest schema.

#### 4.1 Schema Changes

Edit `context/manifest/schema.ts`:

```typescript
// Add to agent/function definitions

const ValidationRuleSchema = z.object({
  // Payload field checks
  payload: z.array(z.string()).optional(),
  // Entity existence checks (SQL-like)
  exists: z.string().optional(),
  // State checks (SQL-like)
  state: z.string().optional(),
  // Artifact checks
  files: z.array(z.string()).optional(),
});

const PersistActionSchema = z.union([
  // Declarative update
  z.object({
    update: z.string(),
    set: z.record(z.string(), z.string()),
    where: z.string().optional(),
  }),
  // Declarative insert
  z.object({
    insert: z.string(),
    values: z.record(z.string(), z.string()),
  }),
  // Declarative log
  z.object({
    log: z.string(),
    data: z.record(z.string(), z.string()).optional(),
  }),
  // Escape hatch for complex logic
  z.object({
    custom_function: z.string(),
  }),
]);

// Add to AgentSchema and FunctionSchema
const FlowFieldsSchema = z.object({
  validate_input: ValidationRuleSchema.optional(),
  validate_output: z.object({
    schema: z.string().optional(),
    require_artifacts: z.boolean().optional(),
  }).optional(),
  persist: z.array(PersistActionSchema).optional(),
});
```

#### 4.2 Update Reference Documentation

Edit `context/manifest/reference.md` to document:

- `validate_input` field syntax and examples
- `validate_output` field syntax
- `persist` action types with examples
- When to use `custom_function` escape hatch

#### 4.3 Deliverables

- [x] Updated `context/manifest/schema.ts` with validation/persist fields
- [x] Updated `context/manifest/reference.md` with documentation
- [x] Example snippets showing usage (included in reference.md)

---

### Phase 5: Model Selection in Deep Dive

**Goal:** Explicitly ask about model choice during Phase 3.

#### 5.1 Update Phase 3 Process

Edit `CLAUDE.md` Phase 3 section:

```markdown
### Phase 3: Deep Dive

For each agent, ask:

1. **Input**: What context does this agent need?
2. **Process**: What steps? What logic?
3. **Output**: What fields matter?
4. **Boundaries**: What should it explicitly NOT do?
5. **Failure**: What happens when things go wrong?
6. **Model Selection**:
   > "This agent [does X]. What's the right cost/quality tradeoff?"
   > - **Fast & cheap** (haiku) — Simple extraction, classification
   > - **Balanced** (sonnet) — Most tasks, good default
   > - **Maximum quality** (opus) — Complex reasoning, important writing

**Default Heuristics (propose, then confirm):**
| Task Type | Default |
|-----------|---------|
| Data extraction | haiku |
| Classification/routing | haiku |
| Research/analysis | sonnet |
| Writing/creative | sonnet |
| Complex multi-step reasoning | opus |
```

#### 5.2 Deliverables

- [x] Updated `CLAUDE.md` Phase 3 with model selection question
- [x] Default heuristics table

---

### Phase 6: Validation with New Example

**Goal:** Create a new example using the enhanced discovery process to validate all changes work together.

#### 6.1 Example Domain Selection

Choose a domain that exercises all patterns:
- Multiple entities with relationships
- Mix of agents, functions, human steps
- External integrations
- Batch approval pattern
- Different model needs per agent

**Suggested:** Podcast guest outreach system
- Entities: podcasts, hosts, pitches, campaigns
- Agents: research host, draft pitch, personalize
- Functions: ingest RSS, send email, check replies
- Human: approve pitch batch
- Integrations: Firecrawl (scrape), Resend (email)

#### 6.2 Validation Checklist

- [ ] Run full discovery using updated skill
- [ ] Generate lifecycle visualization with flow classification
- [ ] Confirm database schema captures all MVP columns
- [ ] Verify agent/function/human classification is correct
- [ ] Generate manifest with new validation/persist fields
- [ ] Model selection explicitly chosen for each agent
- [ ] All patterns from library used appropriately

#### 6.3 Deliverables

- [x] `workspace/podcast-outreach/manifest.yaml` — Lightweight validation example
- [ ] Full workspace artifacts (CLAUDE.md, schemas, specs) — Deferred to real usage
- [ ] Document any gaps discovered during validation — Deferred to real usage
- [ ] Refinements to discovery process based on learnings — Deferred to real usage

**Note:** Phase 6 completed as lightweight validation only. The manifest.yaml demonstrates all new features (validate_input, validate_output, persist, model selection, database patterns, agent/function classification). Full workspace artifacts will be validated during actual product discovery sessions.

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `context/patterns/database-patterns.md` | Create | Column patterns library |
| `context/patterns/flow-patterns.md` | Create | Flow patterns with executor types |
| `.claude/skills/discovery/SKILL.md` | Edit | Add questions 10-11 (database, integrations) |
| `.claude/skills/discovery/retrospective.md` | Edit | Add flow classification to Phase 2.5 |
| `CLAUDE.md` | Edit | Update Phase 2.5 and Phase 3 sections |
| `context/manifest/schema.ts` | Edit | Add validation/persist schema fields |
| `context/manifest/reference.md` | Edit | Document new fields |
| `workspace/podcast-outreach/` | Create | Validation example |

---

## Success Criteria

1. **Discovery captures complete information** — No assumptions needed during manifest generation
2. **Database schema is MVP-focused** — Only business columns, Supabase defaults excluded
3. **Agent/function/human classification is explicit** — Every step has clear executor type
4. **Flow details are captured** — Trigger, validation, persist, emit for each step
5. **Model selection is intentional** — Every agent has explicitly chosen model
6. **New example validates end-to-end** — Full workflow exercised with enhanced process

---

## References

- Source analysis: `plans/manifest-coverage/README.md`
- Current discovery: `.claude/skills/discovery/SKILL.md`
- Manifest schema: `context/manifest/schema.ts`
- Existing patterns: `context/patterns/`
