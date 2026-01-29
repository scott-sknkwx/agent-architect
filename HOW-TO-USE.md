# How to Use Agent Architect

Agent Architect helps you design agent-based products through an interview process, then generates a working codebase using Agent Factory.

## Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Agent Architect   │     │    Agent Factory    │     │   Your Product      │
│   (Design Tool)     │ ──▶ │    (Generator)      │ ──▶ │   (Standalone)      │
│                     │     │                     │     │                     │
│ - Interview user    │     │ - Parse manifest    │     │ - Next.js app       │
│ - Model domain      │     │ - Generate code     │     │ - Inngest functions │
│ - Write manifest    │     │ - Merge content     │     │ - Agent configs     │
│ - Write CLAUDE.md   │     │ - Install deps      │     │ - Ready to deploy   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Workflow

### Step 1: Design with Agent Architect

Start a conversation with Agent Architect and describe what you want to build:

```
"Let's build a lead-gifting platform that converts anonymous
website visitors into sales opportunities"
```

Agent Architect will:
1. **Discovery** - Ask questions about triggers, goals, domain, constraints
2. **Domain Modeling** - Propose agents, events, state machine
3. **Deep Dive** - Define each agent's contract and behavior
4. **Generation** - Write files to `workspace/{product-name}/`

Output in `workspace/kringle/`:
```
workspace/kringle/
├── manifest.yaml           # Product definition
├── agents/
│   ├── persona-matcher.md  # CLAUDE.md content
│   ├── email-drafter.md
│   └── ...
├── config/
│   └── triage-rules/
├── schemas/
│   └── status-yaml-schema.ts
└── templates/
    └── email-guidance/
```

### Step 2: Ship with Agent Factory

Run a single command to generate, merge, install, and clean up:

```bash
agent-factory init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  --output ~/projects/kringle \
  --merge-content ~/agent-architect/workspace/kringle \
  --install \
  --clean-staging
```

This command:
1. Parses your manifest and generates the project structure
2. Merges your CLAUDE.md files, configs, templates, and schemas
3. Installs npm dependencies
4. Removes the staging directory after success

### Step 3: Configure & Run

```bash
cd ~/projects/kringle
cp .env.example .env.local
# Edit .env.local with your API keys
npm run dev          # Start Next.js
npx inngest-cli dev  # Start Inngest dev server (separate terminal)
```

---

## CLI Reference

### Available Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--manifest <path>` | `-m` | **Required.** Path to product.manifest.yaml |
| `--output <path>` | `-o` | Output directory (defaults to product name in cwd) |
| `--merge-content <path>` | `-c` | Content directory to merge (repeatable) |
| `--install` | `-i` | Run npm install after generation |
| `--clean-staging` | | Remove merge-content directories after success |
| `--dry-run` | | Preview changes without executing |
| `--verbose` | `-v` | Show detailed output during execution |

### Merge Content Behavior

When `--merge-content` is specified, the CLI automatically routes content:

| Source Pattern | Target | Strategy |
|----------------|--------|----------|
| `agents/*.md` (flat files) | `agents/*/context/CLAUDE.md` | Match by name, overwrite stubs |
| `agents/*/context/CLAUDE.md` (nested) | Same path | Direct copy |
| `config/**/*` | `config/` | Deep copy, skip existing |
| `templates/**/*` | `templates/` | Deep copy, skip existing |
| `schemas/*.ts` | `schemas/` | Copy, overwrite stubs |

### Examples

**Preview without creating files:**
```bash
agent-factory init -m manifest.yaml -o ./my-project --dry-run
```

**Full workflow with verbose output:**
```bash
agent-factory init \
  -m ~/agent-architect/workspace/kringle/manifest.yaml \
  -o ~/projects/kringle \
  -c ~/agent-architect/workspace/kringle \
  --install \
  --clean-staging \
  --verbose
```

**Multiple merge sources:**
```bash
agent-factory init \
  -m manifest.yaml \
  -o ./my-project \
  -c ./workspace/agents \
  -c ./workspace/config \
  -c ./shared-templates
```

---

## Directory Structure Reference

### Agent Architect (this repo)
```
agent-architect/
├── CLAUDE.md              # Agent Architect instructions
├── HOW-TO-USE.md          # This file
├── context/
│   ├── agent-sdk-docs/    # SDK documentation reference
│   ├── examples/          # Example manifests
│   ├── patterns/          # Design patterns
│   └── tech-docs/         # External service docs
└── workspace/             # Staging area for generated products
    └── {product-name}/    # Temporary, deleted by --clean-staging
```

### Generated Product
```
{product-name}/
├── package.json
├── tsconfig.json
├── .env.example
├── agents/
│   └── {agent-name}/
│       ├── config.ts      # ClaudeAgentOptions
│       ├── hydration.ts   # Context loading
│       └── context/
│           └── CLAUDE.md  # Your agent instructions (merged)
├── inngest/
│   ├── client.ts
│   └── functions/         # One per agent
├── lib/
│   ├── supabase.ts
│   ├── logger.ts
│   ├── state-machine.ts
│   ├── agent-runner.ts
│   ├── idempotency.ts
│   ├── persistence.ts
│   └── workspace.ts
├── schemas/
│   ├── events.ts          # Zod schemas for all events
│   └── {agent}-output.ts  # Output schemas per agent
├── config/                # Your config (merged)
├── templates/             # Your templates (merged)
├── app/api/
│   ├── inngest/           # Inngest webhook
│   └── webhooks/          # External webhooks
└── supabase/migrations/
```

---

## Common Issues

### "Cannot find module" errors after generation

Use `--install` flag or run `npm install` manually in the project directory.

### Generated CLAUDE.md has TODO placeholders

Use `--merge-content` to merge your custom content from the workspace.

### Manifest validation errors

Run validation first:
```bash
agent-factory validate --manifest ./manifest.yaml
```

### Unmatched agent files warning

Your merge-content has agent files that don't match agents in the manifest. Either add the missing agent to your manifest or remove the extra .md file.

### Need manual control?

Omit `--merge-content` and `--clean-staging` to generate only the scaffold, then copy files yourself.
