# refactor: Relocate context/ to .claude/context/

## Overview

Move `context/` directory into `.claude/context/` so that:
1. Agent Architect references it from the canonical `.claude/` location
2. Generated projects receive a full copy of reference documentation
3. No version drift between agent-architect and its reference materials

## Problem Statement

The current `context/` directory sits at the repository root, separate from the `.claude/` directory where skills and Claude Code configuration live. This creates several issues:

- **Inconsistent structure**: Reference docs are separate from the `.claude/` hierarchy
- **No copy behavior for generated projects**: Workspaces don't automatically inherit reference materials
- **Discovery friction**: Users must know about two separate locations for Claude-related content

## Proposed Solution

Relocate `context/` to `.claude/context/` and update all references. Add generation logic to copy this directory to generated workspaces.

```
BEFORE                              AFTER
──────────────────────────────────  ──────────────────────────────────
agent-architect/                    agent-architect/
├── CLAUDE.md                       ├── CLAUDE.md
├── context/          ◄── HERE      ├── .claude/
│   ├── agent-sdk-docs/             │   ├── context/      ◄── MOVED
│   ├── manifest/                   │   │   ├── agent-sdk-docs/
│   ├── patterns/                   │   │   ├── manifest/
│   └── tech-docs/                  │   │   ├── patterns/
└── .claude/                        │   │   └── tech-docs/
    └── skills/                     │   └── skills/
                                    └── workspace/
                                        └── {product}/
                                            └── .claude/
                                                └── context/  ◄── COPY
```

## Technical Approach

### Critical Blocker: .gitignore Fix

The current `.gitignore` contains `.claude/` which ignores the entire directory. This MUST be fixed before moving content.

```gitignore
# CURRENT (problematic)
.claude/

# REQUIRED (selective)
.claude/settings.json
.claude/settings.local.json
```

### Files Requiring Updates

| File | Occurrences | Type |
|------|-------------|------|
| `.gitignore` | 1 | Config |
| `CLAUDE.md` | 15 | Core reference |
| `HOW-TO-USE.md` | 4 | User documentation |
| `.claude/skills/agent-sdk/SKILL.md` | 4 | Skill |
| `.claude/skills/agent-sdk/troubleshooting.md` | 2 | Skill |
| `.claude/skills/agent-sdk/code-examples.md` | 1 | Skill |
| `.claude/context/manifest/output-structure.md` | 1 | Post-move update |

**Total: 8 files, 28 reference updates**

### Reference Locations

**CLAUDE.md** (15 occurrences):
- Lines 83-87: Resources table
- Lines 396-398: Key Documents table
- Lines 406-412: Design Patterns table
- Line 434: Technology Reference section

**HOW-TO-USE.md** (4 occurrences):
- Line 263: Directory Structure Reference tree
- Lines 283-284: Generated Product tree (distinct from agent context)

**Skills** (7 occurrences total):
- `.claude/skills/agent-sdk/SKILL.md`: Lines 8, 31, 112, 117
- `.claude/skills/agent-sdk/troubleshooting.md`: Lines 3, 120
- `.claude/skills/agent-sdk/code-examples.md`: Line 3

## Implementation Phases

### Phase 0: Preparation (CRITICAL) ✅

**Purpose:** Create safety checkpoint and fix .gitignore before any changes.

> **Note:** Phase 0 was completed in a previous PR iteration (commit `bdaea43`).

- [x] `git add -A && git commit -m "checkpoint: before context relocation"` - Create restore point
- [x] Update `.gitignore` to selectively ignore `.claude/settings*.json` instead of entire `.claude/`
- [x] Verify: `git check-ignore .claude/context/` returns nothing (not ignored)
- [x] Stage .gitignore change

### Phase 1: Move Directory ✅

**Purpose:** Physically relocate the content.

- [x] `mv context/ .claude/context/`
- [x] Verify: `ls -la .claude/context/` shows all 4 subdirectories
- [x] Verify: `context/` no longer exists at root

### Phase 2: Update References ✅

**Purpose:** Fix all path references across the codebase.

#### 2.1 CLAUDE.md

Update all `context/` paths to `.claude/context/`:

- [x] Resources table (lines 83-87)
- [x] Key Documents table (lines 396-398)
- [x] Design Patterns table (lines 406-412)
- [x] Technology Reference section (line 434)

#### 2.2 HOW-TO-USE.md

- [x] Directory Structure Reference tree (line 263)
- [x] Verify lines 283-284 refer to `agents/*/context/` (different concept, no change needed)

#### 2.3 Skills

- [x] `.claude/skills/agent-sdk/SKILL.md` - 4 occurrences
- [x] `.claude/skills/agent-sdk/troubleshooting.md` - 2 occurrences
- [x] `.claude/skills/agent-sdk/code-examples.md` - 1 occurrence

### Phase 3: Update Generation Logic ✅

**Purpose:** Ensure generated projects receive context copy.

#### 3.1 Update output-structure.md

Add to `.claude/context/manifest/output-structure.md`:
- [x] New `.claude/context/` section in directory tree
- [x] Document copy behavior
- [x] Add validation checklist item

#### 3.2 Add to CLAUDE.md Phase 4

- [x] Add step to Phase 4 generation instructions:

```markdown
8. **Context copy** - Copy reference materials to generated project:
   - Copy `.claude/context/` to `workspace/{product}/.claude/context/`
   - All subdirectories: agent-sdk-docs, manifest, patterns, tech-docs
   - This provides generated projects with complete reference documentation
```

#### 3.3 Add Generated CLAUDE.md Template Section

- [x] Add template for reference section to include in generated project's `.claude/CLAUDE.md`:

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

### Phase 4: Validation ✅

**Purpose:** Verify migration succeeded.

#### 4.1 Path Verification

```bash
# Should return NOTHING (except agents/*/context/ which is different)
grep -r "context/" CLAUDE.md HOW-TO-USE.md .claude/skills/ | grep -v ".claude/context/"
```

- [x] No stale references (only `agents/*/context/` refs remain, which is correct)

#### 4.2 Git Verification

```bash
# Should NOT be ignored
git check-ignore .claude/context/

# Should show all changes staged properly
git status
```

- [x] `.claude/context/` is tracked by git
- [x] All expected files show as modified/renamed (52 renamed, 6 modified)

#### 4.3 Functional Test

- [x] All 4 context subdirectories present (agent-sdk-docs, manifest, patterns, tech-docs)
- [x] SDK docs exist at paths referenced by skills
- [x] `index.md` exists at `.claude/context/agent-sdk-docs/index.md`

#### 4.4 Generation Test (Optional)

- [ ] Run discovery on a test product
- [ ] Verify `workspace/{test}/.claude/context/` is created with all subdirectories
- [ ] Verify generated CLAUDE.md includes reference section

### Phase 5: Commit

**Purpose:** Complete the migration with proper commit.

```bash
git add -A
git commit -m "refactor: relocate context/ to .claude/context/

- Move context/ directory into .claude/context/
- Update all references in CLAUDE.md, HOW-TO-USE.md
- Update agent-sdk skill references
- Fix .gitignore to track .claude/context/
- Add context copy step to Phase 4 generation
- Update output-structure.md with new location

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## Acceptance Criteria

### Functional Requirements

- [x] `context/` no longer exists at root level
- [x] `.claude/context/` contains all moved content (agent-sdk-docs, manifest, patterns, tech-docs)
- [x] All CLAUDE.md references point to `.claude/context/` paths
- [x] All skill references point to `.claude/context/` paths
- [x] HOW-TO-USE.md directory tree shows `.claude/context/`
- [x] `.gitignore` allows `.claude/context/` to be tracked
- [ ] Agent-architect discovery/generation still functions correctly

### Quality Gates

- [x] `grep -r "context/" CLAUDE.md HOW-TO-USE.md .claude/skills/ | grep -v ".claude/context/"` returns nothing (only `agents/*/context/` refs remain, which is correct)
- [x] `git check-ignore .claude/context/` returns nothing
- [x] Skill file references point to existing documentation paths

## Dependencies & Risks

### Dependencies

- None (self-contained refactor)

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Forgotten reference causes skill failure | Medium | High | Complete grep verification |
| .gitignore not fixed, content ignored | Low | High | Fix .gitignore FIRST (Phase 0) |
| Interrupted migration leaves broken state | Low | High | Git checkpoint enables rollback |
| Generated projects fail without context | Medium | Medium | Generation test validates |

### Rollback Procedure

If migration fails:
```bash
git checkout HEAD~1  # Return to checkpoint
# Or if already committed:
git revert HEAD
mv .claude/context/ context/
```

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| What should .gitignore contain? | Selective: `.claude/settings.json`, `.claude/settings.local.json` |
| Should archived plans be updated? | No - they're historical records |
| How does copy happen? | Added to Phase 4 instructions in CLAUDE.md |
| What about existing workspaces? | Unaffected - context is reference only |

## References

### Internal

- Original plan: `plans/context-relocation/README.md`
- Output structure: `.claude/context/manifest/output-structure.md`
- Agent SDK skill: `.claude/skills/agent-sdk/SKILL.md`

### External

- [Claude Code Memory Documentation](https://code.claude.com/docs/en/memory)
- [CLAUDE.md Best Practices](https://claude.com/blog/using-claude-md-files)

---

**Estimated changes:** 8 files, ~50 line edits
