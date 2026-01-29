# feat: Add `--output`, `--merge-content`, `--install`, `--clean-staging` flags to agent-factory CLI

**Created**: 2026-01-29
**Status**: Draft
**Complexity**: Medium-High
**Estimated Files**: 5-8 files modified/created

---

## Overview

Enhance the `agent-factory init` command with four new flags to streamline the workflow from Agent Architect design to running product. Currently, users must manually copy CLAUDE.md files, configs, templates, and schemas after generation. This feature consolidates that into a single command.

**Before (7 steps)**:
```bash
cd ~/projects
npx tsx ~/agent-factory/src/cli.ts init --manifest ~/agent-architect/workspace/kringle/manifest.yaml
cd kringle
cp ~/agent-architect/workspace/kringle/agents/persona-matcher.md agents/persona-matcher/context/CLAUDE.md
# ... repeat for each agent, config, template, schema
npm install
rm -rf ~/agent-architect/workspace/kringle
```

**After (1 step)**:
```bash
agent-factory init \
  --manifest ~/agent-architect/workspace/kringle/manifest.yaml \
  --output ~/projects/kringle \
  --merge-content ~/agent-architect/workspace/kringle \
  --install \
  --clean-staging
```

---

## Problem Statement / Motivation

The current workflow from HOW-TO-USE.md (lines 88-110) has significant friction:

1. **Multiple manual copy steps** - Easy to forget files, especially as agent count grows
2. **Error-prone** - Wrong paths, missing files, partial copies
3. **Output location is implicit** - Uses CWD + product.name, leading to accidental generation in wrong directory
4. **Dependencies not auto-installed** - Extra step users always need
5. **Cleanup is manual** - Staging directories accumulate

This friction slows the design-to-implementation feedback loop that Agent Architect aims to optimize.

---

## Proposed Solution

Add four new flags to the `agent-factory init` command:

| Flag | Type | Purpose |
|------|------|---------|
| `--output <path>` / `-o` | Optional string | Explicit output directory (instead of cwd + product.name) |
| `--merge-content <path>` | Repeatable string[] | Directory to merge into generated project |
| `--install` / `-i` | Boolean | Run `npm install` after generation |
| `--clean-staging` | Boolean | Remove merge-content source directories after success |

---

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EXECUTION PHASES                               │
└─────────────────────────────────────────────────────────────────────────────┘

Phase 1: Argument Parsing & Validation
├─ Parse --manifest (required, existing)
├─ Parse --output (optional, resolve path)
├─ Collect --merge-content paths (optional, repeatable, validate each exists)
├─ Parse --install (boolean flag)
└─ Parse --clean-staging (boolean flag, requires --merge-content)

Phase 2: Determine Output Directory
├─ IF --output: use resolved path
└─ ELSE: use join(cwd, manifest.product.name)

Phase 3: Scaffold Project (EXISTING BEHAVIOR)
├─ Create directory structure
├─ Generate all files from templates
└─ Generate stub CLAUDE.md files

Phase 4: Merge Content (NEW)
├─ FOR each --merge-content path:
│   ├─ Detect content type (agents/, config/, templates/, schemas/)
│   └─ Apply appropriate merge strategy
└─ Log merge summary

Phase 5: Install Dependencies (CONDITIONAL)
├─ IF --install:
│   ├─ Detect package manager (default: npm)
│   └─ Run install in output directory

Phase 6: Clean Staging (CONDITIONAL)
├─ IF --clean-staging AND all previous phases succeeded:
│   ├─ Validate paths are safe to delete
│   └─ Remove each --merge-content source directory
```

### Merge Strategy by Content Type

| Source Pattern | Target | Strategy |
|----------------|--------|----------|
| `agents/*.md` (flat files) | `agents/*/context/CLAUDE.md` | Match by name, overwrite stubs |
| `agents/*/context/CLAUDE.md` (nested) | `agents/*/context/CLAUDE.md` | Direct copy, overwrite stubs |
| `config/**/*` | `config/` | Deep copy, skip existing files |
| `templates/**/*` | `templates/` | Deep copy, skip existing files |
| `schemas/*.ts` | `schemas/` | Copy, overwrite generated stubs |

### File Changes

#### Modified Files

**`/Users/scottstrang/agent-factory/src/cli.ts`** (CLI entry point)
```typescript
// Add new options to init command
program
  .command("init")
  .description("Initialize a new product from a manifest")
  .requiredOption("-m, --manifest <path>", "Path to product.manifest.yaml")
  .option("-o, --output <path>", "Output directory (defaults to product name)")
  .option(
    "-c, --merge-content <path>",
    "Content directory to merge (repeatable)",
    collectPaths,
    []
  )
  .option("-i, --install", "Run npm install after generation")
  .option("--clean-staging", "Remove merge-content directories after success")
  .option("--dry-run", "Preview changes without executing")
  .action(async (options) => {
    await initCommand(options);
  });
```

**`/Users/scottstrang/agent-factory/src/commands/init.ts`** (Init command)
- Refactor to accept options object instead of single manifest path
- Add merge phase after scaffold phase
- Add install phase (conditional)
- Add cleanup phase (conditional)
- Update "Next steps" output based on what was done

#### New Files

**`/Users/scottstrang/agent-factory/src/utils/merge-content.ts`** (Merge logic)
```typescript
export interface MergeOptions {
  source: string;      // Source directory path
  dest: string;        // Destination project directory
  dryRun?: boolean;    // Preview only
}

export interface MergeResult {
  copied: string[];    // Files that were copied
  skipped: string[];   // Files that were skipped (already exist)
  matched: string[];   // Agent .md files matched to agents
  unmatched: string[]; // Agent .md files with no matching agent
}

export async function mergeContent(options: MergeOptions): Promise<MergeResult>;
```

**`/Users/scottstrang/agent-factory/src/utils/run-install.ts`** (npm install runner)
```typescript
export interface InstallOptions {
  cwd: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
  silent?: boolean;
}

export async function runInstall(options: InstallOptions): Promise<void>;
```

**`/Users/scottstrang/agent-factory/src/utils/cleanup.ts`** (Safe cleanup)
```typescript
export interface CleanupOptions {
  paths: string[];
  dryRun?: boolean;
  force?: boolean;
}

export async function safeCleanup(options: CleanupOptions): Promise<string[]>;
```

**`/Users/scottstrang/agent-factory/src/utils/path-helpers.ts`** (Path utilities)
```typescript
export function collectPaths(value: string, previous: string[]): string[];
export function validatePath(path: string): string;
export function validateDirectory(path: string): string;
export function isSafePath(path: string): boolean;
```

---

## Implementation Phases

### Phase 1: Foundation (Core flags without merge logic)

**Deliverables:**
- [ ] Add `--output` flag with path resolution
- [ ] Add `--install` flag with basic npm install
- [ ] Add `--dry-run` flag for preview mode
- [ ] Refactor `initCommand` to accept options object
- [ ] Update "Next steps" output dynamically

**Success Criteria:**
- `agent-factory init -m manifest.yaml -o ./my-project --install` works
- Output directory is controllable
- Dependencies install automatically when flag is set

**Files:**
- `src/cli.ts` - Add flags
- `src/commands/init.ts` - Refactor signature, add install logic
- `src/utils/run-install.ts` - New file
- `src/utils/path-helpers.ts` - New file

### Phase 2: Merge Content

**Deliverables:**
- [ ] Add `--merge-content` repeatable flag
- [ ] Implement content type detection (agents/, config/, templates/, schemas/)
- [ ] Implement CLAUDE.md matching logic (flat and nested support)
- [ ] Implement deep copy for config/templates
- [ ] Implement schema merge (overwrite stubs)
- [ ] Log merge summary

**Success Criteria:**
- `--merge-content ~/workspace/kringle` correctly routes content to appropriate targets
- CLAUDE.md stubs are replaced with real content
- Config/templates are copied without overwriting existing
- Unmatched agent files produce warnings

**Files:**
- `src/cli.ts` - Add `--merge-content` flag
- `src/commands/init.ts` - Add merge phase
- `src/utils/merge-content.ts` - New file

### Phase 3: Clean Staging

**Deliverables:**
- [ ] Add `--clean-staging` flag
- [ ] Implement path safety validation
- [ ] Only clean after successful generation + merge
- [ ] Add confirmation/warning for paths outside workspace

**Success Criteria:**
- `--clean-staging` removes merge-content source directories
- Refuses to delete dangerous paths (/, ~, /usr, etc.)
- Only runs if all previous phases succeeded
- Warns for paths outside conventional workspace locations

**Files:**
- `src/cli.ts` - Add `--clean-staging` flag
- `src/commands/init.ts` - Add cleanup phase
- `src/utils/cleanup.ts` - New file

### Phase 4: Polish & Documentation

**Deliverables:**
- [ ] Add `--verbose` flag for detailed logging
- [ ] Update agent-architect/HOW-TO-USE.md with new workflow
- [ ] Add error codes and helpful error messages
- [ ] Add integration tests for all flag combinations

**Success Criteria:**
- Clean, informative output for all scenarios
- Documentation matches implementation
- Tests cover happy path and error cases

---

## Alternative Approaches Considered

### Alternative 1: Single `--workspace` flag instead of `--merge-content`

```bash
agent-factory init --manifest ./manifest.yaml --workspace ~/agent-architect/workspace/kringle
```

**Pros:** Simpler UX, single flag
**Cons:** Less flexible, assumes specific directory structure
**Decision:** Rejected - `--merge-content` is more flexible and explicit

### Alternative 2: Automatic merge based on manifest location

Detect if manifest is in an agent-architect workspace and auto-merge sibling directories.

**Pros:** Zero configuration for common case
**Cons:** Magic behavior, harder to understand/debug
**Decision:** Rejected - explicit flags are clearer

### Alternative 3: Config file for complex workflows

`.agent-factory.json` that specifies all options.

**Pros:** Reproducible builds, no long command lines
**Cons:** Over-engineering for current needs, adds complexity
**Decision:** Deferred - can add later if needed

---

## Acceptance Criteria

### Functional Requirements

- [ ] `--output <path>` generates project at specified path instead of CWD/product.name
- [ ] `--output` creates parent directories if they don't exist
- [ ] `--merge-content <path>` can be specified multiple times
- [ ] `--merge-content` validates that paths exist before starting
- [ ] Agent `.md` files are matched by name to generated agent directories
- [ ] Unmatched agent `.md` files produce a warning
- [ ] `--install` runs npm install in the output directory
- [ ] `--install` failure does not delete generated files
- [ ] `--clean-staging` only runs after successful generation and merge
- [ ] `--clean-staging` validates paths before deletion
- [ ] `--dry-run` shows what would happen without making changes
- [ ] All flags work in combination

### Non-Functional Requirements

- [ ] Performance: Merge operation completes in < 5 seconds for typical workspace
- [ ] Error messages include specific file paths and suggested fixes
- [ ] Console output uses consistent chalk styling with existing CLI

### Quality Gates

- [ ] All existing tests pass
- [ ] New integration tests for each flag
- [ ] TypeScript strict mode, no `any` types
- [ ] Code follows existing patterns in init.ts

---

## Risk Analysis & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `--clean-staging` deletes wrong directory | Low | Critical | Path validation, require paths within workspace or use --force |
| Merge overwrites user customizations | Medium | High | Skip existing files for config/templates, only overwrite stubs |
| npm install fails in CI environment | Medium | Medium | Clear error message, keep generated files, suggest retry |
| Path resolution differs across OS | Low | Medium | Use Node.js path.resolve(), test on macOS/Linux/Windows |

---

## Dependencies & Prerequisites

**Required:**
- `fs-extra` - Already in package.json (v11.3.3) for enhanced file operations
- `child_process` - Node.js built-in for npm install

**Optional additions:**
- `ora` - For spinner during install (nice-to-have)
- `rimraf` - For cross-platform cleanup (fs-extra may suffice)

---

## Testing Strategy

### Unit Tests

```typescript
// src/utils/__tests__/merge-content.test.ts
describe('mergeContent', () => {
  it('matches flat agent .md files to agent directories');
  it('matches nested CLAUDE.md files to agent directories');
  it('skips existing config files');
  it('overwrites generated schema stubs');
  it('reports unmatched agent files as warnings');
});

// src/utils/__tests__/cleanup.test.ts
describe('safeCleanup', () => {
  it('refuses to delete root directories');
  it('refuses to delete home directory');
  it('deletes specified directories');
  it('handles non-existent paths gracefully');
});
```

### Integration Tests

```bash
# Test matrix for flag combinations
npm test -- --grep "init command"

# F1: Default behavior (existing)
# F2: --output only
# F6: Full workflow (--output --merge-content --install --clean-staging)
# F9: --output --install (no merge)
```

---

## References & Research

### Internal References

- Current init implementation: `/Users/scottstrang/agent-factory/src/commands/init.ts`
- CLI entry point: `/Users/scottstrang/agent-factory/src/cli.ts`
- Proposed workflow: `/Users/scottstrang/agent-architect/HOW-TO-USE.md:141-210`
- Manifest schema: `/Users/scottstrang/agent-factory/src/manifest/schema.ts`

### External References

- [Commander.js variadic options](https://github.com/tj/commander.js#variadic-option)
- [fs-extra copy with filter](https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy.md)
- [Node.js child_process spawn](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)

### Related Work

- Issue: N/A (this is the first issue)
- PRs: N/A

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Q1: Source structure for CLAUDE.md files? | Support BOTH flat (`agents/*.md`) AND nested (`agents/*/context/CLAUDE.md`) |
| Q2: Existing directory handling? | Check if exists, warn if non-empty, proceed unless `--force` is needed |
| Q3: Conflict resolution for merged files? | CLAUDE.md: overwrite stubs. Config/templates: skip existing. Schemas: overwrite stubs. |
| Q4: Smart merge vs separate flags? | Smart merge - auto-detect subdirectories and route appropriately |
| Q5: Clean-staging safeguards? | Path validation + refuse dangerous paths + require explicit --merge-content |

---

## ERD: No database changes

This feature modifies CLI behavior only; no database schema changes required.

---

## File Tree After Implementation

```
agent-factory/
├── src/
│   ├── cli.ts                      # MODIFIED: Add flags
│   ├── commands/
│   │   └── init.ts                 # MODIFIED: Refactor, add phases
│   └── utils/
│       ├── merge-content.ts        # NEW: Merge logic
│       ├── run-install.ts          # NEW: npm install wrapper
│       ├── cleanup.ts              # NEW: Safe cleanup
│       └── path-helpers.ts         # NEW: Path utilities
└── package.json                    # MODIFIED: Add deps if needed
```
