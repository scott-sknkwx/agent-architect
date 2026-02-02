# Contract-to-SDK Mapping

This document shows how manifest agent definitions translate to SDK `query()` options at runtime.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MANIFEST → SDK MAPPING                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  manifest.yaml                          SDK query() options             │
│  ─────────────────                      ──────────────────              │
│  agents[].config.model           →      model                           │
│  agents[].config.allowed_tools   →      allowedTools                    │
│  agents[].config.permission_mode →      permissionMode                  │
│  agents[].config.subagents       →      agents                          │
│  agents[].contract.output_schema →      outputFormat.schema             │
│  agents[].limits                 →      maxTurns, maxBudgetUsd, etc.    │
│  agents[].triggers               →      Inngest event trigger           │
│  agents[].emits                  →      step.sendEvent() calls          │
│  Agent CLAUDE.md file            →      cwd + settingSources            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Complete Mapping Table

### Config Fields

| Manifest Field | SDK Option | Transform | Notes |
|----------------|------------|-----------|-------|
| `config.model` | `model` | Expand name | `"sonnet"` → `"claude-sonnet-4-5"` |
| `config.allowed_tools` | `allowedTools` | Direct | `["Read", "Write", "Glob"]` |
| `config.permission_mode` | `permissionMode` | Direct | See [Permission Modes](#permission-modes) |
| `config.subagents[]` | `agents` | Array → Record | See [Subagent Mapping](#subagent-mapping) |
| `config.mcp_servers[]` | `mcpServers` | Array → Record | See [MCP Servers](#mcp-servers) |

### Contract Fields

| Manifest Field | SDK Option | Transform | Notes |
|----------------|------------|-----------|-------|
| `contract.output_schema` | `outputFormat.schema` | Import + convert | Load Zod schema → `zodToJsonSchema()` |
| `contract.context_in.from_db` | Hydration step | N/A | Query DB → render template → write to workspace |
| `contract.context_in.static` | Hydration step | N/A | Copy config directory to workspace |
| Agent CLAUDE.md | `cwd` + `settingSources` | Copy file | Copy to `{workspace}/.claude/CLAUDE.md` |

### Limit Fields

| Manifest Field | SDK Option | Transform | Notes |
|----------------|------------|-----------|-------|
| `limits.max_tokens` | `maxThinkingTokens` | Direct | Optional thinking budget |
| `limits.max_tool_calls` | `maxTurns` | Direct | Max conversation turns |
| `limits.timeout_seconds` | Inngest config | `{ timeout: "300s" }` | Function-level timeout |
| `limits.max_retries` | Inngest config | `{ retries: 3 }` | Function-level retries |

### Trigger/Emit Fields

| Manifest Field | Runtime Location | Notes |
|----------------|------------------|-------|
| `triggers[].event` | Inngest trigger | `{ event: "lead.enriched" }` |
| `emits[].event` | `step.sendEvent()` | Conditional on agent output |
| `emits[].when` | Runtime condition | `if (result.matched)` |
| `emits[].delay` | `step.sendEvent()` delay | Inngest delayed event |

### Workspace Fields

| Manifest Field | Runtime Behavior | Notes |
|----------------|------------------|-------|
| `workspace.base` | Workspace path prefix | Default: `/tmp/agent-workspace-` |
| `workspace.cleanup` | Cleanup timing | `on_success`, `on_complete`, `never` |
| `workspace.snapshot_on_failure` | Error handling | Save workspace on failure for debugging |

## Code Examples

### Model Mapping

```typescript
// Manifest
config:
  model: sonnet

// Runtime
const MODEL_MAP: Record<string, string> = {
  haiku: "claude-haiku-3-5-latest",
  sonnet: "claude-sonnet-4-5",
  opus: "claude-opus-4-5"
};

query({
  prompt: "...",
  options: {
    model: MODEL_MAP[manifest.config.model]  // "claude-sonnet-4-5"
  }
});
```

### Permission Modes

```typescript
// Manifest
config:
  permission_mode: bypassPermissions

// Runtime - MUST include both options
query({
  prompt: "...",
  options: {
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true  // Required when bypassPermissions
  }
});
```

| Mode | Use Case | SDK Options |
|------|----------|-------------|
| `default` | Interactive with user | `permissionMode: "default"` |
| `acceptEdits` | Auto-accept file changes | `permissionMode: "acceptEdits"` |
| `bypassPermissions` | Server-side execution | `permissionMode: "bypassPermissions"` + `allowDangerouslySkipPermissions: true` |

### Output Schema Mapping

```typescript
// Manifest
contract:
  output_schema: schemas/persona-matcher-output.ts

// Runtime
import { PersonaMatcherOutputSchema } from "../../schemas/persona-matcher-output";
import { zodToJsonSchema } from "zod-to-json-schema";

const schema = zodToJsonSchema(PersonaMatcherOutputSchema, { $refStrategy: "root" });

query({
  prompt: "...",
  options: {
    outputFormat: { type: "json_schema", schema }
  }
});
```

### Subagent Mapping

```yaml
# Manifest
config:
  subagents:
    - name: persona-scorer
      description: "Scores a single lead against a single persona"
      model: haiku
      tools: ["Read"]
```

```typescript
// Runtime - Array becomes Record
import { readFileSync } from "fs";

query({
  prompt: "...",
  options: {
    agents: {
      "persona-scorer": {
        description: "Scores a single lead against a single persona",
        prompt: readFileSync("agents/persona-scorer.md", "utf8"),
        tools: ["Read"],
        model: "haiku"  // SDK accepts: 'sonnet' | 'opus' | 'haiku' | 'inherit'
      }
    }
  }
});
```

**Key differences:**
- Manifest uses array with `name` field
- SDK uses Record with agent name as key
- SDK requires `prompt` (load from CLAUDE.md file)
- SDK `model` uses short names (`haiku`), not full names

### MCP Servers

```yaml
# Manifest
config:
  mcp_servers:
    - name: custom-tools
      url: http://localhost:3001/mcp
```

```typescript
// Runtime
query({
  prompt: "...",
  options: {
    mcpServers: {
      "custom-tools": {
        type: "http",
        url: "http://localhost:3001/mcp"
      }
    }
  }
});
```

### Limits Mapping

```yaml
# Manifest
limits:
  max_tokens: 50000
  max_tool_calls: 50
  timeout_seconds: 300
  max_retries: 3
```

```typescript
// Runtime - Split between SDK options and Inngest config

// Inngest function config
inngest.createFunction(
  {
    id: "persona-matcher",
    retries: manifest.limits.max_retries,      // 3
    timeout: `${manifest.limits.timeout_seconds}s`  // "300s"
  },
  { event: "matching.started" },
  async ({ event, step }) => {
    // SDK query options
    const result = await query({
      prompt: "...",
      options: {
        maxTurns: manifest.limits.max_tool_calls,        // 50
        maxThinkingTokens: manifest.limits.max_tokens,   // 50000
        maxBudgetUsd: 0.50  // Not in manifest, set per-agent
      }
    });
  }
);
```

### Event Triggers and Emissions

```yaml
# Manifest
triggers:
  - event: lead.enriched

emits:
  - event: lead.matched
    when: "output.matched == true"
  - event: lead.no_match
    when: "output.matched == false"
  - event: lead.check_timeout
    delay: "24h"
```

```typescript
// Runtime
inngest.createFunction(
  { id: "persona-matcher" },
  { event: "lead.enriched" },  // triggers[0].event
  async ({ event, step }) => {
    const result = await runAgent(/* ... */);

    // Conditional emissions based on output
    if (result.matched) {
      await step.sendEvent("emit-matched", {
        name: "lead.matched",
        data: { lead_id: event.data.lead_id, persona_id: result.persona_id }
      });
    } else {
      await step.sendEvent("emit-no-match", {
        name: "lead.no_match",
        data: { lead_id: event.data.lead_id, reason: result.reason }
      });
    }

    // Delayed event (timeout check)
    await step.sendEvent("schedule-timeout-check", {
      name: "lead.check_timeout",
      data: { lead_id: event.data.lead_id },
      // Inngest handles the delay
    });
  }
);
```

## CLAUDE.md Loading Requirements

The SDK loads CLAUDE.md through a specific mechanism:

### Required Configuration

```typescript
query({
  prompt: "...",
  options: {
    // 1. Set working directory to workspace
    cwd: workspacePath,

    // 2. Use Claude Code's system prompt (required for CLAUDE.md)
    systemPrompt: { type: "preset", preset: "claude_code" },

    // 3. Load project settings (this finds .claude/CLAUDE.md)
    settingSources: ["project"]
  }
});
```

### Workspace Structure

The agent's CLAUDE.md must be at `{workspace}/.claude/CLAUDE.md`:

```
/tmp/agent-workspace-{uuid}/
├── .claude/
│   └── CLAUDE.md    ← Agent instructions loaded here
├── lead.md          ← Hydrated context
└── personas/        ← Static config
```

### Hydration Code

```typescript
// Copy agent CLAUDE.md to workspace
import { cpSync, mkdirSync } from "fs";
import { join } from "path";

mkdirSync(join(workspacePath, ".claude"), { recursive: true });
cpSync(
  `agents/${agentName}.md`,           // Source: agents/persona-matcher.md
  join(workspacePath, ".claude", "CLAUDE.md")  // Dest: workspace/.claude/CLAUDE.md
);
```

### What settingSources Does

| Value | Loads From | Purpose |
|-------|------------|---------|
| `'user'` | `~/.claude/settings.json` | Global user settings |
| `'project'` | `.claude/settings.json` + `.claude/CLAUDE.md` | Project settings and instructions |
| `'local'` | `.claude/settings.local.json` | Local overrides (gitignored) |

For agent runners, use `settingSources: ['project']` to load only the agent's CLAUDE.md without inheriting user settings.

## Complete Mapping Function

Here's a utility function that converts manifest agent config to SDK options:

```typescript
import { zodToJsonSchema } from "zod-to-json-schema";
import { readFileSync } from "fs";
import type { Options } from "@anthropic-ai/claude-agent-sdk";

const MODEL_MAP: Record<string, string> = {
  haiku: "claude-haiku-3-5-latest",
  sonnet: "claude-sonnet-4-5",
  opus: "claude-opus-4-5"
};

interface ManifestAgent {
  name: string;
  config: {
    model: "haiku" | "sonnet" | "opus";
    allowed_tools: string[];
    permission_mode?: "default" | "acceptEdits" | "bypassPermissions";
    subagents?: Array<{
      name: string;
      description?: string;
      model: "haiku" | "sonnet" | "opus";
      tools: string[];
    }>;
  };
  contract: {
    output_schema: string;
  };
  limits?: {
    max_tokens?: number;
    max_tool_calls?: number;
  };
}

export function manifestToSdkOptions(
  agent: ManifestAgent,
  workspacePath: string,
  outputSchema: z.ZodSchema
): Partial<Options> {
  const options: Partial<Options> = {
    cwd: workspacePath,
    systemPrompt: { type: "preset", preset: "claude_code" },
    settingSources: ["project"],
    model: MODEL_MAP[agent.config.model],
    allowedTools: agent.config.allowed_tools,
    outputFormat: {
      type: "json_schema",
      schema: zodToJsonSchema(outputSchema, { $refStrategy: "root" })
    }
  };

  // Permission mode
  if (agent.config.permission_mode === "bypassPermissions") {
    options.permissionMode = "bypassPermissions";
    options.allowDangerouslySkipPermissions = true;
  } else if (agent.config.permission_mode) {
    options.permissionMode = agent.config.permission_mode;
  }

  // Limits
  if (agent.limits?.max_tool_calls) {
    options.maxTurns = agent.limits.max_tool_calls;
  }
  if (agent.limits?.max_tokens) {
    options.maxThinkingTokens = agent.limits.max_tokens;
  }

  // Subagents
  if (agent.config.subagents?.length) {
    options.agents = {};
    for (const sub of agent.config.subagents) {
      options.agents[sub.name] = {
        description: sub.description || `Subagent: ${sub.name}`,
        prompt: readFileSync(`agents/${sub.name}.md`, "utf8"),
        tools: sub.tools,
        model: sub.model
      };
    }
  }

  return options;
}
```

## Related Documentation

- [Agent Runtime Pattern](../patterns/agent-runtime-pattern.md) - Full runtime implementation
- [Manifest Reference](./reference.md) - Manifest schema documentation
- [Agent SDK TypeScript Reference](../agent-sdk-docs/docs/typescript-sdk.md) - Complete SDK API
