---
name: agent-sdk
description: Reference for building with the Claude Agent SDK. Use when questions involve skills, hooks, subagents, tools, permissions, sessions, MCP servers, system prompts, or any agent configuration.
---

# Claude Agent SDK Reference

When answering questions about building agents with the Claude Agent SDK, ALWAYS consult the documentation in `context/agent-sdk-docs/`.

## Quick Lookup

| Topic | Read This |
|-------|-----------|
| Getting started, first agent | `docs/quickstart.md` |
| SDK capabilities overview | `docs/agent-sdk-overview.md` |
| TypeScript API, types, options | `docs/typescript-sdk.md` |
| Creating custom MCP tools | `docs/guides/custom-tools.md` |
| Hooks for control flow | `docs/guides/controlling-execution-hooks.md` |
| Subagents and delegation | `docs/guides/subagents.md` |
| System prompts, CLAUDE.md | `docs/guides/system-prompts.md` |
| Structured JSON outputs | `docs/guides/structured-outputs.md` |
| Skills (SKILL.md files) | `docs/guides/agent-skills.md` |
| Permissions and approval | `docs/guides/handling-permissions.md` |
| Session management | `docs/guides/session-management.md` |
| MCP server configuration | `docs/guides/mcp.md` |
| Hosting and deployment | `docs/guides/hosting.md` |
| Security hardening | `docs/guides/secure-deployment.md` |

## Before Answering Agent SDK Questions

1. **Read the index**: `context/agent-sdk-docs/index.md` has a complete topic → document mapping
2. **Read the relevant doc**: Don't guess—actually read the documentation
3. **Use exact types**: The TypeScript SDK doc has all type definitions
4. **Verify tool names**: Built-in tools are: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Task, Skill, TodoWrite

## Common Question Categories

### "How do I create a [thing]?"

| Thing | Document |
|-------|----------|
| First agent | `docs/quickstart.md` |
| Custom tool | `docs/guides/custom-tools.md` |
| Subagent | `docs/guides/subagents.md` |
| Skill | `docs/guides/agent-skills.md` |
| Slash command | `docs/guides/slash-commands.md` |
| Hook | `docs/guides/controlling-execution-hooks.md` |

### "What options/types are available?"

Read `docs/typescript-sdk.md` for:
- `ClaudeAgentOptions` / `Options` type
- `AgentDefinition` for subagents
- `McpServerConfig` variants
- Hook types and callbacks
- All message types
- Permission types

### "How do I control [behavior]?"

| Behavior | Document |
|----------|----------|
| Tool permissions | `docs/guides/handling-permissions.md` |
| Tool execution | `docs/guides/controlling-execution-hooks.md` |
| Output format | `docs/guides/structured-outputs.md` |
| System prompt | `docs/guides/system-prompts.md` |
| Session state | `docs/guides/session-management.md` |

### "How do I deploy/host?"

Read both:
- `docs/guides/hosting.md` - Deployment patterns
- `docs/guides/secure-deployment.md` - Security hardening

## Key Concepts

### Subagents vs Skills

| Aspect | Subagent | Skill |
|--------|----------|-------|
| Defined in | Code (`AgentDefinition`) or `.claude/agents/` | `.claude/skills/SKILL.md` |
| Invoked via | `Task` tool | `Skill` tool |
| Context | Fresh context, own system prompt | Same context as parent |
| Use for | Parallel work, specialized tasks | Workflow instructions, domain expertise |

### Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Ask for dangerous operations |
| `acceptEdits` | Auto-approve file edits, ask for others |
| `bypassPermissions` | No permission prompts (use with caution) |
| `plan` | Read-only, cannot modify files |

### Hook Events

| Event | When Fired |
|-------|------------|
| `PreToolUse` | Before tool execution (can block/modify) |
| `PostToolUse` | After successful tool execution |
| `PostToolUseFailure` | After tool error |
| `SubagentStart` | When subagent spawns |
| `SubagentStop` | When subagent completes |
| `Stop` | When agent stops |

## Additional References

| Need | File |
|------|------|
| Working code snippets | `code-examples.md` |
| Common issues and fixes | `troubleshooting.md` |
| Complete topic index | `context/agent-sdk-docs/index.md` |

## Full Documentation Index

For the complete topic → document mapping with example questions, read:
`context/agent-sdk-docs/index.md`
