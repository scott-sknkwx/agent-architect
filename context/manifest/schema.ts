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
  type: z.enum(["string", "number", "boolean", "object"]),
  required: z.boolean().optional(),
  enum: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
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
// FLOW VALIDATION & PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Input validation rules for agents and functions.
 * Checked BEFORE processing begins. If validation fails, the step errors without executing.
 *
 * Syntax uses SQL-like expressions with {{ field }} template interpolation:
 * - payload: Array of required payload fields
 * - exists: SQL-like existence check, e.g., "leads.id = {{ lead_id }}"
 * - state: SQL-like state check, e.g., "leads.status IN ('new', 'retry')"
 * - files: Array of required artifact paths
 */
const ValidationRuleSchema = z.object({
  payload: z.array(z.string()).optional().describe("Required payload fields"),
  exists: z.string().optional().describe("SQL-like existence check, e.g., 'leads.id = {{ lead_id }}'"),
  state: z.string().optional().describe("SQL-like state check, e.g., 'leads.status IN (\"new\", \"retry\")'"),
  files: z.array(z.string()).optional().describe("Required artifact file paths"),
});

/**
 * Output validation rules for agents and functions.
 * Checked AFTER processing completes. If validation fails, the step errors before emitting.
 */
const OutputValidationSchema = z.object({
  schema: z.string().optional().describe("Path to Zod schema file for output validation"),
  require_artifacts: z.boolean().optional().describe("Whether artifacts must be created"),
});

/**
 * Persist actions define database changes that occur after successful processing.
 * Uses declarative SQL-like syntax with {{ result.field }} template interpolation.
 *
 * Supports three action types:
 * - update: Update existing records
 * - insert: Insert new records
 * - log: Append to audit/event log tables
 *
 * Use custom_function as an escape hatch for complex persistence logic.
 */
const PersistUpdateActionSchema = z.object({
  update: z.string().describe("Table name to update"),
  set: z.record(z.string(), z.string()).describe("Column-value pairs using {{ result.field }} syntax"),
  where: z.string().optional().describe("SQL WHERE clause, e.g., 'id = {{ lead_id }}'"),
});

const PersistInsertActionSchema = z.object({
  insert: z.string().describe("Table name to insert into"),
  values: z.record(z.string(), z.string()).describe("Column-value pairs using {{ result.field }} syntax"),
});

const PersistLogActionSchema = z.object({
  log: z.string().describe("Log/audit table name"),
  data: z.record(z.string(), z.string()).optional().describe("Additional data to log"),
});

const PersistCustomActionSchema = z.object({
  custom_function: z.string().describe("Path to custom persistence function (escape hatch)"),
});

const PersistActionSchema = z.union([
  PersistUpdateActionSchema,
  PersistInsertActionSchema,
  PersistLogActionSchema,
  PersistCustomActionSchema,
]);

/**
 * Flow fields that can be added to agents and functions.
 * These define the validation and persistence behavior for each step.
 */
const FlowFieldsSchema = z.object({
  validate_input: ValidationRuleSchema.optional().describe("Input validation rules - checked before processing"),
  validate_output: OutputValidationSchema.optional().describe("Output validation rules - checked after processing"),
  persist: z.array(PersistActionSchema).optional().describe("Database changes after successful processing"),
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

  // Flow fields (optional - for explicit validation/persistence)
  validate_input: ValidationRuleSchema.optional(),
  validate_output: OutputValidationSchema.optional(),
  persist: z.array(PersistActionSchema).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Webhook handler extension for validation and transform steps.
 */
const WebhookHandlerSchema = z.object({
  validation: z.array(z.string()).optional(),
  transform: z.array(z.string()).optional(),
});

/**
 * Hookdeck configuration for inngest-first webhooks.
 * Routes external webhooks directly to Inngest, bypassing API routes.
 */
const HookdeckConfigSchema = z.object({
  source: z.string().describe("Hookdeck source name, e.g., 'RB2B'"),
  destination_port: z.number().describe("Local Inngest dev server port, typically 8288"),
  path: z.string().describe("Inngest event path, e.g., '/e/rb2b'"),
  transformation: z.string().describe("Path to Hookdeck transformation file"),
});

/**
 * Traditional webhook: Next.js API route handles request.
 */
const TraditionalWebhookSchema = z.object({
  name: z.string(),
  routing: z.literal("traditional"),
  path: z.string(),
  auth: z.enum(["hmac", "api_key", "bearer", "none"]),
  secret: z.string().optional(),
  emits: z.string(),
  transform: z.string(),
  description: z.string().optional(),
  handler: WebhookHandlerSchema.optional(),
});

/**
 * Inngest-first webhook: Hookdeck routes directly to Inngest.
 * No API route needed - webhooks go straight to event processing.
 */
const InngestFirstWebhookSchema = z.object({
  name: z.string(),
  routing: z.literal("inngest-first"),
  hookdeck: HookdeckConfigSchema,
  emits: z.string(),
  description: z.string().optional(),
  notes: z.array(z.string()).optional(),
});

/**
 * Webhook definition - discriminated on "routing" field.
 * All webhooks must specify their routing type.
 */
const WebhookSchema = z.discriminatedUnion("routing", [
  TraditionalWebhookSchema,
  InngestFirstWebhookSchema,
]);

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
// NON-AGENTIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Function trigger variants for different execution patterns.
 */
const SimpleTriggerSchema = z.object({
  event: z.string(),
});

const FanInTriggerSchema = z.object({
  primary: z.string(),
  wait_for: z.array(z.string()),
  correlation_key: z.string(),
  timeout: z.string().optional(),
});

const CronTriggerSchema = z.object({
  cron: z.string(),
  schedule: z.string(),
});

const RoutingTriggerSchema = z.object({
  event: z.string(),
  route_on: z.string(),
  routes: z.record(z.string(), z.object({
    emit: z.string(),
    then: z.string().optional(),
  })),
  default_route: z.string().optional(),
});

/**
 * Step definition for inngest-first-webhook functions.
 * Each step is a discrete unit of work with error handling.
 */
const FunctionStepSchema = z.object({
  name: z.string().describe("Step identifier, e.g., 'validate', 'lookup-org'"),
  action: z.string().describe("Human-readable description of what this step does"),
  on_failure: z.string().optional().describe("Error handling strategy"),
  notes: z.array(z.string()).optional().describe("Implementation notes"),
});

/**
 * Function configuration for retry/timeout behavior.
 */
const FunctionConfigSchema = z.object({
  retries: z.number().optional().default(3),
  timeout: z.string().optional().default("30s"),
});

/**
 * Non-agentic function schema for event-driven scaffolds.
 * Supports 5 patterns: simple, fan-in, cron, routing, inngest-first-webhook
 */
const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing", "inngest-first-webhook"]),
  trigger: z.union([SimpleTriggerSchema, FanInTriggerSchema, CronTriggerSchema, RoutingTriggerSchema]),
  emits: z.array(z.string()).optional(),

  // For simple, fan-in, cron, routing patterns
  actions: z.array(z.string()).optional(),

  // For inngest-first-webhook pattern
  steps: z.array(FunctionStepSchema).optional(),
  config: FunctionConfigSchema.optional(),
  schema: z.string().optional().describe("Path to validation schema file"),

  // Common fields
  integrations: z.array(z.string()).optional(),
  context: z.string().optional(),
  open_questions: z.array(z.string()).optional(),

  // Flow fields (optional - for explicit validation/persistence)
  validate_input: ValidationRuleSchema.optional(),
  validate_output: OutputValidationSchema.optional(),
  persist: z.array(PersistActionSchema).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE - ACCESS CONTROL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Actors represent the different identities that can access data.
 * Each actor has a name and an identifier expression that resolves to their ID at runtime.
 *
 * Common patterns:
 * - tenant: current_setting('app.current_tenant')::uuid
 * - authenticated_user: auth.uid()
 * - service_role: Always allowed (bypasses RLS)
 */
const ActorSchema = z.object({
  name: z.string().describe("Human-readable actor name (e.g., 'tenant', 'owner', 'team_member')"),
  identifier: z.string().describe("SQL expression that resolves to the actor's ID at runtime"),
  description: z.string().optional().describe("Explains who this actor represents"),
});

/**
 * Access policies define WHO can do WHAT on a table.
 * These get translated into Postgres RLS policies.
 *
 * The condition field uses :actor as a placeholder for the actor's identifier.
 * Example: "org_id = :actor" becomes "org_id = current_setting('app.current_tenant')::uuid"
 */
const AccessPolicySchema = z.object({
  actor: z.string().describe("References an actor defined in database.actors"),
  operations: z.array(z.enum(["SELECT", "INSERT", "UPDATE", "DELETE"])).describe("Which operations this policy allows"),
  condition: z.string().describe("SQL condition using :actor placeholder. Example: 'org_id = :actor'"),
  description: z.string().optional().describe("Explains the business rule this policy enforces"),
});

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE - TABLES
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
  access: z.array(AccessPolicySchema).min(1).describe("At least one access policy required - RLS is mandatory"),
});

const DatabaseSchema = z.object({
  migrations_dir: z.string().optional().default("supabase/migrations/"),
  actors: z.array(ActorSchema).min(1).describe("Define all actors that can access data"),
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
// INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Typed schemas for known integrations.
 * Uses .passthrough() to allow unknown integrations without schema changes.
 *
 * Source of truth: agent-architect/context/tech-docs/
 */

// Transcription
const AssemblyAIIntegrationSchema = z.object({
  api_key: z.string().describe("AssemblyAI API key for transcription"),
});

// Lead enrichment
const ClayIntegrationSchema = z.object({
  api_key: z.string().describe("Clay API key"),
  table_webhook_url: z.string().optional().describe("Webhook URL for Clay table"),
  webhook_secret: z.string().optional().describe("Secret for verifying Clay webhook signatures"),
});

// Semantic search
const ExaAIIntegrationSchema = z.object({
  api_key: z.string().describe("Exa AI API key for semantic search"),
});

// Web scraping
const FirecrawlIntegrationSchema = z.object({
  api_key: z.string().describe("Firecrawl API key"),
});

// AI memory layer
const HonchoIntegrationSchema = z.object({
  api_key: z.string().describe("Honcho API key for AI memory"),
});

// Webhook routing (webhook_secret is for Hookdeck's destination signing)
const HookdeckIntegrationSchema = z.object({
  api_key: z.string().describe("Hookdeck API key"),
  webhook_secret: z.string().optional().describe("Secret for verifying Hookdeck destination signatures"),
});

// Unified CRM/ATS/HRIS integrations
const MergeIntegrationSchema = z.object({
  api_key: z.string().describe("Merge API key for unified integrations"),
  webhook_signing_key: z.string().optional().describe("Key for verifying Merge webhook signatures"),
});

// Browser automation
const ParallelIntegrationSchema = z.object({
  api_key: z.string().describe("Parallel API key for browser automation"),
});

// Visitor identification (inbound webhooks only, auth can also be URL params)
const RB2BIntegrationSchema = z.object({
  webhook_secret: z.string().optional().describe("Secret for custom validation of RB2B webhooks"),
});

// Email sending
const ResendIntegrationSchema = z.object({
  api_key: z.string().describe("Resend API key"),
  webhook_secret: z.string().describe("Secret for verifying Resend webhook signatures"),
  from_domain: z.string().optional().describe("Domain for sending emails, e.g., 'mail.kringle.io'"),
});

// Payments & billing
const StripeIntegrationSchema = z.object({
  secret_key: z.string().describe("Stripe secret key"),
  webhook_secret: z.string().describe("Secret for verifying Stripe webhook signatures"),
});

const IntegrationsSchema = z.object({
  assemblyai: AssemblyAIIntegrationSchema.optional(),
  clay: ClayIntegrationSchema.optional(),
  exaai: ExaAIIntegrationSchema.optional(),
  firecrawl: FirecrawlIntegrationSchema.optional(),
  honcho: HonchoIntegrationSchema.optional(),
  hookdeck: HookdeckIntegrationSchema.optional(),
  merge: MergeIntegrationSchema.optional(),
  parallel: ParallelIntegrationSchema.optional(),
  rb2b: RB2BIntegrationSchema.optional(),
  resend: ResendIntegrationSchema.optional(),
  stripe: StripeIntegrationSchema.optional(),
}).passthrough().optional().describe("External service integrations");

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
    integrations: IntegrationsSchema,
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
  functions: z.array(FunctionSchema).optional(),
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
export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type OutputValidation = z.infer<typeof OutputValidationSchema>;
export type PersistAction = z.infer<typeof PersistActionSchema>;
export type FlowFields = z.infer<typeof FlowFieldsSchema>;
export type Webhook = z.infer<typeof WebhookSchema>;
export type TraditionalWebhook = z.infer<typeof TraditionalWebhookSchema>;
export type InngestFirstWebhook = z.infer<typeof InngestFirstWebhookSchema>;
export type HookdeckConfig = z.infer<typeof HookdeckConfigSchema>;
export type WebhookHandler = z.infer<typeof WebhookHandlerSchema>;
export type Cron = z.infer<typeof CronSchema>;
export type Function = z.infer<typeof FunctionSchema>;
export type FunctionStep = z.infer<typeof FunctionStepSchema>;
export type FunctionConfig = z.infer<typeof FunctionConfigSchema>;
export type SimpleTrigger = z.infer<typeof SimpleTriggerSchema>;
export type FanInTrigger = z.infer<typeof FanInTriggerSchema>;
export type CronTrigger = z.infer<typeof CronTriggerSchema>;
export type RoutingTrigger = z.infer<typeof RoutingTriggerSchema>;
export type Table = z.infer<typeof TableSchema>;
export type Actor = z.infer<typeof ActorSchema>;
export type AccessPolicy = z.infer<typeof AccessPolicySchema>;
export type Integrations = z.infer<typeof IntegrationsSchema>;
export type AssemblyAIIntegration = z.infer<typeof AssemblyAIIntegrationSchema>;
export type ClayIntegration = z.infer<typeof ClayIntegrationSchema>;
export type ExaAIIntegration = z.infer<typeof ExaAIIntegrationSchema>;
export type FirecrawlIntegration = z.infer<typeof FirecrawlIntegrationSchema>;
export type HonchoIntegration = z.infer<typeof HonchoIntegrationSchema>;
export type HookdeckIntegration = z.infer<typeof HookdeckIntegrationSchema>;
export type MergeIntegration = z.infer<typeof MergeIntegrationSchema>;
export type ParallelIntegration = z.infer<typeof ParallelIntegrationSchema>;
export type RB2BIntegration = z.infer<typeof RB2BIntegrationSchema>;
export type ResendIntegration = z.infer<typeof ResendIntegrationSchema>;
export type StripeIntegration = z.infer<typeof StripeIntegrationSchema>;
