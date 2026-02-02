# Context Relocation Plan

## Summary

Move `context/` into `.claude/context/` so that:
1. Agent Architect references it from the canonical location
2. Generated projects receive a full copy
3. No version drift between agent-architect and its own reference materials

## Current State

```
agent-architect/
├── CLAUDE.md              # References context/ directly
├── context/
│   ├── agent-sdk-docs/
│   ├── manifest/
│   ├── patterns/
│   └── tech-docs/
└── .claude/
    └── skills/
```

## Target State

```
agent-architect/
├── CLAUDE.md              # References .claude/context/
├── .claude/
│   ├── context/           # MOVED HERE
│   │   ├── agent-sdk-docs/
│   │   ├── manifest/
│   │   ├── patterns/
│   │   └── tech-docs/
│   └── skills/
└── workspace/
    └── {product}/
        └── .claude/
            └── context/   # FULL COPY (not symlink)
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Location | `.claude/context/` | Single source of truth for agent-architect |
| Copy vs symlink | Full copy | Portability; generated projects are standalone |
| tech-docs curation | Include ALL | Future extensibility; don't know what integrations will be added |
| agent-sdk-docs | Include FULL | Completeness is worth the size |
| Version drift | Not acceptable | Hence the move (not duplicate) |

## Implementation Steps

### Phase 1: Move context/ to .claude/context/

1. Move the directory:
   ```bash
   mv context/ .claude/context/
   ```

2. Update `CLAUDE.md` references:
   - Change all `context/` paths to `.claude/context/`
   - Update Resource table locations
   - Update Reference section paths

3. Update any skills that reference context/:
   - Check `.claude/skills/` for `context/` references
   - Update to `.claude/context/`

4. Verify no broken references:
   ```bash
   grep -r "context/" CLAUDE.md .claude/skills/
   ```

### Phase 2: Update Output Structure

1. Update `output-structure.md` (now at `.claude/context/manifest/output-structure.md`):
   - Add `.claude/context/` section to directory tree
   - Document what each subdirectory contains
   - Add to validation checklist

2. Document the copy behavior:
   - All of `.claude/context/` gets copied to generated projects
   - No curation/filtering

### Phase 3: Update Generation Logic

In Phase 4 of the agent-architect process:

1. Add step to copy `.claude/context/` to workspace output:
   ```
   workspace/{product}/.claude/context/ ← copy from .claude/context/
   ```

2. Update generated project's `.claude/CLAUDE.md` to include reference section:
   ```markdown
   ## Reference Materials

   When extending this project, consult:

   | Topic | Location |
   |-------|----------|
   | Agent SDK (tools, permissions, hooks) | `.claude/context/agent-sdk-docs/` |
   | Design patterns (agent vs function, approvals) | `.claude/context/patterns/` |
   | Integration documentation | `.claude/context/tech-docs/` |
   | Manifest schema and examples | `.claude/context/manifest/` |
   ```

### Phase 4: Validation

1. Run agent-architect on a test product
2. Verify `.claude/context/` is copied to workspace output
3. Verify generated CLAUDE.md references are correct
4. Verify agent-architect itself still works with moved context

## Files to Modify

| File | Changes |
|------|---------|
| `CLAUDE.md` | Update all `context/` → `.claude/context/` |
| `.claude/context/manifest/output-structure.md` | Add context section, update tree |
| `.claude/skills/*` | Check for and update any context/ references |
| Phase 4 generation instructions in `CLAUDE.md` | Add context copy step |

## Files to Move

```
context/agent-sdk-docs/  →  .claude/context/agent-sdk-docs/
context/manifest/        →  .claude/context/manifest/
context/patterns/        →  .claude/context/patterns/
context/tech-docs/       →  .claude/context/tech-docs/
```

## Generated Project CLAUDE.md Template Addition

```markdown
## Reference Materials

This project includes reference documentation for extending and maintaining the system.

### Agent SDK Documentation
Location: `.claude/context/agent-sdk-docs/`

Use when:
- Adding new agents
- Modifying agent tool permissions
- Understanding hooks, subagents, skills
- Configuring structured outputs

Key files:
- `docs/agent-sdk-overview.md` - Capabilities overview
- `docs/typescript-sdk.md` - API reference
- `docs/guides/` - How-to guides for specific features

### Design Patterns
Location: `.claude/context/patterns/`

Use when:
- Deciding agent vs function for new capability
- Adding approval workflows
- Understanding content sourcing decisions
- Designing event flows

Key files:
- `executor-model-pattern.md` - Agent vs function decision framework
- `bundle-approval-pattern.md` - Human approval design
- `content-sourcing-pattern.md` - Agent-drafted vs template-sourced
- `event-design-patterns.md` - Event naming and payload design

### Integration Documentation
Location: `.claude/context/tech-docs/`

Use when:
- Implementing function specs
- Adding new integrations
- Debugging external service calls
- Understanding webhook patterns

### Manifest Reference
Location: `.claude/context/manifest/`

Use when:
- Modifying manifest.yaml
- Adding new agents, events, or functions
- Understanding schema structure
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Broken references after move | grep validation step |
| Skills referencing old paths | Explicit skills check in Phase 1 |
| Generated projects missing context | Validation step in Phase 4 |

## Success Criteria

- [ ] `context/` no longer exists at root level
- [ ] `.claude/context/` contains all moved content
- [ ] `CLAUDE.md` references `.claude/context/` paths
- [ ] Generated projects receive full `.claude/context/` copy
- [ ] Generated project CLAUDE.md includes reference section
- [ ] Agent-architect discovery/generation still functions correctly
