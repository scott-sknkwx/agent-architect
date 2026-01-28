import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

const StateDefinitionSchema = z.object({
  name: z.string(),
  transitions_to: z.array(z.string()),
  terminal: z.boolean().optional(),
});

const StateMachineSchema = z.object({
  initial: z.string(),
  states: z.array(StateDefinitionSchema),
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════════════════════

const EventFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

const EventDefinitionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  payload: z.record(z.string(), EventFieldSchema),
  idempotency_key: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

const DbSourceSchema = z.object({
  table: z.string(),
  as: z.string(),
  template: z.string().optional(),
  must_have: z.array(z.string()).optional(),
});

const StaticSourceSchema = z.object({
  source: z.string(),
  dest: z.string(),
});

const ArtifactSchema = z.object({
  file: z.string(),
  required: z.boolean().optional().default(true),
  persist_to: z.enum(["supabase_storage", "database", "none"]).optional().default("supabase_storage"),
});

const ContractSchema = z.object({
  state_in: z.union([z.string(), z.array(z.string())]),
  state_out: z.string(),
  context_in: z.object({
    from_db: z.array(DbSourceSchema).optional(),
    static: z.array(StaticSourceSchema).optional(),
  }).optional(),
  context_out: z.object({
    artifacts: z.array(ArtifactSchema).optional(),
  }).optional(),
  output_schema: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const SubagentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  model: z.enum(["haiku", "sonnet", "opus"]),
  tools: z.array(z.string()),
});

const McpServerSchema = z.object({
  name: z.string(),
  url: z.string(),
});

const AgentConfigSchema = z.object({
  model: z.enum(["haiku", "sonnet", "opus"]),
  allowed_tools: z.array(z.string()),
  permission_mode: z.enum(["default", "acceptEdits", "bypassPermissions"]).optional(),
  subagents: z.array(SubagentSchema).optional(),
  mcp_servers: z.array(McpServerSchema).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT LIMITS
// ═══════════════════════════════════════════════════════════════════════════

const AgentLimitsSchema = z.object({
  max_tokens: z.number().optional().default(50000),
  max_tool_calls: z.number().optional().default(50),
  timeout_seconds: z.number().optional().default(300),
  max_retries: z.number().optional().default(3),
});

// ═══════════════════════════════════════════════════════════════════════════
// AGENT WORKSPACE
// ═══════════════════════════════════════════════════════════════════════════

const WorkspaceSchema = z.object({
  base: z.string().optional(),
  cleanup: z.enum(["on_success", "on_complete", "never"]).optional().default("on_success"),
  snapshot_on_failure: z.boolean().optional().default(true),
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL AGENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const AgentSchema = z.object({
  name: z.string(),
  description: z.string(),
  triggers: z.array(z.object({ event: z.string() })),
  emits: z.array(z.object({
    event: z.string(),
    when: z.string().optional(),
    delay: z.string().optional(),
  })),
  contract: ContractSchema,
  config: AgentConfigSchema,
  limits: AgentLimitsSchema.optional(),
  workspace: WorkspaceSchema.optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

const WebhookSchema = z.object({
  name: z.string(),
  path: z.string(),
  auth: z.enum(["hmac", "api_key", "bearer", "none"]),
  secret: z.string().optional(),
  emits: z.string(),
  transform: z.string(),
  description: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// CRON
// ═══════════════════════════════════════════════════════════════════════════

const CronSchema = z.object({
  name: z.string(),
  schedule: z.string(),
  function: z.string(),
  description: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const TableColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().optional().default(true),
  default: z.string().optional(),
  references: z.string().optional(),
});

const TableSchema = z.object({
  name: z.string(),
  columns: z.array(TableColumnSchema).optional(),
  rls: z.boolean().optional().default(true),
});

const DatabaseSchema = z.object({
  migrations_dir: z.string().optional().default("supabase/migrations/"),
  tables: z.array(TableSchema),
});

// ═══════════════════════════════════════════════════════════════════════════
// OBSERVABILITY
// ═══════════════════════════════════════════════════════════════════════════

const ObservabilitySchema = z.object({
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
    format: z.enum(["json", "pretty"]).optional().default("json"),
  }).optional(),
  tracing: z.object({
    enabled: z.boolean().optional().default(true),
    trace_id_field: z.string().optional().default("trace_id"),
  }).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL MANIFEST SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export const ManifestSchema = z.object({
  product: z.object({
    name: z.string(),
    description: z.string(),
    version: z.string(),
  }),

  infrastructure: z.object({
    inngest: z.object({
      app_id: z.string(),
      signing_key: z.string(),
      event_key: z.string(),
    }),
    supabase: z.object({
      project_ref: z.string(),
      url: z.string(),
      anon_key: z.string(),
      service_key: z.string(),
    }),
    anthropic: z.object({
      api_key: z.string(),
      default_model: z.enum(["haiku", "sonnet", "opus"]),
    }),
    deployment: z.object({
      platform: z.enum(["vercel", "railway", "docker"]),
      region: z.string().optional(),
    }),
  }),

  tenancy: z.object({
    enabled: z.boolean(),
    identifier: z.string(),
    isolation: z.object({
      database: z.enum(["rls", "schema", "database"]),
      storage: z.enum(["prefix", "bucket"]),
      workspace: z.enum(["prefix"]),
    }),
  }).optional(),

  state_machine: StateMachineSchema,
  events: z.object({
    namespace: z.string(),
    definitions: z.array(EventDefinitionSchema),
  }),
  agents: z.array(AgentSchema),
  database: DatabaseSchema,

  crons: z.array(CronSchema).optional(),
  webhooks: z.array(WebhookSchema).optional(),
  observability: ObservabilitySchema.optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type Manifest = z.infer<typeof ManifestSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type EventDefinition = z.infer<typeof EventDefinitionSchema>;
export type Contract = z.infer<typeof ContractSchema>;
export type StateMachine = z.infer<typeof StateMachineSchema>;
export type StateDefinition = z.infer<typeof StateDefinitionSchema>;
export type AgentLimits = z.infer<typeof AgentLimitsSchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
export type Cron = z.infer<typeof CronSchema>;
export type Table = z.infer<typeof TableSchema>;
