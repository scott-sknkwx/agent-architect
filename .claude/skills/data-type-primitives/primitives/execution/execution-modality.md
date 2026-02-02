# Execution Modality

How a step executes: human, agent, or workflow.

## Definition

**Execution Modality** defines WHO or WHAT performs a subtask and the interface contract for that executor. Each modality has different input/output schemas, capabilities, and constraints.

## The Three Modalities

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 AGENT                                                   │
│  ────────                                                   │
│  AI-powered execution for creative or judgment tasks        │
│                                                             │
│  • Has access to tools (Read, Write, WebSearch, etc.)       │
│  • Produces structured output matching a schema             │
│  • Can reason about context and make decisions              │
│  • Costs tokens, may have latency                           │
│                                                             │
│  Use for: Drafting content, classification, scoring,        │
│           complex routing, personalization                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  👤 HUMAN                                                   │
│  ─────────                                                  │
│  Manual execution requiring human judgment or approval      │
│                                                             │
│  • Sees an approval bundle or task UI                       │
│  • Makes decisions, provides input, reviews content         │
│  • Has unpredictable latency (minutes to days)              │
│  • May provide feedback or request changes                  │
│                                                             │
│  Use for: Approvals, quality gates, edge cases,             │
│           relationship decisions, policy exceptions         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚙️ WORKFLOW                                                │
│  ──────────                                                 │
│  Automated execution via functions or external services     │
│                                                             │
│  • Deterministic (same input = same output)                 │
│  • Fast, cheap, reliable                                    │
│  • No creative judgment                                     │
│  • Can call external APIs, transform data, emit events      │
│                                                             │
│  Use for: API calls, data transforms, scheduling,           │
│           notifications, template substitution              │
└─────────────────────────────────────────────────────────────┘
```

## Input/Output Schemas

### Agent Execution

```yaml
agent_step:
  # Configuration
  agent_id: string                # Which agent configuration to use

  # Inputs
  inputs:
    workspace_path: string        # Hydrated context directory
    context_in:
      db_records: json[]          # Data from database
      static_files: string[]      # Paths to config files
    prompt_source: string         # Path to CLAUDE.md

  # What agent can do
  allowed_tools:
    - Read
    - Write
    - Glob
    - Grep
    - WebSearch
    # etc.

  # Expected output
  output_schema: zod_schema       # Structured output definition

  # Execution result
  outputs:
    artifacts: file_path[]        # Files created
    structured_output: json       # Matching output_schema
    token_usage:
      input_tokens: integer
      output_tokens: integer
    duration_ms: integer
```

### Human Execution

```yaml
human_step:
  # Configuration
  task_type: enum                 # approval, input, review, decision

  # Inputs
  inputs:
    approval_bundle_id: uuid?     # For approval tasks
    context: json                 # Supporting information
    instructions: text            # What the human should do

  # Available actions
  allowed_actions:
    - approve
    - reject
    - edit
    - reassign
    - escalate

  # Constraints
  required_fields: string[]?      # Fields human must provide
  deadline: timestamp?            # When this must be done

  # Execution result
  outputs:
    decision: string              # Which action taken
    modifications: json?          # Any changes made
    feedback: text?               # Reason or notes
    decided_by: uuid
    decided_at: timestamp
```

### Workflow Execution

```yaml
workflow_step:
  # Configuration
  function_name: string           # Inngest function or handler

  # Inputs
  inputs:
    event_payload: json           # Triggering event data
    db_lookups:                   # Required data queries
      - table: string
        query: string
        as: string                # Variable name

  # What workflow can do
  allowed_operations:
    - transform                   # Data manipulation
    - api_call                    # External service
    - db_write                    # Persistence
    - emit_event                  # Trigger next step
    - schedule                    # Delayed execution

  # Execution result
  outputs:
    result: json                  # Operation result
    emitted_events: event[]       # Events triggered
    db_writes: write_op[]         # Persistence operations
    duration_ms: integer
```

## Choosing the Right Modality

| Task Characteristic | Modality |
|---------------------|----------|
| Requires creativity or personalization | 🤖 Agent |
| Requires judgment about edge cases | 🤖 Agent or 👤 Human |
| Requires policy/business decision | 👤 Human |
| Requires approval before proceeding | 👤 Human |
| Is deterministic (same input = same output) | ⚙️ Workflow |
| Calls external APIs | ⚙️ Workflow |
| Is time-sensitive (< 1 second) | ⚙️ Workflow |
| Requires relationship context | 👤 Human |
| Template substitution (no creativity) | ⚙️ Workflow |

## Examples by Subtask Type

### Email Drafting → Agent
```yaml
subtask:
  name: "Draft initial outreach email"
  type: "generation"
  assigned_to: "agent"
  agent_config:
    agent_id: "email-drafter"
    output_schema: EmailDraftSchema
```

### Email Sending → Workflow
```yaml
subtask:
  name: "Send email via Resend"
  type: "api_call"
  assigned_to: "workflow"
  workflow_config:
    function_name: "send-email"
    inputs:
      email_id: "{{subtask.email_id}}"
```

### Campaign Approval → Human
```yaml
subtask:
  name: "Review and approve campaign"
  type: "decision"
  assigned_to: "human"
  human_config:
    approval_bundle_id: "{{bundle.id}}"
    allowed_actions: ["approve", "reject", "request_edit", "reassign"]
```

### EEX Personalization → Workflow
```yaml
subtask:
  name: "Personalize EEX templates"
  type: "transform"
  assigned_to: "workflow"
  workflow_config:
    function_name: "personalize-eex"
    inputs:
      template_ids: ["eex_1", "eex_2", "eex_3", "eex_4", "eex_5"]
      variables:
        first_name: "{{lead.first_name}}"
        company: "{{lead.company}}"
```

### Lead Classification → Agent
```yaml
subtask:
  name: "Classify lead response"
  type: "decision"
  assigned_to: "agent"
  agent_config:
    agent_id: "response-triager"
    output_schema: ResponseClassificationSchema
```

### Reply Approval → Human
```yaml
subtask:
  name: "Approve drafted reply"
  type: "approval"
  assigned_to: "human"
  human_config:
    task_type: "approval"
    context:
      original_email: "{{thread.original}}"
      lead_response: "{{thread.response}}"
      drafted_reply: "{{draft.body}}"
    allowed_actions: ["approve", "edit", "reject"]
```

## Modality Transitions

Sometimes a subtask changes modality based on conditions:

```yaml
subtask:
  name: "Handle unclear response"
  default_modality: "agent"

  escalation_rules:
    - condition: "agent.confidence < 0.6"
      escalate_to: "human"
      reason: "Low confidence classification"

    - condition: "agent.output.category == 'escalate'"
      escalate_to: "human"
      reason: "Agent requested escalation"
```

## Events by Modality

| Modality | Events |
|----------|--------|
| 🤖 Agent | `agent.started`, `agent.completed`, `agent.failed`, `agent.escalated` |
| 👤 Human | `human.assigned`, `human.viewed`, `human.decided`, `human.timed_out` |
| ⚙️ Workflow | `workflow.started`, `workflow.completed`, `workflow.failed`, `workflow.retrying` |
