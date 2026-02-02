# Resend

Email sending API. Simple, developer-focused.

## When Agent Architect Uses This

- Agents that send emails
- Email template patterns
- Tracking opens/clicks

## Basic Send
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'you@yourdomain.com',
  to: 'recipient@example.com',
  subject: 'Hello',
  html: '<p>Email body</p>',
});
```

## With React Templates
```typescript
import { WelcomeEmail } from './templates/welcome';

await resend.emails.send({
  from: 'you@yourdomain.com',
  to: 'recipient@example.com',
  subject: 'Welcome',
  react: WelcomeEmail({ name: 'Scott' }),
});
```

## Tracking
```typescript
const { data } = await resend.emails.send({
  // ...
  tags: [
    { name: 'campaign_id', value: 'abc123' },
    { name: 'lead_id', value: 'xyz789' },
  ],
});

// data.id = email ID for tracking
```

## Webhooks

Resend can send webhooks for:
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`
- `email.complained`

## Limits

- 100 emails/day on free tier
- 3,000 emails/month on free tier
- Rate limit: 10 requests/second

## Agent Patterns

### Email Drafting vs Sending
```
EmailWriter agent → drafts email → approval.requested
(human approves)
EmailSender agent → sends via Resend → email.sent
```

Never have the drafting agent also send. Separate concerns.

## TODO: Add More

- [ ] Batch sending
- [ ] Scheduled sends
- [ ] Attachment handling
