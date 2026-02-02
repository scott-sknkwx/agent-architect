# Sample Product

This is a **canonical example** of an Agent Architect workspace. Use it as a reference when generating new products.

## Purpose

This example demonstrates:
- Correct manifest.yaml structure with inline comments
- Agent CLAUDE.md format and content
- Output schema patterns with required fields
- Config directory structure for static context
- Access control policy patterns

## Directory Structure

```
sample-product/
├── manifest.yaml              # Annotated manifest with all sections
├── agents/
│   └── processor.md           # Example agent CLAUDE.md
├── schemas/
│   └── processor-output.ts    # Example output schema with required fields
├── config/
│   └── sample-personas/
│       └── README.md          # Documents expected config contents
├── functions/
│   └── specs/                 # Function specs would go here
└── README.md                  # This file
```

## Key Patterns Demonstrated

### Manifest Structure
- Product metadata
- Infrastructure configuration (env vars for secrets)
- State machine with terminal states
- Events with typed payloads and trace_id
- Agent contracts with context_in/context_out
- Functions with correct integration arrays
- Database with actors and access policies

### Agent CLAUDE.md
- Clear role statement
- Context it receives
- Step-by-step process
- Explicit boundaries (DO/DON'T)
- Failure handling instructions
- Structured output examples

### Output Schema
- Required `success: z.boolean()` field
- Required `error: z.string().optional()` field
- Agent-specific fields with descriptions
- Type export for TypeScript usage

### Access Control
- Actors defined once at database level
- Per-table access policies with `:actor` placeholder
- Common patterns: tenant isolation, owner-only

## Using This Example

When generating a new product:

1. Copy this structure as a starting point
2. Replace `sample-product` with your product name
3. Update the manifest based on discovery interview results
4. Create agent CLAUDE.md files for each agent
5. Create output schemas matching agent structured output
6. Create config directories for each `context_in.static` source
7. Run Agent Factory to generate the deployable project

## Validation Checklist

Before running Agent Factory:

- [ ] `manifest.yaml` is valid YAML
- [ ] Each agent has a corresponding `agents/{name}.md`
- [ ] Each agent has an output schema at `contract.output_schema` path
- [ ] Each `context_in.static.source` has a `config/{source}/` directory
- [ ] All tables have at least one access policy
- [ ] All events include `trace_id` in payload
