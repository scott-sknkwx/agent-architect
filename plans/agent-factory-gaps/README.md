# Agent Factory Gaps

Gaps between agent-architect documentation and agent-factory implementation, identified from three recently completed plans:
- `agent-runtime-pattern` — Documents how agents execute at runtime
- `context-relocation` — Moved context to `.claude/context/`
- `manifest-coverage` — Added validation/persist schema fields

## Summary

| Gap | Priority | Effort | Status |
|-----|----------|--------|--------|
| Context copy to generated projects | High | Small | Not implemented |
| Subagent generation | High | Medium | Not implemented |
| Full SDK options mapping | Medium | Medium | Partial |
| Manifest schema extensions | Medium | Medium | Not implemented |

---

## Gap 1: Context Copy

**Source:** `context-relocation` plan

**Problem:** Generated projects don't receive `.claude/context/` directory with SDK docs, patterns, and reference materials. Developers extending the generated project have no local documentation.

**Expected behavior:**
```
{generated-project}/
└── .claude/
    └── context/
        ├── agent-sdk-docs/    # SDK reference
        ├── manifest/          # Schema, examples
        ├── patterns/          # Design patterns
        └── tech-docs/         # Integration docs
```

**Current behavior:** Directory not created, nothing copied.

**Location in agent-factory:**
- `src/commands/init.ts:93-109` — Directory creation list
- After line 239 — Where copy should occur

**Fix:**
1. Add `.claude/context` to dirs array
2. Copy from agent-architect's `.claude/context/` to generated project
3. Update generated CLAUDE.md template to reference these docs

**Acceptance criteria:**
- [ ] `{output}/.claude/context/` exists after generation
- [ ] All 4 subdirectories present (agent-sdk-docs, manifest, patterns, tech-docs)
- [ ] Generated CLAUDE.md includes "Reference Materials" section

---

## Gap 2: Subagent Generation

**Source:** `agent-runtime-pattern` plan

**Problem:** Manifest supports `config.subagents[]` but generated code doesn't pass subagents to SDK `query()` options.

**Manifest definition:**
```yaml
agents:
  - name: persona-matcher
    config:
      subagents:
        - name: persona-scorer
          description: "Scores a single lead against a single persona"
          model: "haiku"
          tools: ["Read"]
```

**Expected generated code:**
```typescript
for await (const message of query({
  prompt: "...",
  options: {
    // ... other options
    agents: {
      "persona-scorer": {
        description: "Scores a single lead against a single persona",
        prompt: readFileSync("agents/persona-scorer.md", "utf8"),
        tools: ["Read"],
        model: "haiku"
      }
    }
  }
}))
```

**Current behavior:** `options.agents` not populated.

**Location in agent-factory:**
- `src/manifest/schema.ts:86-91` — SubagentSchema exists
- `templates/inngest-function.hbs` — Template doesn't include agents mapping
- `templates/agent-config.hbs` — Config doesn't include subagents

**Fix:**
1. Extract subagents from manifest during generation
2. Generate subagent config with CLAUDE.md prompt loading
3. Pass to SDK query options

**Acceptance criteria:**
- [ ] Subagents from manifest appear in generated inngest function
- [ ] Subagent CLAUDE.md files loaded as `prompt`
- [ ] Model, tools, description passed correctly

---

## Gap 3: Full SDK Options Mapping

**Source:** `agent-runtime-pattern` plan, `contract-to-sdk-mapping.md`

**Problem:** Agent config generation doesn't fully map manifest fields to SDK `ClaudeAgentOptions`.

**Mapping table (from documentation):**

| Manifest Field | SDK Option | Current Status |
|----------------|------------|----------------|
| `config.model` | `model` | Partial |
| `config.allowed_tools` | `allowedTools` | Partial |
| `config.permission_mode` | `permissionMode` | Partial |
| `config.subagents[]` | `agents{}` | Missing |
| `config.mcp_servers` | `mcpServers` | Missing |
| `contract.output_schema` | `outputFormat.schema` | Working |
| `limits.max_tokens` | `maxThinkingTokens` | Unknown |
| `limits.timeout_seconds` | Inngest function config | Working |

**Location in agent-factory:**
- `templates/agent-config.hbs` — Minimal implementation
- `src/generators/agent-config.ts` — Generator logic

**Fix:**
1. Expand agent-config template to include all SDK options
2. Map model names: `"sonnet"` → `"claude-sonnet-4-5"`
3. Include MCP server configuration
4. Include budget/token limits

**Acceptance criteria:**
- [ ] All manifest config fields map to SDK options
- [ ] Model name translation works
- [ ] MCP servers configurable from manifest

---

## Gap 4: Manifest Schema Extensions

**Source:** `manifest-coverage` plan

**Problem:** New schema fields documented in agent-architect aren't recognized by agent-factory's schema parser.

**New fields:**

### 4.1 `validate_input`

```yaml
agents:
  - name: persona-matcher
    validate_input:
      payload: ["lead_id", "organization_id"]
      exists: "SELECT 1 FROM leads WHERE id = :lead_id"
      state: "SELECT 1 FROM leads WHERE id = :lead_id AND status = 'enriched'"
```

### 4.2 `validate_output`

```yaml
agents:
  - name: persona-matcher
    validate_output:
      schema: "schemas/persona-matcher-output.ts"
      require_artifacts: true
```

### 4.3 `persist`

```yaml
agents:
  - name: persona-matcher
    persist:
      - update: leads
        set:
          status: "matched"
          persona_id: "output.persona_id"
        where: "id = :lead_id"
      - log: agent_runs
        data:
          agent: "persona-matcher"
          duration_ms: "output.duration_ms"
```

**Location in agent-factory:**
- `src/manifest/schema.ts:98-144` — AgentSchema, FunctionSchema

**Fix:**
1. Add `ValidationRuleSchema` to schema.ts
2. Add `PersistActionSchema` to schema.ts
3. Add fields to AgentSchema and FunctionSchema
4. Update generators to use these fields (or generate stubs)

**Acceptance criteria:**
- [ ] Manifest with new fields parses without error
- [ ] Fields accessible during generation
- [ ] Generated code includes validation/persist logic (or TODOs)

---

## Implementation Order

### Phase 1: Context Copy (Quick Win)
- Add `.claude/context` directory creation
- Implement copy from agent-architect
- Update generated CLAUDE.md template
- **Validates:** Developers can reference docs in generated projects

### Phase 2: Subagent Generation
- Update inngest-function template
- Generate subagent config objects
- Load subagent CLAUDE.md as prompt
- **Validates:** Multi-agent workflows work

### Phase 3: Full SDK Mapping
- Expand agent-config template
- Add model name translation
- Add MCP server support
- **Validates:** All manifest config reaches SDK

### Phase 4: Schema Extensions
- Add new schema types
- Update parsers
- Generate validation/persist stubs
- **Validates:** New manifest features recognized

---

## Files Affected in Agent Factory

| File | Changes |
|------|---------|
| `src/commands/init.ts` | Add context directory, copy logic |
| `src/manifest/schema.ts` | Add validate_input, validate_output, persist |
| `templates/inngest-function.hbs` | Add subagent passing, validation steps |
| `templates/agent-config.hbs` | Expand to full SDK options |
| `src/generators/agent-config.ts` | Handle new config fields |

---

## References

### Agent Architect Documentation
- `.claude/context/patterns/agent-runtime-pattern.md` — Canonical agent runner pattern
- `.claude/context/manifest/contract-to-sdk-mapping.md` — Full mapping table
- `.claude/context/manifest/reference.md` — Schema documentation with new fields

### Agent Factory
- `src/manifest/schema.ts` — Current schema
- `templates/` — Generation templates

### Completed Plans
- `plans/zzz-complete/agent-runtime-pattern/`
- `plans/zzz-complete/context-relocation/`
- `plans/zzz-complete/manifest-coverage/`
