import { z } from "zod";

export const EscalationHandlerOutputSchema = z.object({
  success: z.boolean(),

  // What action to take
  action: z.enum([
    "revise_draft",
    "terminate",
    "snooze",
    "schedule_meeting",
    "reply_to_question"
  ]),

  // For revise_draft (emits draft.requested)
  draft_feedback: z.string().optional(),
  email_type: z.string().optional(),

  // For snooze (emits lead.snoozed)
  // Note: Event field is 'snoozed_until', matching manifest
  snoozed_until: z.string().datetime().optional(),
  snooze_reason: z.string().optional(),
  resume_at_phase: z.enum(["reach_out", "eex", "post_eex"]).optional(),

  // For terminate (emits lead.terminated)
  // Note: Event field is 'reason', matching manifest
  reason: z.enum([
    "opt_out",
    "not_interested",
    "bounced",
    "complained",
    "timeout",
    "human_rejected",
    "enrichment_failed",
    "escalated_unresolved"
  ]).optional(),
  terminated_at_phase: z.string().optional(),

  // Agent reasoning
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type EscalationHandlerOutput = z.infer<typeof EscalationHandlerOutputSchema>;
