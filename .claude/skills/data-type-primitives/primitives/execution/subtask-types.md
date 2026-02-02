# Subtask Types

Common subtask patterns within campaigns.

> **Note**: Approvals and emails are NOT separate primitives—they're specialized subtask types executed within the campaign hierarchy. This document catalogs the most common patterns.

---

## Approval Subtasks

Human decision points within a campaign.

### When to Use

- Gate before autonomous execution begins
- Quality check on agent-drafted content
- Policy decision requiring human judgment
- Exception handling for edge cases

### Schema

```yaml
subtask:
  type: approval
  assigned_to: human

  # What's being approved
  approval_config:
    bundle_id: uuid               # Reference to approval_bundle
    # OR inline definition:
    review_items:
      - subtask_id: uuid          # Items to mark approved/rejected
        label: string
        editable: boolean

    # Available actions
    actions:
      - name: approve
        marks_approved: subtask_id[]
        emits: campaign.approved
      - name: reject
        emits: entity.rejected
        requires_reason: true
      - name: request_edit
        emits: draft.revision_requested
        requires_reason: true

    # Constraints
    deadline: timestamp?
    auto_action_on_timeout: approve | reject | escalate
```

### Example: Campaign Approval

```yaml
subtask:
  id: "st_approve_campaign"
  task_id: "task_approval"
  name: "Review and approve campaign"
  type: approval
  assigned_to: human
  assignee_rule: "campaign.created_by"

  approval_config:
    bundle_id: "ab_lead_jane"
    actions:
      - { name: approve, marks_approved: [st_email_1, st_email_2, st_eex_1, st_eex_2, st_eex_3, st_eex_4, st_eex_5] }
      - { name: reject, emits: lead.rejected, requires_reason: true }
      - { name: request_edit, emits: draft.revision_requested }
      - { name: reassign, emits: campaign.reassignment_requested }
```

### Example: Reply Approval

```yaml
subtask:
  id: "st_approve_reply"
  task_id: "task_handle_question"
  name: "Approve drafted reply"
  type: approval
  assigned_to: human
  trigger: "after:st_draft_reply"

  approval_config:
    review_items:
      - subtask_id: "st_draft_reply"
        label: "Reply Email"
        editable: true
    actions:
      - { name: approve, marks_approved: [st_send_reply] }
      - { name: edit, returns_to: st_draft_reply }
```

### Fan-Out Pattern

When approval completes, mark multiple downstream subtasks as approved:

```
Human clicks [APPROVE]
        │
        ▼
subtask.completed (type: approval)
        │
        ▼
┌───────────────────────────────────────┐
│  FAN-OUT                              │
│                                       │
│  UPDATE subtasks                      │
│  SET status = 'approved'              │
│  WHERE id IN (marks_approved)         │
└───────────────────────────────────────┘
        │
        ▼
Each approved subtask now eligible to execute
```

---

## Email Subtasks

Sending emails via external provider (Resend, SendGrid, etc.).

### When to Use

- Outreach emails (cold, follow-up)
- Transactional emails (notifications, confirmations)
- Drip sequences (EEX, nurture)
- Reply emails (response to inbound)

### Schema

```yaml
subtask:
  type: email
  assigned_to: workflow           # Sending is automated
  content_source: agent_drafted | template_sourced

  email_config:
    # Content (mutually exclusive based on content_source)
    draft_id: uuid?               # If agent_drafted, reference to draft
    template_id: string?          # If template_sourced, template name

    # Recipient
    to: string                    # Email address or variable
    to_name: string?

    # Sending
    from_email: string            # Configured sender
    from_name: string
    reply_to: string?

    # Tracking
    track_opens: boolean
    track_clicks: boolean

    # Scheduling
    send_at: timestamp?           # Scheduled send time

  # Result (populated after send)
  result:
    provider_id: string           # Resend message ID
    sent_at: timestamp
    status: sent | delivered | bounced | complained
```

### Example: Agent-Drafted Outreach

```yaml
subtask:
  id: "st_send_initial"
  task_id: "task_reach_out"
  name: "Send initial outreach email"
  type: email
  assigned_to: workflow
  content_source: agent_drafted
  trigger: "event:campaign.approved"
  status: approved                # Pre-approved via bundle

  email_config:
    draft_id: "draft_initial_outreach"
    to: "{{lead.email}}"
    to_name: "{{lead.first_name}} {{lead.last_name}}"
    from_email: "{{org.sender_email}}"
    from_name: "{{org.sender_name}}"
    track_opens: true
    track_clicks: true
```

### Example: Template-Sourced EEX

```yaml
subtask:
  id: "st_eex_lesson_1"
  task_id: "task_eex_sequence"
  name: "Send EEX Lesson 1"
  type: email
  assigned_to: workflow
  content_source: template_sourced
  trigger: "event:lead.accepted_gift"
  status: approved                # Pre-approved via bundle

  email_config:
    template_id: "eex_devops_lesson_1"
    to: "{{lead.email}}"
    # Template variables resolved from lead + persona
    variables:
      first_name: "{{lead.first_name}}"
      company: "{{lead.company}}"
```

### Email Lifecycle

```
draft (if agent_drafted)
    │
    ▼
approved (via approval subtask or pre-approved)
    │
    ▼
queued (ready to send)
    │
    ▼
sent ──► delivered
    │         │
    │         ├──► opened
    │         │       │
    │         │       └──► clicked
    │         │
    │         └──► bounced / complained
    │
    └──► failed (API error, retry)
```

---

## Other Common Subtask Types

### API Call

```yaml
subtask:
  type: api_call
  assigned_to: workflow

  api_config:
    service: clay | resend | slack | custom
    endpoint: string
    method: GET | POST | PUT | DELETE
    payload: json
    retry:
      max_attempts: 3
      backoff: exponential
```

### Wait

```yaml
subtask:
  type: wait
  assigned_to: workflow

  wait_config:
    duration: "3d"                # Fixed duration
    # OR
    until_event: "lead.responded" # Wait for event
    timeout: "7d"                 # Max wait time
    timeout_action: continue | fail | escalate
```

### Data Transform

```yaml
subtask:
  type: transform
  assigned_to: workflow

  transform_config:
    input: json_path              # Where to read
    operation: merge | map | filter | enrich
    output: table.column          # Where to write
```

### Agent Generation

```yaml
subtask:
  type: generation
  assigned_to: agent
  content_source: agent_drafted

  agent_config:
    agent_id: string              # Which agent to invoke
    output_schema: string         # Expected output shape
    context:                      # What agent receives
      - "{{lead}}"
      - "{{persona}}"
      - "{{previous_emails}}"
```

### Review (Human)

```yaml
subtask:
  type: review
  assigned_to: human

  review_config:
    item_type: lead | email | campaign
    item_id: uuid
    checklist:
      - "Verify contact information"
      - "Confirm persona fit"
    outcome_options:
      - { value: "pass", label: "Looks good" }
      - { value: "fail", label: "Issues found", requires_notes: true }
```

---

## Mapping to Manifest

### Subtask Type → Function

```yaml
functions:
  # Email sending
  - name: send-email
    trigger: subtask.queued
    filter: "subtask.type == 'email' && subtask.status == 'approved'"
    integrations: [resend]

  # API calls
  - name: execute-api-call
    trigger: subtask.queued
    filter: "subtask.type == 'api_call'"

  # Waits (via Inngest sleep)
  - name: execute-wait
    trigger: subtask.queued
    filter: "subtask.type == 'wait'"
```

### Subtask Type → Agent

```yaml
agents:
  - name: email-drafter
    trigger: subtask.queued
    filter: "subtask.type == 'generation' && subtask.agent_config.agent_id == 'email-drafter'"

  - name: response-triager
    trigger: subtask.queued
    filter: "subtask.type == 'generation' && subtask.agent_config.agent_id == 'response-triager'"
```

### Approval → UI Component

Approval subtasks map to UI components:

```yaml
ui:
  components:
    - name: ApprovalBundle
      renders_subtask_type: approval
      props_from: subtask.approval_config
```
