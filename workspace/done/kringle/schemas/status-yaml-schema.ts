import { z } from "zod";

/**
 * Status YAML Schema (Bill of Materials)
 *
 * This is the traveling context document for each lead.
 * It records everything about the lead's journey through the Kringle system.
 *
 * Storage: Supabase Storage at leads/{org_id}/{lead_id}/status.yaml
 * Updated: By Ingest after each agent completes and after each event
 */

// ═══════════════════════════════════════════════════════════════════════════════
// META SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const MetaSchema = z.object({
  lead_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  version: z.number().int().positive(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// POSITION SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const PositionSchema = z.object({
  current_phase: z.enum([
    "ingestion",
    "matching",
    "campaign",
    "reach_out",
    "eex",
    "post_eex",
    "outcome",
    "complete"
  ]),
  current_state: z.string(), // Maps to state_machine states
  current_step: z.string().nullable(),
  next_event_expected: z.string().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ENRICHMENT SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EnrichmentSchema = z.object({
  status: z.enum(["pending", "in_progress", "complete", "partial", "failed"]),
  source_webhook: z.string(),
  firecrawl: z.object({
    status: z.enum(["pending", "complete", "failed", "skipped"]),
    company_url: z.string().url().nullable(),
    homepage_context_path: z.string().nullable(),
    completed_at: z.string().datetime().nullable(),
  }).nullable(),
  clay: z.object({
    status: z.enum(["pending", "complete", "failed"]),
    email: z.string().email().nullable(),
    title: z.string().nullable(),
    linkedin_url: z.string().url().nullable(),
    company_name: z.string().nullable(),
    company_size: z.string().nullable(),
    industry: z.string().nullable(),
    funding_stage: z.string().nullable(),
    completed_at: z.string().datetime().nullable(),
  }).nullable(),
  completed_at: z.string().datetime().nullable(),
  failure_reason: z.string().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONA MATCHING SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const PersonaScoreSchema = z.object({
  persona_id: z.string().uuid(),
  persona_name: z.string(),
  score: z.number().min(0).max(1),
  passed_threshold: z.boolean(),
});

const PersonaMatchingSchema = z.object({
  status: z.enum(["pending", "matched", "no_match", "insufficient_data"]),
  evaluated_personas: z.array(PersonaScoreSchema),
  matched_persona_id: z.string().uuid().nullable(),
  matched_persona_name: z.string().nullable(),
  confidence_score: z.number().min(0).max(1).nullable(),
  agent_reasoning: z.string().nullable(),
  completed_at: z.string().datetime().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// CAMPAIGN SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EmailRecordSchema = z.object({
  email_id: z.string().uuid(),
  email_type: z.string(),
  draft_version: z.number().int().positive(),
  draft_path: z.string().nullable(),
  subject: z.string().nullable(),
  body_preview: z.string().nullable(),
  status: z.enum(["drafted", "pending_approval", "approved", "rejected", "sent", "delivered", "opened", "clicked", "bounced", "complained"]),
  drafted_at: z.string().datetime().nullable(),
  approved_at: z.string().datetime().nullable(),
  approved_by: z.string().nullable(),
  sent_at: z.string().datetime().nullable(),
  resend_message_id: z.string().nullable(),
});

const CampaignSchema = z.object({
  campaign_id: z.string().uuid(),
  persona_id: z.string().uuid(),
  template_source: z.string(),
  current_phase: z.enum(["reach_out", "eex", "post_eex", "complete"]),
  eex_step: z.number().int().min(0).nullable(),
  eex_steps_total: z.number().int().positive().nullable(),
  emails: z.array(EmailRecordSchema),
  created_at: z.string().datetime(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPROVALS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const ApprovalRecordSchema = z.object({
  approval_id: z.string().uuid(),
  email_type: z.string(),
  draft_version: z.number().int().positive(),
  status: z.enum(["pending", "approved", "rejected", "timeout"]),
  requested_at: z.string().datetime(),
  approver_id: z.string(),
  reminder_count: z.number().int().min(0),
  approved_at: z.string().datetime().nullable(),
  rejected_at: z.string().datetime().nullable(),
  feedback: z.string().nullable(),
  modifications: z.string().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSES SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const ResponseRecordSchema = z.object({
  response_id: z.string().uuid(),
  received_at: z.string().datetime(),
  in_reply_to_email_type: z.string(),
  in_reply_to_message_id: z.string(),
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
  recommended_action: z.string(),
  raw_snippet: z.string(),
  agent_reasoning: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ESCALATIONS SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EscalationRecordSchema = z.object({
  escalation_id: z.string().uuid(),
  reason: z.string(),
  escalated_at: z.string().datetime(),
  escalated_to: z.string(),
  status: z.enum(["pending", "resolved"]),
  resolved_at: z.string().datetime().nullable(),
  resolved_by: z.string().nullable(),
  resolution_action: z.string().nullable(),
  resolution_notes: z.string().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// SNOOZE SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const SnoozeSchema = z.object({
  status: z.enum(["active", "snoozed"]),
  snoozed_at: z.string().datetime().nullable(),
  snoozed_until: z.string().datetime().nullable(),
  reason: z.string().nullable(),
  snoozed_by: z.enum(["agent", "human"]).nullable(),
  resume_at_phase: z.enum(["reach_out", "eex", "post_eex"]).nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// REJECTION SECTION (Human rejects lead at any point)
// ═══════════════════════════════════════════════════════════════════════════════

const RejectionRecordSchema = z.object({
  rejected_at: z.string().datetime(),
  rejected_by: z.string(),
  rejected_at_phase: z.string(),
  rejected_at_step: z.string().nullable(),
  feedback: z.string(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// OUTCOME SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const OutcomeSchema = z.object({
  status: z.enum(["in_progress", "converted", "terminated", "archived"]),
  reason: z.string().nullable(),
  meeting_id: z.string().uuid().nullable(),
  meeting_datetime: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTS LOG SECTION
// ═══════════════════════════════════════════════════════════════════════════════

const EventLogEntrySchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.string(), z.any()).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// FULL STATUS YAML SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const StatusYamlSchema = z.object({
  meta: MetaSchema,
  position: PositionSchema,
  enrichment: EnrichmentSchema,
  persona_matching: PersonaMatchingSchema,
  campaign: CampaignSchema.nullable(),
  approvals: z.array(ApprovalRecordSchema),
  responses: z.array(ResponseRecordSchema),
  escalations: z.array(EscalationRecordSchema),
  snooze: SnoozeSchema,
  rejection: RejectionRecordSchema.nullable(),
  outcome: OutcomeSchema,
  events_log: z.array(EventLogEntrySchema),
});

export type StatusYaml = z.infer<typeof StatusYamlSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// INITIAL STATUS YAML TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export function createInitialStatusYaml(
  leadId: string,
  organizationId: string,
  capturedUrl: string
): StatusYaml {
  const now = new Date().toISOString();

  return {
    meta: {
      lead_id: leadId,
      organization_id: organizationId,
      created_at: now,
      updated_at: now,
      version: 1,
    },
    position: {
      current_phase: "ingestion",
      current_state: "ingested",
      current_step: null,
      next_event_expected: "enrichment.started",
    },
    enrichment: {
      status: "pending",
      source_webhook: "rb2b",
      firecrawl: null,
      clay: null,
      completed_at: null,
      failure_reason: null,
    },
    persona_matching: {
      status: "pending",
      evaluated_personas: [],
      matched_persona_id: null,
      matched_persona_name: null,
      confidence_score: null,
      agent_reasoning: null,
      completed_at: null,
    },
    campaign: null,
    approvals: [],
    responses: [],
    escalations: [],
    snooze: {
      status: "active",
      snoozed_at: null,
      snoozed_until: null,
      reason: null,
      snoozed_by: null,
      resume_at_phase: null,
    },
    rejection: null,
    outcome: {
      status: "in_progress",
      reason: null,
      meeting_id: null,
      meeting_datetime: null,
      completed_at: null,
    },
    events_log: [
      {
        event: "lead.ingested",
        timestamp: now,
        data: { captured_url: capturedUrl },
      },
    ],
  };
}
