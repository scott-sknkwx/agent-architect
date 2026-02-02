# Agent SDK Troubleshooting

Common issues and solutions. For detailed documentation, read `.claude/context/agent-sdk-docs/`.

## Skills Not Working

### Skill not found
- Check file is at `.claude/skills/skill-name/SKILL.md`
- Verify YAML frontmatter has `name` and `description`
- Ensure `allowedTools` includes `"Skill"`
- Load skill directory with `settingSources`

### Skill not being invoked
- Make description clearly states WHEN to use it
- Check skill name matches what agent is looking for
- Verify skill content is actionable, not just informational

## Subagents Not Delegating

### Claude not using Task tool
- Include `"Task"` in `allowedTools`
- Make agent descriptions clearly describe WHAT they do
- Check `description` field is concise and specific
- Ensure prompt explains when delegation is appropriate

### Subagent not loading from filesystem
- Check file is at `.claude/agents/agent-name.md`
- Verify YAML frontmatter has required fields
- Load with `settingSources: [{ type: "file", path: "./.claude" }]`

## Hooks Not Firing

### Hook never called
- Check `toolName` in matcher matches exactly (case-sensitive)
- Verify hook is in correct event key (`PreToolUse`, `PostToolUse`, etc.)
- Ensure callback is async function

### Hook not blocking
- Return `{ permissionDecision: "deny" }` to block
- Check you're in `PreToolUse`, not `PostToolUse`
- Verify matcher isn't too specific

## Permission Issues

### Constant permission prompts
- Set `permissionMode: "acceptEdits"` for file operations
- Use `permissionMode: "bypassPermissions"` for automation (careful!)
- Add allowed tools to `allowedTools` array

### Tool not executing
- Check tool name is in `allowedTools`
- Verify MCP tools use format `mcp__{server}__{tool}`
- Ensure permission mode allows the operation

## MCP Server Issues

### Server not connecting
- Check command path is correct
- Verify environment variables are set
- Look at init message for MCP status
- Try running server command manually

### Tools not appearing
- Check `allowedTools` includes MCP tools
- Use `mcp__{server-name}__{tool-name}` format
- Verify server is reporting tools (check init message)

## Structured Output Issues

### Output not matching schema
- Check `outputFormat.type` is `"json"`
- Verify schema is valid JSON Schema
- Ensure prompt asks for structured data
- Check `structured_output` field in result (not `result`)

### Validation errors
- Schema may be too strict—add `.optional()` where needed
- Check enum values match exactly
- Verify required fields are actually required

## Session Issues

### Cannot resume session
- Session IDs expire after inactivity
- Verify `resume` option has correct session ID
- Check session wasn't from different API key

### Context lost
- Sessions don't persist across restarts
- Fork with `forkSession` to branch from a point
- Save important context externally

## File Checkpointing Issues

### Checkpoints not created
- Enable with `enableFileCheckpointing: true`
- Or set env `CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true`
- Only Write, Edit, NotebookEdit are tracked (not Bash)

### Rewind not working
- Checkpoint must be from same session
- Bash file operations aren't tracked
- Use checkpoint UUID from user message

## Common Error Messages

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| "Tool not allowed" | Tool not in `allowedTools` | Add tool to array |
| "Permission denied" | Permission mode too restrictive | Change mode or add to allowed |
| "Session not found" | Invalid/expired session ID | Start new session |
| "MCP server failed" | Server command error | Check command, env vars |
| "Schema validation failed" | Output doesn't match schema | Relax schema or fix prompt |

## Debug Tips

1. **Log all messages**: Print every message from the generator
2. **Check init message**: Contains MCP status, available commands, session ID
3. **Use PreToolUse hook**: Log all tool calls to see what's happening
4. **Read the docs**: Most issues are covered in `.claude/context/agent-sdk-docs/docs/guides/`
