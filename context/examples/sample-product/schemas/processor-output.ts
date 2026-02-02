import { z } from "zod";

/**
 * Output schema for the Processor agent.
 *
 * Required fields:
 * - success: boolean - whether processing succeeded
 * - error: string (optional) - error message if success is false
 *
 * Agent-specific fields:
 * - summary: brief summary of the analysis
 * - themes: key themes identified
 * - insights: actionable insights found
 * - concerns: potential issues (optional)
 */
export const ProcessorOutputSchema = z.object({
  // Required fields for all agent outputs
  success: z.boolean().describe("Whether the processing succeeded"),
  error: z.string().optional().describe("Error message if success is false"),

  // Agent-specific fields (only present when success is true)
  summary: z.string().optional().describe("Brief summary of the analysis"),
  themes: z.array(z.string()).optional().describe("Key themes identified in the content"),
  insights: z.array(z.string()).optional().describe("Actionable insights from the analysis"),
  concerns: z.array(z.string()).optional().describe("Potential issues or concerns found"),
});

export type ProcessorOutput = z.infer<typeof ProcessorOutputSchema>;
