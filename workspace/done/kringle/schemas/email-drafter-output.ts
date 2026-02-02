import { z } from "zod";

export const EmailDrafterOutputSchema = z.object({
  success: z.boolean(),

  // Required for draft.completed event
  draft_path: z.string(),
  draft_version: z.number().int().positive(),
  email_type: z.enum([
    "initial_outreach",
    "reach_out_followup",
    "eex_1", "eex_2", "eex_3", "eex_4", "eex_5",
    "post_eex_initial",
    "post_eex_followup",
    "reply"
  ]),

  // Draft content (what Resend needs at send time)
  subject: z.string(),
  html_body: z.string(),
  text_body: z.string().optional(),

  // For approval UI
  body_preview: z.string().max(500),

  // Agent metadata
  personalization_applied: z.array(z.string()),
  revision_incorporated: z.boolean().optional(),

  // Error case
  error: z.string().optional(),
});

export type EmailDrafterOutput = z.infer<typeof EmailDrafterOutputSchema>;
