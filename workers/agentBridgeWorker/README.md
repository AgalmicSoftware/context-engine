# Agent Bridge Worker

`workers/agentBridgeWorker/` is the private Telegram demo bridge worker. It is separate from `workers/sessionCorsWorker/` and must stay publicly stripped while the demo lane is private.

## Boundary

- `/api/agent/*` remains the canonical Context Engine agent contract.
- Telegram group chats are public lobbies for safe session/question/doc summaries.
- Private chat or Mini App surfaces are the account/action lane.
- Callback data, deep-link payloads, CloudStorage, Mini App payloads, and persistent chat state use opaque action IDs or safe display text only.
- Broadcast is intentionally disabled in this skeleton. The signer produces signed demo envelopes only.

## Managed Demo Accounts

Managed Telegram demo accounts are deterministic by Telegram principal plus worker deployment. Signing happens through the `ManagedDemoSignerDurableObject` boundary and returns a testnet/demo signed envelope. The normal account metadata never serializes raw key material.

`export_demo_key` and `recover_demo_key` are explicit private-only demo actions. They reject passkey, Porto, CE-CC local, linked external wallet, and production modes.

## Telegram Screens

Every `telegram_screen_state` carries launch metadata: a command, an opaque callback, or the `t.me/<bot>?start=<opaque-action-id>` deep link template.

| State | Launch |
| --- | --- |
| `setup_welcome`, `test_checklist` | `/start` |
| `group_session_card`, `account_created` | `/ce_join` |
| `private_start` | `/start <opaque-action-id>` or `t.me/<bot>?start=<opaque-action-id>` |
| `onboarding` | `/ce_onboarding` |
| question cards | `/ce_questions` |
| `doc_library`, `doc_detail` | `/ce_docs` |
| `generate_questions` | `/ce_generate_questions` |
| `account_recovered` | `/ce_recover_key` |
| confirmation, submitted, draft, retry states | opaque callback actions |

The group session-linked card says `Context Engine session linked: <session>` and exposes `Join Session`, `View Questions`, and `View / Add Docs`. `View Questions` is the group-lobby default action. `Join Session` opens private chat and routes participants without a configured account to private account setup. Group messages remain safe public summaries only and never include account state, private answers, keys, grants, or gated/private document contents.

Account-created screens do not include `Open in CE`. Optional onboarding uses: `Enter startup info so I can suggest answers for you.` Confirmation copy is `Submit this response?` with `Save draft` and `Edit`.

## Doc Library

The worker contract models R2 document bytes, D1 metadata/index status, and KV short-lived action records. Supported file types are:

- Markdown: `md`
- PDF: `pdf`
- Images: `png`, `jpg`, `jpeg`, `webp`

Public summaries include titles, file types, visibility, and index status. Private or SBT-gated contents are never included in group-safe summaries.

The doc-library button copy is `View / Add Docs`. Selected docs are recorded as inputs for `Generate Questions` and as future `Use as Answer Context` candidates. Generating questions without selected docs returns `Select or upload docs before generating questions.`

## Question Cards

Telegram question cards follow CE control conventions:

- Binary/agree-style questions use `Agree`, `Unsure`, and `Disagree`.
- Rating questions render discrete `0` through `10` buttons.
- Single-select multichoice questions render single-select option buttons.
- Multi-select multichoice questions preserve per-option selected state.
- Freeform questions expose `Type` and `Voice`.
- Additional comments are always present, microphone is present when supported, and docs/context appears only when docs exist or are relevant.

## Local Checks

```bash
cd workers/agentBridgeWorker
node --test *.test.mjs
```
