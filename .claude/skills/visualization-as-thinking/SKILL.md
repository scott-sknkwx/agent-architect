---
name: visualization-as-thinking
description: Use ASCII diagrams as a debugging tool for understanding. Draw architecture before building to make implicit assumptions explicit and invite correction.
---

# Visualization as Thinking Tool

Visual representations make implicit assumptions EXPLICIT. They're easier to critique than prose or YAML.

## When to Use

- After domain modeling, before generation
- When translating between user mental model and system architecture
- When you need to validate understanding with a domain expert
- When designing state machines, lifecycles, or workflows

## The Pattern

```
1. DRAW the system as ASCII
   - Use clear boxes for phases/components
   - Mark human touchpoints with 👤
   - Mark agent invocations with 🤖
   - Mark automated functions with ⚙️
   - Show flow with arrows (→, ▼, etc.)

2. ASK "Does this match your mental model?"
   - Expect corrections
   - Look for bundling opportunities
   - Question every human touchpoint

3. ITERATE until aligned
   - The first diagram is a conversation starter
   - Expect 2-3 iterations
   - Redraw, don't patch

4. THEN generate code
   - The diagram IS the design
   - The manifest is just the encoding
```

## Key Insight

When you draw:
```
[Human can reject] ──► matched ──► rejected ──► terminated
```

The domain expert can immediately see: "Wait, that's wrong. The rejection should be LATER."

This is much harder to catch in prose or YAML.

## Example Lifecycle Diagram

```
    PROCESSING                    IN FLIGHT                   COMPLETED
    ──────────                    ─────────                   ─────────

┌─────────────────┐
│ 1. Ingest       │              (fully autonomous)
│    ⚙️ function  │                     │
├─────────────────┤                     │
│ 2. Enrich       │                     │
│    ⚙️ function  │                     │
├─────────────────┤          ┌──────────┴──────────┐
│ 3. Qualify      │          │                     │
│    🤖 Agent     │──────────┤  6. Execute         │
├─────────────────┤          │     ⚙️ auto-send    │         ┌───────────┐
│ 4. Setup        │          │         │           │────────►│ Converted │
│    🤖 Agent     │          │         ▼           │         └───────────┘
├─────────────────┤          │  7. Continue        │         ┌───────────┐
│ 5. APPROVAL     │          │     ⚙️ auto         │────────►│Terminated │
│    👤 Human     │──────────┤         │           │         └───────────┘
│    Reviews ALL  │          │         ▼           │
└─────────────────┘          │  8. Follow-up       │
                             │     ⚙️ auto-send    │
                             └─────────────────────┘
```

## Questions to Ask While Drawing

1. **Human touchpoints**: Where does a human NEED to be involved?
2. **Bundling**: Can we batch these approvals into one review?
3. **Autonomy**: Once X happens, what runs without intervention?
4. **Interrupts**: What events can alter the autonomous flow?
5. **Terminal states**: What are all the ways this can end?

## Anti-patterns

- Drawing AFTER you've written code (too late to catch misunderstandings)
- Accepting the first diagram as final (it's a conversation starter)
- Using complex diagramming tools (ASCII is fast and editable)
- Hiding assumptions in prose (make them visual and explicit)
