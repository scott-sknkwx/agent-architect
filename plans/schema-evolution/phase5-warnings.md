# Phase 5.4 Validation Warnings

These warnings appeared when running `npx tsc --noEmit` on generated project output. They are **pre-existing template issues** unrelated to the schema evolution work completed in Phases 1-4.

## Summary

| Category | Count | Severity | In Scope |
|----------|-------|----------|----------|
| Agent SDK Import | 6 | Error | No |
| Agent Output Types | 14 | Error | No |
| Agent Runner Config | 2 | Error | No |

## 1. Agent SDK Import Errors

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
The agent config template imports `ClaudeAgentOptions` from the SDK, but this type is not exported from the package. The template was likely written against an older or different version of the SDK API.

**Fix Required:**
Update `templates/agent-config.hbs` in agent-factory to use the correct SDK export. Options:
1. Import `AgentOptions` or similar from the actual SDK exports
2. Define a local type that matches the SDK's expected config shape
3. Check SDK documentation for current API

---

## 2. Agent Output Type Errors

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
The generated agent runner functions expect specific output fields (`action`, `matched`, `classification`) but the output type is defined as `{ success: boolean }`. The agent output schemas need to be properly typed and the function templates need to use those types.

**Fix Required:**
1. Ensure agent output schemas in `schemas/` directory include all expected fields
2. Update agent function templates to import and use the correct output schema types
3. Or use type assertions if dynamic typing is intentional

---

## 3. Agent Runner Config Error

**File:** `lib/agent-runner.ts`

**Error:**
```
error TS2353: Object literal may only specify known properties, and 'cwd' does not exist in type '{ prompt: string | AsyncIterable<SDKUserMessage>; options?: Options | undefined; }'.
```

**Root Cause:**
The `cwd` option is being passed to the agent runner but it's not a valid property in the SDK's expected type.

**Fix Required:**
Check Claude Agent SDK documentation for:
1. How to set working directory for agent execution
2. Whether this should be in a different config location
3. Update template accordingly

---

## Recommendations

These issues should be tracked separately from the schema evolution work:

1. **Create issue**: "Fix agent SDK imports in generator templates"
2. **Create issue**: "Align agent output types with generated schemas"
3. **Create issue**: "Review agent-runner.ts template against current SDK API"

The schema evolution (object types, webhook discriminated union, inngest-first-webhook pattern) is complete and working correctly.
