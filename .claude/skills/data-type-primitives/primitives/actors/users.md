# Users

Human actors who interact with the system.

## Why Users Matter

Users are distinct from organizations—they're the humans who:
- Log in and authenticate
- Get assigned tasks (subtasks where `assigned_to: human`)
- Make approval decisions
- Configure org settings
- Receive notifications

---

## Schema

```yaml
user:
  id: uuid

  # Identity (from auth provider)
  email: string
  name: string?
  avatar_url: string?

  # Authentication
  auth_provider: supabase | google | saml
  auth_provider_id: string        # ID in the auth system

  # Status
  status: active | invited | suspended
  email_verified: boolean

  # Preferences
  preferences: json
    timezone: string
    notification_channels: [email, slack, in_app]

  # Timestamps
  created_at: timestamp
  last_login_at: timestamp?
```

---

## Memberships

Users relate to organizations through memberships:

```yaml
membership:
  id: uuid
  user_id: uuid
  org_id: uuid

  # Role
  role: owner | admin | member | viewer

  # Permissions (role-based or custom)
  permissions: string[]?          # Override role defaults if needed

  # Status
  status: active | invited | removed
  invited_by: uuid?
  invited_at: timestamp?
  accepted_at: timestamp?

  # Context
  is_default: boolean             # Load this org on login
```

### Role Permissions

| Role | Description | Typical Permissions |
|------|-------------|---------------------|
| `owner` | Created the org, full access | All permissions, billing, delete org |
| `admin` | Manages org settings and users | Manage users, templates, integrations |
| `member` | Day-to-day operator | Create/manage campaigns, approve |
| `viewer` | Read-only access | View campaigns, analytics |

---

## Users in Campaigns

When a subtask is `assigned_to: human`, it needs a specific user:

```yaml
subtask:
  name: "Approve campaign"
  assigned_to: human
  assignee_id: user_123           # Specific user
  # OR
  assignee_role: admin            # Any admin in the org
  # OR
  assignee_rule: "campaign.created_by"  # Dynamic assignment
```

### Assignment Rules

| Rule | Meaning |
|------|---------|
| Specific user | `assignee_id: user_xyz` |
| Any with role | `assignee_role: admin` |
| Creator | `assignee_rule: campaign.created_by` |
| Round-robin | `assignee_rule: round_robin(role: member)` |
| Least busy | `assignee_rule: least_assignments(role: member)` |

---

## Mapping to Manifest

### Database Tables

```yaml
database:
  tables:
    - name: users
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: email, type: text, unique: true }
        - { name: name, type: text }
        - { name: auth_provider, type: text }
        - { name: auth_provider_id, type: text }
        - { name: status, type: text, default: "active" }
        - { name: preferences, type: jsonb, default: "{}" }
        - { name: created_at, type: timestamptz, default: "now()" }
      access:
        - actor: authenticated_user
          operations: [SELECT, UPDATE]
          condition: "id = :actor"
          description: "Users can read/update their own profile"

    - name: memberships
      columns:
        - { name: id, type: uuid, primary: true }
        - { name: user_id, type: uuid, references: users.id }
        - { name: org_id, type: uuid, references: organizations.id }
        - { name: role, type: text }
        - { name: status, type: text, default: "invited" }
        - { name: is_default, type: boolean, default: false }
      access:
        - actor: tenant
          operations: [SELECT]
          condition: "org_id = :actor"
          description: "Org members can see other members"
        - actor: authenticated_user
          operations: [SELECT, UPDATE]
          condition: "user_id = :actor"
          description: "Users can see/update their own memberships"

  actors:
    - name: authenticated_user
      identifier: "auth.uid()"
      description: "The logged-in user from Supabase Auth"
```

### Supabase Auth Integration

```yaml
# Users table syncs with Supabase Auth
triggers:
  - name: sync_auth_user
    on: auth.users INSERT
    action: |
      INSERT INTO public.users (id, email, auth_provider, auth_provider_id)
      VALUES (NEW.id, NEW.email, 'supabase', NEW.id::text)
```

---

## Events

| Event | When |
|-------|------|
| `user.created` | New user registered |
| `user.invited` | User invited to org |
| `user.accepted_invite` | User joined org |
| `user.role_changed` | Role updated |
| `user.task_assigned` | Subtask assigned to user |
| `user.task_completed` | User completed subtask |

---

## Notifications

Users receive notifications through configured channels:

```yaml
notification:
  user_id: uuid
  channel: email | slack | in_app
  type: task_assigned | task_due | campaign_approved | etc.
  payload: json
  sent_at: timestamp?
  read_at: timestamp?
```

Common notification triggers:
- Subtask assigned (`assigned_to: human`, `assignee_id: this_user`)
- Subtask approaching due date
- Campaign requires approval
- Error requiring attention
