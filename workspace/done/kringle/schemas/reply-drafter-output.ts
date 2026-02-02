import { z } from "zod";

export const ReplyDrafterOutputSchema = z.object({
  success: z.boolean(),

  // Required for email.send_requested event
  reply_drafted: z.boolean(),
  draft_path: z.string(),

  // Draft content (what Resend needs at send time)
  subject: z.string(),
  html_body: z.string().optional(),
  text_body: z.string().optional(),

  // For preview/logging
  body_preview: z.string().max(500),
  word_count: z.number().int().positive(),

  // Agent metadata - helps understand the reply strategy
  question_type: z.enum([
    "product_differentiation",
    "product_service",
    "process_next_steps",
    "clarifying",
    "interest_signaling",
    "unclear",
    "other"
  ]),
  response_strategy: z.enum([
    "educate_then_soft_cta",
    "direct_answer",
    "clarify_question",
    "acknowledge_and_redirect",
    "provide_resource"
  ]),

  // Error case
  error: z.string().optional(),
});

export type ReplyDrafterOutput = z.infer<typeof ReplyDrafterOutputSchema>;
