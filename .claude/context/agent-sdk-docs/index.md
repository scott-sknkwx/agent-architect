# Claude Agent SDK Documentation Index

This index helps Claude Code find the right documentation for Agent SDK questions.

---

## Quick Reference: When to Use Each Document

| Topic | Document |
|-------|----------|
| Getting started, installation, first agent | [quickstart.md](docs/quickstart.md) |
| SDK overview, capabilities, what it can do | [agent-sdk-overview.md](docs/agent-sdk-overview.md) |
| TypeScript API reference, types, options | [typescript-sdk.md](docs/typescript-sdk.md) |
| TypeScript V2 preview (send/stream pattern) | [typescript-sdkv2.md](docs/typescript-sdkv2.md) |

---

## Core Documentation

### [docs/agent-sdk-overview.md](docs/agent-sdk-overview.md)
**Use for:** General questions about the Agent SDK, capabilities overview, comparing to other Claude tools

**Topics covered:**
- What the Agent SDK is and why to use it
- Built-in tools (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch)
- Hooks for controlling agent behavior
- Subagents for delegating tasks
- MCP server integration
- Permission modes
- Session management
- Comparison: Agent SDK vs Client SDK vs Claude Code CLI
- Installation steps
- API key setup (Anthropic, Bedrock, Vertex AI, Azure)
- Branding guidelines

**Example questions:**
- "What can the Agent SDK do?"
- "What tools does the agent have access to?"
- "How is the Agent SDK different from the API?"
- "How do I install the Agent SDK?"

---

### [docs/quickstart.md](docs/quickstart.md)
**Use for:** Getting started, creating first agent, basic setup

**Topics covered:**
- Prerequisites (Node.js 18+, Python 3.10+)
- Installing Claude Code runtime
- Installing the SDK (npm/pip/uv)
- Setting API keys
- Creating a buggy file for testing
- Building a bug-fixing agent
- Understanding the `query()` function
- Permission modes (`acceptEdits`, `bypassPermissions`, `default`)
- Tool configuration (`allowedTools`)

**Example questions:**
- "How do I create my first agent?"
- "How do I set up the Agent SDK?"
- "What's a simple agent example?"
- "How do I run my agent?"

---

### [docs/typescript-sdk.md](docs/typescript-sdk.md)
**Use for:** TypeScript API reference, complete type definitions, all options

**Topics covered:**
- `query()` function signature and parameters
- `tool()` function for custom MCP tools
- `createSdkMcpServer()` for in-process MCP servers
- `Options` type with all configuration options
- `Query` interface methods (interrupt, rewindFiles, setPermissionMode, etc.)
- `AgentDefinition` for programmatic subagents
- `SettingSource` for filesystem settings
- `PermissionMode` types
- `CanUseTool` callback signature
- `McpServerConfig` variants (stdio, SSE, HTTP, SDK)
- All message types (`SDKMessage`, `SDKAssistantMessage`, `SDKResultMessage`, etc.)
- Hook types (`HookEvent`, `HookCallback`, `HookInput` variants)
- Tool input types (BashInput, FileEditInput, GrepInput, etc.)
- Tool output types
- Permission types
- `SandboxSettings` for sandboxed execution

**Example questions:**
- "What options can I pass to query()?"
- "What's the type for ClaudeAgentOptions?"
- "How do I define a custom tool in TypeScript?"
- "What message types can I receive?"
- "What's the hook callback signature?"

---

### [docs/typescript-sdkv2.md](docs/typescript-sdkv2.md)
**Use for:** V2 preview interface questions, simpler multi-turn conversations

**Topics covered:**
- `unstable_v2_createSession()` for new sessions
- `unstable_v2_resumeSession()` to resume by ID
- `unstable_v2_prompt()` for one-shot queries
- Session interface (`send()`, `stream()`, `close()`)
- Multi-turn conversation patterns
- Session resume with stored IDs
- Automatic cleanup with `await using`

**Example questions:**
- "What is the V2 SDK interface?"
- "How do I use send() and stream()?"
- "How do I create a multi-turn conversation?"
- "How do I resume a session in V2?"

---

## Guides

### [docs/guides/agent-skills.md](docs/guides/agent-skills.md)
**Use for:** Skills that Claude autonomously invokes, SKILL.md files

**Topics covered:**
- What Skills are and how they work
- Creating Skills as `SKILL.md` files
- Skill locations (`.claude/skills/`, `~/.claude/skills/`)
- Loading Skills with `settingSources`
- Enabling Skills with `allowedTools: ["Skill"]`
- Tool restrictions (note: `allowed-tools` in SKILL.md only works in CLI)
- Discovering available Skills
- Troubleshooting Skills not found or not being used

**Example questions:**
- "How do I create a custom skill?"
- "Why isn't my skill being used?"
- "Where do I put SKILL.md files?"
- "How do Skills differ from subagents?"

---

### [docs/guides/controlling-execution-hooks.md](docs/guides/controlling-execution-hooks.md)
**Use for:** Hooks, intercepting tool calls, custom validation, logging, security

**Topics covered:**
- All hook events: PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, Stop, SubagentStart, SubagentStop, PreCompact, PermissionRequest, SessionStart, SessionEnd, Notification
- Hook callback function signature
- Matchers for filtering which tools trigger hooks
- Hook input data fields
- Hook output fields (permissionDecision, updatedInput, systemMessage, etc.)
- Blocking tools with `permissionDecision: 'deny'`
- Modifying tool input with `updatedInput`
- Auto-approving specific tools
- Chaining multiple hooks
- Async operations in hooks
- Notification hooks (TypeScript only)
- Troubleshooting hooks

**Example questions:**
- "How do I block dangerous commands?"
- "How do I log all tool calls?"
- "How do I modify tool inputs before execution?"
- "What hooks are available?"
- "How do I auto-approve read-only tools?"

---

### [docs/guides/costs-usage-tracking.md](docs/guides/costs-usage-tracking.md)
**Use for:** Token usage, billing, cost tracking

**Topics covered:**
- Understanding steps vs messages
- Same ID = same usage rule
- Charging once per step
- Result message cumulative usage
- Per-model usage breakdown with `modelUsage`
- Implementing a cost tracker class
- Handling parallel tool use reporting
- Cache token tracking
- Best practices for billing

**Example questions:**
- "How do I track API costs?"
- "How do I get token usage?"
- "Why am I seeing duplicate usage?"
- "How do I implement billing?"

---

### [docs/guides/custom-tools.md](docs/guides/custom-tools.md)
**Use for:** Creating custom MCP tools, in-process tool execution

**Topics covered:**
- `tool()` function for type-safe tool definitions
- `createSdkMcpServer()` for in-process servers
- Tool naming convention: `mcp__{server}__{tool}`
- Configuring `allowedTools` for MCP tools
- Streaming input requirement for MCP tools
- Type safety with Zod (TypeScript) and type hints (Python)
- Error handling in tools
- Example tools: weather, database query, API gateway, calculator

**Example questions:**
- "How do I create a custom tool?"
- "How do I make an MCP server?"
- "What's the tool naming format?"
- "How do I define tool input schemas?"

---

### [docs/guides/file-checkpoints.md](docs/guides/file-checkpoints.md)
**Use for:** Rewinding file changes, checkpointing, undo

**Topics covered:**
- How checkpointing tracks Write, Edit, NotebookEdit changes
- Enabling with `enableFileCheckpointing: true`
- Environment variable `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING`
- Capturing checkpoint UUIDs from user messages
- Calling `rewindFiles()` to restore
- Checkpoint before risky operations pattern
- Multiple restore points pattern
- Interactive example with utils.py
- Limitations (Bash changes not tracked, same session only)
- Troubleshooting checkpointing issues

**Example questions:**
- "How do I undo file changes?"
- "How do I enable checkpointing?"
- "How do I rewind to a previous state?"
- "Why aren't my checkpoints working?"

---

### [docs/guides/handling-permissions.md](docs/guides/handling-permissions.md)
**Use for:** Permission modes, canUseTool callback, controlling tool access

**Topics covered:**
- Permission flow diagram
- Permission modes: `default`, `acceptEdits`, `bypassPermissions`, `plan`
- Setting permission mode initially and dynamically
- `canUseTool` callback implementation
- Handling `AskUserQuestion` tool responses
- Permission flow order (hooks -> deny -> allow -> ask -> mode -> callback)

**Example questions:**
- "What permission modes are available?"
- "How do I auto-approve file edits?"
- "How do I implement custom permission logic?"
- "How do I handle user questions from Claude?"

---

### [docs/guides/hosting.md](docs/guides/hosting.md)
**Use for:** Deployment, containers, production hosting

**Topics covered:**
- Container-based sandboxing requirements
- System requirements (runtime, RAM, CPU, disk)
- SDK architecture (long-running process, persistent shell)
- Sandbox provider options (Cloudflare, Modal, Daytona, E2B, Fly, Vercel)
- Deployment patterns: Ephemeral, Long-Running, Hybrid, Single Container
- FAQ: communicating with sandboxes, costs, idle timeouts, CLI updates

**Example questions:**
- "How do I deploy an agent to production?"
- "What resources does the SDK need?"
- "What sandbox providers work with the SDK?"
- "Should I use ephemeral or persistent containers?"

---

### [docs/guides/mcp.md](docs/guides/mcp.md)
**Use for:** MCP server configuration, external tools, resources

**Topics covered:**
- Basic MCP configuration in `.mcp.json`
- Passing `mcpServers` to query options
- Transport types: stdio, HTTP/SSE, SDK (in-process)
- Resource management (listing and reading MCP resources)
- Authentication with environment variables
- Error handling for MCP connections
- Checking MCP server status in init message

**Example questions:**
- "How do I configure an MCP server?"
- "How do I use the Playwright MCP?"
- "What MCP transport types are supported?"
- "How do I pass credentials to MCP servers?"

---

### [docs/guides/plugins.md](docs/guides/plugins.md)
**Use for:** Loading plugins, extending with commands/agents/skills/hooks

**Topics covered:**
- What plugins can include (commands, agents, skills, hooks, MCP servers)
- Loading plugins via `plugins` option
- Path specifications (relative/absolute)
- Verifying plugin installation via init message
- Using plugin commands (namespace: `plugin-name:command-name`)
- Plugin directory structure
- Common use cases (dev/testing, project-specific, multiple sources)
- Troubleshooting plugin issues

**Example questions:**
- "How do I load a plugin?"
- "How do I use plugin commands?"
- "What's the plugin directory structure?"
- "Why isn't my plugin loading?"

---

### [docs/guides/secure-deployment.md](docs/guides/secure-deployment.md)
**Use for:** Security hardening, isolation, credential management

**Topics covered:**
- Built-in security features (permissions, static analysis, sandbox mode)
- Security boundaries and least privilege
- Isolation technologies: sandbox-runtime, containers, gVisor, VMs (Firecracker)
- Docker security configuration (--cap-drop, --network none, etc.)
- Credential management with proxy pattern
- Using ANTHROPIC_BASE_URL and HTTP_PROXY
- Filesystem configuration (read-only mounts, tmpfs)
- Files to exclude from mounts (.env, credentials, keys)

**Example questions:**
- "How do I secure my agent deployment?"
- "How do I run the agent in a sandbox?"
- "How do I inject credentials safely?"
- "What Docker options should I use?"

---

### [docs/guides/session-management.md](docs/guides/session-management.md)
**Use for:** Sessions, resuming conversations, forking sessions

**Topics covered:**
- Getting session ID from init message
- Resuming sessions with `resume` option
- Session forking with `forkSession` option
- When to fork vs continue
- Maintaining context across exchanges

**Example questions:**
- "How do I resume a session?"
- "How do I get the session ID?"
- "What's the difference between forking and continuing?"
- "How do I maintain conversation context?"

---

### [docs/guides/slash-commands.md](docs/guides/slash-commands.md)
**Use for:** Slash commands, /compact, /clear, custom commands

**Topics covered:**
- Discovering available commands via init message
- Sending slash commands via prompt
- Built-in commands: `/compact`, `/clear`
- Creating custom commands as markdown files
- Command locations (`.claude/commands/`, `~/.claude/commands/`)
- Command frontmatter (allowed-tools, description, model)
- Arguments and placeholders ($1, $2, $ARGUMENTS)
- Bash command execution in commands (!`command`)
- File references (@filename)
- Namespacing with subdirectories

**Example questions:**
- "How do I use /compact?"
- "How do I create a custom command?"
- "Where do I put command files?"
- "How do I pass arguments to commands?"

---

### [docs/guides/streaming-input.md](docs/guides/streaming-input.md)
**Use for:** Streaming vs single message mode, async generators

**Topics covered:**
- Streaming input mode (recommended): persistent session, image uploads, queued messages, hooks support
- Single message mode: one-shot queries, stateless environments
- Limitations of single message mode
- Implementation with async generators
- When to use each mode

**Example questions:**
- "How do I upload images?"
- "What's streaming input mode?"
- "When should I use single message vs streaming?"
- "How do I create an async generator for input?"

---

### [docs/guides/structured-outputs.md](docs/guides/structured-outputs.md)
**Use for:** JSON schema outputs, validated responses

**Topics covered:**
- When to use structured outputs
- Defining JSON schemas
- Using Zod (TypeScript) or Pydantic (Python) for schemas
- `outputFormat` option configuration
- Accessing `structured_output` from result
- Supported JSON Schema features
- Error handling (`error_max_structured_output_retries`)
- Example: TODO tracking agent with structured output

**Example questions:**
- "How do I get JSON output from the agent?"
- "How do I validate agent responses?"
- "How do I use Zod with the SDK?"
- "What JSON Schema features are supported?"

---

### [docs/guides/subagents.md](docs/guides/subagents.md)
**Use for:** Creating subagents, delegating tasks, Task tool

**Topics covered:**
- Three ways to create subagents (programmatic, filesystem, built-in general-purpose)
- Benefits: context management, parallelization, specialized instructions, tool restrictions
- `AgentDefinition` type (description, prompt, tools, model)
- Including `Task` in `allowedTools`
- Automatic vs explicit invocation
- Dynamic agent configuration
- Detecting subagent invocation via `parent_tool_use_id`
- Tool restrictions for subagents
- Troubleshooting (not delegating, filesystem not loading, Windows prompt length)

**Example questions:**
- "How do I create a subagent?"
- "What's the AgentDefinition type?"
- "How do I restrict subagent tools?"
- "Why isn't Claude using my subagent?"

---

### [docs/guides/system-prompts.md](docs/guides/system-prompts.md)
**Use for:** System prompts, CLAUDE.md, output styles

**Topics covered:**
- Default behavior (empty system prompt)
- Method 1: CLAUDE.md files (project-level instructions)
- Method 2: Output styles (persistent configurations)
- Method 3: `systemPrompt` with preset and `append`
- Method 4: Custom system prompt string
- Loading CLAUDE.md with `settingSources`
- Comparison table of all approaches
- Combining approaches

**Example questions:**
- "How do I set a system prompt?"
- "How do I use CLAUDE.md?"
- "How do I add to Claude Code's default prompt?"
- "What's the difference between output styles and system prompts?"

---

### [docs/guides/todo-lists.md](docs/guides/todo-lists.md)
**Use for:** Todo tracking, progress display, TodoWrite tool

**Topics covered:**
- Todo lifecycle (pending -> in_progress -> completed)
- When todos are automatically created
- Monitoring TodoWrite tool calls
- Implementing a progress tracker class
- Real-time progress display

**Example questions:**
- "How do I track agent progress?"
- "How do I use the TodoWrite tool?"
- "How do I display task completion?"

---

## Document Lookup by Keyword

| Keyword | Document(s) |
|---------|-------------|
| agent | overview, quickstart, subagents |
| AgentDefinition | typescript-sdk, subagents |
| allowedTools | typescript-sdk, quickstart, permissions |
| AskUserQuestion | permissions, typescript-sdk |
| Bash | typescript-sdk, overview |
| billing | costs-usage-tracking |
| bypassPermissions | permissions, quickstart |
| canUseTool | permissions, typescript-sdk |
| checkpoint | file-checkpoints |
| CLAUDE.md | system-prompts |
| command (custom) | slash-commands |
| container | hosting, secure-deployment |
| cost | costs-usage-tracking |
| custom tool | custom-tools |
| Docker | hosting, secure-deployment |
| Edit | typescript-sdk, overview |
| error | controlling-execution-hooks |
| fork | session-management |
| Grep | typescript-sdk, overview |
| hook | controlling-execution-hooks, typescript-sdk |
| hosting | hosting, secure-deployment |
| image | streaming-input |
| install | quickstart, overview |
| JSON | structured-outputs |
| MCP | mcp, custom-tools |
| message type | typescript-sdk |
| model | typescript-sdk |
| options | typescript-sdk |
| output style | system-prompts |
| permission | permissions, controlling-execution-hooks |
| plugin | plugins |
| PostToolUse | controlling-execution-hooks |
| PreToolUse | controlling-execution-hooks |
| production | hosting, secure-deployment |
| prompt (system) | system-prompts |
| query() | typescript-sdk, quickstart |
| Read | typescript-sdk, overview |
| resume | session-management, typescript-sdkv2 |
| rewind | file-checkpoints |
| sandbox | secure-deployment, typescript-sdk |
| schema | structured-outputs |
| SDKMessage | typescript-sdk |
| security | secure-deployment |
| send() | typescript-sdkv2 |
| session | session-management, typescript-sdkv2 |
| settingSources | typescript-sdk, agent-skills, system-prompts |
| Skill | agent-skills |
| slash command | slash-commands |
| stream() | typescript-sdkv2 |
| streaming | streaming-input |
| subagent | subagents |
| systemPrompt | system-prompts, typescript-sdk |
| Task tool | subagents, typescript-sdk |
| todo | todo-lists |
| token | costs-usage-tracking |
| tool | custom-tools, typescript-sdk |
| TypeScript | typescript-sdk, typescript-sdkv2 |
| usage | costs-usage-tracking |
| V2 | typescript-sdkv2 |
| WebFetch | typescript-sdk, overview |
| WebSearch | typescript-sdk, overview |
| Write | typescript-sdk, overview |
| Zod | custom-tools, structured-outputs |
