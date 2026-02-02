# Bundle Approval Pattern

## Overview

The Bundle Approval pattern consolidates multiple approval decisions into a single human touchpoint. Instead of requiring humans to approve each item individually (causing approval fatigue), the system prepares all items upfront and presents them as a bundle for one review.

## The Problem

```
BAD: Per-item approval (approval fatigue)
────────────────────────────────────────

match → [approve?] → draft email 1 → [approve?] → send → draft email 2 → [approve?] → ...

Human reviews: 5+ times per lead
Result: Slow, frustrating, low throughput
```

## The Solution

```
GOOD: Bundle approval (single touchpoint)
─────────────────────────────────────────

match → draft ALL → personalize ALL → [APPROVE BUNDLE] → auto-send → auto-send → ...

Human reviews: 1 time per lead
Result: Fast, satisfying, high throughput
```

## Pattern Components

### 1. Campaign Items Table

Track individual executable items with their source and status:

```yaml
campaign_items:
  columns:
    - campaign_id      # Parent bundle
    - item_type        # "email", "notification", etc.
    - sequence         # Execution order (1, 2, 3...)
    - content_source   # "agent_drafted" or "template_sourced"
    - status           # "pending", "approved", "sent", "skipped"
    - subject          # Email subject
    - body             # Email body
```

### 2. Content Source Distinction

| Source | Meaning | Who Creates | Human Editable? |
|--------|---------|-------------|-----------------|
| `agent_drafted` | Creative, personalized content | Claude agent | Yes |
| `template_sourced` | Deterministic personalization | Non-agentic function | Preview only |

### 3. Approval Bundle Events

```yaml
# Human clicks APPROVE in UI
campaign.approved:
  payload:
    campaign_id: string
    approved_by: string
    modifications: string (optional)

# Human clicks REJECT
campaign.rejected:
  payload:
    campaign_id: string
    rejected_by: string
    feedback: string

# Human requests changes to agent-drafted content
campaign.revision_requested:
  payload:
    campaign_id: string
    feedback: string

# Human wants different persona assignment
campaign.persona_change_requested:
  payload:
    campaign_id: string
    new_persona_id: string (optional)
    feedback: string
```

### 4. Fan-Out on Approval

When `campaign.approved` fires, a function marks ALL items as approved:

```yaml
- name: approve-campaign-items
  trigger:
    event: campaign.approved
  actions:
    - "UPDATE campaign_items SET status = 'approved' WHERE campaign_id = payload.campaign_id"
  emits:
    - reach_out.started  # Begin autonomous execution
```

## UI Contract

The approval bundle UI should present:

| Section | Content | Editable? |
|---------|---------|-----------|
| Lead Info | Name, title, company, enrichment data | No |
| Persona Match | Matched persona, confidence score, reasoning | No (can request change) |
| Agent-Drafted Emails | Wrapper emails (4) | Yes |
| Template-Sourced Emails | EEX sequence (5) | Preview only |

Actions available:
- **Approve** → Marks all items approved, starts execution
- **Reject** → Terminates lead
- **Request Edit** → Returns to agent with feedback
- **Change Persona** → Restarts persona matching

## When to Use This Pattern

Use Bundle Approval when:
- Multiple related items need human review
- Items share context (same lead, same campaign)
- Approval fatigue would harm throughput
- Items can be prepared upfront

Don't use Bundle Approval when:
- Items arrive at unpredictable times
- Each item genuinely needs independent consideration
- Items have no shared context

## Example: Kringle Lead Campaign

```
Campaign Bundle (9 items):
├── 1. reach_out_initial      (agent_drafted)    ◄── Editable
├── 2. reach_out_followup     (agent_drafted)    ◄── Editable
├── 3. eex_1                  (template_sourced) ◄── Preview
├── 4. eex_2                  (template_sourced) ◄── Preview
├── 5. eex_3                  (template_sourced) ◄── Preview
├── 6. eex_4                  (template_sourced) ◄── Preview
├── 7. eex_5                  (template_sourced) ◄── Preview
├── 8. post_eex_initial       (agent_drafted)    ◄── Editable
└── 9. post_eex_followup      (agent_drafted)    ◄── Editable

Human reviews ONCE → All 9 items approved → Autonomous execution begins
```

## Related Patterns

- **Content Sourcing Pattern** - Distinguishing agent_drafted vs template_sourced
- **Event-Driven Execution** - How approved items get sent
