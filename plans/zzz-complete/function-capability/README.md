# Function Capability Plan

This directory contains the plan for enabling Agent Architect to capture function implementation context during the interview phase, which Agent Factory then merges into generated projects.

## The Problem

Agent Factory generates Inngest function stubs that crash on invocation:

```typescript
throw new Error("DRAFT: check-response-timeouts not yet implemented");
```

Every function requires manual implementation, even when Agent Architect already captured the logic during the interview. That knowledge is lost — it lives in the conversation but not in the output.

## The Approach

**Separation of Concerns:**

| Component | Responsibility | Does NOT Do |
|-----------|----------------|-------------|
| Agent Architect | Interview, discovery, capture context | Write TypeScript code |
| Agent Factory | Merge specs, generate scaffolds | Understand business logic |
| Generated Project | Implementation (human or Claude) | Re-discover requirements |

**The Flow:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DESIGN TIME                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Agent Architect                                                        │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │ Interview Phase                                               │      │
│   │ • "What triggers this function?"                              │      │
│   │ • "What database tables does it query?"                       │      │
│   │ • "What's the timeout threshold?"                             │      │
│   │ • "What events should it emit?"                               │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │ Output: workspace/{product}/functions/specs/                  │      │
│   │                                                               │      │
│   │ • check-response-timeouts.spec.md                             │      │
│   │ • ingest-rb2b-webhook.spec.md                                 │      │
│   │ • route-triage-result.spec.md                                 │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BUILD TIME                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Agent Factory (npx tsx agent-factory init --merge-content ...)         │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │ 1. Parse manifest.yaml                                        │      │
│   │ 2. Generate project scaffold                                  │      │
│   │ 3. Generate function stubs (inngest/functions/*.ts)           │      │
│   │ 4. Merge specs (inngest/functions/specs/*.spec.md)            │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                              │                                           │
│                              ▼                                           │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │ Output: projects/{product}/                                   │      │
│   │                                                               │      │
│   │ inngest/functions/                                            │      │
│   │ ├── check-response-timeouts.ts        (stub)                  │      │
│   │ ├── ingest-rb2b-webhook.ts            (stub)                  │      │
│   │ └── specs/                                                    │      │
│   │     ├── check-response-timeouts.spec.md   ◄── FROM INTERVIEW  │      │
│   │     ├── ingest-rb2b-webhook.spec.md       ◄── FROM INTERVIEW  │      │
│   │     └── route-triage-result.spec.md       ◄── FROM INTERVIEW  │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       IMPLEMENTATION TIME                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Developer or Claude (in generated project)                             │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │ 1. Read specs/check-response-timeouts.spec.md                 │      │
│   │ 2. Implement check-response-timeouts.ts                       │      │
│   │ 3. Spec serves as requirements + documentation                │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why Specs, Not Code?

| Approach | Pros | Cons |
|----------|------|------|
| **Agent Architect generates TypeScript** | One-step solution | Wrong imports, type errors, no project context, hard to maintain |
| **Agent Architect generates specs** | Captures intent, readable, maintainable, implementation has full context | Extra step to implement |

The spec approach wins because:

1. **Agent Architect's strength is discovery** — it's good at asking questions and capturing requirements, not writing compile-ready TypeScript
2. **Implementation context exists in the project** — the generated project has types, imports, database schema, integration clients
3. **Specs are documentation** — they survive implementation and help future developers understand why the function exists
4. **Specs are editable** — if requirements change, update the spec; the implementation follows

## Complexity Tiers

Not all functions need the same level of specification:

| Tier | Example | Spec Depth | Implementation Difficulty |
|------|---------|------------|---------------------------|
| **Trivial** | Webhook → validate → emit | Minimal (obvious pattern) | Copy-paste with minor edits |
| **Simple** | Cron → query DB → emit per row | Standard template | Straightforward implementation |
| **Complex** | Fan-in, routing, multi-integration | Comprehensive with examples | Requires careful implementation |

See [spec-format.md](./spec-format.md) for the spec template and how it scales by complexity.

## Documents in This Directory

| Document | Purpose |
|----------|---------|
| `README.md` | This file — overview and approach |
| `spec-format.md` | The function.spec.md template and schema |
| `feat-spec-based-function-generation.md` | Implementation plan (TODO) |
| `feat-function-generation-capability.md` | Archived — original code-gen approach |

## Key Decisions

1. **Specs live in `functions/specs/`, not alongside code** — keeps the functions directory clean, makes specs easy to find
2. **Specs are Markdown** — readable, diffable, editable; not YAML/JSON
3. **Complexity determines spec depth** — trivial functions get minimal specs, complex functions get comprehensive ones
4. **Agent Architect captures, doesn't implement** — maintains separation of concerns

## Open Questions

- [ ] Should specs include example test cases?
- [ ] Should there be a spec validation step in Agent Factory?
- [ ] How do we handle spec drift (spec updated but implementation not)?
