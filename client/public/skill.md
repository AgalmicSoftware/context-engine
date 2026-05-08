# Context Engine Agent Skill

Use the human web UI for direct review, wallet/passkey decisions, and final approvals. Use the agent HTTP interface for structured reads, drafts, approval requests, and managed demo-account setup.

The canonical agent surface is `/api/agent/*`. Telegram, OpenClaw, MCP, and local helpers are adapters; they must not invent separate agent dialects.

## Security Rules

- Never place session payloads, question payloads, answer text, grants, JWTs, private keys, worker tokens, seed phrases, or account material in Telegram callbacks, deep-link payloads, CloudStorage, Mini App payloads, or chat state.
- Treat Telegram group chat as the public lobby. Use private chat with the same bot for account setup and actions.
- Group-card deep links must carry only opaque action IDs. Resolve group, session, and question context server-side.
- Do not request raw key export. Do not expect passkey, Porto, wallet, or CE-CC local accounts to sign remotely.
- Scoped delegated execution is only available where a safe authority boundary exists, such as a managed demo/testnet account. Otherwise create an approval request.

## Account Modes

Create or recover managed demo metadata with:

```http
POST /api/agent/accounts/create
Content-Type: application/json

{
  "telegramUserId": "555",
  "workerDeploymentId": "demo-worker",
  "session": "general"
}
```

The response returns address and account metadata only. It must not return raw private keys, seed phrases, CE-CC JWTs, worker tokens, or durable signing authority.

Passkey, Porto, wallet, and CE-CC local accounts remain approval-required, local-session-key-only, or AA-only according to their existing boundaries.

## Core Flows

Read inbox and pending work:

```http
GET /api/agent/inbox?session=general
```

Read sessions and fetch a question:

```http
GET /api/agent/sessions
GET /api/agent/questions?session=general
```

Save a local draft without submitting:

```http
POST /api/agent/responses/draft
Content-Type: application/json

{
  "session": "general",
  "questionId": "0x...",
  "questionType": "freeform",
  "answer": "Draft text"
}
```

Request human-approved submission:

```http
POST /api/agent/responses/submit-request
Content-Type: application/json

{
  "session": "general",
  "questionIds": ["0x..."],
  "idempotencyKey": "agent:general:submit:0001"
}
```

Request a scoped grant:

```http
POST /api/agent/connect-requests
Content-Type: application/json

{
  "agentId": "telegram:agent-1",
  "requestedScopes": ["agent:delegated-execute"],
  "requestedSessions": ["general"],
  "requestedActions": ["agent.response.delegated_execute"],
  "riskCeiling": "medium",
  "executionPolicy": "scoped_delegated_execute",
  "expiresAt": "2099-01-01T00:00:00.000Z",
  "idempotencyKey": "telegram:general:connect:0001"
}
```

Approvals and denials are local human actions:

```http
POST /api/agent/connect-requests/approve
POST /api/agent/connect-requests/deny
GET /api/agent/connect-requests/:id
GET /api/agent/requests/:id
```

## Preferences

Telegram and OpenClaw may provide preference bundles by value or by reference. Preference storage in the worker is optional. Predictive answers are allowed only when onboarding/preferences are configured and completed, or a preference bundle is supplied.
