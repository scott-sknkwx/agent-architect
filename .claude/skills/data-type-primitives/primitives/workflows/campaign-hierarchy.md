# Campaign Hierarchy

The fundamental organizational structure for workflow automation.

## Why This Structure

Every automated workflow we build follows the same pattern: there's a primary entity (lead, order, ticket) that moves through stages, with work happening at each stage. Rather than reinvent this structure for each project, we use a consistent hierarchy:

```
Campaign → Phase → Task → Subtask
```

**Campaign** is the container—it tracks the full lifecycle of work against an entity.

**Phase** represents a distinct stage with its own rules (e.g., "Processing" requires human approval; "In-Flight" is autonomous).

**Task** is a logical unit of work that appears in dashboards and task lists.

**Subtask** is what actually executes—the atomic action assigned to a human, agent, or workflow.

This hierarchy enables:
- **Consistent tooling**: Same UI patterns, same event structures, same state machines
- **Template inheritance**: Platform → Organization → Instance at every level
- **Clear ownership**: Every subtask has an explicit assignee
- **Predictable events**: `campaign.approved`, `phase.started`, `task.completed`, `subtask.failed`

---

## Campaign

The top-level container representing the full lifecycle of work against an entity.

### Schema

```yaml
campaign:
  id: uuid
  name: string

  # What this operates on
  entity_type: string             # lead, order, ticket, etc.
  entity_id: uuid

  # Template lineage
  org_template_id: uuid
  platform_template_id: uuid?

  # Ownership
  org_id: uuid
  created_by: uuid

  # Status
  status: draft | pending_approval | active | paused | completed | canceled | failed
  approved_by: uuid?
  approved_at: timestamp?

  # Timestamps
  created_at: timestamp
  started_at: timestamp?
  completed_at: timestamp?

  # Composition
  phases: phase[]
  current_phase_id: uuid?
```

### Status Transitions

```
draft → pending_approval → active → completed
                │            │
                │            ├→ paused → active
                │            └→ failed
                └→ canceled
```

---

## Phase

A stage within a campaign with distinct execution rules.

### Schema

```yaml
phase:
  id: uuid
  campaign_id: uuid
  name: string
  sequence: integer

  # Status
  status: pending | active | completed | skipped | failed

  # Execution rules
  autonomous: boolean             # Runs without human intervention?
  interruptible: boolean          # Can external events alter flow?
  interrupt_events: string[]?     # Which events can interrupt

  # Timestamps
  started_at: timestamp?
  completed_at: timestamp?

  # Composition
  tasks: task[]
```

### Common Patterns

| Phase Type | Autonomous | Interruptible | Example |
|------------|------------|---------------|---------|
| Processing | No | No | Ingest → Enrich → Qualify → Approve |
| In-Flight | Yes | Yes | Execute sequence, handle responses |
| Terminal | Yes | No | Archive, analytics, cleanup |

---

## Task

A logical unit of work within a phase.

### Schema

```yaml
task:
  id: uuid
  phase_id: uuid
  name: string
  description: text?
  sequence: integer

  # Status (often derived from subtasks)
  status: pending | in_progress | blocked | completed | skipped | failed

  # Assignment (if task-level)
  assigned_to: human | agent | workflow
  assignee_id: uuid?

  # Timing
  due_at: timestamp?
  started_at: timestamp?
  completed_at: timestamp?

  # Dependencies
  depends_on: task_id[]?

  # Composition
  subtasks: subtask[]
```

### Status Derivation

Task status typically derives from subtask states:
- All pending → `pending`
- Any in_progress → `in_progress`
- Any blocked → `blocked`
- All completed → `completed`
- Any failed (no recovery) → `failed`

---

## Subtask

The atomic unit of work. This is what actually gets executed.

### Schema

```yaml
subtask:
  id: uuid
  task_id: uuid
  name: string
  description: text?

  # Classification
  type: string                    # email, review, decision, api_call, wait, etc.
  content_source: agent_drafted | template_sourced | user_provided | system_generated

  # Ordering & Timing
  sequence: integer
  trigger: immediate | after:{id} | delay:{duration} | event:{name} | manual
  due_at: timestamp?

  # Assignment
  assigned_to: human | agent | workflow
  assignee_id: uuid?

  # Status
  status: pending | queued | in_progress | awaiting_approval | completed | skipped | failed

  # Execution
  started_at: timestamp?
  completed_at: timestamp?
  result: json?
  error: text?

  # Retry
  attempt_count: integer
  max_attempts: integer
```

---

## Mapping to Manifest

The campaign hierarchy maps to manifest sections as follows:

### Events

Each level emits predictable events:

```yaml
# In manifest.yaml
events:
  # Campaign-level
  - name: campaign.created
    payload: { campaign_id, entity_type, entity_id, org_id }
  - name: campaign.approved
    payload: { campaign_id, approved_by }
  - name: campaign.completed
    payload: { campaign_id, outcome }

  # Phase-level
  - name: phase.started
    payload: { campaign_id, phase_id, phase_name }
  - name: phase.completed
    payload: { campaign_id, phase_id }

  # Task-level
  - name: task.started
    payload: { campaign_id, task_id, task_name }
  - name: task.completed
    payload: { campaign_id, task_id }

  # Subtask-level
  - name: subtask.completed
    payload: { campaign_id, task_id, subtask_id, result }
  - name: subtask.failed
    payload: { campaign_id, task_id, subtask_id, error }
```

### Database Tables

```yaml
# In manifest.yaml
database:
  tables:
    - name: campaigns
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: entity_type, type: text }
        - { name: entity_id, type: uuid }
        - { name: org_template_id, type: uuid, references: org_templates.id }
        - { name: status, type: text }
        - { name: current_phase_id, type: uuid }
        - { name: org_id, type: uuid }
      access:
        - { actor: tenant, operations: [SELECT, INSERT, UPDATE], condition: "org_id = :actor" }

    - name: phases
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: campaign_id, type: uuid, references: campaigns.id }
        - { name: name, type: text }
        - { name: sequence, type: integer }
        - { name: status, type: text }
        - { name: autonomous, type: boolean }

    - name: tasks
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: phase_id, type: uuid, references: phases.id }
        - { name: name, type: text }
        - { name: sequence, type: integer }
        - { name: status, type: text }
        - { name: assigned_to, type: text }

    - name: subtasks
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: task_id, type: uuid, references: tasks.id }
        - { name: name, type: text }
        - { name: type, type: text }
        - { name: sequence, type: integer }
        - { name: status, type: text }
        - { name: assigned_to, type: text }
        - { name: content_source, type: text }
        - { name: result, type: jsonb }
```

### Agents

Agents execute subtasks where `assigned_to: agent`:

```yaml
# In manifest.yaml
agents:
  - name: email-drafter
    description: "Drafts personalized emails"
    contract:
      trigger: subtask.queued
      filter: "subtask.assigned_to == 'agent' && subtask.type == 'generation'"
      context_in:
        db:
          - query: "SELECT * FROM campaigns WHERE id = :campaign_id"
            as: campaign
          - query: "SELECT * FROM subtasks WHERE id = :subtask_id"
            as: subtask
      output_schema: schemas/email-draft.ts
```

### Functions

Functions execute subtasks where `assigned_to: workflow`:

```yaml
# In manifest.yaml
functions:
  - name: send-email
    description: "Sends email via Resend"
    trigger: subtask.queued
    filter: "subtask.assigned_to == 'workflow' && subtask.type == 'email'"
    steps:
      - load subtask and email content
      - call Resend API
      - update subtask.status = 'completed'
      - emit subtask.completed
```

---

## Best Practices

### Naming Conventions

| Level | Convention | Examples |
|-------|------------|----------|
| Campaign | `{Persona/Type} {Action}` | "DevOps Leader Outreach", "Enterprise Fulfillment" |
| Phase | Noun or gerund | "Processing", "In-Flight", "Completed" |
| Task | Verb phrase | "Approve Campaign", "Send Outreach", "Handle Response" |
| Subtask | Specific action | "Draft initial email", "Call Resend API", "Review persona match" |

### Status Ownership

- **Campaign/Phase status**: Managed by orchestration layer (Inngest)
- **Task status**: Derived from subtasks OR managed by orchestrator
- **Subtask status**: Managed by the executor (agent/human/workflow)

### When to Create New Levels

| Situation | Solution |
|-----------|----------|
| Need to track progress in UI | Create a Task |
| Need different execution rules | Create a Phase |
| Need atomic retry/rollback | Make it a Subtask |
| Same structure, different entity | New Campaign with same template |

### Template Layering

```yaml
# Platform template (rarely changes)
platform_templates:
  - name: "Standard Outreach"
    phases: [Processing, In-Flight, Completed]

# Org template (per persona/product)
org_templates:
  - name: "Senior DevOps Leader"
    platform_template_id: "standard-outreach"
    overrides:
      phases.in_flight.tasks: [custom EEX sequence]

# Live instance (per entity)
campaigns:
  - org_template_id: "senior-devops-leader"
    entity_type: lead
    entity_id: "lead_jane_smith"
    # Variables for personalization
    variables: { first_name: "Jane", company: "Acme" }
```
