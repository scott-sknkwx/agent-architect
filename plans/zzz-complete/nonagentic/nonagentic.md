# Plan: Non-Agentic Function Generation for agent-factory

## Executive Summary

The `agent-factory` framework generates Inngest functions only for AI agents, leaving a gap: the "plumbing" functions that connect events together without AI involvement. This plan addresses how to extend the framework to generate these non-agentic functions from manifest declarations.

---

## Current State Analysis

### What Exists

| Component | Status | Location |
|-----------|--------|----------|
| Event definitions | ✅ 58 events | `manifest.yaml` events section |
| State machine | ✅ 48 states | `manifest.yaml` state_machine section |
| Agent functions | ✅ 4 agents | Generated via `inngest-function.hbs` |
| Webhook definitions | ⚠️ Partial | Routes defined, no handlers generated |
| Cron definitions | ⚠️ Partial | Schedules defined, no functions generated |
| Response routing | ✅ Defined | `platform-campaign-template.yaml` |
| Timing config | ✅ Defined | `platform-campaign-template.yaml` |

### What's Missing

1. **No `functions:` section in manifest** - No place to declare non-agentic functions
2. **No handler generation for webhooks** - Transform files referenced but not generated
3. **No handler generation for crons** - Function names referenced but not generated
4. **No event-to-event bridge functions** - Glue between events not declarable
5. **No external API call functions** - Clay, Firecrawl, Resend integrations not generated

---

## Gap Analysis: Manifest Detail Assessment

### Sufficient Detail Available

| Function Type | Required Info | Available In Manifest? |
|--------------|---------------|------------------------|
| Webhook handlers | path, auth, emits, transform | ✅ Yes |
| Lead ingestion | event payloads, db schema | ✅ Yes |
| Approval workflow | timing, reminders, escalation | ✅ Yes (template) |
| Response routing | classification → action mapping | ✅ Yes (template) |
| Snooze management | duration rules, wake conditions | ✅ Yes (template) |
| Timeout detection | phase timing, wait periods | ✅ Yes (template) |
| State transitions | from/to states, terminal flags | ✅ Yes |

### Needs Additional Detail

| Function Type | Missing Info | Recommendation |
|--------------|--------------|----------------|
| Clay enrichment | API endpoint, request format, auth | Add `integrations:` section |
| Firecrawl scraping | API endpoint, request format, auth | Add `integrations:` section |
| Resend email sending | API key location, template format | Add `integrations:` section |
| Campaign creation | Template merge logic | Can infer from existing patterns |
| Analytics aggregation | Metrics to compute | Add to `lead.journey_completed` event or separate config |

---

## Proposed Manifest Schema Extension

### New `functions:` Section

```yaml
functions:
  # ─────────────────────────────────────────────────────────────────────────
  # SIMPLE EVENT HANDLERS
  # ─────────────────────────────────────────────────────────────────────────
  - name: ingest-lead
    description: "Parse RB2B webhook and create lead record"
    trigger: webhook.received
    emits:
      - event: lead.ingested
      - event: enrichment.started
        when: "lead.email != null"
    actions:
      - type: upsert
        table: leads
        on_conflict: ["organization_id", "fingerprint"]
      - type: update_state
        to: ingested

  # ─────────────────────────────────────────────────────────────────────────
  # EXTERNAL API CALLS
  # ─────────────────────────────────────────────────────────────────────────
  - name: request-clay-enrichment
    description: "Send enrichment request to Clay"
    trigger: enrichment.started
    emits:
      - event: clay/enrichment.requested
    actions:
      - type: api_call
        integration: clay
        endpoint: "/enrichment"
        method: POST
        body_from_event: true
        callback_event: clay/enrichment.completed

  - name: request-firecrawl-scrape
    description: "Scrape company homepage via Firecrawl"
    trigger: clay/enrichment.completed
    emits:
      - event: firecrawl/scrape.requested
    actions:
      - type: api_call
        integration: firecrawl
        endpoint: "/scrape"
        method: POST
        body:
          url: "{{ event.company_url }}"
        callback_event: lead.scraped

  # ─────────────────────────────────────────────────────────────────────────
  # ORCHESTRATION (FAN-IN)
  # ─────────────────────────────────────────────────────────────────────────
  - name: consolidate-enrichment
    description: "Wait for Clay + Firecrawl, then emit lead.enriched"
    trigger:
      all_of:
        - clay/enrichment.completed
        - lead.scraped
      correlation_key: "lead_id"
    emits:
      - event: lead.enriched
    actions:
      - type: update_state
        to: enriched

  # ─────────────────────────────────────────────────────────────────────────
  # STATE TRANSITION HANDLERS
  # ─────────────────────────────────────────────────────────────────────────
  - name: create-campaign
    description: "Create campaign from matched lead"
    trigger: lead.match_passed
    emits:
      - event: campaign.created
      - event: reach_out.started
    actions:
      - type: insert
        table: campaigns
        data:
          template_snapshot: "{{ merge_templates(persona_id) }}"
      - type: update_state
        to: campaign_created

  # ─────────────────────────────────────────────────────────────────────────
  # APPROVAL WORKFLOW
  # ─────────────────────────────────────────────────────────────────────────
  - name: request-approval
    description: "Create approval record when draft completes"
    trigger: draft.completed
    emits:
      - event: approval.requested
    actions:
      - type: insert
        table: approvals
        data:
          status: pending
          approver_user_id: "{{ persona.owner_user_id }}"
      - type: update_state
        to: pending_approval

  - name: send-email-on-approval
    description: "Send email via Resend when approved"
    trigger: approval.approved
    emits:
      - event: email.send_requested
      - event: email.sent
        delay: "after_api_response"
    actions:
      - type: api_call
        integration: resend
        endpoint: "/emails"
        method: POST
        body:
          to: "{{ lead.email }}"
          subject: "{{ draft.subject }}"
          html: "{{ draft.body }}"
      - type: update
        table: email_events
        set:
          resend_message_id: "{{ response.id }}"
          sent_at: "{{ now() }}"
      - type: update_state
        to: sent

  # ─────────────────────────────────────────────────────────────────────────
  # RESPONSE ROUTING
  # ─────────────────────────────────────────────────────────────────────────
  - name: route-triage-result
    description: "Route triage classification to appropriate action"
    trigger: triage.completed
    routing:
      source: "{{ campaign.current_phase }}"
      config_path: "platform-campaign-template.yaml#response_handling"
    # Emits determined by routing rules in config

  # ─────────────────────────────────────────────────────────────────────────
  # TIMERS & DELAYS
  # ─────────────────────────────────────────────────────────────────────────
  - name: start-response-timer
    description: "Start timer after email sent"
    trigger: email.sent
    emits:
      - event: timeout.response_wait
        delay: "{{ phase_timing.max_wait_for_response }}"
        cancel_on:
          - email.replied
          - lead.terminated

  # ─────────────────────────────────────────────────────────────────────────
  # CRON FUNCTIONS
  # ─────────────────────────────────────────────────────────────────────────
  - name: check-pending-approvals
    description: "Send reminders for pending approvals"
    trigger: cron.approval-reminder
    query:
      table: approvals
      where:
        status: pending
        last_reminder_at: "< {{ now() - approval.reminder_interval }}"
        reminder_count: "< {{ approval.max_reminders }}"
    for_each:
      - type: send_notification
        channel: email
        template: approval_reminder
      - type: update
        table: approvals
        set:
          reminder_count: "{{ reminder_count + 1 }}"
          last_reminder_at: "{{ now() }}"
      - type: emit
        event: approval.reminder

  - name: process-snoozed-leads
    description: "Wake up snoozed leads"
    trigger: cron.snooze-wakeup
    query:
      table: leads
      where:
        current_state: snoozed
        snoozed_until: "< {{ now() }}"
    for_each:
      - type: emit
        event: "{{ snooze.resume_at_phase }}.started"
      - type: update_state
        to: "{{ snooze.resume_at_phase }}_drafting"
```

### New `integrations:` Section

```yaml
integrations:
  clay:
    type: api
    base_url: "${CLAY_API_URL}"
    auth:
      type: api_key
      header: "Authorization"
      value: "Bearer ${CLAY_API_KEY}"
    timeout: 30000
    retry:
      max_attempts: 3
      backoff: exponential

  firecrawl:
    type: api
    base_url: "${FIRECRAWL_API_URL}"
    auth:
      type: api_key
      header: "Authorization"
      value: "Bearer ${FIRECRAWL_API_KEY}"
    timeout: 60000
    retry:
      max_attempts: 2
      backoff: exponential

  resend:
    type: api
    base_url: "https://api.resend.com"
    auth:
      type: api_key
      header: "Authorization"
      value: "Bearer ${RESEND_API_KEY}"
    timeout: 10000
    retry:
      max_attempts: 3
      backoff: exponential
```

---

## Implementation Plan

### Phase 1: Schema Extension
**Goal**: Extend manifest schema to support non-agentic function declarations

1. Update `src/manifest/schema.ts`:
   - Add `FunctionSchema` for non-agentic functions
   - Add `IntegrationSchema` for external API configs
   - Add `ActionSchema` for declarative actions (upsert, update, api_call, emit)
   - Add `RoutingSchema` for config-driven event routing
   - Update `ManifestSchema` to include `functions` and `integrations`

2. Update manifest parser to validate new sections

### Phase 2: Function Template
**Goal**: Create Handlebars template for non-agentic functions

1. Create `templates/function.hbs`:
   - Simpler than `inngest-function.hbs` (no workspace, no AI)
   - Pattern: trigger → validate → execute actions → emit
   - Support for:
     - Database operations (upsert, update, insert)
     - External API calls with retry
     - Event emission (immediate, delayed, conditional)
     - State transitions

2. Create `templates/cron-function.hbs`:
   - Query-based batch processing
   - For-each iteration pattern

### Phase 3: Generator Updates
**Goal**: Generate non-agentic functions alongside agent functions

1. Update `src/commands/init.ts`:
   - Add loop for `manifest.functions` similar to `manifest.agents`
   - Generate function files to `inngest/functions/`
   - Update Inngest route to include non-agentic functions

2. Create `src/generators/function.ts`:
   - Template data preparation for non-agentic functions
   - Action code generation

3. Update `generateInngestRoute()`:
   - Include both agent functions and non-agentic functions

### Phase 4: Supporting Infrastructure
**Goal**: Generate helpers for actions

1. Create `lib/integrations.ts`:
   - API client factory based on integration config
   - Retry logic
   - Error handling

2. Create `lib/routing.ts`:
   - Config-driven event routing
   - Load rules from YAML

3. Create `lib/actions.ts`:
   - Reusable action executors (db ops, api calls, state updates)

### Phase 5: Validation & Testing
**Goal**: Ensure generated functions are correct

1. Schema validation:
   - Events referenced in triggers must exist
   - Events referenced in emits must exist
   - State transitions must be valid per state machine
   - Integrations referenced must be defined

2. Generate test stubs for each function

---

## Function Categories to Generate

### Category 1: Webhook Handlers (3 functions)
```
rb2b-webhook-handler      : webhook.received → lead.ingested
clay-callback-handler     : Resend webhook → clay/enrichment.completed
resend-webhook-handler    : Resend webhook → email.* events
```

### Category 2: Ingestion Pipeline (4 functions)
```
ingest-lead               : webhook.received → lead.ingested, enrichment.started
request-clay-enrichment   : enrichment.started → clay/enrichment.requested
request-firecrawl-scrape  : clay/enrichment.completed → firecrawl/scrape.requested
consolidate-enrichment    : [clay + firecrawl] → lead.enriched
```

### Category 3: Campaign & Drafting (3 functions)
```
create-campaign           : lead.match_passed → campaign.created
start-phase               : campaign.created, eex.started, etc. → draft.requested
request-revision          : approval.rejected → draft.requested (with feedback)
```

### Category 4: Approval Workflow (4 functions)
```
request-approval          : draft.completed → approval.requested
auto-approve-eex          : draft.completed (eex_2-5) → approval.approved
send-email-on-approval    : approval.approved → email.send_requested → email.sent
handle-approval-timeout   : approval.timeout → lead.escalated
```

### Category 5: Email Delivery (1 function)
```
process-resend-webhook    : Resend events → email.delivered/opened/clicked/bounced/complained
```

### Category 6: Response Routing (4 functions)
```
route-triage-result       : triage.completed → response.* events
handle-accept-gift        : response.accept_gift → eex.started
handle-meeting-request    : response.request_meeting → meeting.requested
handle-snooze             : response.delayed → lead.snoozed
```

### Category 7: Timers & Timeouts (3 functions)
```
start-response-timer      : email.sent → timeout.response_wait (delayed)
handle-response-timeout   : timeout.response_wait → phase timeout
cancel-timer-on-response  : email.replied → cancel pending timeout
```

### Category 8: Cron Functions (3 functions)
```
check-pending-approvals   : cron → approval.reminder / approval.timeout
process-snoozed-leads     : cron → resume events
check-response-timeouts   : cron → timeout.response_wait
```

### Category 9: Lifecycle (3 functions)
```
terminate-lead            : various → lead.terminated → lead.journey_completed
archive-lead              : lead.match_failed → lead.archived → lead.journey_completed
convert-lead              : meeting.booked → lead.converted → lead.journey_completed
```

### Category 10: Analytics (1 function)
```
aggregate-journey         : lead.journey_completed → journey_analytics insert
```

**Total: ~29 non-agentic functions**

---

## Recommended Manifest Additions

Before implementing, the kringle manifest needs:

### 1. `integrations:` Section (Required)
```yaml
integrations:
  clay:
    type: api
    base_url: "${CLAY_API_URL}"
    auth: { type: api_key, header: "Authorization", value: "Bearer ${CLAY_API_KEY}" }
  firecrawl:
    type: api
    base_url: "${FIRECRAWL_API_URL}"
    auth: { type: api_key, header: "Authorization", value: "Bearer ${FIRECRAWL_API_KEY}" }
  resend:
    type: api
    base_url: "https://api.resend.com"
    auth: { type: api_key, header: "Authorization", value: "Bearer ${RESEND_API_KEY}" }
```

### 2. `functions:` Section (Required)
Define all ~29 non-agentic functions using the schema proposed above.

### 3. Merge `platform-campaign-template.yaml` into manifest (Optional)
The timing, approval, and response routing rules could be:
- Kept as separate file (referenced by path)
- Embedded in manifest under `config:` section

Recommendation: Keep separate for maintainability, but add schema validation.

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/manifest/schema.ts` | Modify | Add FunctionSchema, IntegrationSchema, ActionSchema |
| `src/commands/init.ts` | Modify | Generate non-agentic functions |
| `src/generators/function.ts` | Create | Non-agentic function generator |
| `templates/function.hbs` | Create | Non-agentic function template |
| `templates/cron-function.hbs` | Create | Cron function template |
| `lib/integrations.ts` | Generate | API client factory |
| `lib/routing.ts` | Generate | Config-driven routing |
| `lib/actions.ts` | Generate | Reusable action executors |

---

## Next Steps

1. **User Decision**: Approve schema extension approach
2. **Add to kringle manifest**: `integrations:` section
3. **Add to kringle manifest**: `functions:` section (29 functions)
4. **Implement Phase 1**: Schema extension
5. **Implement Phase 2-3**: Templates and generators
6. **Validate**: Generate kringle project and verify functions

---

## Open Questions

1. **Fan-in pattern**: Should `consolidate-enrichment` use Inngest's `waitForEvent` or a separate coordination mechanism?

2. **Timer cancellation**: How should delayed events be cancelled? Options:
   - Inngest step cancellation API
   - Idempotency check at execution time
   - Database flag check

3. **Routing complexity**: Should complex routing (like response handling) be:
   - Inline in function definition
   - Reference to external config file
   - Generated as a routing function that reads config at runtime

4. **Testing strategy**: Should the generator produce:
   - Just the functions (user writes tests)
   - Function stubs + test templates
   - Full test suite with mocks
