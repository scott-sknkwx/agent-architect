# Agent Boundaries

## The Single Responsibility Test

Ask: "Can I describe what this agent does in one sentence without using 'and'?"

Bad: "This agent finds leads AND scores them AND writes emails"
Good: "This agent scores leads against the ICP"

## Common Agent Types

| Type | Input | Output | Example |
|------|-------|--------|---------|
| Evaluator | Entity + criteria | Score + reasoning | LeadQualifier |
| Transformer | Data format A | Data format B | Transcriber |
| Generator | Context + instructions | New content | EmailWriter |
| Router | Entity | Category | PersonaMatcher |
| Executor | Plan | Confirmation | EmailSender |

## Boundary Rules

1. Evaluators don't execute
2. Generators don't decide
3. One external system per executor
4. Humans gate high-stakes actions
