---
name: context-engine
description: Read Context Engine questions, save drafts and submit explicitly authorized answers through a session's scoped Agent HTTP API.
---

# Context Engine Agent Runtime

Skill version: 2026-10-27 (v45).

Use the Session Worker origin supplied by the user. Check
`GET /capabilities?slug=<sessionSlug>` for `agent_http_v1` and `agentHttp.ready`.
Fetch `/api/agent/skill-version` when refreshing these instructions. Use only
`/api/agent/*`; historical Telegram aliases and separate Bridge origins are
unsupported.

Keep a `ceagt_` credential in private auth context and send it only as
`Authorization: Bearer <token>` to its issued Worker origin. Never place it in
URLs, chat, logs, receipts or browser storage. Include the issued `sessionSlug`;
do not supply a transport user ID. Credentials cannot switch sessions or users.
Operator actions use the Session Worker's signed admin authority, not a root
agent token. Do not ask for operator authority to perform participant work.

Read `/api/agent/questions` and follow every `nextCursor` while `hasMore` is
true. Keep the reported total and reject incomplete or stale pagination. Read
`answer_schema`, canonical question IDs and availability before drafting. Do
not infer the scale of a rating or reorder quadratic options. Locked questions
remain unavailable even if an earlier read was allowed. `/tags` and
`/questions/next` help select relevant unanswered questions.

POST `/api/agent/preferences` saves a draft by default. Submit only when the
user authorized the particular answers; send `submit: true` with truthful
approval metadata. Caller-asserted approval is a record of the claim, not proof
that a human reviewed it. Preserve draft-versus-final provenance. Do not count
queued or uncertain work as a confirmed answer. Retry using the same request
identity; an uncertain chain transaction needs reconciliation, not a new
submission.

Question creation requires `pose_questions` plus current session policy.
`/question-votes/recommend` produces recommendations; applying them requires
`apply_question_votes`. Research buckets at `/groups` do not grant canonical
Worker membership. Group proposals and child records are session-scoped.
Operator-only routes include direct question-queue control, child records,
service bootstrap, cache writes and skill-update flags. Scoped admin workflows
also require current Session Worker admin authorization. For signed operator
writes, include `httpMethod` (for example `"POST"` or `"DELETE"`) in the body
before computing its hash and signature. Put all operation inputs in that
signed body; query parameters cannot modify signed writes.

Use `/api/agent/results` only when current visibility and gates allow it. Hidden
results cannot be requested through a demo or cached view. Geo backlinks are
returned as data and do not cause remote publication. Session-funded text AI
uses saved session settings; never send or request a provider key in prompts.

For browser login, exchange a user credential or a service with `session_login`
at `/api/agent/client-login/exchange`. The returned agent credential and
participant JWT have different purposes at the same origin. Keep both in page
memory and discard them on reload, logout or expiry. Source revocation also
invalidates exchanged credentials. Use the
[Wrapped instructions](../ce-session-wrapped/SKILL.md) for predictions, which
remain separate from ordinary answers.
