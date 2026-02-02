# Agent SDK Code Examples

Quick reference for common patterns. For full documentation, read the relevant guide in `context/agent-sdk-docs/docs/guides/`.

## Basic Agent

```typescript
import { query } from "@anthropic-ai/claude-code";

const messages = query({
  prompt: "Fix the bug in utils.ts",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    permissionMode: "acceptEdits",
  },
});

for await (const message of messages) {
  if (message.type === "result") {
    console.log("Done:", message.result);
  }
}
```

## Custom Tool

```typescript
import { tool, createSdkMcpServer, query } from "@anthropic-ai/claude-code";

const weatherTool = tool({
  name: "get_weather",
  description: "Get current weather for a city",
  inputSchema: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name" },
    },
    required: ["city"],
  },
  async execute({ city }) {
    // Your implementation
    return { temperature: 72, conditions: "sunny" };
  },
});

const server = createSdkMcpServer({ tools: [weatherTool] });

const messages = query({
  prompt: "What's the weather in San Francisco?",
  options: {
    mcpServers: [{ type: "sdk", server }],
    allowedTools: ["mcp__sdk__get_weather"],
  },
});
```

## Hook for Logging

```typescript
const messages = query({
  prompt: "Refactor the auth module",
  options: {
    hooks: {
      PreToolUse: [
        {
          callback: async ({ toolName, toolInput }) => {
            console.log(`Tool: ${toolName}`, toolInput);
            return {}; // Allow execution
          },
        },
      ],
    },
  },
});
```

## Hook to Block Dangerous Commands

```typescript
hooks: {
  PreToolUse: [
    {
      matcher: { toolName: "Bash" },
      callback: async ({ toolInput }) => {
        const dangerous = ["rm -rf", "sudo", "> /dev/"];
        if (dangerous.some((d) => toolInput.command?.includes(d))) {
          return { permissionDecision: "deny" };
        }
        return {};
      },
    },
  ],
}
```

## Subagent Definition

```typescript
const messages = query({
  prompt: "Analyze and test the codebase",
  options: {
    agents: {
      "test-runner": {
        description: "Runs tests and reports results",
        prompt: "Run all tests and summarize failures",
        allowedTools: ["Bash", "Read"],
        model: "claude-sonnet-4-20250514",
      },
    },
    allowedTools: ["Read", "Task"],
  },
});
```

## Structured Output

```typescript
import { z } from "zod";

const TodoSchema = z.object({
  todos: z.array(
    z.object({
      task: z.string(),
      priority: z.enum(["high", "medium", "low"]),
      done: z.boolean(),
    })
  ),
});

const messages = query({
  prompt: "List the TODOs in this codebase",
  options: {
    outputFormat: {
      type: "json",
      schema: TodoSchema,
    },
  },
});

for await (const message of messages) {
  if (message.type === "result" && message.structured_output) {
    const todos = message.structured_output as z.infer<typeof TodoSchema>;
    console.log(todos.todos);
  }
}
```

## Session Resume

```typescript
// First run - capture session ID
let sessionId: string;
for await (const message of query({ prompt: "Start working on feature X" })) {
  if (message.type === "init") {
    sessionId = message.sessionId;
  }
}

// Later - resume session
const messages = query({
  prompt: "Continue where we left off",
  options: {
    resume: sessionId,
  },
});
```

## Loading CLAUDE.md

```typescript
const messages = query({
  prompt: "Follow the project conventions",
  options: {
    settingSources: [
      { type: "file", path: "./CLAUDE.md" },
      { type: "file", path: "./.claude/settings.json" },
    ],
  },
});
```

## MCP Server Configuration

```typescript
const messages = query({
  prompt: "Use the database",
  options: {
    mcpServers: [
      {
        type: "stdio",
        command: "npx",
        args: ["-y", "@your/mcp-server"],
        env: { DATABASE_URL: process.env.DATABASE_URL },
      },
    ],
    allowedTools: ["mcp__your-server__query"],
  },
});
```
