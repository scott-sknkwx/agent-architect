# Agent Architect

Design and build agent systems using the Agent Factory framework. Transform vague product ideas into production-ready manifests through structured discovery interviews.

**What is Agent Architect?**

This project. A design tool that interviews humans, captures requirements, and produces complete system definitions. The output is a `manifest.yaml` plus supporting files (agent instructions, schemas, function specs). Agent Architect does NOT generate TypeScript code—it generates the blueprints that Agent Factory consumes.

**Value delivered:** Capture requirements that would otherwise live in someone's head, surface edge cases before implementation, and generate artifacts that can be scaffolded into working code. 

**What is Agent Factory?**

A separate CLI tool at `../agent-factory/`. Takes a `manifest.yaml` and produces a working TypeScript project with Inngest functions, Supabase migrations, agent runners, and typed event definitions. The manifest is the single source of truth; Agent Factory turns it into runnable code.

**What is Flow?**
```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  AGENT ARCHITECT │  →   │  AGENT FACTORY   │  →   │  WORKING SYSTEM  │
│  (You are here)  │      │  (CLI tool)      │      │  (TypeScript)    │
├──────────────────┤      ├──────────────────┤      ├──────────────────┤
│ • Discovery      │      │ • Scaffold       │      │ • Inngest funcs  │
│ • Domain model   │      │ • Generate types │      │ • Supabase DB    │
│ • Manifest.yaml  │      │ • Migrations     │      │ • Agent runners  │
│ • Agent CLAUDE.md│      │ • Boilerplate    │      │ • Event handlers │
│ • Function specs │      │                  │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
     DESIGN                    BUILD                    RUN
```

## Working ON Agent Architect

For developing agent-architect itself (not building agent systems with it), see `plans/index.md`.

**Flow:** `feature-description.md` → `implementation-order.md` → execute → complete

Plans track features, refactors, and improvements to this tool.

---

## Constraints

- Ask before assuming
- Propose before generating
- Generate complete files, not snippets
- Explain reasoning
- Use Agent Factory patterns, not custom solutions
- Never skip the interview—the interview IS the value
- Verify against Agent SDK docs before recommending tools, options, or patterns
- Validate all static context references have corresponding files/directories

## Separation of Concerns

Agent Architect is a **design tool**, NOT a code generator. 

**Why specs instead of code for functions?**
1. Discovery is the strength— asking questions, capturing requirements, understanding intent
2. Project context is unavailable— generated project has types, imports, clients not visible here
3. Specs are durable— serve as documentation after implementation
4. Implementation belongs in the project— where Claude or developer has full context


## Capabilities

### Skills

Invoke with `/skill-name`. These encode specialized expertise and workflows:

| Skill | When to Use |
|-------|-------------|
| `/discovery` | Starting a new agent system design; guides interview to capture all requirements |
| `/agent-sdk` | Questions about Claude Agent SDK—skills, hooks, subagents, tools, permissions, sessions |
| `/claude-code-usage` | Deciding when to create MCPs vs Skills vs neither |
| `/data-type-primitives` | Reference proven patterns for campaigns, templates, actors, execution modalities |
| `/domain-expert-in-loop` | Validating architectural decisions with domain experts |
| `/function-spec-generation` | Capturing function implementation context; generating specs (not code) |
| `/visualization-as-thinking` | Drawing ASCII diagrams to debug understanding before generating |

### Resources

| Resource | Location |
|----------|----------|
| Agent Factory CLI | `../agent-factory/` |
| **Agent SDK Documentation** | `.claude/context/agent-sdk-docs/` — THE authoritative reference |
| Manifest (schema, reference, examples) | `.claude/context/manifest/` |
| Patterns | `.claude/context/patterns/` |
| Tech docs | `.claude/context/tech-docs/` |
| Output | `./workspace/` |

### Architecture: The Universal Loop

**Every step in an Agent Factory system follows the same pattern:**

```
┌─────────────────────────────────────────────────────────────┐
│  Event Listen → Validate Input → ACTION → Validate Output → Event Emit  │
└─────────────────────────────────────────────────────────────┘
```

This applies to ALL three execution types:

| Executor | ACTION Step | Example |
|----------|-------------|---------|
| 🤖 **Agent** | Claude reasons and decides | Draft personalized email |
| 👤 **Human** | Person reviews and acts | Approve outreach bundle |
| ⚙️ **Automated** | Deterministic TypeScript | Validate webhook payload |

**The pattern is always the same.** Whether Claude is drafting an email, a human is approving a batch, or a function is parsing a webhook—each step:
1. Listens for an event trigger
2. Validates the input payload
3. Performs its action (the only part that differs)
4. Validates the output
5. Emits the next event(s)

**Why this matters:**
- **Composability**: Any executor type can be swapped without changing the flow
- **Testability**: Each step is isolated and can be tested independently
- **Observability**: Every step is visible in Inngest dashboard
- **Durability**: Events are persisted; failures don't lose work
- **Decoupling**: Steps don't call each other directly; they emit events

**Nothing calls anything directly.** An agent emits `prospect.qualified`, and a separate step listens for that event. This keeps every step single-purpose and replaceable.

### Agent Factory Patterns

These patterns follow from the universal loop architecture:

| Pattern | Purpose |
|---------|---------|
| **Event-driven** | Agents communicate via Inngest events, not direct calls |
| **Single responsibility** | Each agent does ONE thing well |
| **Structured output** | Agents return Zod-validated JSON, not free text |
| **State machine** | Entities progress through defined states with valid transitions |
| **Contract-based** | Agents declare inputs, outputs, and tools in manifest |
| **RLS-first** | Every database table has access policies; no exceptions |

When the Constraints say "use Agent Factory patterns," this means: design systems using events, single-purpose agents, structured outputs, state machines, contracts, and RLS.


### Agent Factory Components

The agentic systems defined by Agent Architect use the following core components as building blocks:

| Component | Generated | NOT Generated |
|-----------|-----------|---------------|
| **Database** | Schema in manifest, access policies | Migration SQL (Agent Factory does this) |
| **Events** | Event definitions in manifest | TypeScript event types |
| **Agents** | CLAUDE.md instructions, output schemas | TypeScript agent runner code |
| **Functions** | Spec files (`.spec.md`) with implementation context | TypeScript function code |

### Agent Runtime Layer

Agent Architect produces design artifacts; Agent Factory generates the runtime code that executes them. The runtime layer bridges manifest definitions to SDK calls:

```
Design Artifacts              Runtime Code (Agent Factory generates)
────────────────              ────────────────────────────────────
agents/{name}.md        →     src/inngest/agents/{name}.ts
schemas/{name}-output.ts →    (imported by agent runner)
contract.context_in     →     lib/workspace.ts hydration
contract.output_schema  →     SDK outputFormat option
```

See `.claude/context/patterns/agent-runtime-pattern.md` for the canonical agent runner implementation pattern.

---

## Agent Architect Process

### Phase 1: Discovery

Use the `/discovery` skill when humans describe what they want to build. Cover:

- **Trigger, Goal, Domain** — What starts it, what's the end state, what entities exist
- **Actors & Access** — Who can see/modify what
- **Approval Patterns** — Where humans approve, batch opportunities, post-approval autonomy
- **Content Sourcing** — Agent-drafted vs template-sourced content
- **Token Economics** — Cost of rejection late vs early, front-loading work
- **Autonomy Boundaries** — What runs without input after approval

Ask conversationally, not as a checklist. Adapt based on answers.

**Completion criteria:** The `/discovery` skill includes an Output Checklist. Phase 1 is complete when all checklist items have answers:
- [ ] What triggers the system?
- [ ] What's the terminal state?
- [ ] What's the primary entity and its states?
- [ ] Who are the actors and what are their access patterns?
- [ ] Where are approval points? Can they be batched?
- [ ] What content is agent-drafted vs template-sourced?
- [ ] What are the autonomy boundaries?

### Phase 2: Domain Modeling

Propose:

1. **Agents**: Each agent does ONE thing
   - Name by function (Scout, Qualifier, Writer)
   - Define clear boundaries
   - Identify required context

2. **Events**: The language between agents
   - Follow noun.verb naming (prospect.qualified)
   - Define data flows with each event

3. **State Machine**: Valid transitions
   - Map the happy path
   - Map failure states
   - Identify terminal states

Present as diagram or summary. Ask: "Does this match your mental model? What's missing?"

### Agent vs Function Decision

Before visualizing the lifecycle, classify each step:

| Use Agent (🤖) When... | Use Function (⚙️) When... |
|------------------------|---------------------------|
| Task requires judgment | Logic is fully deterministic |
| Output varies by context | Same input → same output |
| Reasoning needed | Rules can be expressed as code |
| "Figure out the right answer" | "Execute the defined steps" |

**Examples:**
- Persona matching → Agent (weighs multiple signals)
- Email drafting → Agent (creative, personalized)
- Timeout checks → Function (query + emit, no judgment)
- Webhook validation → Function (schema parse, pass/fail)

**Heuristic:** If complete logic fits a flowchart with no "it depends" nodes, it's a function.

### Phase 2.5: Lifecycle Visualization (CRITICAL)

**Visualize the entity lifecycle BEFORE generating anything.**

This is a DESIGN ARTIFACT and DEBUGGING TOOL, not documentation.

1. **Draw the lifecycle as ASCII**
   - Mark human touchpoints with 👤
   - Mark agent invocations with 🤖
   - Mark automated functions with ⚙️
   - Show phase boundaries (Processing → In Flight → Completed)

2. **Classify each step** with executor type and flow details:

   | Field | Description |
   |-------|-------------|
   | **Executor** | 🤖 Agent / ⚙️ Function / 👤 Human |
   | **Trigger** | Event name (e.g., `lead.qualified`) or cron |
   | **Input Validation** | What must be true before starting |
   | **Steps** | What happens during processing |
   | **Output Validation** | What must be true after |
   | **Persist** | What database changes occur |
   | **Emit** | What event(s) fire next |

   Reference: `context/patterns/flow-patterns.md` for classification heuristics and common patterns.

3. **Identify approval patterns**
   - Where does a human NEED to approve?
   - Can approvals be batched? (Usually yes)
   - What creates approval fatigue?

4. **Define autonomy boundaries**
   - What runs WITHOUT further human input after approval?
   - What events INTERRUPT autonomous flow?
   - What's the point of no return?

5. **Distinguish content sources**
   - Agent-drafted per entity?
   - Templated/pre-built (inherited from persona, org, etc.)?

6. **Present and iterate**
   - Show the diagram AND flow table
   - Ask: "Does this match your mental model?"
   - EXPECT CORRECTIONS—first diagram is a conversation starter
   - Iterate 2-3 times until alignment

**Example lifecycle phases:**
```
PROCESSING              IN FLIGHT                 COMPLETED
(human touchpoints)     (fully autonomous)        (terminal)
─────────────────       ─────────────────         ──────────
⚙️ Ingest               ⚙️ Execute                Success
🤖 Enrich               (only interrupts:         Failure
🤖 Qualify               responses, errors)       Archived
⚙️ Setup
👤 APPROVE BUNDLE ──────►
```

**Example flow table:**
| Step | Executor | Trigger | Persist | Emit |
|------|----------|---------|---------|------|
| Ingest | ⚙️ | webhook/rb2b | Insert lead | `lead.received` |
| Enrich | 🤖 | `lead.received` | Update enrichment_data | `lead.enriched` |
| Qualify | 🤖 | `lead.enriched` | Update status, score | `lead.qualified` / `lead.disqualified` |
| Approve | 👤 | Dashboard action | Update statuses | `batch.approved` → fan-out |

**Key insight:** The diagram IS the design. The manifest encodes the diagram.

See `.claude/skills/discovery/retrospective.md` for full methodology.

### Phase 3: Deep Dive

For each agent, ask:

1. **Input**: What context does this agent need?
2. **Process**: What steps? What logic?
3. **Output**: What fields matter?
4. **Boundaries**: What should it explicitly NOT do?
5. **Failure**: What happens when things go wrong?
6. **Model Selection**: What's the right cost/quality tradeoff?

   > "This agent [does X]. What's the right model for this task?"
   > - **Fast & cheap** (haiku) — Simple extraction, classification, routing
   > - **Balanced** (sonnet) — Most tasks, research, analysis, writing
   > - **Maximum quality** (opus) — Complex reasoning, important decisions

**Default Heuristics (propose, then confirm):**

| Task Type | Default Model | Rationale |
|-----------|---------------|-----------|
| Data extraction | haiku | Structured input → structured output |
| Classification/routing | haiku | Clear categories, fast decisions |
| Research/analysis | sonnet | Needs synthesis, good enough quality |
| Writing/creative | sonnet | Balances quality and cost |
| Complex multi-step reasoning | opus | Highest quality for critical decisions |
| High-stakes decisions | opus | Worth the cost for important outcomes |

Take detailed notes—these become CLAUDE.md content.

**During deep dive, reference Agent SDK docs to determine:**
- Which built-in tools the agent needs (Read, Write, Bash, WebSearch, etc.)
- Whether subagents help decompose complex tasks
- Appropriate permission mode
- Need for structured output

### Phase 3.5: Function Deep Dive

Use the `/function-spec-generation` skill for non-agentic functions:

- **Complexity classification** — Trivial, Simple, or Complex determines spec depth
- **Trigger & Input** — Event or cron, payload shape
- **Steps & Logic** — What happens, in order
- **Database & Integrations** — Tables, APIs, error handling
- **Configuration** — Thresholds, limits, constants
- **Output** — Events emitted, return values

**DO NOT write TypeScript code.** Capture context as structured specs in `workspace/{product}/functions/specs/`.

See `plans/function-capability/spec-format.md` for full template.

### Phase 4: Generation

Generate:

1. **manifest.yaml** - Complete product definition:
   - All events with real payloads
   - All agents with real contracts
   - Real state machine
   - Database tables with access policies (actors + per-table RLS rules)
   - Functions with correct integrations

   **Function Integrations Rule:**
   - **DO NOT** list core infrastructure (supabase, inngest, anthropic) in function `integrations` arrays
   - Core infrastructure is always available—it's the platform
   - **ONLY** list external/optional integrations actually called: resend, clay, firecrawl, hookdeck, rb2b, etc.

2. **CLAUDE.md files** - Real instructions for each agent:
   - Actual process steps from interview
   - Real boundaries
   - Real output examples
   - Real failure handling

3. **Output schemas** - Real Zod schemas (per `docs/guides/structured-outputs.md`)

   **Output Schema Checklist:**
   - [ ] Schema file exists at path in `contract.output_schema`
   - [ ] Schema includes `success: z.boolean()`
   - [ ] Schema includes `error: z.string().optional()`
   - [ ] Schema fields match CLAUDE.md "Structured output" examples
   - [ ] Enum values match manifest event payload enums

4. **Agent configs** - Using `ClaudeAgentOptions` from `docs/typescript-sdk.md`:
   - Correct tool names from SDK docs
   - Proper permission modes
   - Subagent definitions if needed

5. **Config files** - Domain-specific content (ICPs, templates, etc.)

6. **Static context validation**:
   - Scan all agent contracts for `context_in.static` references
   - Verify each `source` path exists in workspace
   - Create missing directories with placeholder files
   - Document what each config directory should contain

   **Static Reference Checklist:**
   - [ ] Directory exists at `workspace/{product}/config/{source}`
   - [ ] Contains at least a README or definition file
   - [ ] Contents match agent's CLAUDE.md expectations

7. **Function specs** - Implementation context for non-agentic functions:
   - One `.spec.md` file per function in `workspace/{product}/functions/specs/`
   - Specs capture WHAT, not TypeScript code

   **Complexity → Sections:**
   | Complexity | Sections Required |
   |------------|-------------------|
   | Trivial | Purpose, Trigger, Input, Output |
   | Simple | + Steps, DB Operations, Error Handling, Configuration |
   | Complex | + Integration Calls, Edge Cases, Test Cases, Related Functions, Open Questions |

   See `plans/function-capability/spec-format.md` for full template.

8. **Context copy** - Copy reference materials to generated project:
   - Copy `.claude/context/` to `workspace/{product}/.claude/context/`
   - All subdirectories: agent-sdk-docs, manifest, patterns, tech-docs
   - This provides generated projects with complete reference documentation

   **Generated CLAUDE.md Reference Section:**

   Include this section in generated project's `.claude/CLAUDE.md`:

   ```markdown
   ## Reference Materials

   This project includes reference documentation for extending and maintaining the system.

   | Topic | Location |
   |-------|----------|
   | Agent SDK (tools, permissions, hooks) | `.claude/context/agent-sdk-docs/` |
   | Design patterns (agent vs function, approvals) | `.claude/context/patterns/` |
   | Integration documentation | `.claude/context/tech-docs/` |
   | Manifest schema and examples | `.claude/context/manifest/` |
   ```

Write files to `workspace/` directory.

### Phase 5: Scaffold

Run:
```bash
cd workspace
npx tsx ../../agent-factory/src/cli.ts init --manifest manifest.yaml
```

Then overwrite placeholder files with generated content.

### Phase 6: Iterate

Update specific files based on testing feedback. Surgically edit—don't regenerate everything.

### Commands

User triggers for process phases:

| Command | Action |
|---------|--------|
| "Let's build [description]" | Start Phase 1 |
| "Show me the agents" | Show current agent diagram |
| "Show me the lifecycle" | Phase 2.5 ASCII visualization |
| "Deep dive on [agent]" | Phase 3 for specific agent |
| "Generate it" | Phase 4 + 5 |
| "Update [agent]'s CLAUDE.md" | Surgical edit |
| "Start over" | Clear workspace, restart |

---

## Reference

### Key Documents

| Document | Purpose |
|----------|---------|
| `.claude/context/manifest/output-structure.md` | Expected output directory tree and file purposes |
| `.claude/context/manifest/reference.md` | Contract definitions, access control, function integrations |
| `.claude/context/manifest/contract-to-sdk-mapping.md` | How manifest fields map to SDK query() options |
| `.claude/context/manifest/examples/sample-product/` | Canonical example workspace with annotated files |
| `workspace/done/kringle/` | Complete reference implementation with runtime docs |
| `plans/function-capability/README.md` | Function spec approach overview |
| `plans/function-capability/spec-format.md` | Function spec template and sections |

### Design Patterns

| Pattern | File | When to Use |
|---------|------|-------------|
| **Agent Boundaries** | `.claude/context/patterns/agent-boundaries.md` | Single Responsibility Test, common agent types, boundary rules |
| **Agent Runtime** | `.claude/context/patterns/agent-runtime-pattern.md` | How agents execute: workspace hydration, SDK query(), cleanup |
| **Bundle Approval** | `.claude/context/patterns/bundle-approval-pattern.md` | Multiple items need human review; avoid approval fatigue |
| **CLAUDE.md Patterns** | `.claude/context/patterns/claude-md-patterns.md` | Template structure for agent instructions in Phase 4 |
| **Content Sourcing** | `.claude/context/patterns/content-sourcing-pattern.md` | Distinguishing agent-drafted vs template-sourced content |
| **Database Patterns** | `.claude/context/patterns/database-patterns.md` | Column patterns, tenancy, state machines, relationships |
| **Event Design** | `.claude/context/patterns/event-design-patterns.md` | Naming conventions (noun.verb), payload design, granularity |
| **Executor Model** | `.claude/context/patterns/executor-model-pattern.md` | Understanding who executes each step (🤖/👤/⚙️) |
| **Flow Patterns** | `.claude/context/patterns/flow-patterns.md` | Common flow patterns, executor classification heuristics |
| **Access Control** | `.claude/context/manifest/reference.md#access-control-pattern` | Database RLS policies, actor definitions |

**Quick Pattern Reference:**

**Bundle Approval:** Single touchpoint where human reviews lead + persona fit + all content at once. Fan-out on approval marks all items approved.

**Content Sourcing:**
- `agent_drafted` = Creative, personalized, editable (Claude agent)
- `template_sourced` = Deterministic personalization, preview-only (non-agentic function)

**Executor Model:**
- 🤖 Agent = Complex tasks requiring judgment (agents section)
- 👤 Human = Approvals, escalations (events that humans trigger)
- ⚙️ Automated = Deterministic operations (functions section)

**Access Control:** Every table MUST have at least one access policy. RLS is mandatory.
- Define actors once in `database.actors` (tenant, owner, admin, etc.)
- Each table declares access policies with `:actor` placeholder
- Common patterns: tenant isolation, owner-only, team membership, public read

### Technology Reference

Consult `.claude/context/tech-docs/` when designing integrations. Local docs provide design guidance; web search official docs for current API signatures.

| Tech | Purpose | Local Doc | Official Docs |
|------|---------|-----------|---------------|
| Inngest | Event orchestration | `inngest.md` | https://www.inngest.com/docs |
| Supabase | Database + storage | `supabase.md` | https://supabase.com/docs |
| Resend | Email sending | `resend.md` | https://resend.com/docs |
| Clay | Lead enrichment | `clay.md` | https://docs.clay.com |
| RB2B | Visitor identification | `rb2b.md` | https://www.rb2b.com/docs |
| Hookdeck | Webhook infrastructure | `hookdeck.md` | https://hookdeck.com/docs |
| AssemblyAI | Transcription | `assemblyai.md` | https://www.assemblyai.com/docs |
| Firecrawl | Web scraping | `firecrawl.md` | https://docs.firecrawl.dev |
| Exa | Semantic search | `exaai.md` | https://docs.exa.ai |
| Parallel | Browser automation | `parallel.md` | https://docs.parallel.ai |
| Merge | Unified integrations | `merge.md` | https://docs.merge.dev |
| Honcho | AI memory layer | `honcho.md` | https://docs.honcho.dev |
| Stripe | Payments + billing | `stripe.md` | https://stripe.com/docs/api |
| Webhook Routing | Inngest-first architecture | `webhook-routing.md` | — |

Reference when:
- Choosing how agents communicate (Inngest events)
- Designing database tables (Supabase patterns)
- Agents need to send email (Resend)
- Agents need enrichment data (Clay)
- Designing external webhook ingestion (Inngest-first pattern)

### Agent Contract Tools

Tools for manifest `allowedTools` configuration:

| Tool | Purpose |
|------|---------|
| Read | Read file contents |
| Write | Create/overwrite files |
| Edit | Modify existing files |
| Bash | Execute shell commands |
| Glob | Find files by pattern |
| Grep | Search file contents |
| WebSearch | Search the web |
| WebFetch | Fetch URL contents |
| Task | Delegate to subagents |
| Skill | Use skill definitions |
| TodoWrite | Track task progress |

Verify tool names match SDK docs exactly before generating configs.

### Agent SDK Documentation Reference

Consult for ANY agent implementation decisions during Phase 4 generation:

| Topic | Document |
|-------|----------|
| SDK overview, capabilities | `docs/agent-sdk-overview.md` |
| TypeScript API, types, options | `docs/typescript-sdk.md` |
| Creating custom MCP tools | `docs/guides/custom-tools.md` |
| Hooks for control flow | `docs/guides/controlling-execution-hooks.md` |
| Subagents for delegation | `docs/guides/subagents.md` |
| System prompts, CLAUDE.md | `docs/guides/system-prompts.md` |
| Structured JSON outputs | `docs/guides/structured-outputs.md` |
| Skills (SKILL.md files) | `docs/guides/agent-skills.md` |
| Permissions and approval | `docs/guides/handling-permissions.md` |
| Session management | `docs/guides/session-management.md` |
| Hosting and deployment | `docs/guides/hosting.md` |
| Security hardening | `docs/guides/secure-deployment.md` |
