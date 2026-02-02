---
name: claude-code-usage
description: Decision framework for when to create MCPs vs Skills vs neither. MCPs provide tool access; Skills provide expertise and workflow logic. They complement each other.
---

# Claude Code Usage: MCPs vs Skills

MCPs and Skills are complementary, not competitive. Understanding when to create each is critical for effective agent systems.

## The Core Distinction

```
┌─────────────────────────────────────────────────────────────────┐
│                         ME (User)                              │
│                             │                                   │
│                             ▼                                   │
│                    ┌────────────────┐                          │
│                    │   CLAUDE CODE  │                          │
│                    │     Agent      │                          │
│                    └────────────────┘                          │
│                             │                                   │
│              ┌──────────────┴──────────────┐                   │
│              ▼                              ▼                   │
│     ┌────────────────┐            ┌────────────────┐           │
│     │    SKILLS      │            │     MCPs       │           │
│     ├────────────────┤            ├────────────────┤           │
│     │ • Expertise    │            │ • Tool Access  │           │
│     │ • Workflows    │            │ • External Data│           │
│     │ • Domain Logic │            │ • API Actions  │           │
│     │ • Step-by-step │            │ • Connectivity │           │
│     └────────────────┘            └────────────────┘           │
│                                           │                    │
│                                           ▼                    │
│                                  ┌────────────────┐            │
│                                  │ External Tools │            │
│                                  │ Notion, Gmail  │            │
│                                  │ Stripe, GitHub │            │
│                                  └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Decision Guide

| You Need... | Create... |
|-------------|-----------|
| Access to external data/APIs | MCP Server |
| Step-by-step workflow instructions | Skill |
| Real-time data queries | MCP Server |
| Domain expertise encoding | Skill |
| File system operations beyond native | MCP Server |
| Process consistency across team | Skill |
| Actions in external systems | MCP Server |
| Training model on HOW to use tools | Skill |

## The Hardware Store Analogy

Imagine you and a friend go to Home Depot to build a backyard patio. You buy all the tools, but neither of you knows:
- What goes first
- What type of wood you need
- How to use each tool properly

**MCPs = The Tools** (drill, saw, level)
**Skills = The Expertise** (the contractor who knows the step-by-step)

Without skills, agents with many MCP tools will:
- Hallucinate which tool to use
- Pick the wrong one
- Produce unreliable outcomes

## Detailed Guides

| Topic | File | When to Read |
|-------|------|--------------|
| When to create an MCP | `when-to-create-mcp.md` | Building external integrations |
| When to create a Skill | `when-to-create-skill.md` | Encoding workflows or expertise |
| Progressive Disclosure | `progressive-disclosure.md` | Managing context efficiently |
| Combining MCPs + Skills | `combining-mcp-and-skills.md` | Building complete agent systems |

## The Key Insight

> "Skills capture the knowledge that would otherwise live in your head or get re-explained every time someone new joins the team."

MCPs handle **connectivity** (how to connect to Notion).
Skills handle **capability** (how to use Notion for meeting prep).

## Anti-patterns

| Anti-pattern | Why It's Wrong | Better Approach |
|--------------|----------------|-----------------|
| MCP-only agents | Too many tools → hallucination | Add skills for workflow guidance |
| Skills without MCPs | Can't access external data | Add MCPs for data/tool access |
| One mega-skill | Context bloat | Split into focused skills with progressive disclosure |
| Conflicting MCP/Skill instructions | Agent has to guess | MCP = connectivity, Skill = workflow |

## When to Create Neither

Sometimes you don't need a new MCP or Skill:

1. **Native tools suffice** - Claude Code has Read, Write, Edit, Bash, WebSearch, etc.
2. **One-time task** - Just give instructions directly in the conversation
3. **Simple query** - A web search or file read doesn't need a wrapper
4. **Already exists** - Check existing MCPs and skills first
