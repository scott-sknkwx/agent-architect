# Executor Model Pattern

## Overview

Every step in an agent system has an **executor** - the actor responsible for performing the action. Understanding executor types helps design appropriate schemas, UI contracts, and error handling for each step.

## Three Executor Types

### 🤖 Agent

A Claude agent processes complex tasks requiring judgment, creativity, or multi-step reasoning.

**In Manifest:**
```yaml
agents:
  - name: persona-matcher
    triggers:
      - event: lead.enriched
    emits:
      - event: lead.matched
```

**Characteristics:**
- Has a CLAUDE.md with instructions
- Uses tools (Read, Write, Glob, Task, etc.)
- Produces structured output
- Token cost per invocation
- May need retries on failure
- Workspace for artifacts

**Best For:**
- Classification/scoring tasks
- Creative content generation
- Multi-step reasoning
- Tasks requiring judgment

### 👤 Human

A human performs actions through a UI, typically approvals, escalation resolution, or configuration.

**In Manifest:**
Human steps are implicit - they're the events that connect human actions to system responses:

```yaml
events:
  - name: campaign.approved
    description: "Human approved the campaign bundle"

functions:
  - name: approve-campaign-items
    trigger:
      event: campaign.approved  # Human action triggers this
```

**Characteristics:**
- Action originates from UI click/form submission
- Emits events that trigger functions/agents
- May include modifications/feedback in payload
- No token cost (human labor cost instead)
- Latency is unpredictable (minutes to days)
- May need reminders/timeouts

**Best For:**
- Approval gates
- Escalation resolution
- Configuration changes
- Quality control checkpoints

### ⚙️ Automated

A non-agentic function handles deterministic operations - API calls, database updates, routing logic.

**In Manifest:**
```yaml
functions:
  - name: personalize-eex
    pattern: simple
    trigger:
      event: wrapper_emails.drafted
    emits:
      - eex.personalized
```

**Characteristics:**
- Pure code (no Claude invocation)
- Deterministic given same inputs
- Fast execution (<1 second typically)
- No token cost
- Easy to test/debug
- Can batch operations

**Best For:**
- API integrations (Resend, Clay, etc.)
- Database CRUD operations
- Template personalization
- Event routing
- Fan-out operations
- Timeout/schedule handling

## Event-Driven Connection

All three executors communicate via events through Inngest:

```
Event fires
    │
    ▼
Inngest routes to handler
    │
    ├── Agent? → Spawn Claude agent → Agent emits events
    │
    ├── Human? → Wait for UI action → UI emits events
    │
    └── Automated? → Run function → Function emits events
```

There's no "autonomous mode" toggle - the system is always event-driven. The appearance of autonomy comes from event chains that don't include human executor steps.

## Choosing the Right Executor

| Task | Executor | Why |
|------|----------|-----|
| Score lead against personas | 🤖 Agent | Requires judgment |
| Draft personalized email | 🤖 Agent | Creative content |
| Classify email response | 🤖 Agent | NLP understanding |
| Approve campaign bundle | 👤 Human | Quality gate |
| Resolve escalation | 👤 Human | Requires human judgment |
| Cancel campaign | 👤 Human | User-initiated action |
| Personalize template | ⚙️ Automated | Deterministic substitution |
| Send email via Resend | ⚙️ Automated | API call |
| Update database status | ⚙️ Automated | CRUD operation |
| Route triage result | ⚙️ Automated | Conditional logic |
| Check timeouts | ⚙️ Automated | Scheduled query |

## Manifest Conventions

To make executor types clear in the manifest, use comments:

```yaml
agents:
  # ─────────────────────────────────────────────────────────
  # PERSONA MATCHER AGENT
  # Executor: 🤖 Agent
  # ─────────────────────────────────────────────────────────
  - name: persona-matcher
    ...

functions:
  # ─────────────────────────────────────────────────────────
  # APPROVAL FUNCTIONS (Single Human Touchpoint)
  # Triggered by: 👤 Human
  # ─────────────────────────────────────────────────────────
  - name: approve-campaign-items
    ...

  # ─────────────────────────────────────────────────────────
  # EMAIL SENDING FUNCTIONS
  # Executor: ⚙️ Automated
  # ─────────────────────────────────────────────────────────
  - name: send-reach-out-initial
    ...
```

## Related Patterns

- **Bundle Approval Pattern** - Human executor design
- **Content Sourcing Pattern** - Agent vs Automated for content
