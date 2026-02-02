# Output Structure

When Agent Architect generates a product, it creates a complete workspace in `workspace/{product-name}/`. This document describes the expected directory structure and what each file/directory contains.

For a minimal working example, see `examples/sample-product/`.

---

## Directory Tree

```
{product-name}/
├── README.md                 # Product overview and quick start
├── manifest.yaml             # THE source of truth
│
├── .claude/                  # REQUIRED: Project-level Claude config
│   ├── CLAUDE.md             # Instructions for generated codebase
│   ├── context/              # Reference documentation (copied from agent-architect)
│   │   ├── agent-sdk-docs/   # Agent SDK documentation
│   │   ├── manifest/         # Schema, reference, examples
│   │   ├── patterns/         # Design patterns
│   │   └── tech-docs/        # Integration documentation
│   └── skills/               # Slash commands for the project
│       └── ...
│
├── agents/                   # REQUIRED: CLAUDE.md files for each agent
│   └── {agent-name}.md
│
├── schemas/                  # REQUIRED: Zod output schemas (one per agent)
│   └── {agent-name}-output.ts
│
├── config/                   # REQUIRED: Static context files referenced by agents
│   └── {source}/             # One directory per context_in.static source
│
├── templates/                # REQUIRED: Handlebars templates for context assembly
│   └── {entity}-context.md.hbs
│
├── functions/                # REQUIRED: Function specs (not code)
│   └── specs/
│       └── {function-name}.spec.md
│
└── docs/                     # REQUIRED: Reference documentation
    └── {topic}.md
```

---

## Required Directories

All directories are required. Agent Architect generates complete, documented systems.

| Directory | Purpose |
|-----------|---------|
| `.claude/` | Project-level Claude instructions, skills, and reference context |
| `.claude/context/` | Reference documentation copied from agent-architect (SDK docs, patterns, tech docs) |
| `agents/` | Per-agent CLAUDE.md instructions |
| `schemas/` | Zod schemas for agent structured output |
| `config/` | Static context files referenced by agents |
| `templates/` | Handlebars templates that transform DB data into agent context |
| `functions/specs/` | Function specification files (see `plans/function-capability/spec-format.md`) |
| `docs/` | Reference documentation explaining how the system works |

---

## Config Directory Convention

Each `context_in.static` reference in an agent's contract maps to a config subdirectory.

**Pattern:**
```yaml
# In manifest.yaml
agents:
  - name: {agent-name}
    contract:
      context_in:
        static:
          - source: {concept}      # → config/{concept}/
            description: "..."
```

**Mapping rule:** `source: {name}` → `config/{name}/`

### Example: Kringle Lead Outreach

```
config/
├── personas/{persona-id}/       # Per-persona configuration
│   ├── filter_criteria.yaml     # ICP matching rules
│   ├── pain_points.yaml         # Problems this persona has
│   ├── messaging_angles.yaml    # How to approach them
│   └── eex/                     # Email execution sequences
│       ├── eex-1.md
│       └── eex-2.md
├── triage-rules/                # Lead qualification rules
│   └── default.yaml
└── escalation-actions/          # What to do on specific triggers
    └── high-intent.yaml
```

---

## Templates Directory

Templates transform database records into readable context for agents.

**Pattern:**
```
templates/
└── {entity}-context.md.hbs      # Formats {entity} data for agents
```

### Example: Kringle Lead Outreach

```
templates/
├── lead-context.md.hbs          # Lead record → agent-readable context
│                                # {{name}}, {{company}}, {{enrichment.linkedin_headline}}
├── persona-summary.md.hbs       # Persona config → messaging brief
│                                # Pain points, angles, tone guidelines
├── campaign-status.md.hbs       # Campaign state → what's sent, what's pending
└── response-thread.md.hbs       # Email thread → context for triage agent
```

---

## Docs Directory

Reference documentation that travels with the generated project. Explains "why" and "how" for developers maintaining the system.

**Pattern:**
```
docs/
├── {entity}-lifecycle.md        # State machine and transitions
├── {feature}-flow.md            # How a feature works end-to-end
└── integration-notes.md         # External service details
```

### Example: Kringle Lead Outreach

```
docs/
├── lead-lifecycle.md            # Lead states: new → enriched → qualified → ...
├── approval-flow.md             # Bundle approval UX and fan-out logic
├── email-sequence-logic.md      # EEX timing, response handling, timeouts
└── integration-notes.md         # RB2B webhook format, Clay enrichment fields
```

---

## What Agent Factory Generates

When you run Agent Factory against a workspace:

```bash
cd workspace/{product-name}
npx tsx ../../agent-factory/src/cli.ts init --manifest manifest.yaml
```

Agent Factory reads the workspace files and generates a deployable project in `projects/{product-name}/`:

| From Workspace | To Project |
|----------------|------------|
| `manifest.yaml` | `inngest/events.ts`, `lib/database.ts`, migrations |
| `agents/*.md` | `agents/{name}/CLAUDE.md` (merged with agent runner) |
| `schemas/*.ts` | `agents/{name}/output-schema.ts` |
| `.claude/context/` | `.claude/context/` (copied - reference documentation) |
| `config/` | `config/` (copied) |
| `templates/` | `templates/` (copied) |
| `functions/specs/` | `inngest/functions/specs/` (copied, stubs generated) |
| `docs/` | `docs/` (copied) |

---

## Generated Project Structure for Agents

When Agent Factory scaffolds a project, agents become executable Inngest functions. This section documents the runtime code structure.

### Project Directory Layout

```
projects/{product-name}/
├── src/
│   └── inngest/
│       ├── client.ts              # Inngest client configuration
│       ├── agents/                # Agent runner functions
│       │   ├── persona-matcher.ts
│       │   ├── email-drafter.ts
│       │   └── response-triager.ts
│       └── functions/             # Non-agent functions
│           ├── send-email.ts
│           └── check-timeouts.ts
│
├── lib/
│   ├── workspace.ts               # Workspace hydration utilities
│   ├── supabase.ts                # Database client
│   └── inngest.ts                 # Event type definitions
│
├── agents/                        # Agent CLAUDE.md files (from workspace)
│   ├── persona-matcher.md
│   ├── email-drafter.md
│   └── response-triager.md
│
├── schemas/                       # Zod output schemas (from workspace)
│   ├── persona-matcher-output.ts
│   ├── email-drafter-output.ts
│   └── response-triager-output.ts
│
├── config/                        # Static config (from workspace)
├── templates/                     # Handlebars templates (from workspace)
└── docs/                          # Documentation (from workspace)
```

### Agent Runner Location

Each agent in the manifest generates a file at `src/inngest/agents/{agent-name}.ts`:

```
Manifest                           Generated Project
────────                           ─────────────────
agents:
  - name: persona-matcher    →     src/inngest/agents/persona-matcher.ts
  - name: email-drafter      →     src/inngest/agents/email-drafter.ts
  - name: response-triager   →     src/inngest/agents/response-triager.ts
```

### Workspace Utilities

The `lib/workspace.ts` module provides:

| Function | Purpose |
|----------|---------|
| `hydrateWorkspace(options)` | Build temp directory with CLAUDE.md + context |
| `cleanupWorkspace(path)` | Remove temp directory after agent completes |

See [Agent Runtime Pattern](../patterns/agent-runtime-pattern.md) for implementation details.

### Workspace vs Generated Project Paths

Understanding where files live at each stage:

| File Type | Workspace Path | Generated Project Path |
|-----------|----------------|------------------------|
| Agent instructions | `agents/{name}.md` | `agents/{name}.md` |
| Output schemas | `schemas/{name}-output.ts` | `schemas/{name}-output.ts` |
| Agent runners | N/A (not generated) | `src/inngest/agents/{name}.ts` |
| Workspace utils | N/A (not generated) | `lib/workspace.ts` |
| Static config | `config/{source}/` | `config/{source}/` |
| Templates | `templates/*.hbs` | `templates/*.hbs` |

**Key distinction:**
- **Workspace** = Design artifacts created by Agent Architect
- **Generated Project** = Runnable TypeScript created by Agent Factory
- Agent runners and workspace utilities only exist in the generated project

### Runtime Workspace Structure

At runtime, `hydrateWorkspace()` creates a temporary directory:

```
/tmp/agent-workspace-{uuid}/
├── .claude/
│   └── CLAUDE.md           # Copied from agents/{name}.md
├── lead.md                  # Hydrated from database via template
├── personas/                # Multiple files from DB query
│   ├── {id-1}.md
│   └── {id-2}.md
└── config/                  # Copied from static sources
    └── personas/
```

This workspace is passed as `cwd` to the SDK `query()` function, then cleaned up after execution.

---

## Validation Checklist

Before running Agent Factory, verify:

- [ ] `README.md` exists with product overview
- [ ] `manifest.yaml` exists and is valid YAML
- [ ] `.claude/CLAUDE.md` exists with project instructions
- [ ] `.claude/context/` exists with reference documentation (agent-sdk-docs, manifest, patterns, tech-docs)
- [ ] Each agent in manifest has a corresponding `agents/{name}.md`
- [ ] Each agent has an output schema at the path specified in `contract.output_schema`
- [ ] Each `context_in.static.source` has a corresponding `config/{source}/` directory
- [ ] Static config directories contain at least a README or definition file
- [ ] `templates/` contains at least one `.hbs` template
- [ ] `docs/` contains at least one documentation file
- [ ] Function specs follow format in `plans/function-capability/spec-format.md`
