# CLAUDE.md Refactor Plan

This document captures the analysis and recommendations for restructuring the Agent Architect CLAUDE.md file.

## Status: COMPLETE ✓

**Completed:** 2025-02-01

| Phase | Status | Summary |
|-------|--------|---------|
| Phase 1: Create Supporting Infrastructure | ✓ Complete | 8 files created |
| Phase 2: Edit CLAUDE.md | ✓ Complete | 182 deletions, 37 insertions |
| Phase 3: Validate | ✓ Complete | 5/6 checks pass |

### Results

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Line count | 578 | 432 | <300 | ⚠️ Over target (25% reduction achieved) |
| Internal links | - | 100% | 100% | ✓ |
| Duplicated content | Yes | No | No | ✓ |
| /discovery skill | - | Created | Created | ✓ |
| Sample product | - | Complete | Complete | ✓ |

### Files Created

```
.claude/skills/discovery/SKILL.md          # Discovery interview questions
docs/workspace-structure.md                 # Workspace directory tree
docs/manifest-reference.md                  # Contract definitions, access control
context/examples/sample-product/
├── manifest.yaml                           # Annotated canonical example
├── agents/processor.md                     # Example agent CLAUDE.md
├── schemas/processor-output.ts             # Example output schema
├── config/sample-personas/README.md        # Config directory example
└── README.md                               # How to use this example
```

---

## Original State (Before Refactor)

- **578 lines** — too long for a primary instruction document
- Mixes workflow methodology, reference material, and pattern catalogs
- Duplicative content across sections
- Missing concrete examples and workspace structure documentation

---

## Issues by Category

### 1. Unclear Items

| Issue | Clarification | Action |
|-------|---------------|--------|
| Agent Factory relationship | `plans/function-capability/README.md` explains the separation well | Link to this doc from CLAUDE.md |
| "Contract" terminology | Refers to `AgentContractSchema` in `context/manifest-schema.ts` | Add brief definition with link to schema |
| Phase numbering | Keep current numbering (see [Phase Numbering Decision](#phase-numbering-decision)) | No change |
| Static context validation | No example of valid source path | Add example (see below) |
| Workspace structure | Not documented anywhere | Create `docs/workspace-structure.md` |

**Static Context Example to Add:**

```yaml
# In manifest.yaml
agents:
  - name: persona-matcher
    contract:
      context_in:
        static:
          - source: personas          # → workspace/{product}/config/personas/
            description: "Persona definitions with filter criteria"
          - source: triage-rules      # → workspace/{product}/config/triage-rules/
            description: "Lead qualification rules"
```

### 2. Duplicative Content

| Topic | Current Locations | Recommendation |
|-------|-------------------|----------------|
| Approval patterns | Phase 1 (lines 86-101), Phase 2.5 (143-173), Lifecycle Design (525-576) | **Keep Phase 2.5 as authoritative.** Phase 1 gets 2 sentences + link. Delete Lifecycle Design section. |
| Access control | Phase 1 (79-85, 115-122), Access Control Pattern (473-523) | **Keep Access Control Pattern section.** Phase 1 gets brief mention + link. |
| SDK doc references | Table (16-31) + "Before generating..." (33-43) | **Keep the table only.** It's scannable. Delete the inline "Before..." rules. |
| Content sourcing | Phase 1, Phase 2.5, Content Source Distinction | **Consolidate into Phase 2.5 only.** |
| Bundle approval | Phase 2.5 + Approval Bundle Pattern section | **Keep in Phase 2.5.** Delete separate section. |

### 3. Overdone Items

| Item | Issue | Action |
|------|-------|--------|
| Built-in Tools Reference (411-428) | Tools agents can specify in contracts, not Agent Architect's tools | Rename section to "Agent Contract Tools Reference" with clarifying sentence |
| External Technologies (451-468) | Good content, lacks framing | Add intro: "Commonly leveraged integrations in generated projects. Trusted and documented." |

### 4. Missing Items

| Item | Priority | Action |
|------|----------|--------|
| Concrete manifest example | High | Create `context/examples/sample-product/` as canonical example |
| Workspace directory tree | High | Create `docs/workspace-structure.md` with the tree provided |
| Agent vs Function decision criteria | High | Add to Phase 3/3.5 boundary |
| Discovery skill | High | Extract question methodology into `/discovery` skill |
| Error recovery guidance | Low | Keep as-is for now |
| Iteration protocol | Low | Keep as-is for now |

**Agent vs Function Decision Criteria to Add:**

```markdown
### When to Use an Agent vs. a Function

| Characteristic | Agent (🤖) | Function (⚙️) |
|----------------|------------|---------------|
| **Determinism** | Non-deterministic but predictable | Deterministic |
| **Judgment** | Requires reasoning, weighing options | Follows explicit rules |
| **Output** | May vary given same input | Same input → same output |
| **Examples** | Persona matching, email drafting, triage | Timeout checks, webhook ingestion, routing |

**Decision heuristic:** If you can write the complete logic as a flowchart with no "it depends" nodes, it's a function. If it needs to "figure out" the right answer, it's an agent.
```

---

## Phase Numbering Decision

**Decision: Keep current numbering (1, 2, 2.5, 3, 3.5, 4, 5, 6)**

Renumbering would require updating these files:

| File | Impact |
|------|--------|
| `.claude/skills/function-spec-generation/SKILL.md` | References "Phase 3.5" directly |
| `docs/discovery-retrospective.md` | Documents the phase flow |
| `plans/function-capability/feat-spec-based-function-generation.md` | Heavy phase references |
| `plans/manifest-coverage/README.md` | References Phase 1, 2, 3 |
| Commands section in CLAUDE.md | References phases in user-facing commands |

The ".5" phases accurately reflect that they were additions to an existing flow. Renumbering provides marginal clarity improvement at significant update cost. The current scheme is documented and understood.

---

## Proposed Structure

### Single CLAUDE.md with Links (~250 lines)

Keep CLAUDE.md as the primary doc, move reference material to linked docs.

**New CLAUDE.md outline:**

```
# Agent Architect (~250 lines)

## Identity (5 lines)
## What I Have Access To (10 lines)
## My Process
  - Phase 1: Discovery (invoke /discovery skill for questions)
  - Phase 2: Domain Modeling
  - Phase 2.5: Lifecycle Visualization (approval patterns live here)
  - Phase 3: Agent Deep Dive
  - Phase 3.5: Function Deep Dive
  - Phase 4: Generation
  - Phase 5: Scaffold
  - Phase 6: Iterate
## Commands
## Constraints
## Key Documents (links table)
## Skills Reference (table)
## Design Patterns (quick reference + links)
```

**New supporting docs:**

| Doc | Contents |
|-----|----------|
| `docs/workspace-structure.md` | Directory tree, file locations, what goes where |
| `.claude/skills/discovery/SKILL.md` | Discovery questions, signals, access patterns |
| `docs/manifest-reference.md` | Contract definitions, access policies, function integrations rule |
| `context/examples/sample-product/` | Canonical example with all expected files |

---

## Specific Edits

### 1. Rename Built-in Tools Section

**Before:**
```markdown
## Built-in Tools Reference (from Agent SDK)

When configuring `allowedTools` for agents, these are available:
```

**After:**
```markdown
## Agent Contract Tools

Tools that agents can request in their manifest `allowedTools` configuration:
```

### 2. Add Agent vs Function Criteria

Insert after Phase 3 intro, before Phase 3.5:

```markdown
### Deciding: Agent or Function?

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
```

### 3. Consolidate Approval Patterns

**Phase 1 (brief):**
```markdown
6. **Approval Patterns**: See [Phase 2.5: Lifecycle Visualization](#phase-25-lifecycle-visualization-critical) for full methodology.
   - Key question: Can we batch approvals?
   - Key signal: "I don't want to approve every..."
```

**Phase 2.5 (authoritative):** Keep existing content.

**Delete:** Lines 525-576 (Lifecycle Design Pattern section). Already covered in Phase 2.5.

### 4. Consolidate Access Control

**Phase 1 (brief):**
```markdown
4. **Actors & Access**: Who can see/modify what? See [Access Control Pattern](#access-control-pattern) for full specification.
```

**Keep:** Access Control Pattern section (473-523) as-is.

### 5. Extract Discovery Questions to Skill

Create `.claude/skills/discovery/SKILL.md` containing all Phase 1 discovery questions, signals, and access patterns. CLAUDE.md Phase 1 becomes:

```markdown
### Phase 1: Discovery

When a human describes what they want to build, I invoke the `/discovery` skill to guide the conversation.

The skill covers:
- Trigger, Goal, Domain questions
- Actors & Access patterns
- Approval patterns and autonomy boundaries
- Content sourcing and token economics
- Constraint identification

I ask these questions conversationally, not as a checklist. I adapt based on answers.
```

### 6. Add Workspace Structure Doc

Create `docs/workspace-structure.md`:

```markdown
# Workspace Structure

When Agent Architect generates a product, this is the expected directory tree:

{product-name}/
├── manifest.yaml              # Source of truth
├── .claude/
│   ├── CLAUDE.md              # Project instructions
│   └── skills/                # Slash commands
├── agents/                    # CLAUDE.md per agent
├── schemas/                   # Zod output schemas
├── config/                    # Static context
│   ├── personas/{id}/
│   ├── campaigns/
│   └── triage-rules/
├── templates/                 # Handlebars templates
└── docs/                      # Reference documentation

## File Purposes

| Directory | Who Creates | Purpose |
|-----------|-------------|---------|
| `manifest.yaml` | Agent Architect | All events, agents, state machine, database |
| `agents/*.md` | Agent Architect | Per-agent CLAUDE.md instructions |
| `schemas/*.ts` | Agent Architect | Zod schemas for structured output |
| `config/` | Agent Architect | Static context referenced by agents |
| `.claude/` | Agent Architect | Project-level Claude instructions |
| `templates/` | Agent Architect | Context assembly templates |
| `docs/` | Agent Architect | Bundled reference docs |

## Config Directory Convention

Each `context_in.static` reference maps to a config subdirectory:

source: personas        →  config/personas/
source: triage-rules    →  config/triage-rules/
source: campaigns       →  config/campaigns/
```

### 7. Enhance External Technologies

**Before:**
```markdown
## External Technologies

These are the external tech solutions we use.
```

**After:**
```markdown
## External Technologies

Trusted integrations commonly used in generated projects. Local docs provide design guidance; web search official docs for current API signatures.
```

### 8. Create Canonical Example

Create `context/examples/sample-product/` with:

```
sample-product/
├── manifest.yaml              # Annotated with inline comments
├── agents/
│   └── sample-agent.md        # Example CLAUDE.md
├── schemas/
│   └── sample-agent-output.ts # Example output schema
├── config/
│   └── sample-config/
│       └── README.md          # What goes here
└── README.md                  # How to use this example
```

---

## Implementation Phases

### Phase 1: Create Supporting Infrastructure

| Task | Output |
|------|--------|
| Create `/discovery` skill | `.claude/skills/discovery/SKILL.md` |
| Create workspace structure doc | `docs/workspace-structure.md` |
| Create canonical example | `context/examples/sample-product/` |

### Phase 2: Edit CLAUDE.md

| Task | Lines Affected |
|------|----------------|
| Delete SDK doc inline rules | 33-43 |
| Add Agent vs Function decision criteria | After line 191 |
| Replace Phase 1 content with skill reference | 55-122 |
| Consolidate approval patterns (brief in Phase 1) | 86-101 → 2 lines |
| Consolidate access control (brief in Phase 1) | 79-85 → 1 line |
| Delete Lifecycle Design Pattern section | 525-576 |
| Delete Approval Bundle Pattern section | 536-558 |
| Delete Content Source Distinction section | 559-567 |
| Rename "Built-in Tools Reference" | 411 |
| Enhance External Technologies intro | 451 |
| Add static context example | After line 276 |
| Add links to new supporting docs | Key Documents table |
| Add `/discovery` to Skills Reference table | 369-379 |

### Phase 3: Validate

| Check | Target |
|-------|--------|
| CLAUDE.md line count | Under 300 lines |
| All internal links resolve | 100% |
| No duplicated content | Verified |
| Skills table includes /discovery | Present |
| Sample product is complete | All expected files |

---

## Discovery Skill Specification

### Location
`.claude/skills/discovery/SKILL.md`

### Content to Extract from CLAUDE.md

1. **Discovery questions** (lines 55-107)
   - Trigger
   - Goal
   - Domain
   - Actors & Access
   - Constraints
   - Approval Patterns
   - Content Sourcing
   - Token Economics
   - Autonomy Boundaries

2. **Signal patterns** (lines 110-122)
   - Approval pattern signals
   - Access pattern signals

### Skill Structure

```markdown
# Discovery Interview

## When to Use
Invoke at the start of any new agent system design. Guides the conversation to capture all requirements.

## Discovery Questions

### 1. Trigger
What starts the process?
- External webhook (from what service?)
- Scheduled job (how often?)
- Manual submission (via what interface?)

### 2. Goal
What's the end state?
...

[Full content from CLAUDE.md lines 55-122]

## Signals to Listen For

### Approval Patterns
- "I don't want to approve every email" → batch approval needed
- "Once we commit to this lead..." → identify the commitment point
...

### Access Patterns
- "Only the owner should see..." → owner-based access
- "Everyone in the org..." → tenant isolation
...

## Output

After discovery, you should have answers to:
- [ ] What triggers the system?
- [ ] What's the terminal state?
- [ ] Who are the actors?
- [ ] Where are approval points?
- [ ] What content is agent-drafted vs template-sourced?

Proceed to Phase 2: Domain Modeling.
```

---

## Line Count Projection vs Actual

| Section | Before | Projected | Actual |
|---------|--------|-----------|--------|
| Identity + Access | 50 | 20 | ~30 |
| My Process (all phases) | 260 | 120 | ~130 |
| Commands | 10 | 10 | 10 |
| Constraints | 15 | 15 | 15 |
| Separation of Concerns | 25 | 25 | 25 |
| Key Documents | 15 | 20 | 15 |
| Skills Reference | 15 | 20 | 20 |
| Design Patterns | 25 | 15 | 25 |
| Technology Reference | 40 | 35 | 40 |
| Access Control Pattern | 50 | 10 | 10 |
| Agent Contract Tools | 20 | 15 | 20 |
| External Technologies | - | - | 70 |
| **Total** | **578** | **~305** | **432** |

**Decision:** Kept Technology Reference and External Technologies sections inline for easier access. The 432-line result is a 25% reduction and acceptable for usability.

---

## Final Implementation Checklist

### Phase 1: Create Supporting Infrastructure ✓
- [x] Create `.claude/skills/discovery/SKILL.md`
- [x] Create `docs/workspace-structure.md`
- [x] Create `docs/manifest-reference.md` (access control, contract definitions)
- [x] Create `context/examples/sample-product/manifest.yaml`
- [x] Create `context/examples/sample-product/agents/sample-agent.md`
- [x] Create `context/examples/sample-product/schemas/sample-agent-output.ts`
- [x] Create `context/examples/sample-product/config/README.md`
- [x] Create `context/examples/sample-product/README.md`

### Phase 2: Edit CLAUDE.md ✓
- [x] Delete SDK doc inline rules (33-43)
- [x] Replace Phase 1 with skill reference + brief summary
- [x] Add Agent vs Function decision criteria after Phase 3
- [x] Delete Lifecycle Design Pattern section (525-576)
- [x] Condense Access Control Pattern (kept brief version with link to `docs/manifest-reference.md`)
- [x] Keep Technology tables inline (decision: easier access outweighs line count)
- [x] Rename "Built-in Tools Reference" to "Agent Contract Tools"
- [x] Enhance External Technologies intro
- [x] ~~Add static context example~~ (deferred - docs/manifest-reference.md has examples)
- [x] Update Key Documents table with new docs
- [x] Add `/discovery` to Skills Reference table
- [x] Add links throughout

### Phase 3: Validate ✓
- [⚠️] CLAUDE.md under 300 lines — **432 lines** (25% reduction from 578, acceptable)
- [x] All links resolve
- [x] No duplicated content
- [x] Discovery skill loads correctly (verified in system skills list)
- [x] Verify sample-product is a valid workspace structure
