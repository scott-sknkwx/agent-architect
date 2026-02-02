---
name: function-spec-generation
description: Capture function implementation context during interviews. Generate specs, not code. Give implementers everything they need to build without guessing.
---

# Function Spec Generation

I capture implementation context for non-agentic functions during interviews, producing `.spec.md` files that serve as both requirements and documentation.

## The Principle

**I generate specs, not code.**

| I Do | I Don't Do |
|------|------------|
| Capture WHAT the function should do | Write TypeScript implementations |
| Ask questions until context is complete | Assume or guess details |
| Document edge cases and error handling | Leave gaps for implementer to fill |
| Scale depth to complexity | Over-specify trivial functions |

## When to Use

- During Phase 3.5 (Function Deep Dive) of the interview
- When a non-agentic function appears in the manifest
- When the human says "let's spec out [function]"
- Before generation phase, after domain modeling

## Prerequisites

Before generating specs, ensure:
1. **Lifecycle diagram exists** (Phase 2.5) — This defines the phases
2. **Functions are listed in manifest** — This provides pattern and trigger info
3. **Domain model is clear** — Tables, events, state machine are defined

## Phase Assignment

**Phase comes from the lifecycle diagram created in Phase 2.5.**

### Process

1. **Read the lifecycle diagram** in `docs/{entity}-lifecycle-architecture.md`
2. **Identify which phase** the function operates in:
   - Look at the trigger event — what phase emits it?
   - Look at the output events — what phase consumes them?
   - Where does this function appear in the flow?
3. **Use the diagram's phase names** — Don't invent new ones

### Phase Format

Use: `{Major Phase} → {Sub-phase}`

**Examples from a typical lead lifecycle:**
```
Processing → Ingest       # Webhook ingestion, initial validation
Processing → Enrich       # Data enrichment, scraping
Processing → Qualify      # Matching, scoring
Processing → Setup        # Campaign creation, drafting
Processing → Approval     # Human review, approval actions

In Flight → Reach Out     # Initial outreach emails
In Flight → EEX           # Educational sequence
In Flight → Post-EEX      # Follow-up after education
In Flight → Response      # Handling replies
In Flight → Suppression   # Opt-outs, bounces

Completed → Terminal      # Final state handlers, analytics

Cross-cutting → Scheduling  # Cron jobs
Cross-cutting → Routing     # Event dispatchers
```

### Cross-cutting Functions

Some functions don't fit in a single phase:
- **Cron jobs** → `Cross-cutting → Scheduling`
- **Event routers** → `Cross-cutting → Routing`
- **Utilities** → `Cross-cutting → Utilities`

## Complexity Classification

First, classify the function:

| Complexity | Signals | Spec Depth |
|------------|---------|------------|
| **Trivial** | Webhook → validate → emit, no DB writes, 1-2 steps | Minimal |
| **Simple** | 3-5 steps, single integration, linear flow | Standard |
| **Complex** | Fan-in, routing, multi-integration, conditional logic | Comprehensive |

## The Interview Pattern

```
1. IDENTIFY the function's purpose
   "What is this function supposed to accomplish?"
   "Why does the system need this?"

2. MAP the trigger and flow
   "What event or schedule triggers this?"
   "Walk me through what happens step by step"

3. DIG INTO specifics based on complexity
   - Trivial: Just confirm the pattern
   - Simple: Database queries, error handling
   - Complex: All details, edge cases, examples

4. CAPTURE configuration
   "Are there any thresholds, limits, or constants?"
   "What values might need tuning?"

5. DOCUMENT uncertainty
   "What questions are still open?"
   "What might we need to revisit?"

6. WRITE the spec
   Use the template from plans/function-capability/spec-format.md
```

## Questions by Category

### Trigger & Input
- What event triggers this function? (or what cron schedule?)
- What data does the event payload contain?
- For crons: What data do you query to find items to process?

### Steps & Logic
- Walk me through what happens, step by step
- For each step: What data does it need? What does it produce?
- What's the happy path? What are the alternative paths?

### Database Operations
- What tables does this function read from?
- What tables does it write to?
- What are the query conditions? (WHERE clauses, limits)
- What fields are selected, inserted, or updated?

### Integration Calls
- What external APIs does this call?
- What does the request look like? The response?
- How do you handle rate limits, errors, timeouts?

### Configuration
- What values are hardcoded that might need to change?
- What thresholds or limits exist?
- Should any of these be environment variables?

### Error Handling
- What errors can occur at each step?
- Which errors should retry? Which should not?
- What fallback behavior exists?
- How do we log or alert on failures?

### Output
- What events does this function emit?
- What's the payload shape for each event?
- Does the function return a value? What shape?

### Edge Cases (Complex only)
- What happens if [unusual scenario]?
- What about [boundary condition]?
- How do we handle [concurrent execution]?

## Spec Sections by Complexity

### Trivial (Minimal Spec)
```markdown
# Function: {name}

| Property | Value |
|----------|-------|
| Complexity | Trivial |
| Pattern | {pattern} |
| Phase | {phase from lifecycle diagram} |
| Status | Spec Complete |

## Purpose
{1-2 sentences}

## Trigger
{event or cron}

## Input
{payload shape}

## Output
{events emitted}
```

### Simple (Standard Spec)
All of Trivial, plus:
- Steps (ordered list of operations)
- Database Operations (tables, queries)
- Error Handling (retryable vs non-retryable)
- Configuration (constants, limits)

### Complex (Comprehensive Spec)
All of Simple, plus:
- Integration Calls (API details)
- Edge Cases (what-ifs)
- Examples (concrete input → output)
- Related Functions (upstream/downstream)
- Open Questions (unresolved decisions)

## Output Location

Write specs to: `workspace/{product}/functions/specs/{function-name}.spec.md`

Agent Factory will merge these to: `{project}/inngest/functions/specs/`

## Spec Index (README.md)

After generating all specs, create `functions/specs/README.md` that:

1. **Groups specs by lifecycle phase** from the Phase 2.5 diagram
2. **Lists each function** with pattern, complexity, and link
3. **Notes which components are agents** (not specs)

```markdown
# {Product} Function Specs

## Quick Stats
| Metric | Count |
|--------|-------|
| Total Specs | {n} |

## Specs by Phase

### {Major Phase}

#### {Sub-phase}
| Function | Pattern | Complexity |
|----------|---------|------------|
| [function-name](function-name.spec.md) | simple | Trivial |

...

## Agents (Not in Specs)
| Agent | Purpose |
|-------|---------|
| agent-name | Brief description |
```

**Why create this index?**
- Navigation for implementers
- Architecture documentation
- Completeness verification

## Anti-patterns

- **Writing TypeScript** — Specs capture intent; the project has the implementation context
- **Leaving gaps** — If you don't know, ASK; don't leave the implementer guessing
- **Over-specifying trivial functions** — A webhook handler doesn't need edge cases
- **Under-specifying complex functions** — Fan-in patterns need examples
- **Assuming database schema** — Confirm table and column names explicitly
- **Skipping error handling** — Every step can fail; capture what happens

## Example: check-response-timeouts

**Interview snippet:**

> Human: "We need to check for leads that haven't responded."
>
> Me: "What triggers this check?"
> Human: "Cron, every 30 minutes."
>
> Me: "What's the timeout threshold?"
> Human: "48 hours after the email was sent."
>
> Me: "What table has the sent timestamp?"
> Human: "campaign_items, the sent_at column."
>
> Me: "What do you do when you find a timed-out item?"
> Human: "Emit a timeout event so the next step can run."

**Resulting spec:** See `plans/function-capability/spec-format.md` for the full example.

## Reference

Full spec template: `plans/function-capability/spec-format.md`
Approach overview: `plans/function-capability/README.md`
