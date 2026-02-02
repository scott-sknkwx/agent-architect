# When to Create an MCP Server

MCP (Model Context Protocol) servers give Claude Code access to external tools, data, and systems. They're the "hands" that let the agent interact with the world.

## Create an MCP When You Need

### 1. Real-Time Data Access
The data must be fresh from an external source.

```
Examples:
- Current Stripe subscription status
- Today's calendar events from Google Calendar
- Live CRM records from Salesforce
- Recent Slack messages
```

### 2. Actions in External Systems
You need to DO something in another system, not just read.

```
Examples:
- Create a Notion page
- Send an email via Gmail
- Open a GitHub issue
- Update a Jira ticket
- Deploy to Vercel
```

### 3. File Operations Beyond Native
When native Read/Write/Edit isn't enough.

```
Examples:
- Database queries (PostgreSQL, MongoDB)
- Cloud storage (S3, GCS)
- Specialized file formats (PDF manipulation, Excel generation)
```

### 4. API Integrations
You need authenticated access to third-party APIs.

```
Examples:
- Notion API
- GitHub API
- Stripe API
- Any service with OAuth or API keys
```

## MCP Server Responsibilities

| MCP Should Handle | MCP Should NOT Handle |
|-------------------|----------------------|
| Connection/authentication | Step-by-step workflows |
| Query syntax/API formats | Business logic decisions |
| Error responses | Presentation format |
| Rate limiting | Multi-server coordination |
| Tool descriptions | Domain-specific guidance |

## Rule of Thumb

> MCP instructions cover **how to use the server and its tools correctly**.
>
> Skills instructions cover **how to use them for a given purpose or in a multi-server workflow**.

## Example: Salesforce MCP

A Salesforce MCP server should specify:
- ✅ Query syntax (SOQL format)
- ✅ API authentication
- ✅ Object schemas
- ✅ Rate limits

A Salesforce MCP should NOT specify:
- ❌ Which records to check first
- ❌ How to cross-reference with Slack conversations
- ❌ How to structure output for your team's pipeline review

Those belong in a **Skill**.

## MCP Structure Pattern

```
mcp-server-name/
├── src/
│   └── index.ts         # Server implementation
├── package.json
└── README.md            # Tool descriptions, setup
```

## When NOT to Create an MCP

| Situation | Better Alternative |
|-----------|-------------------|
| One-time API call | Use WebFetch or Bash with curl |
| Local file operations | Native Read/Write/Edit tools |
| Process orchestration | Create a Skill instead |
| Step-by-step instructions | Create a Skill instead |
| Static reference data | Put in CLAUDE.md or Skill |
