# Approval Bundle

What a human reviews at a single touchpoint.

## Definition

An **Approval Bundle** is the package of information presented to a human for review at a single decision point. It consolidates multiple related items so the human can make one informed decision rather than many small ones.

The bundle exists to REDUCE approval fatigue by batching related decisions.

## Schema

```yaml
approval_bundle:
  id: uuid
  campaign_id: uuid

  # What task this bundle is for
  task_id: uuid                   # The approval task this serves

  # What the human sees
  sections:
    - section[]

  # Available actions
  actions:
    - action[]

  # Status
  status: enum
    - pending                     # Awaiting review
    - in_review                   # Human is actively reviewing
    - approved                    # Human approved
    - rejected                    # Human rejected
    - revision_requested          # Human wants changes
    - reassigned                  # Human changed assignment

  # Decision tracking
  decided_by: uuid?
  decided_at: timestamp?
  decision_notes: text?

  # Timestamps
  created_at: timestamp
  expires_at: timestamp?          # Optional deadline
```

## Section Types

```yaml
section:
  id: string
  title: string
  type: enum
    - summary                     # Key facts, read-only
    - review_items                # Items requiring evaluation
    - preview                     # View-only content (not editable)
    - editable                    # Content human can modify

  content: json                   # Structure depends on type

  # For review_items
  items:
    - subtask_id: uuid            # Links to actual subtask
      status: enum                # pending_review | approved | rejected
      editable: boolean
```

## Action Types

```yaml
action:
  name: string                    # approve, reject, request_edit, reassign
  label: string                   # "Approve Campaign", "Reject Lead"

  # What happens when clicked
  marks_approved: subtask_id[]?   # Subtasks to mark as approved
  emits_event: string             # Event to emit
  event_payload: json?            # Additional data for event

  # Behavior
  requires_reason: boolean        # Must provide explanation?
  terminal: boolean               # Ends the review?
  next_state: string?             # What status to transition to
```

## Example: Lead Campaign Approval

```yaml
approval_bundle:
  id: "ab_lead_jane..."
  campaign_id: "c_01abc..."
  task_id: "task_approve_campaign"

  sections:
    - id: "lead_info"
      title: "Lead Information"
      type: "summary"
      content:
        name: "Jane Smith"
        title: "VP of Platform Engineering"
        company: "Acme Corp"
        email: "jane@acme.com"
        linkedin: "linkedin.com/in/janesmith"
        page_visited: "/kubernetes-best-practices"

    - id: "enrichment"
      title: "Enrichment Data"
      type: "summary"
      content:
        clay_data:
          company_size: "500-1000"
          industry: "Technology"
          funding: "Series C"
        firecrawl_data:
          company_description: "Cloud infrastructure provider..."
          technologies: ["Kubernetes", "Terraform", "AWS"]

    - id: "persona_match"
      title: "Persona Assignment"
      type: "review_items"
      items:
        - subtask_id: "st_review_match"
          name: "Persona Match"
          value: "Senior DevOps Leader"
          confidence: 87
          reasoning: "Strong signals: VP title, platform engineering, K8s page visit"
          status: "pending_review"

    - id: "wrapper_emails"
      title: "Agent-Drafted Emails"
      type: "review_items"
      items:
        - subtask_id: "st_email_initial"
          name: "Initial Outreach"
          subject: "Quick question about Acme's K8s journey"
          preview: "Hi Jane, I noticed you were exploring..."
          status: "pending_review"
          editable: true
        - subtask_id: "st_email_followup"
          name: "Follow-up"
          subject: "Re: Quick question"
          preview: "Hi Jane, wanted to follow up..."
          status: "pending_review"
          editable: true

    - id: "eex_preview"
      title: "EEX Sequence (Template-Sourced)"
      type: "preview"
      content:
        sequence_name: "DevOps Excellence Email Experience"
        email_count: 5
        note: "Content inherited from Senior DevOps Leader persona"

  actions:
    - name: "approve"
      label: "Approve & Start Campaign"
      marks_approved: ["st_email_initial", "st_email_followup", "st_eex_1", "st_eex_2", "st_eex_3", "st_eex_4", "st_eex_5", "st_post_initial", "st_post_followup"]
      emits_event: "campaign.approved"
      terminal: true
      next_state: "approved"

    - name: "reject"
      label: "Reject Lead"
      requires_reason: true
      emits_event: "lead.rejected"
      terminal: true
      next_state: "rejected"

    - name: "request_edit"
      label: "Request Changes"
      requires_reason: true
      emits_event: "draft.revision_requested"
      terminal: false
      next_state: "revision_requested"

    - name: "reassign"
      label: "Change Persona"
      requires_reason: false
      emits_event: "campaign.reassignment_requested"
      event_payload_schema:
        new_persona_id: uuid
      terminal: false
      next_state: "reassigned"

  status: "pending"
```

## The Fan-Out Pattern

When a human clicks "Approve", the bundle triggers fan-out to mark multiple subtasks:

```
Human clicks [APPROVE]
        │
        ▼
campaign.approved event
        │
        ▼
┌───────────────────────────────────────┐
│  FAN-OUT: Mark all items as approved  │
│                                       │
│  UPDATE subtasks                      │
│  SET status = 'approved'              │
│  WHERE id IN (bundle.marks_approved)  │
└───────────────────────────────────────┘
        │
        ▼
reach_out.started event
        │
        ▼
Campaign begins autonomously
```

## UI Rendering Hint

The bundle schema is designed to be UI-agnostic, but a typical rendering:

```
┌─────────────────────────────────────────────────────────────┐
│  CAMPAIGN APPROVAL                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 Lead Information                    [Collapse ▼]        │
│  ───────────────────                                        │
│  Jane Smith • VP of Platform Engineering                    │
│  Acme Corp • jane@acme.com                                  │
│                                                             │
│  🎯 Persona Match                       [Review Required]   │
│  ──────────────                                             │
│  Senior DevOps Leader (87% confidence)                      │
│  Reasoning: "Strong signals..."                             │
│                                                             │
│  📧 Emails (4)                          [Review Required]   │
│  ────────────                                               │
│  [1] Initial Outreach    [Preview] [Edit]                   │
│  [2] Follow-up           [Preview] [Edit]                   │
│  [3] Post-EEX Initial    [Preview] [Edit]                   │
│  [4] Post-EEX Follow-up  [Preview] [Edit]                   │
│                                                             │
│  📚 EEX Sequence                        [View Only]         │
│  ──────────────                                             │
│  5 emails from "DevOps Excellence" template                 │
│  [Preview Full Sequence]                                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [APPROVE]  [REJECT]  [REQUEST EDIT]  [CHANGE PERSONA]      │
└─────────────────────────────────────────────────────────────┘
```

## Events Emitted

| Event | When |
|-------|------|
| `approval_bundle.created` | Bundle ready for review |
| `approval_bundle.viewed` | Human opened bundle |
| `approval_bundle.approved` | Human approved |
| `approval_bundle.rejected` | Human rejected |
| `approval_bundle.revision_requested` | Human wants changes |
| `approval_bundle.reassigned` | Human changed assignment |
| `approval_bundle.expired` | Deadline passed without decision |
