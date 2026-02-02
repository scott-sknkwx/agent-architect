---
name: discovery
description: Guides the discovery interview at the start of any new agent system design. Use when a human describes what they want to build and you need to capture all requirements.
---

# Discovery Interview

Invoke at the start of any new agent system design. Guides the conversation to capture all requirements before moving to domain modeling.

## How to Use This Skill

Ask these questions **conversationally, not as a checklist**. Adapt based on answers. Skip questions that don't apply. Dig deeper when answers reveal complexity.

---

## Discovery Questions

### 1. Trigger
What starts the process?
- External webhook (from what service?)
- Scheduled job (how often?)
- Manual submission (via what interface?)

### 2. Goal
What's the end state?
- Data in a CRM?
- Email sent?
- Report generated?
- Human notified?

### 3. Domain
What concepts exist?
- What's the primary entity? (lead, podcast, ticket, document)
- What states can it be in?
- What data needs to be tracked?

### 4. Actors & Access
Who interacts with this system and what can they see?
- Who are the different types of users? (end users, admins, agents, service accounts)
- Is this multi-tenant? Single-tenant? User-scoped?
- For each data type: Who can read it? Who can write it? Under what conditions?
- Are there relationships that grant access? (team membership, ownership, delegation)
- Do agents need different access than humans?

### 5. Constraints
- Human approval needed where?
- Budget/cost sensitivity?
- Speed requirements?
- Integration requirements?

### 6. Approval Patterns (CRITICAL for good UX)
- Where does a human NEED to approve something?
- Can we BATCH approvals? (Review multiple things at once?)
- Once approved, what should be fully autonomous?
- What would cause "approval fatigue" if done individually?
- Is there a single "point of commitment" we can design around?

### 7. Content Sourcing
- What content is generated per-entity by agents?
- What content is templated/pre-built (per persona, per org, etc.)?
- What's the right level of personalization vs. consistency?

### 8. Token Economics
- Are we willing to "waste" tokens drafting content that might be rejected?
- Is front-loading work (draft everything upfront) better than incremental?
- What's the cost of a rejection late in the flow vs. early?

### 9. Autonomy Boundaries
- After a human approves, what CAN run without further input?
- What events MUST interrupt the autonomous flow?
- Can we get to "approve once, run automatically"?

---

## Signals to Listen For

### Approval Pattern Signals
| Signal | Interpretation |
|--------|----------------|
| "I don't want to approve every email" | Batch approval needed |
| "Once we commit to this lead..." | Identify the commitment point |
| "The [X] is pre-defined..." | Template-sourced, not agent-drafted |
| "After approval it should just run" | Define autonomy boundary |

### Access Pattern Signals
| Signal | Interpretation |
|--------|----------------|
| "Only the owner should see..." | Owner-based access |
| "Everyone in the org..." | Tenant isolation |
| "Admins can see all..." | Role-based access |
| "If you're on the team..." | Relationship-based access |
| "Anyone can read but only authenticated users can write..." | Public read, auth write |

---

## Output Checklist

After discovery, you should have answers to:

- [ ] What triggers the system?
- [ ] What's the terminal state?
- [ ] What's the primary entity and its states?
- [ ] Who are the actors?
- [ ] What are the access patterns?
- [ ] Where are approval points?
- [ ] Can approvals be batched?
- [ ] What content is agent-drafted vs template-sourced?
- [ ] What are the autonomy boundaries?

**Next step:** Proceed to Phase 2: Domain Modeling with these answers.

---

## Example Discovery Flow

```
Human: "I want to build a system that processes leads from our website"

You: "Let's start with what triggers this. How do leads come in?
      - Website form submission?
      - Third-party service webhook?
      - Manual CSV upload?"