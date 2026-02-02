# Event Design Patterns

## Naming Convention

Events follow `noun.verb` pattern in past tense:

Good:
- lead.received
- lead.matched
- campaign.planned
- approval.requested
- approval.granted
- email.sent

Bad:
- processLead (verb first)
- lead_received (snake_case)
- LeadMatched (PascalCase)

## Payload Design

Every event payload should have:
```yaml
payload:
  entity_id:
    type: string
    required: true
  org_id:
    type: string
    required: true
  trace_id:
    type: string
    required: true
```

## Event Granularity

Too coarse: `lead.processed` (what happened?)
Too fine: `lead.email.draft.sentence.written`
Just right: `lead.matched`, `lead.qualified`, `campaign.step.completed`
