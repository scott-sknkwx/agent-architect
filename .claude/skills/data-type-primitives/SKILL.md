---
name: data-type-primitives
description: Reusable data type primitives used across projects. Reference these when designing new systems to accelerate development with proven, opinionated patterns.
---

# Data Type Primitives

Standardized building blocks for rapid system design. These primitives encode opinionated patterns that have proven effective across multiple projects.

## Philosophy

### 1. Hierarchical Composition Over Flat Structures

Complex workflows decompose into predictable hierarchies:

```
Campaign → Phase → Task → Subtask
```

Each level has clear responsibilities:
- **Campaign**: The overarching goal with lifecycle status
- **Phase**: A stage of the campaign (e.g., Processing, In-Flight, Completed)
- **Task**: A unit of work within a phase (e.g., "Approve Lead")
- **Subtask**: An atomic action within a task (e.g., "Review persona match")

### 2. Three-Layer Template Inheritance

Content and configuration flow through three layers:

```
Platform Template (admin-defined defaults)
    └── Organization Template (tenant customization)
        └── Live Instance (entity-specific execution)
```

This enables:
- Platform-wide defaults that "just work"
- Organization-level customization without code changes
- Per-entity variation where needed

### 3. Explicit Assignment

Every actionable item has an explicit assignee:

| Assignee Type | Examples |
|---------------|----------|
| `human` | User reviews, approvals, manual actions |
| `agent` | AI-driven decisions, drafting, classification |
| `workflow` | Automated functions, scheduled jobs, event handlers |

No orphaned tasks. No implicit ownership.

### 4. Status as State Machine

Every primitive with status follows state machine principles:
- Defined valid transitions
- Terminal states are explicit
- Status changes emit events

### 5. Content Sourcing Distinction

Distinguish HOW content is created:

| Source | Meaning | Example |
|--------|---------|---------|
| `agent_drafted` | AI generates creative content | Personalized email copy |
| `template_sourced` | Template + variable substitution | EEX course emails |
| `user_provided` | Human-entered content | Manual notes |
| `system_generated` | Deterministic computation | Timestamps, IDs |

---

## Primitive Index

### Actors
Who interacts with the system.

| Primitive | Description | File |
|-----------|-------------|------|
| [Organizations](#organizations) | Tenant isolation boundary | `primitives/actors/organizations.md` |
| [Users](#users) | Human actors and memberships | `primitives/actors/users.md` |

### Workflows
How work is structured.

| Primitive | Description | File |
|-----------|-------------|------|
| [Campaign Hierarchy](#campaign-hierarchy) | Campaign → Phase → Task → Subtask | `primitives/workflows/campaign-hierarchy.md` |
| [Template Layer](#template-layer) | Three-tier template inheritance | `primitives/workflows/template-layer.md` |

### Execution
How work gets done.

| Primitive | Description | File |
|-----------|-------------|------|
| [Execution Modality](#execution-modality) | Agent / Human / Workflow contracts | `primitives/execution/execution-modality.md` |
| [Subtask Types](#subtask-types) | Approvals, emails, and other patterns | `primitives/execution/subtask-types.md` |
| [Approval Bundle](#approval-bundle) | What humans review at a touchpoint | `primitives/execution/approval-bundle.md` |

---

## Quick Reference

### Campaign Hierarchy

```yaml
campaign:
  id: uuid
  entity_type: string        # What this campaign is for (lead, order, ticket)
  entity_id: uuid            # The specific entity instance
  template_id: uuid          # Organization template this derives from
  status: enum               # draft, active, paused, completed, canceled
  phases:
    - phase[]
```

### Subtask Properties (Leaf Node)

```yaml
subtask:
  id: uuid
  task_id: uuid
  type: string               # email, notification, api_call, review, etc.
  name: string               # Human-readable name
  description: text          # What this subtask accomplishes
  status: enum               # pending, in_progress, completed, skipped, failed
  assigned_to: enum          # human | agent | workflow
  assignee_id: uuid?         # Specific user/agent/function if applicable
  due_at: timestamp?         # When this should be completed
  content_source: enum       # agent_drafted | template_sourced | user_provided
  sequence: integer          # Order within parent task
```

### Template Layer Resolution

```
resolve_template(entity, field):
  1. Check live_instance[entity_id][field]
  2. Fall back to org_template[org_id][field]
  3. Fall back to platform_template[field]
  4. Error if no value at any layer
```

---

## Usage

When designing a new system:

1. **Identify the primary entity** (lead, order, ticket, document)
2. **Map the lifecycle phases** (what stages does it go through?)
3. **Define tasks per phase** (what work happens in each stage?)
4. **Break tasks into subtasks** (what atomic actions make up each task?)
5. **Assign each subtask** (human, agent, or workflow?)
6. **Identify template layers** (what's platform vs org vs instance?)
7. **Define approval bundles** (what does a human review together?)

Reference the individual primitive files for detailed schemas and examples.
