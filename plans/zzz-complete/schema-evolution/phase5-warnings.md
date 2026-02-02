# Phase 5.4 Validation Warnings

> **Status: ✅ RESOLVED** — Fixed in agent-factory commit `c45fb02` on `feature/cli-flags-phase1`
>
> See implementation details: [`fix-agent-factory-sdk-types.md`](./fix-agent-factory-sdk-types.md)

These warnings appeared when running `npx tsc --noEmit` on generated project output. They were **pre-existing template issues** unrelated to the schema evolution work completed in Phases 1-4.

## Summary

| Category | Count | Severity | Status |
|----------|-------|----------|--------|
| Agent SDK Import | 6 | Error | ✅ Fixed |
| Agent Output Types | 14 | Error | ✅ Fixed |
| Agent Runner Config | 2 | Error | ✅ Fixed |

## 1. Agent SDK Import Errors ✅

**Files affected:**
- `agents/email-drafter/config.ts`
- `agents/escalation-handler/config.ts`
- `agents/persona-matcher/config.ts`
- `agents/reply-drafter/config.ts`
- `agents/response-triager/config.ts`
- `lib/agent-runner.ts`

**Error:**
```
error TS2305: Module '"@anthropic-ai/claude-agent-sdk"' has no exported member 'ClaudeAgentOptions'.
```

**Root Cause:**
The agent config template imports `ClaudeAgentOptions` from the SDK, but this type is not exported from the package. `ClaudeAgentOptions` is a Python SDK type; TypeScript uses `Options`.

**Resolution:**
Updated templates to import `Options as ClaudeAgentOptions` from the SDK. Also fixed:
- `systemPrompt` format: `{ type: 'preset', preset: 'claude_code' }`
- `outputFormat` format: `{ type: 'json_schema', schema: zodToJsonSchema(...) }`
- Added `zod-to-json-schema` dependency
- Added `allowDangerouslySkipPermissions` for bypass mode
- Added required `prompt` field to subagent definitions

---

## 2. Agent Output Type Errors ✅

**Files affected:**
- `inngest/functions/escalation-handler.ts` (4 errors)
- `inngest/functions/persona-matcher.ts` (2 errors)
- `inngest/functions/response-triager.ts` (7 errors)

**Error pattern:**
```
error TS2339: Property 'action' does not exist on type '{ success: boolean; }'.
error TS2339: Property 'matched' does not exist on type '{ success: boolean; }'.
error TS2339: Property 'classification' does not exist on type '{ success: boolean; }'.
```

**Root Cause:**
The generated agent runner functions expect specific output fields (`action`, `matched`, `classification`) but the output type was inferred as `{ success: boolean }` because the `output` variable wasn't explicitly typed.

**Resolution:**
Updated `inngest-function.hbs` template to:
1. Import `type z` from zod
2. Define `type {{PascalCase}}Output = z.infer<typeof {{PascalCase}}OutputSchema>`
3. Explicitly type the output variable: `const output: {{PascalCase}}Output = ...`

**Note:** Generated schemas are placeholders with only `success: boolean`. Users must fill in fields matching their manifest's `emits.when` conditions. When complete schemas are provided, type checking passes.

---

## 3. Agent Runner Config Error ✅

**File:** `lib/agent-runner.ts`

**Error:**
```
error TS2353: Object literal may only specify known properties, and 'cwd' does not exist in type '{ prompt: string | AsyncIterable<SDKUserMessage>; options?: Options | undefined; }'.
```

**Root Cause:**
The `cwd` option was being passed as a top-level parameter to `query()`, but it belongs inside the `options` object.

**Resolution:**
Updated `generateAgentRunner()` in `init.ts` to pass `cwd` inside options:
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

## Resolution Summary

All issues have been resolved in agent-factory commit `c45fb02` on branch `feature/cli-flags-phase1`.

**Files changed:**
- `templates/agent-config.hbs` - SDK type imports, systemPrompt, outputFormat, subagents
- `templates/inngest-function.hbs` - Explicit output type annotation
- `templates/package.json.hbs` - Added zod-to-json-schema dependency
- `src/commands/init.ts` - Fixed query() signature, added dependency

The schema evolution work (object types, webhook discriminated union, inngest-first-webhook pattern) remains complete and working correctly.
