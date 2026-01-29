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

Output in `workspace/{product-name}/`:
```
workspace/{product-name}/
├── manifest.yaml           # Product definition
├── agents/
│   ├── {agent-name}.md     # CLAUDE.md content for each agent
│   └── ...
├── config/                 # Domain-specific configuration
├── schemas/                # Output schemas
└── templates/              # Email templates, etc.
```

### Step 2: Ship with Agent Factory

#### 2a. Open a terminal and go to your projects folder

This is where you want your new project to live:

```bash
cd ~/projects
```

You should now be in `~/projects`. Verify with `pwd` — it should print something like `/Users/yourname/projects`.

#### 2b. Find your product name

Look in the `workspace/` folder inside agent-architect. You'll see a folder with your product name:

```bash
ls ~/agent-architect/workspace/
```

This will show something like `kringle` or `my-product` — that's your `{product-name}`.

#### 2c. Run the generator command

Replace `{product-name}` with your actual product name from Step 2b:

```bash
npx tsx ~/agent-factory/src/cli.ts init \
  --manifest ~/agent-architect/workspace/{product-name}/manifest.yaml \
  --output ./{product-name} \
  --merge-content ~/agent-architect/workspace/{product-name} \
  --install \
  --archive-staging
```

**Example:** If your product is called `kringle`:
```bash
npx tsx ~/agent-factory/src/cli.ts init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  --output ./kringle \
  --merge-content ~/agent-architect/workspace/kringle \
  --install \
  --archive-staging
```

**What each part means:**
- `npx tsx ~/agent-factory/src/cli.ts init` — Runs the agent-factory tool
- `--manifest ...` — Points to your design blueprint
- `--output ./{product-name}` — Creates the project right here in ~/projects/{product-name}
- `--merge-content ...` — Copies your agent instructions and configs
- `--install` — Automatically runs `npm install` for you
- `--archive-staging` — Archives staging directories to `done/` when complete

#### 2d. Wait for it to finish

The command will:
1. Generate all the project files
2. Copy your custom agent instructions
3. Install dependencies (this takes a minute or two)
4. Clean up

When it's done, you'll have a new folder at `~/projects/{product-name}` with a complete, runnable app.

### Step 3: Configure & Run Locally

#### 3a. Go into your new project

```bash
cd ~/projects/{product-name}
```

#### 3b. Start Supabase (runs in Docker)

**Important:** Do this BEFORE creating `.env.local` — Supabase will error if that file exists with bad syntax.

```bash
supabase start
```

This takes a minute the first time. When it finishes, it prints a bunch of info. Look for these sections:

```
╭──────────────────────────────────────────────────────╮
│ 🌐 APIs                                              │
├────────────────┬─────────────────────────────────────┤
│ Project URL    │ http://127.0.0.1:54321              │  ← SUPABASE_URL
...

╭──────────────────────────────────────────────────────────────╮
│ 🔑 Authentication Keys                                       │
├─────────────┬────────────────────────────────────────────────┤
│ Publishable │ sb_publishable_...                             │  ← SUPABASE_ANON_KEY
│ Secret      │ sb_secret_...                                  │  ← SUPABASE_SERVICE_ROLE_KEY
```

Keep this terminal open or copy these values — you'll need them next.

#### 3c. Set up your environment variables

Now create your `.env.local` file:

```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor and fill in:

| Variable | Value from supabase start |
|----------|---------------------------|
| `SUPABASE_URL` | Project URL (e.g. `http://127.0.0.1:54321`) |
| `SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) |
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com |

Other keys depend on what integrations your product uses (Resend for email, etc.). The `.env.example` file lists everything.

#### 3d. Start the app (two more terminals)

**Terminal 2** — Start the web server:
```bash
npm run dev
```

**Terminal 3** — Start Inngest (the background job runner):
```bash
npx inngest-cli dev
```

#### 3e. You're running!

| Service | URL |
|---------|-----|
| Your app | http://localhost:3000 |
| Inngest dashboard | http://localhost:8288 |
| Supabase Studio | http://localhost:54323 |

### Step 4: (Later) Deploy to Production

Local development uses Docker and `.env.local`. When you're ready to deploy:

- Create a Supabase cloud project and use those credentials
- Deploy to Vercel/Railway/etc. with production environment variables
- Set up Inngest Cloud and point it to your production webhook URL

---

## CLI Reference

### Available Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--manifest <path>` | `-m` | **Required.** Path to product.manifest.yaml |
| `--output <path>` | `-o` | Output directory (defaults to product name in cwd) |
| `--merge-content <path>` | `-c` | Content directory to merge (repeatable) |
| `--install` | `-i` | Run npm install after generation |
| `--archive-staging` | | Move merge-content directories to `done/` after success |
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
npx tsx ~/agent-factory/src/cli.ts init \
  -m ~/agent-architect/workspace/{product-name}/manifest.yaml \
  -o ./{product-name} \
  --dry-run
```

**Full workflow with verbose output:**
```bash
npx tsx ~/agent-factory/src/cli.ts init \
  -m ~/agent-architect/workspace/{product-name}/manifest.yaml \
  -o ./{product-name} \
  -c ~/agent-architect/workspace/{product-name} \
  --install \
  --archive-staging \
  --verbose
```

**Multiple merge sources:**
```bash
npx tsx ~/agent-factory/src/cli.ts init \
  -m ~/agent-architect/workspace/{product-name}/manifest.yaml \
  -o ./{product-name} \
  -c ~/agent-architect/workspace/{product-name}/agents \
  -c ~/agent-architect/workspace/{product-name}/config \
  -c ~/shared-templates
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
    ├── {product-name}/    # Temporary, archived by --archive-staging
    └── done/              # Archived staging directories
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
npx tsx ~/agent-factory/src/cli.ts validate \
  --manifest ~/agent-architect/workspace/{product-name}/manifest.yaml
```

### Unmatched agent files warning

Your merge-content has agent files that don't match agents in the manifest. Either add the missing agent to your manifest or remove the extra .md file.

### Need manual control?

Omit `--merge-content` and `--archive-staging` to generate only the scaffold, then copy files yourself.
