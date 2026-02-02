import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// MINIMAL FUNCTION SCHEMA
// Just enough to generate scaffolds with rich comments
// ═══════════════════════════════════════════════════════════════════════════

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
  cron: z.string(),        // References crons[].name
  schedule: z.string(),    // Cron expression for documentation
});

const RoutingTriggerSchema = z.object({
  event: z.string(),
  route_on: z.string(),    // Field name in event.data
  routes: z.record(z.string(), z.object({
    emit: z.string(),
    then: z.string().optional(),  // Follow-up event (e.g., lead.terminated)
  })),
  default_route: z.string().optional(),
});

const FunctionTriggerSchema = z.union([
  SimpleTriggerSchema,
  FanInTriggerSchema,
  CronTriggerSchema,
  RoutingTriggerSchema,
]);

// ═══════════════════════════════════════════════════════════════════════════
// FUNCTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

export const FunctionSchema = z.object({
  name: z.string(),
  description: z.string(),
  pattern: z.enum(["simple", "fan-in", "cron", "routing"]),
  trigger: FunctionTriggerSchema,
  emits: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),        // Free-text descriptions
  integrations: z.array(z.string()).optional(),   // Names for documentation
  context: z.string().optional(),                 // Notes for implementing agent
  open_questions: z.array(z.string()).optional(), // Questions to resolve
});

export const FunctionsArraySchema = z.array(FunctionSchema);
export type FunctionDefinition = z.infer<typeof FunctionSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED WEBHOOK SCHEMA
// ═══════════════════════════════════════════════════════════════════════════

const WebhookHandlerSchema = z.object({
  validation: z.array(z.string()).optional(),   // Free-text validation steps
  transform: z.array(z.string()).optional(),    // Free-text transform steps
});

export const WebhookSchema = z.object({
  name: z.string(),
  path: z.string(),
  auth: z.enum(["hmac", "api_key", "bearer", "none"]),
  secret: z.string().optional(),
  emits: z.string(),
  handler: WebhookHandlerSchema.optional(),     // NEW
  description: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Detect pattern from trigger shape
// ═══════════════════════════════════════════════════════════════════════════

export function detectPattern(trigger: z.infer<typeof FunctionTriggerSchema>): string {
  if ("wait_for" in trigger) return "fan-in";
  if ("cron" in trigger) return "cron";
  if ("route_on" in trigger) return "routing";
  return "simple";
}
