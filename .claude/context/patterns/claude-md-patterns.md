# CLAUDE.md Patterns

## Structure

Every CLAUDE.md should have:
```markdown
# [Agent Name] Agent

## Identity
One sentence: who I am and what I do.

## My Single Responsibility
The ONE job this agent does. Be specific.
What I do NOT do (boundaries with other agents).

## My Process
Numbered steps. Specific. Actionable.
1. First, I read [specific file]
2. Then, I [specific action]
3. I evaluate [specific criteria]
4. I write [specific output]
5. I return my structured output

## Input Context
What files I expect in my workspace:
- `lead.md` - Lead information (required)
- `status.yaml` - Current state (required)
- `personas/` - Persona definitions (required)

## Output
What I produce:
1. Updated `status.yaml` with new state
2. Artifacts: [list them]
3. Structured output: [show example JSON]

## Failure Modes
What happens when things go wrong:
- If X is missing: [what to do]
- If Y fails: [what to do]
- I return: { success: false, error: "..." }
```

## Principles

1. **Be Specific**: "Evaluate the lead" is bad. "Score the lead 0-100 based on title match, company size, and industry fit" is good.

2. **Define Boundaries**: Explicitly say what this agent does NOT do. "I do NOT send emails. I only draft them."

3. **Show Examples**: Include example inputs and outputs. Agents learn from examples.

4. **Handle Failure**: Every agent must know what to do when things go wrong.

5. **Single Responsibility**: If you're listing more than 5 process steps, you might need two agents.
