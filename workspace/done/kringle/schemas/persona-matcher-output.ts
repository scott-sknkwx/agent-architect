import { z } from "zod";

const PersonaScoreSchema = z.object({
  persona_id: z.string().uuid(),
  persona_name: z.string(),
  score: z.number().min(0).max(1),
  passed_threshold: z.boolean(),
});

export const PersonaMatcherOutputSchema = z.object({
  success: z.boolean(),
  matched: z.boolean(),

  // If matched (lead.match_passed event)
  persona_id: z.string().uuid().nullable(),
  persona_name: z.string().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),

  // If not matched (lead.match_failed event)
  // Maps to event payload field 'reason'
  reason: z.enum(["no_match", "insufficient_data"]).nullable(),

  // Always present
  // Note: Event expects JSON string, but we store as array and serialize at emit time
  scores: z.array(PersonaScoreSchema),
  agent_reasoning: z.string(),

  // Error case
  error: z.string().optional(),
});

export type PersonaMatcherOutput = z.infer<typeof PersonaMatcherOutputSchema>;
