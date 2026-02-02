# Sample Personas Config

This directory contains persona definitions that the processor agent can reference.

## Expected Contents

Each persona should have its own subdirectory with configuration files:

```
sample-personas/
├── persona-a/
│   ├── definition.yaml     # Persona name, description, characteristics
│   ├── filter_criteria.yaml # Criteria for matching items to this persona
│   └── processing_hints.yaml # Hints for how to process items for this persona
└── persona-b/
    └── ...
```

## Example Persona Definition

```yaml
# definition.yaml
name: "Technical Reviewer"
description: "Focuses on technical accuracy and code quality"
characteristics:
  - detail-oriented
  - code-focused
  - prefers structured output
```

## How Agents Use This

The processor agent receives this directory in its context at `personas/`. It can read these files to understand how to tailor its analysis based on the target persona.
