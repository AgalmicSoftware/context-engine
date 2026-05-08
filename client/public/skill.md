# Context Engine Agent Skill

Use the human web UI for direct review, wallet/passkey decisions, and final approvals. Use the agent HTTP interface for structured reads, drafts, approval requests, and managed demo-account setup.

The canonical agent surface is `/api/agent/*`. Telegram, OpenClaw, MCP, and local helpers are adapters; they must not invent separate agent dialects.

## Security Rules

- Never place session payloads, question payloads, answer text, grants, JWTs, private keys, worker tokens, seed phrases, or account material in Telegram callbacks, deep-link payloads, CloudStorage, Mini App payloads, or chat state.
- Treat Telegram group chat as the public lobby. Use private chat with the same bot for account setup and actions.
- Group-card deep links must carry only opaque action IDs. Resolve group, session, and question context server-side.
- Raw key export/recover is allowed only through explicit `export_demo_key` or `recover_demo_key` actions for managed Telegram demo/testnet accounts, in private-only UX with audit events.
- Do not expect passkey, Porto, wallet, production, or CE-CC local accounts to sign remotely.
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

Private bridge worker status:

- `workers/agentBridgeWorker/` is the private Telegram demo bridge worker and is stripped from public releases while private.
- The worker uses a Durable Object signer boundary for managed demo accounts and currently returns signed testnet demo envelopes only; broadcast is disabled.
- Supported bridge doc-library file types are `md`, `pdf`, `png`, `jpg`, `jpeg`, and `webp`.
- Telegram screen states record launch metadata for `/start`, `/ce_join`, `/ce_questions`, `/ce_pose_question`, `/q`, deprecated `/ce_drop_question`, `/ce_docs`, `/ce_generate_questions`, `/ce_account`, `/ce_sbt <sbt-address-or-group-id-or-link>`, `/ce_join_sbt <sbt-address-or-invite-code-or-link>`, `/ce_create_sbt_group [session-slug]`, `/ce_onboarding`, `/ce_export_key`, `/ce_recover_key`, opaque callbacks, `callback:<pose_question_action>`, or `t.me/<bot>?start=<opaque-action-id>`.
- Telegram group session-linked cards say `Context Engine session linked: <session>` with `Join Session`, `View Questions`, `View / Add Docs`, and policy-allowed `Pose Question`; do not add `Answer Privately` by default.
- `View Questions` reads existing session questions through `GET /api/agent/questions`. `Pose Question` uses `/ce_pose_question` or `/q` to pose one existing/generated public-safe question to the group. `/ce_drop_question` is only a deprecated compatibility alias.
- Private, SBT-gated, or Lit-encrypted questions show locked group states. Eligible accounts request private reads through canonical CE agent/session APIs such as `POST /api/agent/decrypt/request`; Telegram does not implement Lit decrypt logic.
- SBT screens expose `Join SBT`, `Details`, `My Account`, public/password join paths, Create SBT Group, and Joined SBTs without holder lists or private holder metadata. Join/create actions route through planned canonical `/api/agent/sbt-groups/*` contracts. Public SBT addresses/group IDs/share links may appear in group commands; passwords, invite credentials, wallet proofs, and private eligibility checks stay in private chat or Mini App. Required SBT gates on `Join Session` show safe group summaries, route public/open joins when eligible, collect password/invite input privately, route wallet/passkey/non-public gates to linked CE account, and retry session join after satisfaction.
- My Account shows the managed address, joined sessions, joined SBT summaries, and private export/restore controls.
- Session storage backend selection belongs to `/new` Advanced session config, not Telegram. `arweave` is the default/current profile; `cloudflare` is explicit and lets the session/general worker enforce SBT gates for docs/context uploads, snippets, short-lived reads, and downloads without requiring Lit unless the payload itself is Lit/client encrypted. Cloudflare profiles use R2 for bytes, D1 for queryable metadata/audit/index records, KV for short-lived action/replay/start refs, and Durable Objects for managed signer/runtime coordination.
- Managed Telegram demo accounts may submit to normal CE sessions only when linked-session, join/SBT gate, session policy, scoped grant, idempotency, and audit checks pass. If direct submit is denied, create a canonical submit request or draft. Anyone in a linked Telegram group may pose public-safe existing questions; private/gated/encrypted prompts remain locked in group output. Mock OpenClaw forwarding is contract-only and uses safe refs/summaries only.
- Telegram question cards must keep CE parity: binary/agree-style uses `Agree`, `Unsure`, `Disagree`; rating is discrete `0` through `10`; multichoice preserves single-select vs multi-select state; freeform offers type/voice; every card has additional comments and microphone where supported; doc/context appears only when documents exist or are relevant.
- The doc-library copy is `View / Add Docs`; selected docs feed `Generate Questions` and may later become `Use as Answer Context`.

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
