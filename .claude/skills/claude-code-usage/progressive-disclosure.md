# Progressive Disclosure in Skills

One of the biggest problems with early MCP adoption was **context bloat**—too much information loaded into the model, causing hallucinations and poor tool selection.

Skills solve this through **progressive disclosure**: loading information in layers, only as needed.

## The Three Levels

```
┌─────────────────────────────────────────────────────────────────┐
│                    LEVEL 1: Always Loaded                       │
│                    ────────────────────────                     │
│                                                                 │
│    Name: "pdf-toolkit"                                         │
│    Description: "Comprehensive PDF toolkit for extracting      │
│                  text, tables, merging, splitting, and forms"  │
│                                                                 │
│    Just enough for Claude to know WHEN to use this skill       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ User invokes skill
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEVEL 2: Skill Body                          │
│                    ───────────────────                          │
│                                                                 │
│    The main SKILL.md content:                                  │
│    - Core instructions                                         │
│    - Primary workflows                                         │
│    - Common patterns                                           │
│                                                                 │
│    References to deeper files:                                 │
│    "For advanced features, see reference.md"                   │
│    "To fill PDF forms, read forms.md"                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Claude needs specific detail
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEVEL 3: Referenced Files                    │
│                    ─────────────────────────                    │
│                                                                 │
│    reference.md - JavaScript libraries, detailed examples      │
│    forms.md - Form-filling specific instructions               │
│    templates/ - Sample configurations                          │
│                                                                 │
│    Loaded ONLY when Claude determines they're relevant         │
└─────────────────────────────────────────────────────────────────┘
```

## Why This Matters

### Without Progressive Disclosure

```
Agent startup → Load ALL skill content → Context bloat → Hallucination
```

### With Progressive Disclosure

```
Agent startup → Load names/descriptions only → User asks → Load relevant skill body
                                                        → Load referenced files only if needed
```

## Implementation

### SKILL.md Structure

```markdown
---
name: pdf-toolkit
description: Comprehensive PDF toolkit for extracting text, tables, merging, splitting documents, and filling out forms.
---

# PDF Toolkit

Core functionality for working with PDFs.

## Basic Operations

[... main instructions ...]

## References

For advanced features and JavaScript libraries, see `reference.md`.

If you need to fill out a PDF form, read `forms.md`.
```

### Key Points

1. **YAML frontmatter is Level 1** - Name and description only
2. **Markdown body is Level 2** - Loaded when skill is invoked
3. **Referenced files are Level 3** - Loaded when Claude reads them

## Example: Complex Skill

```
data-analysis-skill/
├── SKILL.md                    # Core: overview, basic patterns
├── sql-patterns.md             # Level 3: Advanced SQL
├── visualization.md            # Level 3: Chart generation
├── statistical-methods.md      # Level 3: Stats formulas
└── examples/
    ├── marketing.md            # Level 3: Marketing-specific
    └── engineering.md          # Level 3: Engineering-specific
```

User says: "Analyze this marketing data"

1. **Level 1 loaded at startup**: Claude knows "data-analysis-skill" exists for data analysis
2. **Level 2 loaded on invocation**: Basic analysis patterns, references to deeper files
3. **Level 3 loaded as needed**: Claude reads `examples/marketing.md` for domain-specific guidance

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| Everything in SKILL.md | Context bloat on every use | Split into referenced files |
| Too many levels | Confusing, slow | Keep to 2-3 levels max |
| Vague references | Claude doesn't know when to read | Be explicit about triggers |
| No references | Skill body too large | Extract specialized content |

## Writing Good References

In your SKILL.md, be explicit about when to load Level 3:

```markdown
## References

- For **JavaScript library integration**, see `libraries.md`
- If working with **scanned documents**, read `ocr.md`
- For **batch processing** multiple files, see `batch.md`
```

Claude can now intelligently choose which (if any) to load based on the actual task.
