# Function: ingest-resend-inbound-webhook

| Property | Value |
|----------|-------|
| Complexity | Simple |
| Pattern | inngest-first-webhook |
| Phase | In Flight → Response Handling |
| Status | Spec Complete |

## Purpose

Process inbound emails received via Resend's inbound webhook. Parse the reply content, strip signatures and quoted text, look up the original thread, and emit `email.replied` for response triage.

## Trigger

**Type:** Event
**Event:** `webhook/resend-inbound.received`
**Source:** Hookdeck transformation of Resend inbound webhook

## Input

**Event Payload:**
```typescript
{
  raw: ResendInboundPayload;
  headers: Record<string, string>;
  received_at: string;
}
```

**Resend Inbound Structure:**
```typescript
{
  from: string;              // Sender email
  to: string;                // Our receiving address
  subject: string;
  text?: string;             // Plain text body
  html?: string;             // HTML body
  headers: {
    'message-id': string;
    'in-reply-to'?: string;  // References our original email
    'references'?: string;
  };
  attachments?: Array<{
    filename: string;
    content: string;  // base64
    content_type: string;
  }>;
}
```

## Output

### Events Emitted

| Event | When | Payload |
|-------|------|---------|
| `email.replied` | Valid reply with thread found | `{ campaign_item_id, lead_id, organization_id, reply_content, trace_id }` |

### Return Value

```typescript
{
  success: boolean;
  campaign_item_id?: string;
  skipped_reason?: string;
}
```

## Implementation Steps

### Step 1: validate
**Primitive:** `step.run()`

Parse and validate inbound email payload.

### Step 2: parse-reply
**Primitive:** `step.run()`

Extract reply content from `text` or `html` body:
1. Prefer `text` if available (cleaner)
2. Fall back to `html` with HTML stripping
3. Strip email signatures (lines starting with `--` or common patterns)
4. Strip quoted text (lines starting with `>` or `On ... wrote:` patterns)

```typescript
const replyContent = stripSignatureAndQuotes(payload.text || htmlToText(payload.html));
```

### Step 3: lookup-thread
**Primitive:** `step.run()`

Find the campaign_item this is replying to using `In-Reply-To` header:

```typescript
const inReplyTo = payload.headers['in-reply-to'];
const { data: item } = await db
  .from('campaign_items')
  .select('id, lead_id, campaign_id, campaigns(organization_id)')
  .eq('resend_message_id', extractMessageId(inReplyTo))
  .single();
```

If `In-Reply-To` not found, try matching by `from` email to lead's email.

### Step 4: emit-replied
**Primitive:** `step.sendEvent()`

```typescript
await step.sendEvent('emit-replied', {
  name: 'kringle/email.replied',
  data: {
    campaign_item_id: item.id,
    lead_id: item.lead_id,
    organization_id: item.campaigns.organization_id,
    reply_content: replyContent,
    raw_subject: payload.subject,
    has_attachments: (payload.attachments?.length ?? 0) > 0,
    trace_id,
  },
});
```

## Database Operations

### Read: `campaign_items`

| Field | Type | Notes |
|-------|------|-------|
| `resend_message_id` | string | Match against In-Reply-To header |

### Read: `leads` (fallback)

| Field | Type | Notes |
|-------|------|-------|
| `email` | string | Match against `from` address if In-Reply-To fails |

## Error Handling

| Error | Type | Behavior |
|-------|------|----------|
| Invalid payload | `NonRetriableError` | Don't retry |
| Thread not found | Expected | Log, skip (unsolicited email) |
| Parse failure | `NonRetriableError` | Log content for debugging |

## Notes

- **Reply parsing is imperfect**: Different email clients format replies differently
- **Attachments**: Currently noted but not processed; future enhancement
- **Sender verification**: Match `from` against lead's known email for security

## Test Cases

### Test 1: Valid Reply to Campaign Email

**Setup:**
- Send inbound email with In-Reply-To matching known campaign_item
- Plain text body with reply content

**Expected Events:**
```typescript
[{ name: "email.replied", data: { reply_content: "Thanks, I'm interested!" } }]
```

### Test 2: Reply with Quoted Text

**Setup:**
```
Thanks for reaching out!

On Jan 15, 2025 at 10:00 AM, sales@acme.com wrote:
> Hi John, I wanted to share...
```

**Expected:** `reply_content` = "Thanks for reaching out!" (quotes stripped)

### Test 3: Unknown Thread

**Setup:** Inbound email with no matching In-Reply-To
**Expected:** Return `{ success: true, skipped_reason: "thread_not_found" }`

## Related Functions

### Downstream

| Event Emitted | Handler | What Happens |
|---------------|---------|--------------|
| `email.replied` | `response-triager` (agent) | Classifies reply intent |
