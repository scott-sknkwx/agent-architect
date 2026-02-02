# When to Create a Skill

Skills encode expertise, domain knowledge, and workflow logic. They turn raw tool access into reliable, repeatable outcomes.

## Create a Skill When You Have

### 1. Multi-Step Workflows Involving Tools

A process that requires tools in a specific sequence.

```
Example: "Send a report" skill
1. Query Notion for last 5 meeting notes
2. Summarize the notes
3. Send emails to relevant stakeholders
4. Book a follow-up call
5. Send invoice to client
```

Without this skill, "send a report" means nothing—the agent doesn't know WHAT report or HOW.

### 2. Processes Where Consistency Matters

When the same task should be done the same way every time.

```
Examples:
- PR review checklist
- Deployment procedure
- Code style enforcement
- Bug triage workflow
```

### 3. Domain Expertise to Capture and Share

Knowledge that would otherwise live in someone's head.

```
Examples:
- Rails best practices (DHH style)
- Company's design system patterns
- Security review checklist
- How YOUR team uses Notion
```

### 4. Workflows That Should Survive Team Changes

When the person who knows "how we do things" might leave.

```
Examples:
- Onboarding procedures
- Release management
- Customer escalation handling
- Documentation standards
```

### 5. Meeting Prep That Pulls From Multiple Sources

Complex preparation that crosses data boundaries.

```
Example: Meeting prep skill
1. Check calendar for attendees
2. Pull LinkedIn context for each
3. Query CRM for past interactions
4. Check Slack for recent discussions
5. Generate structured prep document
```

## Skill Responsibilities

| Skill Should Handle | Skill Should NOT Handle |
|--------------------|------------------------|
| Step-by-step workflow | Raw API connectivity |
| Business logic decisions | Authentication |
| Presentation/output format | Tool-level error handling |
| Multi-tool coordination | Rate limiting |
| Domain-specific guidance | Query syntax |

## Rule of Thumb

> Skills handle **how to use tools for a given purpose** or **in a multi-server workflow**.
>
> They're the "contractor's knowledge" that makes tools useful.

## Example: Notion for Meeting Prep vs Research

Same MCP (Notion), different Skills:

**Meeting Prep Skill:**
- Focus on calendar integration
- Pull attendee information
- Format as brief summary
- Include action items from last meeting

**Research Knowledge Capture Skill:**
- Focus on content databases
- Tag with topics and sources
- Link to related notes
- Format as permanent reference

## Skill Structure Pattern

```
skill-name/
├── SKILL.md              # Required: YAML frontmatter + main content
├── advanced.md           # Optional: Progressive disclosure
├── examples.md           # Optional: Reference when needed
└── templates/            # Optional: Supporting files
```

## Progressive Disclosure

Skills solve the context bloat problem through layered loading:

```
Level 1: Name + Description (always loaded)
         ↓
Level 2: Main SKILL.md body (loaded when skill is invoked)
         ↓
Level 3: Referenced files (loaded only when needed)
```

See `progressive-disclosure.md` for details.

## When NOT to Create a Skill

| Situation | Better Alternative |
|-----------|-------------------|
| Simple one-liner | Just say it in conversation |
| Tool connectivity | Create an MCP instead |
| Static data reference | Put in CLAUDE.md |
| Rarely used process | Document in project docs |
| Highly variable process | Use direct instructions |

## Signs You Need a Skill

- You find yourself explaining the same process repeatedly
- New team members keep asking "how do we..."
- The output quality varies based on who's prompting
- A workflow spans multiple tools/MCPs
- You want to enforce a specific approach
