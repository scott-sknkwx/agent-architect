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
│ - Write manifest    │     │ - Scaffold project  │     │ - Agent configs     │
│ - Write CLAUDE.md   │     │                     │     │ - Ready to deploy   │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

---

## Current Workflow

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

### Step 2: Run Agent Factory (Current Method)

Navigate to where you want the project to live, then run the CLI:

```bash
# Go to your projects directory
cd ~/projects

# Run agent-factory, pointing to the manifest
npx tsx ~/agent-architect/../agent-factory/src/cli.ts init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml
```

This creates `~/projects/kringle/` with generated code:
```
~/projects/kringle/
├── package.json
├── tsconfig.json
├── .env.example
├── agents/
│   └── persona-matcher/
│       ├── config.ts       # Generated
│       ├── hydration.ts    # Generated
│       └── context/
│           └── CLAUDE.md   # Generated stub (TODO placeholders)
├── inngest/
│   ├── client.ts
│   └── functions/
├── lib/
├── schemas/
├── app/api/
└── supabase/migrations/
```

### Step 3: Merge Custom Content

The generated CLAUDE.md files are stubs. Replace them with your real content:

```bash
cd ~/projects/kringle

# Copy your CLAUDE.md files
cp ~/agent-architect/workspace/kringle/agents/persona-matcher.md \
   agents/persona-matcher/context/CLAUDE.md
cp ~/agent-architect/workspace/kringle/agents/email-drafter.md \
   agents/email-drafter/context/CLAUDE.md
# ... repeat for each agent

# Copy config directories
cp -r ~/agent-architect/workspace/kringle/config/* config/

# Copy templates
cp -r ~/agent-architect/workspace/kringle/templates/* templates/

# Copy custom schemas (merge with generated)
cp ~/agent-architect/workspace/kringle/schemas/* schemas/
```

### Step 4: Install Dependencies

```bash
cd ~/projects/kringle
npm install
```

### Step 5: Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Step 6: Run

```bash
npm run dev          # Start Next.js
npx inngest-cli dev  # Start Inngest dev server (separate terminal)
```

### Step 7: Clean Up Staging

```bash
rm -rf ~/agent-architect/workspace/kringle
```

---

## Optimal Workflow (Proposed)

The current workflow has friction:
- Multiple manual copy steps
- Easy to forget to merge content
- Dependencies not auto-installed
- Output location is implicit (cwd)

### Proposed CLI Enhancement

```bash
agent-factory init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  --output ~/projects/kringle \
  --merge-content ~/agent-architect/workspace/kringle/agents \
  --merge-content ~/agent-architect/workspace/kringle/config \
  --merge-content ~/agent-architect/workspace/kringle/templates \
  --install
```

**New flags:**
| Flag | Purpose |
|------|---------|
| `--output <path>` | Explicit output directory (instead of cwd + product.name) |
| `--merge-content <path>` | Directory to merge into generated project (repeatable) |
| `--install` | Run `npm install` after generation |
| `--clean-staging` | Remove source directories after successful generation |

### Proposed Workflow

**Step 1: Design** (same as current)
```
"Let's build a lead-gifting platform..."
```

**Step 2: Ship** (single command)
```bash
agent-factory init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  --output ~/projects/kringle \
  --merge-content ~/agent-architect/workspace/kringle \
  --install \
  --clean-staging
```

**Step 3: Configure & Run**
```bash
cd ~/projects/kringle
cp .env.example .env.local
# Edit .env.local
npm run dev
```

### Content Merge Logic

When `--merge-content` is specified, the CLI should:

1. **CLAUDE.md files**: `agents/*.md` → `agents/*/context/CLAUDE.md`
   - Match by name: `persona-matcher.md` → `agents/persona-matcher/context/CLAUDE.md`
   - Overwrite generated stubs

2. **Config directories**: Deep merge into `config/`
   - Preserve generated structure
   - Add custom files

3. **Templates**: Deep merge into `templates/`

4. **Schemas**: Merge into `schemas/`
   - Custom schemas override generated stubs
   - Keep generated `events.ts` (derived from manifest)

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
    └── {product-name}/    # Temporary, delete after shipping
```

### Agent Factory (sibling repo)
```
agent-factory/
├── src/
│   ├── cli.ts             # CLI entry point
│   ├── commands/
│   │   └── init.ts        # Init command
│   ├── generators/        # Code generators
│   └── manifest/          # Manifest parser
```

### Generated Product (standalone)
```
{product-name}/
├── package.json
├── tsconfig.json
├── .env.example
├── manifest.yaml          # Copy of source manifest
├── agents/
│   └── {agent-name}/
│       ├── config.ts      # ClaudeAgentOptions
│       ├── hydration.ts   # Context loading
│       └── context/
│           └── CLAUDE.md  # Agent instructions
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
├── config/                # Domain-specific config
├── templates/             # Email templates, etc.
├── app/
│   └── api/
│       ├── inngest/       # Inngest webhook
│       └── webhooks/      # External webhooks
└── supabase/
    └── migrations/
```

---

## Common Issues

### "Cannot find module" errors after generation

Dependencies weren't installed. Run:
```bash
cd ~/projects/{product-name}
npm install
```

### Generated CLAUDE.md has TODO placeholders

You need to merge your custom content. See Step 3 in Current Workflow.

### Project generated inside agent-architect

You ran the CLI from the wrong directory. The CLI creates the project in your current working directory. Run from where you want the project to live:
```bash
cd ~/projects  # NOT ~/agent-architect/workspace
agent-factory init --manifest /path/to/manifest.yaml
```

### Manifest validation errors

Run validation first:
```bash
npx tsx ~/agent-factory/src/cli.ts validate --manifest ./manifest.yaml
```
