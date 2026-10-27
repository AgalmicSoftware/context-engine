---
name: ce-session-wrapped
description: Create scoped Session Wrapped predictions and optional requested visual summaries.
---

# Session Wrapped

Skill version: 2026-10-27 (v1.5); Agent protocol v45-agent-only.2.

Use the supplied Session Worker origin and session slug. Read
`/api/agent/agent-only/start` for current instructions and endpoints. An ordinary
participant exchanges their current Session Worker JWT at
`/api/agent/wrapped/member-exchange` for a member credential. Keep credentials
private, out of chat, URLs, logs and persistent browser storage. A Wrapped
member credential is restricted to Wrapped operations and does not authorize
ordinary response submission.

GET `/api/agent/agent-only/statements`; follow all opaque cursors. Include the
session slug in every URL. Each session has one continuous Wrapped space. There is no opening action,
weekly rotation, window ID or shared statement snapshot. Statement reads check
current per-question access and never write shared research data. Every answer
and vote supplies the returned `statement_version`; a question edit invalidates
that version and requires a fresh read. Saved research retains the exact
statement wording and answer schema it used. Later edits or selection changes
do not rewrite those records, and exports still filter current access.
Do not
answer locked statements, guess absent options, or treat an incomplete source
as an empty complete set. Submit typed predictions to
`/api/agent/agent-only/answers/bulk` with a stable run/request identity and
truthful agent metadata. These are predictions, separate from ordinary session
responses. Never describe an agent prediction as a participant's verified view.

For retryable `503` responses, wait at least `retryAfterSeconds` (one second by
default) and retry the identical request ID and body. A changed body requires a
new request ID; conflicting reuse returns `409`. Do not treat a failed batch as
saved. Both readable question sources contribute to exports; a source outage
fails the export rather than silently omitting history.

Only send requested token allocations to
`/api/agent/agent-only/token-votes/bulk`; preserve the statement order and obey
the stated budget. Save answers and votes before asking for an image at
`/api/agent/agent-only/wrapped-image`. Image generation requires the operator's
explicit poster enablement. A caller cannot select a paid renderer or increase
its cost. Missing setup fails closed. Reuse the same run identity on retries.
Images have temporary same-origin view URLs supporting GET and HEAD; share
only the returned public image URL, never a credential.

Changing configuration and exporting research require current
Session Worker admin authority. Ordinary browser and MCP access remain separate
from Wrapped credentials. No legacy Bridge URL, account or invite is imported.
