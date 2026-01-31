# Fix Agent Factory SDK Type Errors

**Type:** fix
**Status:** Ready for implementation
**Date:** 2026-01-31
**Affects:** agent-factory generator templates

---

## Overview

The agent-factory code generator produces TypeScript files with type errors because the templates use incorrect SDK type names and API signatures. These are template-level issues that need to be fixed in the agent-factory project, not in generated projects.

## Problem Statement

When running `npx tsc --noEmit` on generated projects, 22 TypeScript errors appear:

| Category | Count | Root Cause |
|----------|-------|------------|
| Agent SDK Import | 6 | `ClaudeAgentOptions` doesn't exist—use `Options` |
| Agent Output Types | 14 | Generated functions assume `{ success: boolean }` but use fields like `action`, `matched`, `classification` |
| Agent Runner Config | 2 | `cwd` passed incorrectly to `query()` function |

## Technical Analysis

### Error 1: Wrong Type Name (`ClaudeAgentOptions`)

**Current template code** (`templates/agent-config.hbs:1`):
```typescript
import type { ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
```

**SDK documentation confirms** (`context/agent-sdk-docs/docs/typescript-sdk.md:90-133`):
- The correct type is `Options`, not `ClaudeAgentOptions`
- `ClaudeAgentOptions` is a **Python SDK type**, not TypeScript

**Fix:** Change import to:
```typescript
import type { Options } from "@anthropic-ai/claude-agent-sdk";
```

### Error 2: Wrong `query()` Call Signature

**Current generated code** (`init.ts:986-990`):
```typescript
for await (const message of query({
  prompt: "Execute your task as defined in CLAUDE.md",
  options: config,
  cwd: workspacePath,  // ❌ cwd is NOT a top-level parameter
}))
```

**SDK documentation confirms** (`typescript-sdk.md:26-32`):
```typescript
function query({
  prompt,
  options   // cwd goes INSIDE options, not alongside it
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

**Fix:** Move `cwd` inside the options object:
```typescript
for await (const message of query({
  prompt: "Execute your task as defined in CLAUDE.md",
  options: {
    ...config,
    cwd: workspacePath,
  },
}))
```

### Error 3: Agent Output Type Mismatch

**Problem:** The Inngest function templates access specific output fields (`action`, `matched`, `classification`) but the TypeScript compiler only knows about `{ success: boolean }`.

**Current code pattern** (`inngest-function.hbs`):
```typescript
const rawOutput = (result as any).structured_output;
// Later uses: output.action, output.matched, output.classification
```

**Root cause:** The generated functions don't import or use the actual Zod-inferred output types. The templates need to:
1. Import the output schema type
2. Parse with the schema to get typed output
3. Use the typed output for conditional logic

---

## Implementation Plan

### Phase 1: Fix SDK Type Imports (2 files)

#### Task 1.1: Update `templates/agent-config.hbs`

**File:** `/Users/scottstrang/agent-factory/templates/agent-config.hbs`

**Change line 1 from:**
```typescript
import type { ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
```

**To:**
```typescript
import type { Options as ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
```

> **Note:** Using `as ClaudeAgentOptions` alias preserves compatibility with existing template references to `ClaudeAgentOptions` type while importing the correct SDK type.

**Change line 4 from:**
```typescript
export const {{camelCase name}}Config: ClaudeAgentOptions = {
```

**To:**
```typescript
export const {{camelCase name}}Config: Omit<ClaudeAgentOptions, 'cwd'> = {
```

> **Rationale:** The config object is partial—`cwd` gets added at runtime by the agent runner, not in the static config file.

#### Task 1.2: Update `generateAgentRunner()` in `init.ts`

**File:** `/Users/scottstrang/agent-factory/src/commands/init.ts`

**Change line 919 from:**
```typescript
import type { ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
```

**To:**
```typescript
import type { Options as ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";
```

---

### Phase 2: Fix `query()` Call Signature (1 file)

#### Task 2.1: Update agent runner query call

**File:** `/Users/scottstrang/agent-factory/src/commands/init.ts`

**Location:** Lines 986-990 inside `generateAgentRunner()` function

**Change from:**
```typescript
for await (const message of query({
  prompt: "Execute your task as defined in CLAUDE.md",
  options: config,
  cwd: workspacePath,
}))
```

**To:**
```typescript
for await (const message of query({
  prompt: "Execute your task as defined in CLAUDE.md",
  options: {
    ...config,
    cwd: workspacePath,
  },
}))
```

---

### Phase 3: Fix Output Type Inference (1 file)

#### Task 3.1: Update `templates/inngest-function.hbs` output handling

**File:** `/Users/scottstrang/agent-factory/templates/inngest-function.hbs`

**Current pattern (problematic):**
```typescript
const rawOutput = (result as any).structured_output;
const parsed = {{pascalCase name}}OutputSchema.parse(rawOutput);
// Then accesses parsed.action, parsed.matched, etc.
```

**Issue:** The `parsed` variable's type isn't being used correctly for downstream conditional logic.

**Fix approach:** Ensure the parsed result is properly typed by using the inferred type:

**Add near top of generated function (after imports):**
```typescript
import type { z } from "zod";
type {{pascalCase name}}Output = z.infer<typeof {{pascalCase name}}OutputSchema>;
```

**Then change output handling to explicitly type the parsed result:**
```typescript
const rawOutput = (result as any).structured_output;
const output: {{pascalCase name}}Output = {{pascalCase name}}OutputSchema.parse(rawOutput);
```

This ensures TypeScript knows the exact shape of `output` and can verify property access.

---

### Phase 4: Verification

#### Task 4.1: Regenerate test project

```bash
cd /Users/scottstrang/agent-architect/workspace/kringle
rm -rf agents/ inngest/ lib/ schemas/
npx tsx ../../agent-factory/src/cli.ts init --manifest manifest.yaml
```

#### Task 4.2: Run type check

```bash
cd /Users/scottstrang/agent-architect/workspace/kringle
npx tsc --noEmit
```

**Expected result:** 0 errors

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `agent-factory/templates/agent-config.hbs` | Fix import to use `Options`, add `Omit<..., 'cwd'>` |
| `agent-factory/src/commands/init.ts` | Fix `query()` call signature, fix import |
| `agent-factory/templates/inngest-function.hbs` | Add explicit output type annotation |

## Acceptance Criteria

- [ ] `npx tsc --noEmit` passes with 0 errors on regenerated projects
- [ ] All existing tests in agent-factory pass
- [ ] Generated code imports correct SDK types
- [ ] `cwd` is passed inside `options` object, not alongside it
- [ ] Agent output fields (`action`, `matched`, `classification`, etc.) are typed correctly

## Dependencies & Risks

**Dependencies:**
- None—these are self-contained template fixes

**Risks:**
- **Low:** Changes are backwards-compatible; generated code will work the same, just be type-correct
- **Testing:** Should regenerate at least one project and verify no runtime behavior changes

## References

### Internal References
- SDK Type Documentation: `context/agent-sdk-docs/docs/typescript-sdk.md:90-133`
- Original Warning Analysis: `plans/schema-evolution/phase5-warnings.md`
- Agent Config Template: `agent-factory/templates/agent-config.hbs`
- Agent Runner Generator: `agent-factory/src/commands/init.ts:917-1040`
- Inngest Function Template: `agent-factory/templates/inngest-function.hbs`

### External References
- Claude Agent SDK: https://docs.anthropic.com/en/docs/agent-sdk/typescript-sdk
