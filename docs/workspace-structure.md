# Workspace Structure

When Agent Architect generates a product, it creates a complete workspace in `workspace/{product-name}/`. This document describes the expected directory structure and what each file/directory contains.

## Directory Tree

```
{product-name}/
├── manifest.yaml              # THE source of truth
├── .claude/
│   ├── CLAUDE.md              # Project-level instructions for generated codebase
│   └── skills/                # Slash commands for the generated project
│       ├── add-inngest-function.md
│       ├── add-webhook-source.md
│       ├── event-flow.md
│       └── extend-database.md
│
├── agents/                    # CLAUDE.md files for each agent
│   ├── persona-matcher.md
│   ├── email-drafter.md
│   └── ...
│
├── schemas/                   # Zod output schemas (one per agent)
│   ├── persona-matcher-output.ts
│   ├── email-drafter-output.ts
│   └── ...
│
├── config/                    # Static context files referenced by agents
│   ├── personas/{id}/         # Per-persona configuration
│   │   ├── filter_criteria.yaml
│   │   ├── pain_points.yaml
│   │   ├── messaging_angles.yaml
│   │   └── eex/               # Email execution sequences
│   ├── campaigns/
│   ├── triage-rules/
│   └── escalation-actions/
│
├── templates/                 # Handlebars templates for context assembly
│   ├── lead-context.md.hbs
│   ├── persona-summary.md.hbs
│   └── ...
│
├── functions/                 # Function specs (not code)
│   └── specs/
│       ├── check-response-timeouts.spec.md
│       ├── ingest-rb2b-webhook.spec.md
│       └── ...
│
└── docs/                      # Reference documentation bundled with product
    ├── lead-lifecycle-architecture.md
    └── approval-flow.md
```

## File Purposes

| Directory | Who Creates | Purpose |
|-----------|-------------|---------|
| `manifest.yaml` | Agent Architect | All events, agents, state machine, database schema |
| `agents/*.md` | Agent Architect | Per-agent CLAUDE.md instructions |
| `schemas/*.ts` | Agent Architect | Zod schemas for agent structured output |
| `config/` | Agent Architect | Static context files referenced by agents |
| `.claude/` | Agent Architect | Project-level Claude instructions and skills |
| `templates/` | Agent Architect | Handlebars templates for context assembly |
| `functions/specs/` | Agent Architect | Function specification files (not TypeScript) |
| `docs/` | Agent Architect | Reference documentation bundled with product |

## Config Directory Convention

Each `context_in.static` reference in an agent's contract maps to a config subdirectory:

```yaml
# In manifest.yaml
agents:
  - name: persona-matcher
    contract:
      context_in:
        static:
          - source: personas          # → config/personas/
            description: "Persona definitions"
          - source: triage-rules      # → config/triage-rules/
            description: "Lead qualification rules"
```

**Mapping rule:** `source: {name}` → `config/{name}/`

## What Agent Factory Generates

When you run Agent Factory against a workspace:

```bash
cd workspace
npx tsx ../../agent-factory/src/cli.ts init --manifest manifest.yaml
```

Agent Factory reads the workspace files and generates a deployable project in `projects/{product-name}/`:

| From Workspace | To Project |
|----------------|------------|
| `manifest.yaml` | `inngest/events.ts`, `lib/database.ts`, migrations |
| `agents/*.md` | `agents/{name}/CLAUDE.md` (merged with agent runner) |
| `schemas/*.ts` | `agents/{name}/output-schema.ts` |
| `config/` | `config/` (copied) |
| `templates/` | `templates/` (copied) |
| `functions/specs/` | `inngest/functions/specs/` (copied, stubs generated) |

## Validation Checklist

Before running Agent Factory, verify:

- [ ] `manifest.yaml` exists and is valid YAML
- [ ] Each agent in manifest has a corresponding `agents/{name}.md`
- [ ] Each agent has an output schema at the path specified in `contract.output_schema`
- [ ] Each `context_in.static.source` has a corresponding `config/{source}/` directory
- [ ] Static config directories contain at least a README or definition file
