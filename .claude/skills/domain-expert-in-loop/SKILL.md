---
name: domain-expert-in-loop
description: Ensure domain expert validation of architectural decisions. The magic happens at the intersection of technical capability and domain expertise.
---

# Domain Expert in the Loop

Neither technical knowledge nor domain knowledge alone produces the right architecture. The intersection is where the magic happens.

## The Problem

| Who | Has | Misses |
|-----|-----|--------|
| **Engineer** | Technical patterns, event schemas, state machines | Business intent, UX expectations, approval fatigue |
| **Domain Expert** | Business flow, user needs, operational reality | Implementation constraints, system boundaries |

Building without domain expert validation produces technically correct but UX-hostile systems.

## The Pattern

```
1. PROPOSE architecture (don't ask "what should I build?")
   - Draw a diagram or write a summary
   - Make your assumptions explicit
   - Show the flow as you understand it

2. ASK for CORRECTION (not validation)
   - "Does this match your mental model?"
   - "What's wrong with this picture?"
   - NOT "Is this correct?" (invites rubber-stamping)

3. LISTEN for UX-driven architectural insights
   - "There's no sense making the human review both X and Y separately"
   - "Once they approve, it should just run"
   - "That would cause approval fatigue"

4. TRANSLATE insights into technical patterns
   - "Bundle approvals" → Single touchpoint with fan-out
   - "Just runs after" → Autonomous execution with pre-checks
   - "Approval fatigue" → Batch operations, not per-item

5. ITERATE until mental models align
   - Expect 2-3 rounds
   - Each round gets closer to the right abstraction
```

## Key Questions That Invite Correction

**Instead of:** "Is this architecture correct?"
**Ask:** "Does this match how you think about [the process]?"

**Instead of:** "Should I add feature X?"
**Ask:** "What happens when [edge case]? I assumed [X], is that right?"

**Instead of:** "What do you want?"
**Ask:** "Here's what I understood—what did I get wrong?"

## Recognizing UX-Driven Insights

Domain experts often express architectural insights in UX terms:

| They Say | You Hear |
|----------|----------|
| "That's too many clicks" | Batch operations needed |
| "They'd just approve everything anyway" | Wrong approval granularity |
| "Once they say yes, it should just go" | Autonomous execution phase |
| "They need to see X before deciding" | Bundle includes X |
| "That would be annoying" | Wrong human touchpoint location |

These insights often reveal the RIGHT abstraction.

## The Bundle Insight Example

**User said:** "There's no sense in making the human review both the buyer persona fit and the emails later, might as well bundle."

**This single insight reshaped the entire architecture:**
- Combined qualify + draft + approve into one touchpoint
- Made everything after approval autonomous
- Justified front-loading token spend
- Reduced human touchpoints from N to 1

## Anti-patterns

- **Building then asking**: Too late, sunk cost prevents real feedback
- **Asking for validation**: "Is this good?" gets "sure" not corrections
- **Defending your assumptions**: The goal is alignment, not being right
- **Treating domain expert as requirements doc**: They're a collaborator, not a spec
- **Skipping to implementation**: The interview IS the value

## When to Invoke Domain Expert Loop

- After initial domain modeling, before deep dive
- When you've drawn a lifecycle diagram
- When you're unsure about human touchpoint placement
- When choosing between multiple valid technical approaches
- When something feels "off" about the architecture
