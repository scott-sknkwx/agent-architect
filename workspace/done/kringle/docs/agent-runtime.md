# Kringle Agent Runtime

This document shows how Kringle's agents execute at runtime, mapping manifest definitions to SDK calls.

## Kringle Agents Overview

| Agent | Trigger Event | Purpose |
|-------|---------------|---------|
| `persona-matcher` | `matching.started` | Scores lead against personas, selects best match |
| `email-drafter` | `wrapper_emails.draft_requested` | Drafts 4 wrapper emails |
| `reply-drafter` | `response.question` | Drafts replies to lead questions |
| `response-triager` | `response.received` | Classifies email responses |
| `escalation-handler` | `escalation.created` | Handles complex escalations |

## Persona Matcher: Complete Runtime Example

The persona-matcher agent demonstrates all runtime patterns.

### Manifest Definition

```yaml
- name: persona-matcher
  description: "Scores enriched leads against buyer personas and selects best match"
  triggers:
    - event: matching.started
  emits:
    - event: lead.matched
      when: "output.matched == true"
    - event: lead.no_match
      when: "output.matched == false"
  contract:
    state_in: "enriched"
    state_out: "matched"
    context_in:
      from_db:
        - table: leads
          as: "lead.md"
          template: "templates/lead-context.md.hbs"
          must_have: ["id", "email", "enrichment_data"]
        - table: personas
          as: "personas/"
          template: "templates/persona-summary.md.hbs"
          must_have: ["id", "name", "filter_criteria"]
      static:
        - source: "config/personas/"
          dest: "personas/"
    context_out:
      artifacts:
        - file: "status.yaml"
          required: true
          persist_to: supabase_storage
        - file: "match_scores.json"
          required: true
          persist_to: supabase_storage
    output_schema: "schemas/persona-matcher-output.ts"
  config:
    model: "sonnet"
    allowed_tools: ["Read", "Write", "Glob", "Task"]
    permission_mode: "bypassPermissions"
    subagents:
      - name: persona-scorer
        description: "Scores a single lead against a single persona"
        model: "sonnet"
        tools: ["Read"]
  limits:
    max_tokens: 80000
    max_tool_calls: 100
    timeout_seconds: 300
    max_retries: 2
  workspace:
    base: "leads/{org_id}/{lead_id}/"
    cleanup: "on_success"
    snapshot_on_failure: true
```

### Generated Agent Runner

```typescript
// src/inngest/agents/persona-matcher.ts
import { inngest } from "../client";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PersonaMatcherOutputSchema } from "../../schemas/persona-matcher-output";
import { hydrateWorkspace, cleanupWorkspace, persistArtifacts } from "../../lib/workspace";
import { readFileSync } from "fs";

export const personaMatcher = inngest.createFunction(
  {
    id: "persona-matcher",
    retries: 2,                    // From limits.max_retries
    timeout: "300s"                // From limits.timeout_seconds
  },
  { event: "matching.started" },   // From triggers[0].event
  async ({ event, step }) => {
    let workspacePath: string | null = null;

    try {
      // ─────────────────────────────────────────────────────────────────────
      // Step 1: Hydrate Workspace
      // Manifest: contract.context_in
      // ─────────────────────────────────────────────────────────────────────
      workspacePath = await step.run("hydrate-workspace", async () => {
        return await hydrateWorkspace({
          agentName: "persona-matcher",
          base: `leads/${event.data.organization_id}/${event.data.lead_id}/`,
          contextIn: {
            fromDb: [
              {
                table: "leads",
                id: event.data.lead_id,
                as: "lead.md",
                template: "lead-context.md.hbs",
                mustHave: ["id", "email", "enrichment_data"]
              },
              {
                table: "personas",
                filter: { organization_id: event.data.organization_id, active: true },
                as: "personas/",
                template: "persona-summary.md.hbs",
                mustHave: ["id", "name", "filter_criteria"]
              }
            ],
            static: [
              { source: "config/personas/", dest: "personas/" }
            ]
          }
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 2: Run Agent via SDK
      // Manifest: config.* → SDK options
      // ─────────────────────────────────────────────────────────────────────
      const result = await step.run("run-agent", async () => {
        const schema = zodToJsonSchema(PersonaMatcherOutputSchema, { $refStrategy: "root" });

        for await (const message of query({
          prompt: "Evaluate the lead against all personas and determine the best match. Read CLAUDE.md for detailed instructions.",
          options: {
            // Workspace + CLAUDE.md loading
            cwd: workspacePath!,
            systemPrompt: { type: "preset", preset: "claude_code" },
            settingSources: ["project"],

            // From config.model
            model: "claude-sonnet-4-5",

            // From config.allowed_tools
            allowedTools: ["Read", "Write", "Glob", "Task"],

            // From config.permission_mode
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,

            // From limits.*
            maxTurns: 100,           // limits.max_tool_calls
            maxThinkingTokens: 80000, // limits.max_tokens

            // From contract.output_schema
            outputFormat: { type: "json_schema", schema },

            // From config.subagents
            agents: {
              "persona-scorer": {
                description: "Scores a single lead against a single persona",
                prompt: readFileSync("agents/persona-scorer.md", "utf8"),
                tools: ["Read"],
                model: "sonnet"
              }
            }
          }
        })) {
          if (message.type === "result") {
            if (message.subtype === "success" && message.structured_output) {
              return PersonaMatcherOutputSchema.parse(message.structured_output);
            }
            if (message.subtype !== "success") {
              throw new Error(`Agent error (${message.subtype}): ${message.errors?.join(", ")}`);
            }
          }
        }
        throw new Error("No result from agent");
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 3: Persist Artifacts
      // Manifest: contract.context_out.artifacts
      // ─────────────────────────────────────────────────────────────────────
      await step.run("persist-artifacts", async () => {
        await persistArtifacts(workspacePath!, [
          { file: "status.yaml", required: true, persistTo: "supabase_storage" },
          { file: "match_scores.json", required: true, persistTo: "supabase_storage" }
        ], {
          bucket: "lead-artifacts",
          prefix: `${event.data.organization_id}/${event.data.lead_id}/`
        });
      });

      // ─────────────────────────────────────────────────────────────────────
      // Step 4: Emit Events
      // Manifest: emits[].event + emits[].when
      // ─────────────────────────────────────────────────────────────────────
      if (result.matched) {
        // emits[0]: when "output.matched == true"
        await step.sendEvent("emit-matched", {
          name: "lead.matched",
          data: {
            lead_id: event.data.lead_id,
            organization_id: event.data.organization_id,
            persona_id: result.persona_id,
            confidence_score: result.confidence_score,
            trace_id: event.data.trace_id
          }
        });
      } else {
        // emits[1]: when "output.matched == false"
        await step.sendEvent("emit-no-match", {
          name: "lead.no_match",
          data: {
            lead_id: event.data.lead_id,
            organization_id: event.data.organization_id,
            reason: result.failure_reason || "no_match",
            trace_id: event.data.trace_id
          }
        });
      }

      return result;

    } finally {
      // ─────────────────────────────────────────────────────────────────────
      // Step 5: Cleanup
      // Manifest: workspace.cleanup = "on_success"
      // Note: For "on_complete", cleanup runs always. For "on_success", only on success.
      // ─────────────────────────────────────────────────────────────────────
      if (workspacePath) {
        await step.run("cleanup-workspace", () => cleanupWorkspace(workspacePath!));
      }
    }
  }
);
```

## Workspace Hydration for Lead Context

Kringle agents receive lead context through workspace hydration.

### Lead Context Template

```handlebars
{{! templates/lead-context.md.hbs }}
# Lead: {{first_name}} {{last_name}}

<data source="leads" trust="low">
**Email:** {{email}}
**Company:** {{company_name}}
**Title:** {{title}}

## Enrichment Data (from Clay)
{{#if enrichment_data}}
**LinkedIn Headline:** {{enrichment_data.linkedin_headline}}
**Industry:** {{enrichment_data.industry}}
**Company Size:** {{enrichment_data.company_size}} employees
**Funding Stage:** {{enrichment_data.funding_stage}}
**Location:** {{enrichment_data.location}}
{{else}}
_Enrichment data not available_
{{/if}}

## Homepage Context (from Firecrawl)
{{#if homepage_context}}
{{homepage_context}}
{{else}}
_Homepage not scraped_
{{/if}}
</data>
```

### Hydrated Workspace Structure

```
/tmp/agent-workspace-{uuid}/
├── .claude/
│   └── CLAUDE.md              # From agents/persona-matcher.md
├── lead.md                     # Hydrated from leads table
├── status.yaml                 # Bill of materials (read/write)
└── personas/
    ├── tech-decision-makers/
    │   ├── summary.md          # From personas table via template
    │   └── filter_criteria.yaml # From config/personas/
    └── marketing-leaders/
        ├── summary.md
        └── filter_criteria.yaml
```

## Event Emission Patterns

### Conditional Emissions

Manifest `emits[].when` becomes runtime conditionals:

```yaml
# Manifest
emits:
  - event: lead.matched
    when: "output.matched == true"
  - event: lead.no_match
    when: "output.matched == false"
```

```typescript
// Runtime
if (result.matched) {
  await step.sendEvent("emit-matched", { name: "lead.matched", data: {...} });
} else {
  await step.sendEvent("emit-no-match", { name: "lead.no_match", data: {...} });
}
```

### Delayed Emissions

For timeout checks and scheduled follow-ups:

```yaml
# Manifest (hypothetical)
emits:
  - event: lead.check_timeout
    delay: "24h"
```

```typescript
// Runtime - Inngest handles the delay
await step.sendEvent("schedule-timeout", {
  name: "lead.check_timeout",
  data: { lead_id: event.data.lead_id },
  // Inngest delayed event delivery handled at platform level
});
```

## Email Drafter: Multi-Artifact Example

The email-drafter produces 4 email drafts and updates status.yaml.

### Artifact Persistence

```yaml
# Manifest
context_out:
  artifacts:
    - file: "drafts/reach_out_initial.yaml"
      required: true
      persist_to: supabase_storage
    - file: "drafts/reach_out_followup.yaml"
      required: true
      persist_to: supabase_storage
    - file: "drafts/post_eex_initial.yaml"
      required: true
      persist_to: supabase_storage
    - file: "drafts/post_eex_followup.yaml"
      required: true
      persist_to: supabase_storage
    - file: "status.yaml"
      required: true
      persist_to: supabase_storage
```

```typescript
// Runtime artifact persistence
await step.run("persist-artifacts", async () => {
  await persistArtifacts(workspacePath!, [
    { file: "drafts/reach_out_initial.yaml", required: true, persistTo: "supabase_storage" },
    { file: "drafts/reach_out_followup.yaml", required: true, persistTo: "supabase_storage" },
    { file: "drafts/post_eex_initial.yaml", required: true, persistTo: "supabase_storage" },
    { file: "drafts/post_eex_followup.yaml", required: true, persistTo: "supabase_storage" },
    { file: "status.yaml", required: true, persistTo: "supabase_storage" }
  ], {
    bucket: "lead-artifacts",
    prefix: `${event.data.organization_id}/${event.data.lead_id}/`
  });
});
```

## Response Triager: Multi-State Input

The response-triager can be triggered from multiple states.

```yaml
# Manifest
contract:
  state_in:
    - "reach_out_active"
    - "eex_active"
    - "post_eex_active"
  state_out: "varies"  # Depends on classification
```

The `state_in` array means this agent runs when a lead is in ANY of those states. The output determines which state transition occurs.

## Subagent Configuration

Persona-matcher uses a subagent for parallel persona scoring:

```yaml
# Manifest
config:
  subagents:
    - name: persona-scorer
      description: "Scores a single lead against a single persona"
      model: "sonnet"
      tools: ["Read"]
```

```typescript
// Runtime SDK options
agents: {
  "persona-scorer": {
    description: "Scores a single lead against a single persona",
    prompt: readFileSync("agents/persona-scorer.md", "utf8"),
    tools: ["Read"],
    model: "sonnet"  // SDK accepts: 'sonnet' | 'opus' | 'haiku' | 'inherit'
  }
}
```

The main agent spawns subagents via the `Task` tool. Each subagent:
- Has its own CLAUDE.md loaded from `agents/persona-scorer.md`
- Runs with restricted tools (only `Read`)
- Returns structured output to the parent agent

## Error Handling and Snapshots

```yaml
# Manifest
workspace:
  cleanup: "on_success"
  snapshot_on_failure: true
```

On failure:
1. Workspace is NOT cleaned up (cleanup = "on_success")
2. Workspace is snapshotted to storage for debugging
3. Inngest retries according to `limits.max_retries`

```typescript
// Runtime error handling
try {
  // ... agent execution
} catch (error) {
  if (manifest.workspace.snapshot_on_failure) {
    await step.run("snapshot-workspace", () =>
      snapshotWorkspace(workspacePath!, {
        bucket: "debug-snapshots",
        prefix: `failed/${event.data.lead_id}/${Date.now()}/`
      })
    );
  }
  throw error;  // Let Inngest handle retry
}
```

## Related Documentation

- [Agent Runtime Pattern](../../../context/patterns/agent-runtime-pattern.md) - Core pattern documentation
- [Contract-to-SDK Mapping](../../../context/manifest/contract-to-sdk-mapping.md) - Complete field mapping
- [Output Structure](../../../context/manifest/output-structure.md) - Generated project structure
