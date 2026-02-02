import { z } from "zod";

export const ResponseTriagerOutputSchema = z.object({
  success: z.boolean(),

  // Classification result
  classification: z.enum([
    "accept_gift",
    "request_meeting",
    "delayed",
    "opt_out",
    "not_interested",
    "question",
    "continue",
    "unclear"
  ]),
  sentiment: z.enum(["positive", "negative", "neutral"]),

  // Action guidance
  recommended_action: z.string(),

  // For delayed responses
  snooze_until: z.string().datetime().optional(),
  snooze_reason: z.string().optional(),

  // For question responses
  question_summary: z.string().optional(),

  // Agent reasoning
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type ResponseTriagerOutput = z.infer<typeof ResponseTriagerOutputSchema>;
