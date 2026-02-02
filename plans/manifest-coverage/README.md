# Manifest Coverage Analysis

**Status**: Discovery / Discussion
**Created**: 2026-01-29
**Purpose**: Identify gaps between our discovery process and what the manifest schema requires, propose solutions

---

## The Problem

The current discovery process in CLAUDE.md doesn't gather enough information to fully populate a manifest. Some gaps are intentional (secrets belong elsewhere), but others represent missing conversations that lead to incomplete or assumed implementations.

---

## Gap Analysis

### ✅ Intentionally Skipped (Not Our Problem)

| Schema Section | Why We Skip It |
|----------------|----------------|
| `infrastructure.inngest.*` | Secrets/keys are post-factory config |
| `infrastructure.supabase.*` | Secrets/keys are post-factory config |
| `infrastructure.anthropic.api_key` | Secret, not design concern |
| `infrastructure.deployment` | Deployment target is ops, not architecture |

**Principle**: Agent Architect designs the WHAT. Factory and deployment handle the HOW and WHERE.

---

### ⚠️ Gaps We Need to Close

#### 1. Database Schema Discovery

**Current state**: We ask "what data needs to be tracked" but don't drill into columns, types, relationships.

**Why it matters**: Database schema is foundational. Getting it wrong creates friction throughout the entire system. This is a "gotcha" that bites most projects.

**Proposed approach**: Progressive disclosure
1. Start with entities (tables) from domain modeling
2. For each entity, ask: "What do we need to know about a [lead]?"
3. Then dig deeper: "Any relationships between [leads] and [companies]?"
4. Finally: "Which fields are required vs optional?"

**Open questions**:
- Should we have a "common patterns" library? (created_at, updated_at, org_id for tenancy, etc.)
- How do we handle evolving schemas? (MVP columns vs "we'll need this later")
- Should we generate migration-ready SQL or just logical schema?

---

#### 2. Agentic vs Non-Agentic Decision Framework

**Current state**: Process focuses entirely on agents. The `functions` section of the manifest is never explored.

**The question**: When should something be an agent vs a function?

**Proposed heuristic**:

| Use an AGENT when... | Use a FUNCTION when... |
|---------------------|------------------------|
| Judgment required | Pure data transformation |
| Multiple valid approaches | Deterministic logic |
| Context interpretation needed | Simple routing/fan-out |
| Output quality matters | Speed/cost matters |
| Failure modes need reasoning | Failure modes are binary |

**Examples**:
- "Qualify this lead against ICP" → **Agent** (judgment)
- "Route webhook to correct handler based on type" → **Function** (routing)
- "Wait for 3 enrichment results then combine" → **Function** (fan-in)
- "Write personalized email" → **Agent** (creativity)
- "Send the email via Resend" → **Function** (API call)

**Open questions**:
- How do we ask about this in discovery without overwhelming?
- Should we propose agent vs function during Phase 2 and let user correct?

---

#### 3. Flow Description Framework (THE LOOP)

**Current state**: We describe agents in prose but lack a structured way to describe the full execution flow including validation, persistence, and emit patterns.

**Proposed framework**: Every flow (agent or function) follows THE LOOP:

```
EVENT → VALIDATE INPUT → PROCESS → VALIDATE OUTPUT → PERSIST → EMIT
```

**The Loop in Detail**:

```
┌─────────────────┐
│     EVENT       │  ← What triggers this?
└────────┬────────┘
         ▼
┌─────────────────┐
│ VALIDATE INPUT  │  ← What must be true before we start?
│ • event payload │     • Required fields present?
│ • data exists   │     • Referenced records exist?
│ • state correct │     • Entity in expected state?
│ • files present │     • Required artifacts available?
└────────┬────────┘
         ▼
┌─────────────────┐
│    PROCESS      │  ← The actual work (agent or function)
│                 │
│ [AGENT]         │     prompt + skills + tools + subagents
│    or           │
│ [FUNCTION]      │     deterministic code logic
└────────┬────────┘
         ▼
┌─────────────────┐
│ VALIDATE OUTPUT │  ← What must be true after we finish?
│ • result shape  │     • Schema validation passed?
│ • artifacts     │     • Required files created?
│ • quality gates │     • Business rules satisfied?
└────────┬────────┘
         ▼
┌─────────────────┐
│    PERSIST      │  ← What do we save?
│ • update db     │     • Record state changes
│ • store files   │     • Store artifacts to storage
│ • audit log     │     • Track what happened
└────────┬────────┘
         ▼
┌─────────────────┐
│     EMIT        │  ← What happens next?
└─────────────────┘
```

**Emit Patterns**:

| Pattern | Description | Example |
|---------|-------------|---------|
| IMMEDIATE | Triggers next step now | `lead.qualified` → Starts Writer |
| DELAYED | Triggers after time passes | `followup.scheduled` in 3 days |
| WAIT FOR HUMAN | Pauses until external action | `approval.requested` → dashboard click |
| POLL/CHECK | Wake up, check condition, maybe continue | Check for reply, re-queue if none |
| FAN OUT | Trigger multiple parallel steps | Enrich from 3 sources simultaneously |
| FAN IN | Wait for multiple steps to complete | Combine results when all enrichments done |

**YAML Representation** (proposed):

```yaml
flows:
  - name: qualify-lead
    trigger:
      event: lead.created

    validate_input:
      - payload: [lead_id, org_id]
      - exists: leads.id = {{ lead_id }}
      - state: leads.status IN ['new', 'retry']

    process:
      type: agent
      agent: qualifier

    validate_output:
      schema: QualifierOutput
      require_artifacts: false

    persist:
      - update: leads SET status = {{ result.status }}, score = {{ result.score }}
      - log: qualification_events

    emit:
      - when: result.qualified == true
        event: lead.qualified
      - when: result.qualified == false
        event: lead.disqualified
```

**Open questions**:
- Is this too verbose for the manifest? Should it be a separate file per flow?
- How do we make validation rules expressive but not code?
- Should persist be declarative or just "call this function"?

---

#### 4. Model Selection Per Agent

**Current state**: We assume or don't ask.

**Proposed approach**: Ask during Phase 3 deep dive:

> "This agent is [doing X]. Does it need to be:
> - **Fast & cheap** (haiku) - good for simple extraction, routing
> - **Balanced** (sonnet) - good for most tasks
> - **Maximum quality** (opus) - good for complex reasoning, writing"

**Heuristic defaults**:
| Task Type | Default Model |
|-----------|---------------|
| Data extraction | haiku |
| Classification/routing | haiku |
| Research/analysis | sonnet |
| Writing/creative | sonnet or opus |
| Complex multi-step reasoning | opus |

---

#### 5. Observability (Lower Priority)

**Current state**: Never asked.

**Proposed**: Add to Phase 1 constraints:
> "Any specific logging or monitoring requirements? (Most projects use defaults)"

Default to:
```yaml
observability:
  logging:
    level: info
    format: json
  tracing:
    enabled: true
```

---

## Summary: What to Add to CLAUDE.md

### Phase 1 Additions

```markdown
6. **Integrations**: What external services will this connect to?
   - Email? (Resend)
   - Enrichment? (Clay)
   - Webhooks from? (list sources)
   - Payments? (Stripe)
```

### Phase 2 Additions

```markdown
4. **Flows**: For each agent AND each non-agentic step:
   - What triggers it?
   - What must be true before it runs?
   - What does it do?
   - What must be true after?
   - What does it persist?
   - What does it emit next?

5. **Agent vs Function**: For each processing step, determine:
   - Does this require judgment? → Agent
   - Is this deterministic? → Function
```

### Phase 3 Additions

```markdown
6. **Model**: Does this agent need:
   - Fast/cheap (haiku)
   - Balanced (sonnet)
   - Maximum quality (opus)

7. **Database Detail**: For entities this agent touches:
   - What columns are needed?
   - Which are required?
   - Any relationships?
```

---

## Next Steps

1. **Validate THE LOOP** - Does this framework capture all patterns we've seen?
2. **Test on existing examples** - Can we retrofit lead-qualification manifest to this format?
3. **Design the YAML format** - How verbose should flow descriptions be?
4. **Update CLAUDE.md** - Add the new questions
5. **Create "common patterns" library** - Reusable database patterns, flow patterns

---

## The One-Sentence Version

> Event → Validate → Process → Validate → Persist → Emit → (repeat)

Everything else is details.
