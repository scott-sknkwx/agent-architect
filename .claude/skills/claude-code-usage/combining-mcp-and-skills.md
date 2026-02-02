# Combining MCPs and Skills

The most powerful agent systems combine MCPs (tool access) with Skills (workflow expertise). This document covers patterns for effective combination.

## The Symbiotic Relationship

```
Without Skills:
┌─────────┐     ┌─────────────────────────────────────┐
│  User   │────▶│ Agent + Many MCPs                   │
└─────────┘     │                                     │
                │ "Send a report"                     │
                │ → Which MCP? → Notion? Gmail?       │
                │ → What data? → All of it?           │
                │ → What format? → ???                │
                │ → HALLUCINATION                     │
                └─────────────────────────────────────┘

With Skills:
┌─────────┐     ┌─────────────────────────────────────┐
│  User   │────▶│ Agent + MCPs + "Send Report" Skill  │
└─────────┘     │                                     │
                │ "Send a report"                     │
                │ → Skill activates                   │
                │ → Step 1: Query Notion for notes    │
                │ → Step 2: Summarize with Claude     │
                │ → Step 3: Format as email           │
                │ → Step 4: Send via Gmail            │
                │ → RELIABLE OUTCOME                  │
                └─────────────────────────────────────┘
```

## Combination Patterns

### Pattern 1: One Skill, Multiple MCPs

A single skill orchestrates multiple tools for a complex workflow.

```
Meeting Prep Skill
├── Uses: Google Calendar MCP (attendees, time)
├── Uses: LinkedIn MCP (background research)
├── Uses: Salesforce MCP (past interactions)
├── Uses: Slack MCP (recent conversations)
└── Produces: Structured prep document
```

**When to use:** Cross-cutting workflows that need data from multiple sources.

### Pattern 2: Multiple Skills, One MCP

Multiple skills enhance a single MCP for different purposes.

```
Notion MCP
├── Enhanced by: Meeting Prep Skill
│   └── Focus: Calendar integration, attendee info
├── Enhanced by: Research Capture Skill
│   └── Focus: Tagging, linking, permanent reference
├── Enhanced by: Spec to Implementation Skill
│   └── Focus: Convert specs to tasks
└── Enhanced by: Knowledge Base Skill
    └── Focus: Cross-reference, search
```

**When to use:** When one tool serves many different workflows.

### Pattern 3: Skill-Mediated MCP Chain

Skills define how MCPs hand off to each other.

```
Lead Processing Skill
│
├── Step 1: Identify lead (RB2B MCP)
│           │
├── Step 2: Enrich data (Clay MCP)
│           │
├── Step 3: Score and qualify (Claude reasoning)
│           │
├── Step 4: Add to CRM (Salesforce MCP)
│           │
└── Step 5: Notify sales (Slack MCP)
```

**When to use:** Multi-stage pipelines with clear handoffs.

## Handling Conflicts

When MCP and Skill instructions conflict, Claude has to guess. Prevent this by keeping responsibilities clear:

| Responsibility | Goes In |
|----------------|---------|
| API authentication | MCP |
| Query syntax | MCP |
| Connection handling | MCP |
| Rate limit behavior | MCP |
| **Which data to fetch first** | **Skill** |
| **Output format/presentation** | **Skill** |
| **Multi-step sequencing** | **Skill** |
| **Business logic decisions** | **Skill** |

### Conflict Example

```
❌ BAD:
MCP instructions: "Return results as JSON"
Skill instructions: "Format results as markdown tables"
→ Claude has to guess

✅ GOOD:
MCP instructions: "Returns JSON with fields: id, name, status"
Skill instructions: "Take the JSON response and format as markdown table for team review"
→ Clear handoff
```

## Best Practices

### 1. MCP Stays Generic

MCP tool descriptions should work for ANY workflow:

```yaml
# Good MCP description
name: notion-query
description: "Query Notion databases. Returns JSON with page objects."

# Bad MCP description (too specific)
name: notion-query
description: "Query Notion for meeting notes and format as bullet points for standup"
```

### 2. Skills Add Context

Skills specify HOW to use the generic MCP for a specific purpose:

```markdown
# Meeting Notes Skill

## Querying Notion

Use the notion-query tool with:
- Filter: created_time >= last_standup_date
- Database: Meeting Notes
- Sort: descending by date

Then format each result as:
- **Meeting**: {title}
- **Date**: {created_time}
- **Key Points**: {bullet summary}
```

### 3. Skills Can Require MCPs

Document MCP dependencies in skills:

```markdown
---
name: lead-processing
description: Process and qualify inbound leads
---

## Required MCPs

This skill requires these MCP servers to be installed:
- `rb2b-mcp` - Lead identification
- `clay-mcp` - Data enrichment
- `salesforce-mcp` - CRM integration
```

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Putting workflow in MCP | MCP becomes inflexible | Move workflow to Skill |
| Skill without MCP access | Can't actually DO anything | Ensure MCPs are available |
| Duplicate instructions | Conflicts and confusion | Single source of truth |
| Overly specific MCP | Can't be reused | Keep MCP generic, customize in Skills |

## Quick Reference

```
MCP = "What tools exist and how to call them"
Skill = "What to do with those tools for this purpose"

MCP connects to external systems.
Skill orchestrates those connections.

MCP is infrastructure.
Skill is expertise.
```
