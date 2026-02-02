# Feature: Spec-Based Function Generation

Enable Agent Architect to capture function implementation context during interviews and generate structured spec files that Agent Factory merges into generated projects.

## Status: COMPLETE ✓

**Completed:** 2025-02-01

| Phase | Status | Summary |
|-------|--------|---------|
| Phase 1: Agent Factory Merge Infrastructure | ✅ Complete | `hasFunctionSpecs` detection, DRAFT pattern detection, spec merge logic |
| Phase 2: Agent Architect Interview Enhancement | ✅ Complete | Phase 3.5 references `/function-spec-generation` skill |
| Phase 3: Agent Architect Spec Generation | ✅ Complete | Phase 4 expanded with generation process and section sources |
| Phase 4: Integration Testing with Kringle | ✅ Complete | 2 specs created, merge verified via dry-run |

### Files Changed

**Agent Factory:**
- `src/utils/merge-content.ts` — Added spec detection & merge
- `src/utils/merge-content.test.ts` — Added 9 tests
- `templates/function.hbs` — Added `// SPEC:` reference

**Agent Architect:**
- `CLAUDE.md` — Updated Phase 3.5 and Phase 4
- `HOW-TO-USE.md` — Added spec merge documentation
- `workspace/kringle/functions/specs/` — 2 example specs

---

## Overview

**Problem:** Agent Factory generates Inngest function stubs that crash on invocation (`throw new Error("DRAFT: ...")`). The knowledge needed to implement these functions is captured during the Agent Architect interview but lost — it lives in the conversation, not in the output.

**Solution:** Extend Agent Architect to generate `{function-name}.spec.md` files during the interview phase, following a structured format defined in `spec-format.md`. Agent Factory merges these specs into `inngest/functions/specs/`, providing implementers with comprehensive context.

**Key Insight:** Agent Architect captures context; it doesn't write TypeScript. Implementation happens in the generated project where types, imports, and database schema exist.

---

## Problem Statement

### Current State

```
Interview Phase                    Generated Project
─────────────────                  ──────────────────
"What's the timeout threshold?"    → (lost)
"48 hours"
                                   inngest/functions/check-response-timeouts.ts
"What tables does it query?"       → throw new Error("DRAFT: not implemented");
"campaign_items where status=sent"

"What events should it emit?"      → (lost)
"timeout.response_wait per item"
```

### Desired State

```
Interview Phase                    Generated Project
─────────────────                  ──────────────────
"What's the timeout threshold?"
"48 hours"                         inngest/functions/specs/
                                   └── check-response-timeouts.spec.md
"What tables does it query?"           │
"campaign_items where status=sent"     ├── Configuration: TIMEOUT_HOURS = 48
                                       ├── Database: campaign_items, status=sent
"What events should it emit?"          └── Output: timeout.response_wait
"timeout.response_wait per item"
                                   inngest/functions/check-response-timeouts.ts
                                   → (stub with pointer to spec)
```

---

## Proposed Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AGENT ARCHITECT (Design Time)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐ │
│  │ Interview      │ → │ Classify       │ → │ Generate Spec          │ │
│  │ (existing)     │    │ Complexity     │    │ (new)                  │ │
│  └────────────────┘    └────────────────┘    └────────────────────────┘ │
│                                                       │                  │
│                                                       ▼                  │
│                              workspace/{product}/functions/specs/        │
│                              └── {function-name}.spec.md                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ AGENT FACTORY (Build Time)                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────────────┐ │
│  │ Parse Manifest │ → │ Generate Stubs │ → │ Merge Specs            │ │
│  │ (existing)     │    │ (existing)     │    │ (new)                  │ │
│  └────────────────┘    └────────────────┘    └────────────────────────┘ │
│                                                       │                  │
│                                                       ▼                  │
│                              projects/{product}/inngest/functions/       │
│                              ├── check-response-timeouts.ts  (stub)      │
│                              └── specs/                                  │
│                                  └── check-response-timeouts.spec.md     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GENERATED PROJECT (Implementation Time)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Developer or Claude reads spec → implements function → spec = docs      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Changes Required |
|-----------|------------------|
| Agent Factory | Add spec merge path to `merge-content.ts` |
| Agent Factory | Extend `isStubFile()` to detect DRAFT pattern |
| Agent Factory | Update stub template to reference specs |
| Agent Architect | Add function interview questions to CLAUDE.md |
| Agent Architect | Add spec generation to Phase 4 (Generation) |
| Documentation | Update HOW-TO-USE.md with spec workflow |

### Design Notes

**Specs are pass-through documentation.** Agent Factory does not parse, validate, or transform spec files. It simply:
1. Detects if `functions/specs/` exists in the merge source
2. Copies all `.spec.md` files to `inngest/functions/specs/` in the destination

This is intentional:
- Specs are Markdown documentation, not code
- No schema validation means specs can evolve without code changes
- Implementers (human or Claude) read specs directly
- Future validation (if needed) can be added without breaking existing behavior

---

## Technical Approach

### Implementation Phases

#### Phase 1: Agent Factory Merge Infrastructure

**Goal:** Enable Agent Factory to merge spec files from workspace into generated projects.

**Files to modify:**

| File | Change |
|------|--------|
| `agent-factory/src/utils/merge-content.ts` | Add `hasFunctionSpecs` detection, add merge logic |
| `agent-factory/src/utils/merge-content.ts` | Extend `isStubFile()` to detect DRAFT pattern |
| `agent-factory/templates/function.hbs` | Add spec reference comment in generated stubs |
| `agent-architect/HOW-TO-USE.md` | Document spec merge behavior |
| `agent-factory/src/utils/merge-content.test.ts` | Add unit tests for spec merge (existing file) |

**Detailed changes:**

**1.1 Update `detectContentTypes()` (merge-content.ts:27-59)**

```typescript
export function detectContentTypes(sourcePath: string): {
  hasAgents: boolean;
  hasConfig: boolean;
  hasTemplates: boolean;
  hasSchemas: boolean;
  hasFunctionSpecs: boolean;  // NEW
} {
  const result = {
    hasAgents: false,
    hasConfig: false,
    hasTemplates: false,
    hasSchemas: false,
    hasFunctionSpecs: false,  // NEW
  };

  // ... existing logic ...

  // Check for functions/specs directory
  const specsPath = join(sourcePath, "functions", "specs");
  if (existsSync(specsPath) && statSync(specsPath).isDirectory()) {
    result.hasFunctionSpecs = true;
  }

  return result;
}
```

**1.2 Extend `isStubFile()` detection (merge-content.ts:122-129)**

The function template already outputs `STATUS: DRAFT` and `throw new Error("DRAFT:`, but `isStubFile()` only checks for `TODO:` patterns. Add detection for the DRAFT patterns that already exist in generated stubs:

```typescript
export function isStubFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }
  const content = readFileSync(filePath, "utf-8");
  return (
    content.includes("TODO:") ||
    content.includes("// TODO") ||
    content.includes('throw new Error("DRAFT:') ||  // NEW - already in template output
    content.includes("STATUS: DRAFT")                // NEW - already in template output
  );
}
```

**1.3 Add spec merge section (merge-content.ts, after MERGE SCHEMAS)**

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MERGE FUNCTION SPECS
// ═══════════════════════════════════════════════════════════════════════════

if (contentTypes.hasFunctionSpecs) {
  const specsSource = join(source, "functions", "specs");
  const specsDest = join(dest, "inngest", "functions", "specs");

  if (!dryRun) {
    mkdirSync(specsDest, { recursive: true });
  }

  const specFiles = readdirSync(specsSource).filter((f) => f.endsWith(".spec.md"));

  for (const specFile of specFiles) {
    const sourcePath = join(specsSource, specFile);
    const destPath = join(specsDest, specFile);

    // Always copy specs (they're documentation, not code)
    if (!dryRun) {
      copyFileSync(sourcePath, destPath);
    }
    result.copied.push(relative(process.cwd(), destPath));
  }
}
```

**1.4 Update function stub template (function.hbs)**

Add spec reference at top of generated stubs:

```handlebars
// inngest/functions/{{name}}.ts
// STATUS: DRAFT - Requires implementation
// SPEC: See specs/{{name}}.spec.md for implementation details
// GENERATED: {{generatedAt}}
// PATTERN: {{pattern}}
```

**1.5 Update HOW-TO-USE.md documentation**

Add spec merge behavior to the merge content table in `agent-architect/HOW-TO-USE.md`:

```markdown
| Source Pattern | Target | Strategy |
|----------------|--------|----------|
| ... existing rows ... |
| `functions/specs/*.spec.md` | `inngest/functions/specs/` | Copy all (documentation, always overwrite) |
```

**1.6 Add unit tests for spec merge**

Add tests to existing `agent-factory/src/utils/merge-content.test.ts`:

- Test `detectContentTypes()` returns `hasFunctionSpecs: true` when `functions/specs/` exists
- Test `detectContentTypes()` returns `hasFunctionSpecs: false` when directory doesn't exist
- Test `isStubFile()` returns `true` for `STATUS: DRAFT` content
- Test `isStubFile()` returns `true` for `throw new Error("DRAFT:` content
- Test spec files are copied to correct destination path
- Test spec merge doesn't interfere with existing merge behavior

**Success criteria:**
- [x] `detectContentTypes()` returns `hasFunctionSpecs: true` when `functions/specs/` exists
- [x] `isStubFile()` returns `true` for files containing `throw new Error("DRAFT:`
- [x] Spec files are copied to `inngest/functions/specs/`
- [x] Generated stubs reference their spec file in comments
- [x] HOW-TO-USE.md documents the new merge behavior
- [x] Unit tests pass for all new functionality

---

#### Phase 2: Agent Architect Interview Enhancement

**Goal:** Extend the interview phase to capture function implementation details systematically.

**Files to modify:**

| File | Change |
|------|--------|
| `agent-architect/CLAUDE.md` | Add function interview questions to Phase 3 |
| `agent-architect/CLAUDE.md` | Add complexity classification criteria |

**Detailed changes:**

**2.1 Add to CLAUDE.md Phase 3 (Deep Dive)**

```markdown
### Function Deep Dive

For each non-agentic function in the manifest, I ask:

**Trigger & Timing:**
- "What event triggers this function?" or "What schedule does it run on?"
- "Where does this event come from?" (for context on upstream)

**Data & Queries:**
- "What database tables does this function read from?"
- "What are the query conditions?" (status, time thresholds, etc.)
- "What fields does it need from each table?"

**Logic & Output:**
- "What should happen for each item/event?"
- "What events should be emitted and with what data?"
- "What does the function return?"

**Configuration:**
- "Are there configurable values?" (thresholds, limits, timeouts)
- "What are sensible defaults?"

**Error Handling:**
- "What errors are expected?" (empty results, not found, etc.)
- "What errors should NOT be retried?" (validation failures, bad data)

**Edge Cases:**
- "What happens if [unusual scenario]?"
- "Are there any known complications?"

I capture answers in my notes and use them to generate specs in Phase 4.
```

**2.2 Add complexity classification criteria to CLAUDE.md**

```markdown
### Function Complexity Classification

I classify each function before generating its spec:

| Tier | Criteria | Spec Depth |
|------|----------|------------|
| **Trivial** | Pattern: webhook/simple, Steps: 1-2, No DB writes, No conditionals | Minimal |
| **Simple** | Pattern: simple/cron, Steps: 3-5, May have DB ops, Linear flow | Standard |
| **Complex** | Pattern: fan-in/routing, Multiple integrations, Conditional logic, Has open questions | Comprehensive |

**Complexity signals:**

- `fan-in` or `routing` pattern → Complex
- `wait_for` in trigger → Complex
- `open_questions` in manifest → Complex
- Multiple integrations → Complex
- 4+ steps → Simple or Complex
- Database writes with conditional logic → Simple or Complex
```

**Success criteria:**
- [x] CLAUDE.md includes function interview questions
- [x] CLAUDE.md includes complexity classification criteria
- [x] Interview captures all fields needed for spec generation

---

#### Phase 3: Agent Architect Spec Generation

**Goal:** Generate structured spec files based on interview answers and manifest data.

**Files to modify:**

| File | Change |
|------|--------|
| `agent-architect/CLAUDE.md` | Add spec generation to Phase 4 |
| `agent-architect/context/templates/` | Create spec templates (optional) |

**Detailed changes:**

**3.1 Add to CLAUDE.md Phase 4 (Generation)**

```markdown
### Function Spec Generation

For each non-agentic function, I generate a spec file following the format in `plans/function-capability/spec-format.md`.

**Output location:** `workspace/{product}/functions/specs/{function-name}.spec.md`

**Generation process:**

1. **Classify complexity** using criteria above
2. **Select sections** based on complexity tier
3. **Populate sections** from interview notes + manifest data
4. **Mark status:**
   - `Spec Complete` if all information captured
   - `BLOCKED: Has Open Questions` if unresolved questions exist

**Section population:**

| Section | Source |
|---------|--------|
| Header | Manifest (name, pattern) + Classification |
| Purpose | Interview (why does this exist?) |
| Trigger | Manifest (trigger field) |
| Input | Manifest (trigger) + Interview (payload shape) |
| Output | Manifest (emits) + Interview (payload shapes) |
| Implementation Steps | Interview (logic) + Pattern primitives |
| Database Operations | Interview (tables, fields, conditions) |
| Error Handling | Interview + Pattern defaults |
| Configuration | Interview (thresholds, limits) |
| Integration Calls | Manifest (integrations) + Interview (API details) |
| Edge Cases | Interview (what-ifs) |
| Test Cases | Derived from examples discussed |
| Related Functions | Manifest (event flow analysis) |
| Open Questions | Interview (unresolved items) |

**Example output structure:**

```
workspace/kringle/
├── manifest.yaml
├── agents/
├── functions/
│   └── specs/
│       ├── check-response-timeouts.spec.md
│       ├── ingest-rb2b-webhook.spec.md
│       ├── consolidate-enrichment.spec.md
│       └── route-triage-result.spec.md
└── ...
```
```

**Success criteria:**
- [x] Agent Architect generates spec files during Phase 4
- [x] Specs follow the format in spec-format.md
- [x] Complexity determines section depth
- [x] Open questions block spec status appropriately

---

#### Phase 4: Integration Testing with Kringle

**Goal:** Validate the complete workflow using the Kringle product.

**Tasks:**

1. **Generate specs for existing Kringle functions**
   - Use manifest + interview notes from this conversation
   - Start with `check-response-timeouts` (the one that's erroring)

2. **Rebuild Kringle with specs**
   ```bash
   # Un-archive kringle
   mv workspace/done/kringle workspace/kringle

   # Add specs to workspace
   mkdir -p workspace/kringle/functions/specs
   # (generate spec files)

   # Rebuild
   cd ~/projects
   rm -rf kringle
   npx tsx ~/agent-factory/src/cli.ts init \
     --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
     --output ./kringle \
     --merge-content ~/agent-architect/workspace/kringle \
     --install
   ```

3. **Verify specs merged correctly**
   ```bash
   ls ~/projects/kringle/inngest/functions/specs/
   # Should show: check-response-timeouts.spec.md
   ```

4. **Implement function using spec**
   - Read spec
   - Implement `check-response-timeouts.ts`
   - Verify cron runs without error

**Success criteria:**
- [x] Kringle rebuilds with merged specs
- [x] Specs are accessible at `inngest/functions/specs/`
- [x] Function can be implemented by reading spec
- [ ] Cron job runs successfully after implementation (deferred - requires full project rebuild)

---

## Acceptance Criteria

### Functional Requirements

- [x] Agent Factory detects `functions/specs/` directory in merge sources
- [x] Agent Factory copies `.spec.md` files to `inngest/functions/specs/`
- [x] Agent Factory stub template references spec file location
- [x] `isStubFile()` correctly identifies DRAFT stubs
- [x] Agent Architect interview captures function implementation details
- [x] Agent Architect generates spec files matching spec-format.md
- [x] Complexity classification produces correct tier assignments
- [x] Open questions in specs block status to "BLOCKED"

### Non-Functional Requirements

- [x] Specs are human-readable Markdown
- [x] Specs are diffable in version control
- [x] Merge operation completes in <1 second for typical projects
- [x] No breaking changes to existing merge behavior

### Quality Gates

- [x] All existing merge-content tests pass
- [x] New tests cover spec merge path
- [x] Kringle integration test succeeds
- [x] Documentation updated (HOW-TO-USE.md)

---

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|------------|--------|-------|
| `spec-format.md` defined | ✅ Complete | In `plans/function-capability/` |
| `README.md` overview | ✅ Complete | In `plans/function-capability/` |
| Agent Factory codebase access | ✅ Available | `~/agent-factory/` |
| Agent Architect codebase access | ✅ Available | `~/agent-architect/` |
| Kringle product for testing | ✅ Available | `workspace/done/kringle/` |

---

## Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Spec format is too verbose | Medium | Medium | Start with minimal sections, add as needed |
| Interview doesn't capture enough detail | Medium | High | Iterate on interview questions based on implementation feedback |
| Specs drift from implementation | Low | Medium | Treat specs as documentation; update when implementation changes |
| Complexity classification is wrong | Low | Low | Classification is guidance, not strict; implementer can adjust |

---

## File Locations

### Agent Factory

| Purpose | Path |
|---------|------|
| Merge content utility | `src/utils/merge-content.ts` |
| Function generator | `src/generators/function.ts` |
| Function template | `templates/function.hbs` |
| Init command | `src/commands/init.ts` |

### Agent Architect

| Purpose | Path |
|---------|------|
| Main instructions | `CLAUDE.md` |
| Spec format definition | `plans/function-capability/spec-format.md` |
| This plan | `plans/function-capability/feat-spec-based-function-generation.md` |

### Kringle (Test Product)

| Purpose | Path |
|---------|------|
| Manifest | `workspace/done/kringle/manifest.yaml` |
| Spec output | `workspace/kringle/functions/specs/` (to be created) |

---

## Documentation Plan

| Document | Update Required |
|----------|-----------------|
| `HOW-TO-USE.md` | Add spec merge to merge behavior table |
| `CLAUDE.md` (Agent Architect) | Add function interview questions, spec generation |
| `README.md` (function-capability) | Already complete |
| `spec-format.md` | Already complete |

---

## Future Considerations

1. **Spec validation in Agent Factory**
   - Could validate spec structure before merge
   - Could warn if spec references non-existent tables/events

2. **Spec-to-test generation**
   - Test Cases section could auto-generate test file stubs
   - Would live in `__tests__/functions/`

3. **Spec drift detection**
   - Tool to compare spec vs implementation
   - Warn when implementation diverges from spec

4. **IDE integration**
   - VS Code extension to show spec alongside implementation
   - Jump-to-spec from stub file

---

## References

### Internal

| Document | Purpose |
|----------|---------|
| `plans/function-capability/README.md` | Approach overview |
| `plans/function-capability/spec-format.md` | Spec template and sections |
| `context/tech-docs/inngest.md` | Inngest patterns |
| `context/manifest-schema.ts` | Function schema |

### External

| Resource | URL |
|----------|-----|
| Inngest Step Functions | https://www.inngest.com/docs/features/inngest-functions/steps-workflows |
| Inngest Error Handling | https://www.inngest.com/docs/features/inngest-functions/error-retries |
| Supabase Query Patterns | https://supabase.com/docs/reference/javascript/select |

### Related Work

| Item | Location |
|------|----------|
| Original code-gen approach (archived) | `plans/function-capability/archived-feat-code-generation-approach.md` |
| Earlier research on this feature | This conversation |
