# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Arweave

- Use one forced-refresh option across payload caches and in-flight requests.
  Evict malformed JSON replies so ordinary reads can retry immediately.

### Agents and MCP

- Read research gold and wide exports from permanent submitted-answer history,
  preserving revision order and gold answers from before each prediction.

- Count research completion from distinct stored answers and privacy skips, using
  the Wrapped image coverage rule. Retried attempts remain marked as replays.

- Recheck MCP cancellation after chain validation, token refresh and retry-key
  persistence before sending writes, preserving results already broadcast.

- Mark MCP results, question lists and own-answer reads incomplete when listed
  payloads are unread, including cached misses, and report unread answer counts.

- Require the storage target and timestamp on every upload receipt reservation and
  execute reply, while preserving interrupted uploads at their original target.

- Persist and retry failed question-index ranges, and keep unread question payloads
  incomplete until recovery succeeds.

- Refresh expired registry question indexes even after their historical scan is
  complete, sharing concurrent background refreshes and preserving the indexed block.

- Publish complete MCP key files atomically on filesystems with hard links, so
  concurrent first launches share one identity without reading a partial key.

- Resolve default MCP registry links to the registered `general` session while
  continuing to reject mismatched session identities.

- Serve every eligible question before repeating, including catalogs larger than
  250 questions. Prune removed questions while preserving sponsored priority.

- Limit failed-issuance credential cleanup to its own token record, preserving
  newer credentials issued concurrently and reporting failed revocation writes.

- Keep targeted question-vote matches regardless of catalog size or position,
  with stable ordering for equally relevant recommendations.

- Score participant results from each question's type and rating scale. Keep
  freeform, choice and other unscored answers out of agreement counts and averages.

- Prepare MCP 0.2.0 with shared rating validation. Fractional grids are supported;
  new answers must follow the stored step (default 1). Existing answers remain
  unchanged. The minor version marks the changed accepted-input behavior.

- Require structured approval for sponsored question changes; text-only approval
  no longer applies them. Require a valid plan digest and reject it when the plan changes.

- Keep canonical submitted answers when a stale submission-index copy has the
  same timestamp. Newer timestamps still take precedence when deduplicating copies.

- Keep the CC package's shipped rating-scale module synchronized with the shared
  rating validation rules.

- Give each agent answer edit a durable revision and request identity, so changing
  back to an earlier answer submits the edit while retries remain idempotent.

- Count one current answer per participant and question in agent results and
  answered-state views, using a shared deterministic revision order within each
  participant/question and chronological order across the selected answers.

- Serialize Wrapped research batches in the session coordinator. Bind retries
  to their original content, preserve concurrent answer summaries, and return a
  retryable response while KV is busy. Export both readable question sources
  and report source outages instead of silently dropping history.
- Retry unexpected queue-processing failures instead of acknowledging an
  unprocessed submission.

- Use one continuous Wrapped space per session. Remove weekly windows and their
  opening action; saved answers retain their exact statement wording and schema,
  with current access checked on reads and exports.
- Project completed direct agent submissions to KV once and repair delayed
  projections with a durable alarm. Queued successes retain their outcome while
  an accepted persistence-only message repairs KV. Keep successful outcomes successful, retain uploaded
  payload IDs on retry, validate before admission, and use server timestamps.
- Surface Wrapped config/state read failures and proposal outages. Keep the
  first 2,000 proposals with an explicit incomplete marker instead of dropping
  them or reporting complete aggregates.

- Apply participant upload preflight to agent writes, retain submission outcomes
  across authority changes, and retry pre-send failures without duplicate uploads.
- Preserve Wrapped history across selection and visibility changes; fail closed
  on incomplete KV reads and invalid export cursors. Bind signed operator writes
  to their HTTP method and body, and bound registry RPC response bodies.
- Persist native verification capabilities for Admin and reject deployment
  capabilities whose origin differs from the Session Worker.

- Serve new-session Agent HTTP and Session Wrapped from the Session Worker,
  including scoped credentials, atomic invites, source-bound browser exchange,
  managed testnet submissions and optional queue processing. Remove separate
  Bridge deployment and release bundles without migrating or retiring existing resources.
- Apply canonical session gates and stored-key AI policy to agent workflows.
  Optional operator-funded posters stay disabled by default. Agent auxiliary
  state and signing keys are excluded from session archives.

- Prepare MCP 0.1.2 with the updated agent behavior and automated release workflow.
  Default new host configurations to `npx -y --prefer-online @agalmic/contextengine@latest`.
  Existing users should update their host command once and restart to receive
  future published updates; exact version pins remain available for reproducible
  runs. Publication stays disabled until the application release is merged,
  canonical CI passes and the repository owner enables it.
- Add opt-in GitHub-to-npm publication of the exact CI-tested MCP tarball using
  npm Trusted Publishing, with version, source, integrity and stale-run checks.

- Require explicit `session_login` scope when a service credential exchanges
  into a Session Worker login. Personal user credentials retain login, and exchanged
  tokens are capped by source expiry and invalidated when the source is revoked.
- Retain confirmed local answers in incomplete registry reads during a failed
  block-mark check, while preserving newer canonical answers.
- Persist pending answer-upload identities so repeating a timed-out tool call
  replays the settled record. Keep complete Worker listings complete after an
  agent answers, and hold registry scan cursors when a block mark cannot be checked.
- Verify each remembered registry write against its own block before using it,
  share block probes within a read, and report incomplete results when RPC
  history is unavailable without discarding the last verified scan mark.
- Send response-upload request IDs so a retry within an upload operation can
  replay the original stored reference.
- Bind saved agent state to its wallet and stop startup if its key is missing
  or differs from the recorded identity. Legacy state adopts its existing key.
- Rebuild registry reads when the scanned block is replaced, and discard local
  questions and remembered answers from orphaned blocks.
- Route every MCP registry chain call, including reads, log scans and test-ETH
  checks, through one error sanitizer, and redact URLs and ethers diagnostics
  from tool errors and logs, so a keyed RPC URL cannot reach a transcript.

### Client — available when the site deploys

- Preserve participant Group drafts across configuration refreshes; update default tags only while untouched.

- Keep cleared cache namespaces empty after storage recovery and report incomplete clears without reloading.

- Limit interview submissions to selected changed answers through validation,
  encryption, upload and draft cleanup; leave unselected manual drafts intact.

- Preserve multilingual speech after overlapping audio chunks by trimming
  only verified transcript offsets in both uploaded and rolling audio.

- Try another document index after malformed GraphQL replies and retain the
  current document list when every endpoint fails.

- Compare freeform answers and comments as exact text throughout editing,
  dirty counts, submission differences and interview review; only rating
  answers use numeric equivalence.

- Keep loaded empty saved answers distinct from unknown baselines, so a newer
  saved clear drops older draft edits while incomplete loading preserves them.

- Hold back an invalid saved locked response individually while submitting other
  valid changes, and keep rejecting newly typed lone asterisks before upload.

- Refuse lone asterisks in answers and comments before upload, require valid
  envelopes for encrypted response fields, and clear old ciphertext on edits.

- Re-encrypt response fields and ratings when gate conditions or chains change;
  require decryption before submitting a still-locked field to a different gate.

- Clear cached registry overrides when their on-chain fields are empty, restoring
  metadata or defaults while preserving failed and unrequested fields.

- Keep Realtime interview questions and answers in conversation order when
  transcription completions arrive late or repeat.


- Preserve every stored survey answer when submitting a partial edit. Read the
  current raw container before uploads, retain unchanged encrypted rows exactly,
  and refuse submission when that snapshot cannot be read.

- Finish question and survey publication in its original session, preserve drafts
  edited while publishing, and leave newly opened forms and their timers untouched.

- Pin all SBT writes to the collection session’s configured chain, reject missing
  chains and wallet mismatches, and include the chain in the approved transaction.

- Keep SBT history reads on the session chain and retain cached counts when its
  provider is unavailable, without substituting an injected wallet’s history.

- Separate SBT count-scan coverage from pending live activity. Fill missed history
  without double counting, replace orphaned counts on complete scans, and rebuild
  obsolete cache entries instead of migrating them.

- Read later-edited answers at the configured scan end, with separate historical
  requests and partial-failure reasons when archive state is unavailable.

- Apply pending decrypts only to their original response and unchanged viewer,
  profile and source-session context, preserving newer response revisions.

- Limit General comparisons to General data and carry the same explicit session
  through comparison URLs, provenance and AI requests.

- Treat retired SBT collections as fully hydrated when their admin is the zero
  address, so discovery advances and does not repeatedly fetch their metadata.

- Keep in-flight AI analysis tied to its starting session, reader and chain;
  exports omit analysis when the current filtered inputs have changed.

- Drop live events outside the session scope or configured block limits without
  treating a lagging RPC head as a configured end.

- Cache every live survey responder in a block, order same-block edits by transaction
  and log position, and ignore duplicate events.

- Reloading the Session Wizard preserves explicit start blocks. New blank starts record draft-only provenance so automatic defaults can follow chain changes without entering published configuration.

- Empty completed filters export zero questions and responses, with report availability based on those same counts. Session totals remain the fallback while filters hydrate.

- Survey discovery retains creation blocks from raw event logs and keeps the earliest block for duplicate survey IDs.

- Retry chain-backed response payload failures from their event block instead of
  advancing past them. Forced refreshes rescan from the session's start block.

- Refuse encrypted-key wallet creation when a wallet is already saved for this
  RP ID, preserving its recovery key before any new passkey prompt.

- Cancel pending passkey creation, unlocks, and signing on logout or deletion.
  Late replies cannot restore the signer or connected metadata; expiry still
  permits one signature re-unlock.

- Remove circular session-parser and Arweave imports while preserving resource
  diagnostics and gateway URL normalization.

- Validate wallet transaction quantities before policy checks and sign that same
  normalized transaction in both the Worker and in-memory fallback.

- Reconcile Worker question and survey caches against complete catalogs, keeping
  pending writes and a ten-minute grace period for new records.

- Keep hidden Worker questions and surveys hidden in the reader cache, including
  when saved answers carry their question text. Clear hides only after a complete catalog refresh.

- Add a **Measure how well AI represents participants** switch to Interview
  settings, in the wizard and `/admin` (needs a Session Worker newer than
  0.8.0). It turns on research sharing by default, hidden drafts for 1 in 5
  AI-prefill drafts and the participant score together, and in `/admin` turns
  voice interviews back on if they were off; turning it off restores the
  research defaults.
- Add **How well AIs predicted people** to the Results report of sessions that
  turn on **Show “How well AIs predicted people” in Results**: the overall and
  hidden-draft Mirror Scores, how often people changed a shown draft, stated
  confidence against answers kept, and results by platform. It appears once
  the responses include AI-prefill drafts from the session's minimum number
  of people, 5 by default, and withholds any figure from fewer, and a
  platform also when subtracting it from the overall score would reveal
  fewer. It scores in a background thread.
- Add two Interview settings for that section, in the wizard and `/admin`
  (each needs a Session Worker newer than 0.8.0): **Show “How well AIs
  predicted people” in Results** (`interviewMode.showFidelityResults`, off by
  default), which adds it, while the participant score stays private to each
  person; and under it, **Smallest group shown in “How
  well AIs predicted people”** (`interviewMode.fidelityMinimumPeople`, 5 by
  default), whose **Off** shows every figure, even one person's.
- Suggest the session's open groups after an interview or AI prefill link
  (`interviewMode.suggestGroups`, off by default; needs a Session Worker
  newer than 0.8.0). A group named like the person's single-choice answer
  comes first without an AI call, hidden AI drafts stay out until shown, and
  suggestions never join anyone. A join started before sign-in now survives
  it, and suggestions no longer reload, with an AI call, on every render.
- Resolve the `rxc-ra-test-2` session from its short URL through bundled Worker
  discovery, without requiring a `worker` query parameter.
- Restart backup downloads after configuration/group changes or invalid cursors.
  Before restoring into an unpublished session, check the pinned Worker origin
  and show the target before asking for a signature.
- Clear authoring draft warnings and unload prompts after Clear form or successful
  publication, cancelling queued saves of the discarded draft.
- Keep the license-analysis module inventory outside the published site output.

- Add a versioned product film and 1200×630 poster for site link previews, with
  crawler HTML for About. Posts keep their own header images and omit the film.

- Show persistent authoring draft save failures with Retry and Copy draft,
  a JSON download fallback, and an unload warning while failed edits are unsaved.
- Enforce local scripts and wallet workers through the static CSP, with one
  exact script hash for the sandboxed benchmark report. Browser smoke tests
  apply the real headers, reject CSP violations and check blocked injections.
- Reuse an unchanged survey container on response retries, and refresh cached
  readiness on Submit only when submission is unavailable.
- Restart changed-session backups without retaining stale pages. Deployment
  replay identifies a preserved recovery key and its known fingerprint.
- Advance saved-answer revisions when edited, including changing an
  answer back, and discard in-flight submission state when the account changes.
- Recheck unavailable Worker readiness on Submit and avoid caching transient
  network failures. Expire near-head numeric RPC reads after two seconds so a
  recent chain replacement cannot remain cached for ten minutes.
- Preserve operator-supplied recovery keys through wizard identity changes,
  normalize hex case and distinguish supplied from generated keys. Stream JSONL
  restore files and let admins abandon an unfinished restore.
- Show automatic-analysis retry exhaustion beside manual recovery controls.
  Add private admin diagnostics for upload receipts, automatic-analysis retries
  and pending configuration repair, with bounded pages and explicit refresh.
- Keep a submission's operation ID across failed and partial attempts, so an
  unchanged answer can recover a lost upload reply without another stored copy.
- Gate admin corrections on Worker authority-stamp support and explain known
  submission readiness failures. Show Worker API/bundle details and upgrade hints.
- Add complete session backup and resumable restore to admin settings, with
  generated or operator-supplied recovery keys during setup and confirmed key
  export for existing sessions. Key dialogs offer a private download and keep
  their raw values out of browser persistence.
- Preserve the bookmark action the page showed, match Results bookmark IDs
  case-insensitively, and keep optimistic writes that start during a tab reload.
- Extend required browser coverage to lost upload replies, backup/import and
  recovery-key downloads; pin previous-minor records across canonical readers.
- Keep successfully stored Worker answers saved after a later upload fails,
  name the unsaved drafts, and keep Submit available to retry only those drafts.
- Serialize persisted cache writes across tabs and reload saved values on
  cross-tab notifications. Bookmark changes preserve other tabs' additions.
- Merge saved filters, SBT bookmarks and analysis results into current local
  storage, and retain valid bookmark lists when another list is missing.
- Require browser checks for hosted publication, reload, Results, permissions,
  partial-submit retry and concurrent two-tab bookmarks in CI.
- Move Discard interview out of the modal footer into a trash button beside
  the microphone. Its tooltip, and its description for screen readers, say
  what discarding clears and that submitted responses are kept.
- Offer the ChatGPT or Claude prefill prompt from the voice chooser, in a
  **Let your AI draft your answers** card below Interview and Group
  Conversation, instead of inside the interview; the chooser's descriptions
  now sit behind question-mark tooltips. `?mode=voice` opens the chooser.
  Prefill links still open the interview on their drafts, now with a status
  line and a **Talk through your drafts** microphone.
- Open the interview's AI submission choices inside their dropdown instead of
  over the drafts, with every sharing choice listed before the prefill metadata.
  The metadata no longer repeats what an unticked box leaves out, and is hidden
  when nothing is shared.
- Leave questions people have already answered out of interview and AI-prefill
  drafts, and say how many were left out. A voice or typed interview that gives
  a different answer still shows that draft, noting the answer it changes.
  Answers saved earlier but not yet loaded on the page now count too, so an
  interview no longer replaces them unasked. While questions remain open, the
  voice interviewer asks only about those.
- Scope cached Worker questions and answers to the signed-in reader. Account
  switches and logouts purge Worker cache nodes, a load started under another
  account is discarded, and a complete listing drops answers the reader can no
  longer read.
- Load Interview saved answers after a full survey submission, whose stored
  survey container previously failed the whole load.
- Resume capped response listings on the next refresh, so sessions above
  10,000 answers eventually load every row.
- Give multichoice questions that the old delimiter encoding conflated, such as
  options containing `,` or `:`, a versioned id. Every other id is unchanged,
  and either form verifies in the web client, MCP and CE-CC.

### Workers — requires redeployment

- Checkpoint Lit setup resources in encrypted coordinator storage and resume
  failed attempts without recreating completed resources; activate only after
  the complete setup is finalized atomically.

- Count only eligible public questions toward interview discovery's 100-question
  limit, with separate scan budgets and retryable incomplete-discovery errors.

- Reject encrypted response fields without a valid envelope and public lone-asterisk masks.

- Require public HTTPS targets without embedded credentials throughout custom AI
  redirects, and refuse requests when outbound safety checks are unavailable.

- Bind restored session Worker URLs to the signed, verified destination origin so
  recovery at a new Worker passes client discovery without loosening ordinary edits.

- Keep the importing admin authorized through restore cleanup; publish the restored
  authority and release its lock atomically, with status reads able to finish cleanup.

- Check each listing group once per request and return a retryable failure when
  membership is unavailable, instead of reporting an incomplete page as complete.

- Patch the committed encrypted secret document, preserving key replacements
  and removals across stale KV reads, retries, Lit setup and backup restore.

- Recheck group mutation authority in the session config coordinator and order the separate group commit against admin rotation, including participant epoch checks.

- Remove legacy membership reads and migration from group rosters, preserving
  removal tombstones across repeated paginated listings.

- Research CSV exports use the browser's shared formula guard and quote every cell; JSONL exports retain exact participant text.

- Groups result images draw only participants in groups that meet the minimum size, matching JSON group counts without assigning suppressed participants to another group.

- Anonymous IPv6 callers in one /64 now share a quota; IPv4-mapped addresses share the corresponding IPv4 quota.

- Extract fetched HTML in linear time, including responses with repeated
  unclosed tags, while preserving ordinary visible text.

- Sign each faucet payment once and resend the same bytes across RPC fallback.
  Return the transaction hash on uncertain outcomes, including agent requests.

- Cap Cloudflare upload metadata at 64 KiB with bounded tags so accepted records
  fit backup entries; legacy oversized export errors name the affected storage ID.

- Preserve zero-byte documents through backup and restore, treating an empty KV
  payload as valid bytes rather than a missing object.

- Reject question options that are not strings; client cache and input readers
  ignore malformed legacy options without converting untrusted objects.

- Resume interrupted response uploads at their reserved storage ID and timestamp,
  retaining pending receipts and avoiding duplicate published answers after a crash.

- Clear completed restore journals and page receipts in resumable steps, retaining
  a small completion record. A later import must pass the empty-target check.
- Bound upload diagnostics registration to 250 ms, back off failed attempts for
  60 seconds, and retry through the existing alarm; counts can lag until retry.
- Apply outbound URL checks and timeouts to interview openings, and name a missing
  provider key when refusing a request.
- Recognize configured thinking models regardless of name and preserve inventoried
  built-in output budgets with fixed ceilings up to 16,000 tokens. Caller limits
  can only lower them; aggregate AI usage policy remains separate.
- Preserve Headers inputs in Bridge replies and deploy-helper requests; expand
  the source guard to fallback spreads, optional chains and Object.assign targets.

- Bound session-funded AI requests to configured models, per-operation output
  limits, standard processing, and configured reasoning effort. Remove caller
  tools while preserving saved custom-provider Functions. BYO keys keep their
  existing behavior; interview text generation now follows session settings.
  These limits do not provide aggregate AI budgets.
- Add `GET /admin/diagnostics` with incomplete-count reporting and opaque,
  expiring pagination tokens. Uploads now register their receipt stores in the
  diagnostics index on a best-effort basis; this requires a Worker redeploy.
- Preserve CORS headers on deployment, recovery and provider-backoff replies.
- Authenticate backup cursors before building signed pages, and advance group
  backup revisions only when a successful operation changes state. Upload-limit
  errors retain CORS headers, including their 413 responses.
- Restore R2 resource metadata, authenticate backup pages and refuse archives
  when any required recovery key is missing. Detect writes during export,
  require an empty restore target and keep backup/import pages within their
  storage-operation budget. Abandoning a restore removes all imported rows
  through a resumable cleanup journal before releasing the target.
- Protect receipt identifiers and payload digests with keyed MACs, expire them
  by alarm and validate deterministic upload failures before reserving a lease.
  Replayed settled uploads also recover a missed automatic-analysis enqueue.
- Retry transient automatic-analysis failures after 1, 5 and 30 minutes before
  marking retries exhausted. Honor Retry-After up to 30 minutes, preserve uploads
  merged during a run, and pause invalid output without another billed retry.
- Preserve ownership, authority, visibility and group fields in encrypted
  envelope exports. Add complete paginated session backups and signed imports
  covering chunked payloads, config, ownership, groups, wrapped keys and encrypted
  service secrets. Restore requires the matching recovery keys; a hermetic fresh
  deployment drill verifies recovered reads and access rules.
- Deduplicate settled response uploads by participant and request ID for seven
  days, returning the original reference without another storage write and
  enqueueing automatic analysis idempotently.
  An expired attempt can leave an orphan; legacy Workers retain their old behavior.
- Advertise public capabilities and non-sensitive session readiness categories.
- Return newly generated recovery keys only with the fresh deployment response,
  exclude them from saved receipts, and allow confirmed signed admin export at
  most three times per session per UTC day on single-session deployments.
  Multi-session deployment keys remain with the operator.
- Settle Worker Group mutations stranded by a KV failure: the next operation on
  that group or member replays the recorded intent instead of answering
  not-found, and memberships no longer fail for every member.
- Admit queued automatic analysis against the coordinator's authoritative
  config, so disabling AI also stops jobs already queued.
- Walk every question page in the interview catalog and the Agent Bridge before
  choosing versions, and present one current version per question in the Bridge.

### Verification and shared rules

- Cover the pinned Worker session route with read-only navigation fixtures and
  loaded-session assertions while keeping unmatched network requests blocked.

- Seed encrypted provisioned secrets in admin integration fixtures.

- Align integration assertions with explicit General comparison links and scanned
  SBT mint totals.

- Keep the analysis session-switch regression mock compatible with typed Jest.

- Preserve the Session Worker's isolated dependencies in public replay checks.

- Include shared answer validation in Worker release source comparisons.

- Check signed payment hashes in proof-authorized faucet integration tests.

- Separate the interview panel from voice-mode navigation while preserving
  review, consent, and submission behavior.

- Refresh the fallback Worker release pin and deploy-helper example to the
  verified 0.8.0 bundles before preparing the next application release.

- Verify authenticated faucet replies against the signed payment hash and amount.

- Preserve the original benchmark rating prompts for integer-origin, step-1
  scales; describe increments only for other rating grids.

- Reject eager client runtime import cycles in the wiring gate, with a zero
  baseline and exclusions for type-only imports and deferred loads.

- Use one rating bounds and step rule across browser sliders, agent drafts and
  submissions, Wrapped, MCP and benchmark answers; suggested buttons are display hints.

- Verify recovery of saved answers and unsaved drafts after reload without
  resending saved records.
- Exercise current MCP and browser readers against the unchanged previous
  released Worker bundle. Add duplicate-alarm, account-switch, reload-recovery
  and same-height/higher-head registry convergence regressions.
- Pin previous-release tests to an immutable Worker tag and require that tag in
  CI. Include the Agent Bridge and Worker in shared session-ID/sign-in vectors.
- Share group-password derivation, sign-in message/session-ID rules and admin
  typed-data construction while preserving the client/MCP ethers-v5 and Session
  Worker ethers-v6 package boundary.
- Check installed production dependencies and actual client, MCP, Session Worker,
  Agent Bridge and deploy-helper bundle inputs in CI, including bundled development
  packages. Released Worker bundles must carry complete notices; reviewed license
  exceptions fail when their package versions are no longer installed.

### License

- Project-authored code is MPL-2.0 throughout, including Workers, the generated
  deployment package, contracts/Foundry sources and the CC add-on. Earlier
  releases keep the licenses they shipped with. Corpus data remains CC0-1.0;
  third-party dependencies and assets keep their own licenses and notices.
- Ship full generated third-party notices inside all three released Worker bundles
  and with the standalone Worker deploy package, plus the MIT notice beside the
  add-on's bundled ethers library. Release hashes include the appended notices.

### Benchmark reports

- Keep report trait names and values as own dictionary keys, including built-in
  names such as constructor, across grouping, filtering and export.

- Audit every model the full OpenRouter runner will send, using one effective
  roster for preflight, planning and execution.

- Validate OpenRouter's transport and serving provider separately. Enforce upstream
  routing restrictions with normalized comparisons while preserving reported metadata.

- Use the validated release receipt for benchmark labels, indexing and publication
  status. Require explicit release confirmation and verify the embedded report's hash.

- Compare similarity drift over the same usable question set in both snapshots,
  report its IDs and count, and mark insufficient common overlap unavailable.

- Keep benchmark deadlines active through success/error bodies and structured-output
  fallback attempts, cancelling stalled streams so tasks can retry.

- Repair incomplete checkpoint tails and missing final newlines before any
  benchmark resume appends new records; reject corrupt middle lines.

- Bind importance resume to its recorded endpoint and reject mixed endpoints
  using the deployment identity check shared with stance runs.

- Hash importance prompts in model-id and numeric-repeat order for both generation
  and release validation, independent of roster order.

- File questions without valid answers under "no data" in the report's tag
  filter instead of "mixed / unsure".
- Let the AI discourse benchmark answer any session's questions, every type
  included: `answer` asks each model with reversed wording, flipped rating
  scales and shuffled options, and checks replies with the MCP's answer rules,
  now shared in `shared/questions/answerValue.mjs`. `compare-answers` then
  compares models with everyone and with each group, using statistics suited
  to each question type; a group is withheld when it has fewer than 5 people
  or when subtracting it from everyone would leave fewer.

### Research

- Add Cohen's kappa for choice predictions and rating error, as a share of
  the scale, to the agent fidelity report.
- Add an agent fidelity report: `scripts/agent-fidelity-report.mjs` scores
  how well AI drafts predicted participants' answers from a Results JSON
  export or Session Wrapped rows. It reports Mirror Score, correction rate,
  calibration, lift over a majority guess, accuracy for unusual views, and
  whether drafts flatten strong or varied views. See `docs/agent-fidelity.md`.
  It counts each response under the responder the Worker or chain recorded,
  not the payload's own claim, reads platforms as ChatGPT, Claude or other,
  and withholds calibration bands from fewer than 5 people, and any platform,
  draft-source or group row whose subtraction from the total would reveal
  fewer.
- Keep shared AI draft comparisons minimal by default: predicted answers, ratings,
  confidence and changed fields, without the AI's notes, drafted text or drafts
  for skipped questions. Owners can choose full detail with
  `interviewMode.researchDetail`, which needs a Session Worker newer than 0.8.0.
  Records now carry `version: 2`, `researchTier` and `draftOrigin`, and a line
  beside Submit says when sharing is on.
- Hide a share of AI-prefill drafts until people answer, to measure how much
  seeing a draft sways answers: `interviewMode.hiddenDraftShare`, which needs a
  Session Worker newer than 0.8.0. Each hidden question shows the AI's guess
  after the answer, and research records keep `predictionCondition`, the answer
  from before the reveal and when it was shown. Anchoring now compares hidden
  drafts only with shown drafts from the same source.
- Ask AI prefill and interview drafting for confidence as the chance the
  person keeps the answer unchanged (prompt `ce-interview-brief-v6`), so it can
  be calibrated. v4 and v5 links and catalogs still work; the fidelity report
  calibrates only confidences with this meaning.
- Show participants a private score after they submit AI-prefill drafts
  (`interviewMode.showFidelityScore`, which needs a Session Worker newer than
  0.8.0): how many answers their AI matched, its Mirror Score, its hidden-draft
  guesses and most confident misses, worked out in the browser. The footer
  button stays in place.

## [0.7.0] - 2026-10-21

### Agents and MCP

- Prepare MCP 0.1.1 with sanitized registry RPC errors and retained transaction
  hashes for uncertain submissions. Keep successful answers successful when
  their local history cannot be saved, returning a separate warning.
- Prevent overlapping MCP state updates from losing remembered sessions; fail
  safely when a writer lock remains after a stopped process.

- Pin a hosted session's ID in the dedicated Agent Session Wrapped policy.
  Hosted Wrapped deployments previously produced a policy their own Bridge
  rejected, so deployment could not verify.

- Release hosted test-ETH quota after setup failures before submission, while
  keeping quota reserved for uncertain transaction broadcasts.

- Read recent registry answers first and resume older history across calls, so
  long-running sessions keep showing new responses within bounded scans.
- Preserve faucet transaction hashes and refusal reasons during SBT claims and
  registry writes, including pending funding and failed balance checks.

- Let MCP agents join unencrypted OP Sepolia registry sessions from normal
  session links, read public questions and results, and submit answers and
  statements with their own test-ETH gas and the session Worker's uploads.

- Show confirmed test-ETH offers in session headers, cached session lists and
  MCP session details. Add `request_test_eth` for agents to request funding
  for their own address, shared with SBT claim funding.

- Package the MCP server as `@agalmic/contextengine`, with a standalone executable
  and bundled license notices. Agents install with `npx -y @agalmic/contextengine`;
  host configs can pin `@agalmic/contextengine@0.1.0`.

- Add a Context Engine MCP server (`mcp/`) that lets an AI agent join hosted
  sessions as its own participant. The agent signs in with its own key, reads
  the session context, answers, adds statements, joins open groups, claims
  session SBTs with the same codes people use, and reads public results. Its
  records match the web app's, so they appear in the same Results, with a
  self-declared agent marker and optional display name.

### Client — available when the site deploys

- Let eligible signed-in participants record or upload audio using the session
  AI key, while keeping anonymous transcription available where permitted.
- Hand a finished dictation to its answer field once, outside React rendering,
  and preserve edits when Submit follows typing, dictation or rewrite immediately.
- Cancel obsolete recordings and AI edits when the account, session, Worker or
  field changes. Keep queued drafts scoped to the authority that created them.
- Show the configured gate names on masked questions and restore the missing
  runtime helpers used by prompt decryption, response resets and JSON previews.
- Show the Worker denial for signed-out dictation even when an injected wallet
  is unlocked; retain valid tokens after terminal scope denials.
- Sign in once more after a scope denial when an SBT claim or Worker Group join
  in any open tab may have granted that scope since the last sign-in, so newly
  eligible participants can dictate or use AI without waiting for token expiry.

- Keep provider keys, wallet keys and faucet keys out of copied setup JSON.
- Refuse header images that publishing cannot upload, such as WebP or SVG, as
  soon as they are chosen or pasted instead of failing at publish.
- Name every setup step, use plain labels for advanced fields, show an access
  badge only on protected fields, and explain why Worker verification must be
  repeated after a reload or settings change.
- Let arrow keys move between hosting templates without choosing one; Enter or
  Space chooses, so keyboard users can compare templates first.
- Keep session-network and SBT rules consistent through edits and reloads;
  preserve custom encrypted-storage rules and explicit HTTP-agent opt-outs.
- Accept valid Arweave Worker setup payloads, validate owner-written Interview
  openings before publication, and clear draft Group secrets when the wizard
  closes or the account changes.
- Keep interview settings saving to Session Workers before 0.7.0 by leaving the
  research-sharing default out while it is off; turning it on needs a 0.7.0 Worker.
- Let owners make sharing AI draft changes for research the default. When it
  starts on, the interview review opens its submission info so participants
  see the choice, which covers drafts they removed, before submitting.
- Describe current response-read permissions and saved export preferences
  accurately in setup; distinguish unavailable dropdown choices visually.
- Let a fresh encrypted session publish its first question without treating
  initial storage-key creation as a change in authorization.
- Request sign-in for private Worker reads that require a participant identity,
  and preserve canonical draft ownership on aliased demo session routes.

- Keep Stats group-dialog labels and profile survey previews readable in light
  and dark themes, with desktop/mobile browser contrast coverage.

- Offer an optional test-ETH faucet for hosted sessions with SBT rules on their
  test network. Validate and privately deploy its key, and show the funding address.
- Limit hosted participant faucets to the caller's wallet and three successful
  payouts in 24 hours; balance and other refusals do not consume the allowance.
- Keep a hosted faucet's quota reservation after an uncertain RPC submission,
  and avoid sending another payout through a fallback RPC in the same request.
- Explain how to continue when an older deploy helper or sponsoring Worker
  refuses participant test ETH; a sponsored grant stays reserved for that draft.

- Offer "Anyone can see the public stored results" for unencrypted hosted
  sessions in `/new`. Choosing it makes stored answers public-read; leaving it
  or enabling encryption restores the default access rules.
- Keep `/new` session settings valid after switching encryption back from Lit
  or removing SBT rules, and keep settings when the selected storage or
  encryption is clicked again.

- Preserve ordinary wallet/passkey web participation when Agent HTTP is enabled.
  Agent-token login opens the agent view, and agent logout restores the web page.
- Rename the retained hosted agent surface and utilities around Agent HTTP. Keep
  agent token login, questions, local drafts, explicit Submit, Worker Groups,
  and aggregate results; remove retired bot/Mini App wizard controls.

### Workers — requires redeployment

- Allow existing Wrapped policies without a session ID to gain that ID during
  updates while requiring every other authority field to remain unchanged.
- Keep automatic analysis eligible after an ineligible trigger instead of
  treating it as a permanent generation failure.
- Re-enqueue pending agent answers after queue publication failures using the
  same request generation; preserve uncertain and completed transaction outcomes.
  Mark the failed submission `retryable` so agents send the same answer again.
- Keep normalized faucet settings stable so enabling the wizard switch does not
  trigger repeated render updates.
- Grant new hosted faucets through `faucet_self`, which older Workers ignore.
  Updated Workers map it to the existing faucet route with recipient and daily limits.
- Update `follow-redirects` to 1.16.1 to fix credential-header handling on redirects.

- Enable public Worker-to-Worker routing so same-account Wrapped health checks
  can run. Preserve verified capabilities and health proof through deploy retries.
- Allow dedicated Wrapped HTTP access to be turned off or back on in place while
  preserving pinned authority and signing secrets; search every KV inventory page
  before creating a deployment namespace.
- Use Cloudflare-compatible redirect handling for Lit requests while rejecting
  redirects before credentials can reach another host.
- Recheck session authority before publishing metadata, preserve upload-time
  ownership, and make canonical version selection deterministic.
- Bound encrypted exports and analysis scans, and validate generated analysis
  claims against the responses they cite.
- Recover queued agent submissions without repeating uncertain broadcasts.
- Keep explicit Agent HTTP disablement authoritative over an older enabled
  alias in profile-less Bridge policies.

- Retire Agent Bridge bot webhooks, commands, callbacks, and Mini App routes.
  Keep scoped HTTP credentials, one-time invites, browser login exchange,
  submission queues, and Session Wrapped. Explicit Agent HTTP disablement wins
  over legacy flags; existing account keys, credentials, queue identifiers,
  legacy HTTP/skill aliases, and historical review evidence stay compatible.
- Remove bot secret provisioning and webhook/menu/name/photo requests from the
  local Bridge deployment helper. Existing deployments require separate operator
  webhook/menu and secret cleanup; no live cleanup is performed by this change.
- Keep caller `humanApproved` submission authorization distinct from historical
  verified human confirmation/edit evidence. Current HTTP routes cannot create
  those historical review records.
- Regenerate the native Cloudflare deployment package with the current Session
  Worker authority and storage fixes.

- Keep generated session Worker and Agent Bridge names within Cloudflare's
  54-character limit for Workers with version previews. Hosted deploys for
  sessions with long names were rejected; existing names are unchanged, and a
  deploy already rejected for a long name asks to be started again.
- Keep the group list of a `group_gate` storage profile when the deploy helper
  stores session config. Without it, the Worker denied every group-gated upload.
- Stop sending the `cache` fetch option, which Workers at the deployed
  compatibility date reject. Deploy helpers could not read release manifests,
  hosted Wrapped deployments never passed their health check, and Wrapped
  Bridges could not confirm session membership.

### Benchmark reports

- Preserve observed response distributions, uncertainty and source provenance
  across saved reports, HTML reports and Context Engine exports.
- Keep legacy analysis fingerprints bound to the saved report while normalizing
  display content. Correct saved distributions using the original cell-rounding
  calculation when necessary, without relaxing inconsistent-statistics checks.
- Keep the benchmark Results presentation and its publication artifact aligned.

### Build and verification

- Update the PDF export dependency DOMPurify to 3.4.17 to address its newly
  reported sanitizer vulnerabilities.
- Refresh the shared Zod dependency to 4.6.7 within its consumers' supported
  ranges to address a validation memory-exhaustion advisory.
- Pin the browser smoke job to Ubuntu 24.04, which supports the pinned
  Playwright version, so runner image updates do not prevent Chromium setup.

### Contract source

- Reject survey and question IDs that collide across the two types, preventing
  them from sharing a response-hash slot. The public ABI is unchanged. This guard
  applies to newly deployed contracts; existing deployed contracts are unchanged.

### Upgrade notes

- Follow the [publication upgrade guide](docs/publication-upgrade.md) before
  the site deploys. The client now gives admin precedence only to versions an
  upgraded Worker stamped at upload, so older admin corrections to questions
  and surveys stop winning until an admin republishes them. Upgrade affected
  Workers and republish intended corrections before the new client is live.
- Builds without a Netlify `COMMIT_REF` deploy the Workers pinned to 0.6.14,
  which never write that stamp; admin corrections in sessions they create keep
  ordinary precedence until those Workers come from 0.7.0 or later.
- Existing Agent Bridges keep their Telegram webhook, menu and bot secrets until
  an operator removes them; this release performs no live cleanup.
- Update the project deploy helper and the relevant session Workers and Agent
  Bridges to use the Worker-side changes; a site deployment alone does not
  update existing Workers. See the [Worker documentation](docs/session-cors-worker.md)
  for deployment and compatibility requirements.
- New hosted faucet setup requires the updated deploy helper and Session Worker.
  Older helpers reject `faucet_self`, and older Workers do not grant it. Do not
  substitute the broad `faucet` scope to work around an old deployment.
- The application is version 0.7.0. MCP source is prepared as the independent
  package version 0.1.1; publishing the application does not publish it to npm.
  The existing `@agalmic/contextengine@0.1.0` package lacks these error-handling fixes.

## [0.6.14] - 2026-10-14

### Client — available when the site deploys

- Show the question actions hamburger by default on mobile, alongside the
  previous/next arrows. Stack the phone question counter in a narrow column
  and keep Submit, clear, the menu, and navigation together on one row.
- Move the filtered question count beside the session's Questions heading when
  there are no surveys, freeing toolbar space on phones. Keep the selector when
  surveys are available, and show zero when no questions match the filters.
- Keep long session names and their link icons inside phone layouts, reserve
  space for the Stats loading indicator, and keep Appearance menus readable.
  Wrap Worker group error details within narrow screens.
- Let Settings sponsorship checks finish across equivalent parent renders,
  retain General among other sponsor sessions, and show the route's session
  context when Settings opens on a session page.
- Count every question type shown in Stats, show loading indicators until the
  selected scope is ready, and request Worker sign-in only for the active session.
- Keep radio-key navigation and open comments on the current question; prevent
  double-clicks and double-taps from answering the next card.
- Match Context's AI prompt preview to the selected session's model settings.
- Verify Home's configured Worker independently of explicit session links and
  retain on-chain group reads for verified hybrid Worker sessions.
- Refresh bounded partial results for large Worker sessions while retaining the
  prior report during loading. The 10,000-record cap and incomplete-results
  warning remain in place.

## [0.6.13] - 2026-10-13

### Client — available when the site deploys

- Align desktop question navigation with the top of the card and keep its counter
  on one line when moving between questions. Keep mobile Submit controls clear
  of the navigation arrows.

- Show the Quadratic question type with a compact four-square graphic.

- Keep the Users Details session selector and Filter on one row, with long session
  titles contained beside the external-link icon.

- Fit Appearance controls into a compact row, align question navigation with
  the action buttons, and retain loaded results during background refreshes.

- Switch the active session directly from the Groups page, with session-scoped
  navigation and the selected session’s Worker discovery address.

- Load Questions in Tools from the selected session’s verified Worker, keeping
  unresolved counts in a loading state and failed reads distinct from confirmed zero.

- Bring the group creation form into view when opening it below the visible list.

- Center the session loading message with larger text and a spinner while keeping
  the elapsed-seconds counter visible across themes.

- Resolve Worker session sponsorship in Settings from verified session config and
  live resource presence. Distinguish unavailable checks from missing sponsorship,
  and retain selected-session model defaults for text AI and transcription.

- Route Context dictation and AI rewrite through the selected session's Worker,
  including local session changes and returning to the global default.
- Keep Back and Session above one Groups action row containing View All, Create,
  and Refresh.
- Restore the Questions toolbar as a full-width bordered panel with evenly
  distributed controls and centered wrapping on phones across all themes. Keep
  it pinned near the viewport top while scrolling, including pending Submit controls.
- Show the owning session name and slug for session-wide group member visibility.
  Keep shared group links scoped with an explicit `sessionSlug`, including when
  a different session is active, while supporting older links.
- Advance the question pile after binary and single-choice answers by default.
  Configure the deployment default in the client environment and override it
  per session with `pileAutoAdvanceEnabled`. Keep manual navigation available.
- Keep the active session selection consistent across Stats, account settings,
  Questions, Groups, and Context. Add a session filter to user details and link
  question rows directly to their session report.
- Simplify Stats counters and distribute four visible totals evenly. Make
  Explorer help work by click, tap, or keyboard even when automatic explainers
  are disabled, and keep navigation controls together when space permits.
- Refine the white theme with clearer account controls, readable wordmarks,
  softer Welcome artwork, larger mobile tabs, and a compact footer. Refresh
  returning clients to the updated default theme once.
- Add a collapsible setup graphic to Docs and shorten Groups help. Keep the
  standalone benchmark Results help popup within narrow screens.

## [0.6.9] - 2026-10-13

### Client — available when the site deploys

- Give Minimal session titles and their info controls readable dark-gray text,
  and show loading labels in black on Minimal and Classic 95 light surfaces.
- Use the shared title spacing, timed fade, and hover/focus reveal in Minimal.
  Compact its mobile header with a smaller logo while preserving account controls.
- Match the RxC session tooltip to the shorter Results description, including
  when cached session metadata still contains the retired trailing instructions.

## [0.6.8] - 2026-10-12

### Client — available when the site deploys

- Apply build-time deployment settings before theme and app configuration load,
  so hosted Worker release commits and self-hosted helper URLs take effect on
  the first browser load. Keep the pinned defaults when no override is set.
- Keep standalone benchmark Results headings, help controls, mobile spacing,
  and vote counts aligned with session reports: vote rows read Agree, Unsure,
  Disagree, and Responses, with Invalid shown when any run gave no usable
  answer.
- Make Minimal the default light theme with readable controls, dialogs, response
  cards, reports, group pages, and article charts. Preserve saved theme
  selections and binary answer colors.
- Add a Sessions directory to community Stats with authority totals and filters
  for session type, creation date, recorded activity, and admin address. Show the
  chart and leaderboard's session scope above each section. Undated sessions stay
  in date-filtered views, labelled "date unavailable".
- Improve mobile session spacing, section help icons, filter checkboxes, and
  narrow-screen logo display. Hide section subtitles while their content is open.
- Show one lightweight vector logo in every theme, sized and placed like the
  previous default logo. Remove the animated logo and the hidden per-theme
  copies that a first visit downloaded (up to about 8 MB).
- Enable the AI question filter for Worker sessions with configured AI access.
  Signed-out visitors in participant-only AI sessions are asked to sign in. When
  questions change, both AI filter views keep their ranking and ask you to click
  Apply to update it.
- Rename the Tools entry to Debate Map, retain its embedded view when a detail
  closes, and remove the disabled Suggest Tool card.

Answering and saved answers:

- Preserve a saved comment when an interview import leaves that field blank;
  explicitly cleared comments remain cleared.
- Keep edits to questions hidden by a filter when you submit, instead of marking
  them saved and discarding them.
- Wait for saved answers to load before any upload, in the pile, View all and
  single-question editors, including after a failed or capped listing, a failed
  start-up load, or a change in another tab.
- Load each question's saved answers before restoring its unsaved changes, in
  the pile, View all, and single-question editors, including questions that
  appear after a Submit (even when the refresh after it fails), a failed Submit,
  a decrypt, a filter change, or a sign-in after Clear changes. Submit no longer
  replaces saved answers with blanks, filtering a question out and back in keeps
  its draft, and an edit typed just before its question is filtered out is kept.
- Keep drafts to unsaved changes only. When restoring them, drop only the fields
  whose saved value changed since, and keep drafts written before saved answers
  loaded. Never store decrypted ratings in a draft while the saved ratings stay
  encrypted.
- Clear the previous account's answers, comments, ratings, and unsaved drafts for
  every session on sign-out or account switch.
- Make clearing a saved answer or comment take effect and stay cleared when
  saved answers reload, upload a cleared locked answer as cleared, keep encrypted ratings intact across repeated submits, keep a pending
  rating through Decrypt & Edit, and never publish a "*" placeholder.
- Keep saved encrypted ratings encrypted unless you turn a lock off, including
  when a locked comment's text is deleted or another question is submitted. A
  Submit leaves the saved answers of questions it didn't upload unchanged.
- After a reload, keep an answer or comment that was unlocked but not submitted
  locked as saved, with a note to decrypt and unlock it again.
- Hold back and name a question that can't be uploaded, such as an answer that
  is too long for the session Worker or a locked answer whose new audience needs
  a decrypt first, and upload the rest. A held-back answer keeps its draft and
  its consent choices.
- Size answers as the session Worker stores them, including the question text
  each answer repeats, locked fields, saved locked ratings, and interview
  records, and say how much to shorten an answer before submitting. Unlocked
  answers can use the full stored size.
- Never revert a consent withdrawal: withdrawn names, AI attribution, and
  research sharing stay withdrawn through undo, Clear changes, reloads, and
  failed or partial submits. After a reload, every stored withdrawal is pending
  and uploads with the next Submit.
- Send interview edits to the imported context (removed facts and names) to the
  AI, include unsaved pile edits in the interview review, and stop uploading
  interview drafts removed after a failed submit or discard.
- Show the saved-answers loading notice on session pages, keep the first pile
  card stable on a fresh visit, and skip re-reading cached question files on
  reload.

Sign-in, wallets, and privacy:

- Restore passkey sign-in after a reload without opening the login window.
  Logging out, or disconnecting from a wallet extension, also signs out a saved
  passkey wallet.
- Clear decrypted session names, information, headers, answers, and Lit keys
  from memory on logout or account switch.
- Send profile Analyze your public answers and public comments, but never
  answers you decrypted in this browser ("Only me", "Me + admin", Session or
  SBT-gated), and never cache an analysis built from them.
- Passkey wallet: reject a signing request for another account (error 4100);
  keep your account on a background re-unlock or ask you to log in again;
  relock when the app switches chains, finishing a request already in flight on
  its original chain; never resend a transaction after a lock; and give each new
  passkey a random user handle.
- Check that your own account signed the key wrap before deriving "Only me"
  keys, for MetaMask and passkey signatures alike. Envelopes written with 0.6.7
  still decrypt.
- Bind importance and conviction decrypts to their rating and question.
- Explain sign-in rate limits ("Too many sign-in attempts…") and retry once on
  an expired sign-in nonce.
- Keep Lit debug helpers out of production builds and load the Poseidon library
  only when a commitment is first computed.

Results and reports:

- Let admins decrypt "Me + admin" and Session answers from Results.
- Keep non-voters and comment-only participants out of the Report's opinion map;
  UMAP no longer treats skipped questions as "Unsure".
- Link named participants to their own profile.
- Prefer question metadata over answer payloads in the Report, CSV, and HTML AI
  analysis, and include multiple-choice answers in the HTML AI analysis.
- Show responses and non-responses for binary questions, count Breakdown choices
  once per person and option, and make the Raw Results summary line count like
  the Report.
- Stop recomputing the Report on idle refreshes, refresh it when comments or
  names change, and keep AI cluster summaries across live refreshes.
- Neutralize spreadsheet formulas in CSV exports, and read legacy 0–100 ratings
  on the 0–10 scale.
- Offer Retry in Results when responses fail to load, instead of loading
  indefinitely.

Authoring, sessions, and links:

- Show document, Arweave, token, and metadata links from uploaded surveys,
  questions, responses, SBTs, and session records only when they are safe web,
  Arweave, or same-site links; show other values as plain text. "View on
  Arweave" links only to Arweave transactions.
- Open uploaded, decrypted, and group files that could run script (SVG, HTML,
  XML) only as text or downloads; only raster images display as images.
- Keep one malformed upload from crashing the survey list or stopping new
  questions and surveys from loading for everyone.
- Treat reusing another author's question as published only when the stored
  question has exactly the same type, wording, and options; otherwise show the
  Worker's refusal. Scope new Worker survey ids to their author.
- Append generated questions to a non-empty draft, and don't let a slow registry
  check block publishing.
- Session creation: verify and publish Worker-backed sessions again (broken
  since 0.6.4); send cleared end times and limits; accept only slugs that
  participant links can open; keep Worker secrets on wherever "Require users to
  pay" is hidden; show why verification failed; and link the live session after
  a lost readback.
- Deploy grants send this build's configured Worker release, never an uploaded
  file or manual URL, and explain clearly when a sponsor has no release to
  deploy. /sponsor refuses grants up front when the sponsoring Worker has no
  release recorded.
- Builds without a Netlify commit deploy the 0.6.7 Worker release by default
  (previously 0.6.4).
- Show when a Lit authority needs replacement and let admins acknowledge the
  content-access limits before creating a fresh authority.

SBT groups:

- Protect group passwords against offline guessing: the client stretches each
  password with PBKDF2-SHA256 (600,000 rounds), salted by the group's contract
  address, before deriving the on-chain password check. Group-password groups
  always deploy to their predicted address.
- Start new group-password groups with a generated five-word passphrase and a
  Generate new button. Warn about custom passwords shorter than 16 characters
  and ask for confirmation. Lock the password during and after creation, and
  show it in the success panel for unlimited groups.
- Explain wrong, unreadable, and unsupported group passwords clearly, and offer
  Retry instead of an open Join when a group's password check can't be read.

App shell and performance:

- Recover from a stale deploy: reload once when a section fails to load, then
  show "A new version of Context Engine is available" with a Reload button.
  Never reload automatically while offline, more than once a minute, or twice
  for the same failure in the same deployed version.
- Cache only files that are part of the current deploy for a year; a missing
  /assets file now returns 404 instead of the app page.
- Enforce a baseline Content Security Policy (frame-ancestors, object-src,
  base-uri, form-action) and report a stricter scripts-only-from-this-site
  policy.
- Load fonts in one request with font-display: swap, give Minimal real Open Sans
  bold weights, and match the browser bar color to the theme.
- Smaller loads: the dev agent no longer ships in production; QR code libraries,
  DebateMap styles, the voice modal, and (on first load of non-demo sessions)
  the demo datasets load only where needed. If a demo's data can't load, the
  page shows the new-version panel instead of staying empty. The About demo
  video is about half the size, and About, post, and social preview images are
  smaller.

Docs:

- Describe the trusted operators for Lit-encrypted data: the session Worker and
  Lit account administrators. New authorities require Worker authorization;
  scoped usage keys alone do not grant key release. Lit is not end-to-end encryption.

### Worker — requires a session Worker update

- Authenticate Lit Action requests with a per-session Worker signature and
  encrypt decrypt replies to that request. A leaked scoped usage key cannot
  impersonate an SBT holder or substitute an RPC. Existing unsigned authorities
  fail closed and need a fresh PKP/group/key cutover; old permissions and
  historical ciphertext require separate handling. See the
  [Lit cutover guide](docs/lit-worker-authorization.md).
- Verify a reused Lit Action CID matches the Worker's signer, session, and PKP
  before granting permissions or returning the existing authority.
- Let only a question's or survey's first uploader or a session admin replace
  it, and add admin hide and unhide for questions and surveys. Ids stored before
  this release become admin-only; very large sessions finish indexing them over
  a few uploads, which may briefly return 503.
- Serve stored files with nosniff and a sandbox CSP, and download script-capable
  types instead of rendering them.
- Sign sign-in nonces instead of storing them, so other people can neither
  cancel a pending sign-in nor stop a wallet from getting a nonce; nonces are
  EIP-4361 compliant.
- Parse sign-in messages as strict EIP-4361 and require the signed Worker and
  session binding.
- Refuse voice calls when interviews are off, compare the deploy-helper secret
  in constant time, and cap and shape-check uploads (128 KiB per question,
  256 KiB per survey, 2 MiB per response upload, 96 KiB per stored answer).
- Results analysis: superseded public answers no longer return after a
  participant locks or clears them; only encryption flags lock a row; ratings
  read like the client; ties break deterministically; admin snapshots validate
  current question types and keep older types such as polls; answers that older
  clients cleared while locked read as cleared.
- Validate set-config against the merged config, replace limits on set-config,
  and compare origins ignoring case, default ports, and a trailing slash.
- Sponsored grant deploys use only the sponsoring Worker's recorded release. The
  0.6.8 deploy helper records the verified release on each new session Worker,
  and a retried deploy whose bundle check fails stays pending instead of
  orphaning its staged resources.

### Agent Bridge — requires an Agent Bridge Worker update

- Sign the Worker and session in sign-in messages. Update the Agent Bridge
  **before** session Workers: the new bridge works with both Worker versions,
  while 0.6.8 session Workers refuse the older bridge's sign-ins. This order
  keeps Telegram, Mini App, agent, and managed-faucet sign-ins available.
- Preserve established session aliases in those bindings and reject a named
  session mismatch without retrying against an unspecified session.

### Upgrade notes

- Breaking: password joins and new invite links no longer work for SBT groups
  created before 0.6.8; a clear message explains this. Invite codes already
  issued keep working. Admins who want password joins need a new group.
- Sponsoring Workers must run 0.6.8 or later code, with WORKER_BUNDLE_URL and
  WORKER_BUNDLE_MANIFEST_URL set, before their grants deploy a pinned release.
- Update each session Worker before editing questions or surveys with the new
  client. Rows written by 0.6.7 and earlier have no trusted uploader metadata,
  so readers use the earliest version, subject to the client's plaintext
  question hash-integrity check. Reapply any edits made during the
  upgrade window after the Worker update; updating alone does not recover them.
- Export required readable Lit content **before** updating that session's
  Worker. The new Worker rejects unsigned authorities, and creating a fresh
  authority does not migrate or restore access to historical ciphertext.
- During an in-place session Worker update or rollback, sign-in and new-id
  uploads can fail briefly while the update propagates. Nonce issuance fails
  closed with a retryable 503 when the coordinator cannot issue a signed nonce;
  it does not fall back to issuing a legacy stored nonce. Previously issued
  stored nonces remain consumable once.
- Fresh listings omit hidden question and survey ids. Older cached clients may
  retain entries until updated or reloaded. Unauthorized rewrites of an owned
  id return 409.
- Hiding removes a question or survey from discovery, new-answer views,
  interviews, and analysis. It does not delete historical responses or remove
  them from Raw Results and CSV exports; already-open cached views may need a reload.

## [0.6.7] - 2026-10-09

### Client — available when the site deploys

- Combine RxC context and topic navigation in one compact section. Start with
  three area circles, zoom into a group or topic in place, and use Back to return
  without scrolling past the full topic list. Related topic links omit the extra
  heading, and the introduction omits the repeated “More context” topic summary.
- Temporarily hide Debate Map for `rxc-ra-test`, keeping Report, Raw Results, and
  the Context guide available.
- Omit retired participation instructions from the `rxc-ra-test` report description,
  including when older session metadata is cached.

These client changes do not require updating existing session Workers. The known
issues listed for 0.6.5 remain unchanged.

## [0.6.6] - 2026-10-08

### Client — available when the site deploys

- Reuse cached user analysis when visible profile inputs are unchanged, including
  hosted profiles and the default session. Opening Analyze no longer forces a
  refresh; changed inputs, explicit Refresh and the existing 24-hour expiry still
  generate fresh analysis.
- Open Reverse Alignment focus areas in place of the topic list, with Back and
  previous/next controls at the top for easier navigation on mobile.
- Remove the decorative atlas image and redundant debate-map preview text.

These client changes do not require updating existing session Workers. The known
issues listed for 0.6.5 remain unchanged.

## [0.6.5] - 2026-10-04

### Client — available when the site deploys

- Update the legacy Axios dependency to fix inherited request-method and form-data option handling.
- Make quadratic allocation easier to answer: each option has − and + buttons, a block of squares showing what its votes cost, and a bar showing where your credits have gone. The question-type tile shows a matching compact preview.
- Keep group details inside session pages, simplify interview review controls,
  and improve help controls, documentation contrast and mobile atlas layout.
  Results now separates Report, Debate Map and Raw Results for RxC sessions.
- Make the pile and editing-card decrypt buttons open saved locked fields.
  Preserve audience changes made before or during decryption. Decrypt saved
  ratings with the answer so audience changes re-encrypt all three, and retain
  encrypted importance and conviction across successive locked edits.
- Wait for saved responses to load before uploading changes from a new device.
  Show loading and retry feedback, recover after a failed refresh, and read the
  participant's own saved answers when a complete public listing is unavailable.
  Keep completed submissions readable and preserve untouched answers, comments
  and ratings across sittings.
- Keep locks chosen on blank answers and comments while saved answers load.
  Allow navigation during that read, clear stale loading feedback after account
  changes, and let a completed sync supersede a stalled read on the next Submit.
- Make interview name and AI-attribution choices agree with the uploaded record
  after a failed submission, reopening or reload. Show the name actually being
  sent, retain consent per question, and keep withdrawals when moving between
  pile and full-survey editing.
- Let interview Apply finish after its own-answer read while public results
  are still loading, and clear read failures after a successful retry.
- Avoid repeated session initialization when the live URL changes between
  sessions before router props catch up.
- Preserve valid group joins through same-content configuration refreshes, while
  cancelling joins when their destination changes or authentication fails.
- Keep decrypted drafts with their owning account, mask retained locked values
  in uploads, and pad encrypted choices to avoid revealing their selected length.
- Bind sign-in messages to the intended Worker and session, improve rating
  keyboard controls, and reduce unused code and eager imports.

### Worker — requires a session Worker update

- Reject sign-ins and upload authorizations bound to another Worker or session,
  and validate signed destination Resources before accepting uploads.
- Count public answers with locked notes accurately in Results, while keeping
  encrypted ratings and note contents out of public analysis.
- Pin downloaded Worker packages to the client build's release. Updating the
  client does not automatically update an existing session Worker.

### Known issues

- In full-survey editing, saved per-question name and AI-attribution choices
  arriving after the editor mounts can be omitted from a later edit.
- Production SBT detail pages can lack the current block number because the
  subscription depends on a component name changed by minification.
- Simultaneous consent changes with equal timestamps and reloads against a
  lagging response cache still need stronger conflict-resolution guarantees.
- On a new device, leaving a question while saved answers load can leave its
  saved answer blank in the editor. A later comment-only submission can then
  overwrite that saved answer with an empty value.
- If the response listing lags immediately after a submission, loading saved
  answers can briefly revert a just-saved answer in the editor.
- On a new device, an interview prefill can clear a previously saved comment.

## [0.6.4] - 2026-09-28

### Client — available when the site deploys

- Add a browsable Reverse Alignment Atlas with twelve focus areas, source context,
  search, related topics, and mobile navigation for the RxC sessions. Keep the
  unpopulated topic map in Results labelled "Waiting for more data".
- Discover both RxC test sessions from their clean URLs on a fresh visit.
- Display linked community groups from their configured owning session, preserving
  existing memberships and logos without creating duplicate groups.
- Put compact AI submission choices beside Submit responses, strengthen the
  review heading, and remove the duplicate imported-context title.
- Resolve the signing chain before encrypting responses and preserve the saved
  chain during decryption. Hide new response locks when encryption is disabled.
- Keep Only me fields restricted to the submitter. Offer Me + admin on compatible
  Cloudflare sessions and Session only when membership is private.
- Keep binary interview answers when drafts are submitted again, for example
  after a cancelled signature or Continue interview, and keep unsaved pile edits
  when the interview loads saved answers.
- Make quadratic Reset an undo: it restores the AI's drafted allocation during
  interview review and the saved answer elsewhere, and stays disabled when
  nothing would change.
- Keep a later AI comment when the first draft had none, and restore the
  AI-proposed marker when a comment returns to its starting text.
- Score comparison ratings on each question's own scale, and count report
  answers with the same validation as the Worker's analysis.
- Load the Session Wizard without a second copy of the global stylesheet.

### Worker — requires a session Worker update

- Add authenticated response-field key wrapping for administrator and private
  session audiences, with current membership checks, bound session/field context,
  audit records, and no plaintext key cache in the client.
- Allow explicitly opted-in Cloudflare sessions to offer optional field encryption
  while keeping ordinary responses and Results public by default.
- Advertise these audiences only when the Worker has the encryption key and audit
  storage available. Existing session privacy settings remain unchanged.

### Agent Bridge — requires an Agent Bridge Worker update

- Describe quadratic questions to agents with their voice-credit budget, and
  document the quadratic answer format in agent instructions and skills.

## [0.6.3] - 2026-09-23

### Client fixes — available when the site deploys

- Show comparison summaries and clearly labelled perspective maps together, with
  model attribution and expandable comparisons for each answer type.

- Keep session-scoped profile groups on the selected session, distinguish private memberships from empty results, and place theme and color-blind controls together when space allows.

- Keep profile comparisons in the selected session, load Hosted answers without waiting for chain membership, verify the session configuration on a fresh visit, and show elapsed seconds and Retry when session data cannot load. Restore compact participant pills and comparison styling in both themes.

- Show which AI model generated a profile summary and describe preferences in
  plain language rather than listing scores and vote totals.

- Make interview prompt copying work on the first ready tap in Safari and iOS.
  Check session compatibility in advance, offer Retry when that check fails,
  and reveal the prompt for manual copying if clipboard access fails.
- Keep interview submission working with older session Workers by waiting for
  complete public response hydration when the older saved-answer lookup is
  detected. Current Workers retain strict saved-answer identity and completion
  checks. Existing v4 and v5 interview catalogs remain supported.
- Preserve interview review edits and complete voice instructions, handle
  legacy transcript events, and improve rating and quadratic-answer validation.
- Correct report totals, response ordering and exports; keep partial results
  visible with a warning when a large response history exceeds the loading cap.
- Improve keyboard access, report contrast, group filtering and cancellation,
  and passkey locking. Reduce the initial application bootstrap download.

### Worker fixes — sessions created after this release

New sessions receive the Worker package from this release. The package:

- Enforces private response-read permissions and the configured upload gate.
- Validates storage resource names and checks current authentication on the
  results-analysis artifact route, including stale tokens.
- Improves nonce handling and batches response-index reads.
- Supports authenticated `mine=true` saved-answer listings with responder,
  session and pagination proofs.
- Verifies the public configuration used by setup and publication, and keeps
  Verify usable before the first Publish.
- Strengthens Telegram invite, group and administrator authorization and
  validates all supported answer types in generated results.

Sessions created before 0.6.3 keep their existing Worker and remain supported
by the client. Creators may redeploy to pick up Worker-side fixes.

## Previously published changes

- Align report response bars with pile colors and add persistent Color-blind mode
  under Theme settings, applying shared response and chart palettes across the
  site and PDF reports. Preserve multiple-choice bars in desktop PDF captures.

- Add filtered written-response, rating, multiple-choice, and quadratic sections
  to the Polis report, with top-question previews, expansion, and PDF pagination
  that keeps fitting question blocks together. Remove the binary-only notice.
- Populate built-in Polis demo reports with tagged examples of all four answer
  sections, multiple questions per type, and configurable quadratic budgets.

### Added

- Quadratic allocation questions with configurable voice credits (99 by default),
  signed whole-number votes, quadratic budget validation, and positive, negative,
  and net result totals. Available in survey and standalone authoring, response
  views, named-vote AI analysis, exports, interview prefills, Telegram, and the
  local companion. Tag cards, simulated profiles, demo adapters, and report
  snapshots preserve ordered options and custom budgets.
  Pile submission errors remain visible with pending answers available for retry.

### Changed

- Added Cloudflare Group auto-join links on the detail pages of open, session-visible Groups.
  Session links retain the target across navigation and refresh before sign-in,
  join immediately after login, recognize existing membership, and clear
  completed or cancelled intent. A compact notice names the Group
  before sign-in and offers cancellation alongside the status.
  Group detail links preserve public Worker discovery across new tabs.
  Older clean Group links re-verify cached Worker discovery and show the full
  Group page instead of falling back to SBT block-scan progress.
  Kept the Cloudflare Groups refresh icon borderless and beside the section title.
  Matched the full Groups toolbar controls in height and styling, with subtle
  half-opacity white borders and borderless Refresh.

- Refreshed About functionality copy with accounts, gated content, and interviews.
  Added collapsible related-work and recognition sections with project-specific
  descriptions and links, including the Cosmos × FIRE grant announcement and
  Foresight Institute grant. Grant and event cards use official Cosmos × FIRE,
  Foresight, EDDY, and Edge Patagonia artwork.
  Recognition entries include visual badges, Agent Village artwork, and a
  collapsed preview strip. Renamed the original Recognition section to Acknowledgements.
  Related Work previews benchmark, eval, and media categories, with entries for
  Agent Village Wrapped and Ladders Made of Numbers.
  Moved Whitepaper and the email icon into the title bar and kept the mobile
  Demo and New Session actions side by side. Use-case buttons use compact rows that wrap on smaller screens.
  Title links briefly expand with matching labels on hover, focus, and press.
  Kept Related Work and Uses & Recognition previews compact, with square badges.
  Recognition combines Recognized & Used By and Acknowledgements under one dropdown.
  Acknowledgement dialogs introduce each entity before its connection to Context Engine.

- Kept Account Settings open when a saved passkey session restores in the
  background; the one-second success auto-close now belongs only to an explicit
  passkey **Create** or **Login** action. The signed-in owner's profile labels
  its session-scoped Cloudflare membership list **Groups Joined** and refreshes
  that private list when the active Worker session changes.
- Restored direct URL/file/photo context saves in the Tool Explorer without
  requiring question generation. The action names the active session, routes
  canonical Worker sessions through Cloudflare document storage, keeps
  Arweave/Lit behavior scoped to Arweave-backed sessions, and improves queued
  photo removal contrast across themes.
- Aligned the local Context Engine companion's default session scan with the
  Cloudflare-canonical `demo-sh` default and made its Worker login integration
  fixture attest the registry chain it is actually testing.
- Added credential-free CI configuration-contract coverage for every reachable
  session-mode family, plus runtime assurance for generated Cloudflare Worker
  envelope storage, concurrent multi-agent voting, representative
  response-encryption paths, and both `/new` infrastructure presets while
  keeping external-service live suites operator-run.
- Hardened the operator-local Cloudflare two-key E2E around isolated dev-server
  ports, exact deployment/auditor credential roles, current preset copy, Worker
  secret readiness, and fresh-KV propagation. The live proof now verifies the
  exact restricted token policy, worker-canonical login and encrypted
  upload/read/export, and exact cleanup of its temporary Worker and namespace.
- Reworked the demo Context viewer with a compact single-row desktop header so
  tweets, policy, papers, essays, interviews, sci-fi, metrics, and cross-corpus
  synthesis each use a distinct medium-native presentation. The Question
  Results modal now uses a coherent high-contrast overlay palette with a
  clearly separated light action panel.
- Brought pre-deployment Cloudflare Worker Group drafts to feature parity with
  normal Group creation: `/session/new` now queues image URLs or deferred local
  image uploads, tags, public reference URLs, member limits, join deadlines,
  admin addresses, join modes, and member visibility. Publish uploads local
  artwork only after Worker identity verification, merges session default tags,
  and preserves the uploaded URL for safe retries.
- Kept answer and additional-comment encryption controls independent by default:
  locking an answer no longer visually or actually encrypts its comments unless
  the user explicitly selects **same as answer** or a mandatory gate applies.
- Shortened the ordinary Claude/ChatGPT interview-prefill prompt, moved new
  handoffs to a distinct inert catalog URL to avoid stale external fetches, and
  made binary, rating, and multichoice answer formats explicit.
- Added default-on, per-session voice modes to the session microphone:
  `?mode=interview` runs an OpenAI Realtime one-person interview and maps only
  supported transcript/context evidence into explicitly reviewed response
  drafts, while `?mode=recordGroup` reuses rolling transcription to generate
  draft questions. Ordinary ChatGPT or Claude can use a public per-session
  Worker prompt and base64url fragment link to prefill the same review flow
  without MCP, plugins, installation, or pre-login account linking. Existing
  local answers are never replaced silently, normal login/submission remains
  final authority, and optional source platform/model prediction provenance is
  retained beside the final edited answer. Session creators can set the OpenAI
  Realtime voice model in `/new`; it defaults to `gpt-realtime-2.1` and is
  persisted in the public per-session interview configuration. The Interview
  modal now uses the session's high-contrast surface tokens, hides responder
  context unless an AI prefill supplied it, replaces verbose status text with
  an accessible green/red dot, and presents the Claude/ChatGPT memory handoff
  in a collapsed-by-default card titled **Paste this prompt to augment interview
  with history from Claude or ChatGPT**, with a dedicated caret-labelled **View
  prompt** control, muted prompt preview, and top-right clipboard icon. That
  zero-install handoff now presents itself
  as an explicit review-only user request, accepts only a session-approved
  return origin, requires a readable fact preview before encoding, strips
  identifying source details, and returns a clean interview link instead of an
  opaque empty packet when no relevant memory exists. The copied prompt now
  contains the complete user request while the fetched Worker endpoint returns
  only an inert JSON question catalog, avoiding fetched-page instruction
  ambiguity. External agents can include defensible low-confidence predictions
  with an explained basis; confidence is shown in the review UI and retained in
  submitted prediction provenance without re-authoring version 3 drafts through
  another model. The review now uses pile-style binary choices, confidence
  progress meters, collapsed evidence bases, compact remove/apply actions, and
  a scroll-bounded sticky apply rail. Copying the external-agent prompt gives
  immediate checkmark feedback, and the prompt asks Claude/ChatGPT to hide the
  base64url payload behind an **Open prefilled interview** link. Model provenance
  now survives the anonymous-review-to-login draft migration before submission.
  The `demo-interview` poll questions now use question-specific
  choices while legacy demo fixtures retain their historical choices. Realtime call setup now preserves the browser
  SDP offer byte-for-byte (including its terminal CRLF) and sends the SDP and
  JSON as typed multipart fields, avoiding OpenAI's empty-offer parse failure.
  Voice-mode chooser hover states now keep both titles and descriptions on the
  high-contrast accent text color, and the modal heading is larger. The
  interviewer now explicitly invites personal or topic-level insight and tells
  the responder they can steer the conversation at any point; completed
  responder speech is available afterward in a collapsed transcript
  disclosure. Empty evidence-to-response mappings now show a descriptive,
  high-contrast “not enough information” notice with concrete next steps and
  hide the unchanged retry action. The bundled `demo-interview` session also
  resolves its Worker without exposing a `worker=` query parameter. Claude and
  ChatGPT handoffs may now carry an already-known preferred responder name;
  sharing it with submitted answers requires a separate default-off opt-in, and
  opted-in names become the participant label in the results report. Interview
  review also has a separate default-on accuracy-research consent that records
  the original AI prediction, final submitted response, confidence, and changed
  fields. Locked answers and comments are represented by redacted markers in
  that comparison, with final plaintext captured before encryption solely to
  calculate the edit signal.
  External Claude/ChatGPT handoffs now also self-report research coverage:
  distinct prior chats, memory items, connected sources, and user-authored
  statements searched or used. The review shows those counts, unknown searched
  totals remain `null`, and opted-in model provenance retains them beside the
  final prediction comparison for fidelity analysis.
- Refreshed mounted Stats immediately after successful Cloudflare group
  mutations, evicting the affected session's short-lived Worker catalog cache
  before recounting groups and visible participants.
- Fixed Stats Users/Participants for Cloudflare-canonical sessions so visible
  Worker group admins and the signed-in viewer's own memberships contribute to
  the identity count without fetching or inferring hidden member identities.
- Updated Tag Explorer's Groups count and listing to combine tagged on-chain
  SBT groups with the public or account-authorized Worker group catalog for
  Cloudflare-canonical sessions, including direct URL-pinned demo sessions
  before registry hydration, using Worker-native detail links.
- Fixed inline Polis filtering for Cloudflare-canonical sessions so tag and
  question-type totals use identity-matched Worker question metadata instead
  of silently treating every question as metadata-free.
- Fixed Raw Results for pure Cloudflare-canonical sessions so identity-matched
  Worker question/response caches populate totals without requiring a chain ID
  or starting an RPC latest-block read.
- Fixed home Stats for an active Cloudflare-canonical session so questions and
  surveys come from its identity-scoped Worker caches, Groups count the
  viewer-visible Worker catalog, and the Groups detail modal stays on the
  Worker-native route.
- Renamed the `/new` setup choices to **Centralized** and **Decentralized**, moved Session
  colors into a default-collapsed More options section, and replaced the
  freeform group-creation policy input with a constrained dropdown there.
- Restored centered Welcome-slide headings across responsive layouts while
  preserving each theme profile's constant slide-frame and navigation height.
  Classic 95 now uses a compact viewport-aware frame across every slide, with
  wrapped titles and copy kept inside the shared content pane.
  On standard full-screen desktops, the opening artwork is centered and sized
  to keep the controls visible while placing the site footer below the fold,
  and the taller navigation strip restores the pre-theme 80px arrow scale.
- Replaced the Classic 95 beeswarm tooltip's yellow-to-olive Unsure gradient
  with a solid warning-yellow segment.
- Kept both Classic 95 Welcome-slide navigation arrows fully opaque and white
  while preserving the Context Engine theme's existing arrow treatment.
- Restored editing controls for an account's submitted standalone-question
  response and made explicit passkey login open the platform chooser when
  multiple passkey-derived wallets are available; background signing remains
  pinned to the active credential.
- Gave the Classic 95 question lock-audience popup a raised Windows-style
  boundary so it remains distinct from the question card beneath it.
- Fixed signed-out standalone-question bookmarks so the control updates its
  pressed/color state immediately and restores the session-scoped bookmark
  after a reload.
- Restored the Questions toolbar's viewport-sticky behavior in Classic 95 and
  kept unchanged response inputs memoized so binary vote selection avoids
  rebuilding every visible question control.
- Kept related-tag chips readable in both bundled app themes by using each
  theme's paired control surface and foreground colors.
- Reordered Docs so Prompts precedes FAQ, removed the external-tools notice,
  grouped the bottom session context and Smart Contracts viewer in one frame,
  and added a public GitHub shortcut beside the title. The signed-out login
  control is now text-only and uses the active theme's button font.
- Removed the duplicate Posts link from the About hero while retaining Posts
  in the persistent footer navigation.
- Added a named runtime SCSS app-theme contract with user/deployment precedence,
  pre-paint initialization, a default-on Settings selector, and bundled
  `context-engine` and `classic-95` themes. The complete client presentation
  surface now consumes semantic runtime color, typography, geometry, border,
  elevation, and control-state tokens; a zero-baseline source gate prevents
  raw presentation colors outside narrowly owned theme, export, QR/bitmap, and
  deterministic avatar sources. Session metadata cannot select an app theme.
  Question authoring now uses explicit paired workspace/control/input tokens;
  Classic 95 renders the generator and its toolbar on readable standard gray
  surfaces with white fields instead of mixing black controls into navy. The
  session question, simulated-user, and Groups surfaces now retain readable,
  minimal gray panels at desktop and mobile widths. Its semantic
  `desktop-window` layout profile now presents Tools as Control Panel applets,
  Community Stats as a participant/plot split window, session questions as
  compact dialogs, and footer navigation as a taskbar without theme-ID
  selectors in components. The Classic 95 taskbar stays docked to the viewport
  bottom on short and scrolling pages while reserving space for page content.
- Fixed local Vite startup for the shared CommonJS group-password derivation
  helper. Persistent startup failures now stop after one automatic cache-busted
  reload, and the recovery heading uses the active panel-text token so the
  fallback remains readable across themes.
- Added **Session colors** to the Session Wizard with the curated
  `context-engine`, `ocean`, and `amber` schemes, immediate preview, exact
  `appearance.colorSchemeId` persistence across Worker/Arweave paths, scoped
  active-session accents, accessibility contrast checks, and fixed-light
  standalone exports.
- Added `/session/demo-2` as a fixture-backed preview of “Living With
  Artificial Minds”: 40 typed questions, 62 unique simulated participants,
  deterministic generated responses, and a three-cluster Polis report.
  Poll choices, rating bounds, freeform answers, and stable question IDs now
  agree across the session, report, and question-results surfaces. Simulated
  rows are display-only and live responses win collisions. `demo-sh` remains
  the public default until a dedicated demo-2 Worker, canonical question seed,
  and Worker-held AI key pass live voice/AI verification; no credential is
  stored in the preview config or fixture data.
- Preserved the published `demo-sh` question fixture exactly while preventing
  tri-state sentiment from being presented as a poll, rating, or freeform
  answer. Distinct corrected choices for legacy polls remain deferred until a
  deliberate Worker reseed. Direct Debate Map issue links now close back to the
  Atlas index when no safe return target exists.
- Made SBT and related holder-cache writes atomic across discovery, detail
  hydration, profile scans, filters, selectors, and realtime events. Delayed
  scans now preserve newer activity, unrelated networks, and concurrent user
  responses, and readiness is published only after persistence succeeds.
- Added a `/benchmarks` route for bundled AI Opinions Benchmark reports. The
  static viewer treats models as participants, preserves interactive report
  controls inside a sandboxed frame, and labels incomplete or unvalidated
  artifacts as development previews rather than released results.
- Replaced the `/contracts` utility reference with a user-facing `/docs` page
  containing a quickstart, session-options guide, and FAQ. The page retains
  AI prompt references and a contract deployment explorer that waits for an
  explicit session selection before showing its chain and published contract
  addresses; sessions without published addresses show an empty state instead
  of global template contracts. The page removes the JSON bundle and
  byte-conversion UI. Existing `/contracts` paths permanently rewrite to
  `/docs` while preserving deep-link paths, queries, hashes, and deployment
  base paths.
- Added a repository link to the Docs header. Refreshed the public `llms.txt`
  agent summary with the
  current deployment profiles, authoritative architecture references, and safe
  automation guidance.
- Made address comparison session-aware across legacy registry, pure
  Cloudflare, and hybrid session profiles. Compare routes now preserve the
  active session, wait for its canonical caches, isolate cache and prompt
  fallbacks by slug, await on-chain profile enrichment before analysis, and
  skip chain scans for pure Worker sessions. Independent summary, compass, and
  overlap work now loads concurrently with section-level progress, and compass
  exports use a descriptive comparison filename. Two- and three-participant
  Venn diagrams now share one deterministic region model, expose keyboard- and
  click-pinned detail cards with membership images, and keep AI output from
  overriding region counts or evidence. SBT comparison and profile ownership
  now share session + chain + contract identity and one count-provenance rule;
  native Worker Groups use the same projection contract with session + group
  identity. Canonical compare URLs now use repeated `subject=` parameters with
  explicit `wallet:`, `worker:`, and `sim:` tokens; legacy address-path links
  normalize through the same route contract. Wallet and Worker responders now
  resolve from the active session projection while shipped simulated personas
  use stable corpus question IDs; the UI names each source and session, skips
  chain/cache waiting for simulation-only comparisons, and suppresses opinion
  or membership sections when their evidence is not canonically compatible.
  Related simulated-persona cards now offer a canonical compare action while
  retaining their existing profile links.
- Moved the Community, Polis, and demographic-comparison question beeswarms
  onto a reusable renderer with explicit consumer-owned metric/domain labels,
  named force/stacked layouts, stable-key hover state, and
  keyboard/click-pinned detail cards. Community's live and demo paths also
  share one result-to-point projection so their counts and fallbacks cannot
  drift.
- Clarified the repository boundary between canonical Worker source,
  Cloudflare-native deployment packages, local bundle output, immutable CI
  bundle releases, and the stripped public-source snapshot. Release docs now
  accurately distinguish immutable bundle publication from the separately
  approved stable/`latest` promotion workflow. Source-tree public-text checks
  now scan the same tracked and non-ignored files as the release exporter,
  avoiding ignored local caches without overlooking untracked release input.
- Streamlined the client dependency surface by removing eight unused direct
  packages, replacing standalone preview and source-map tools with Vite-native
  preview and a local deterministic bundle report, and loading only the
  two-input and three-input Poseidon implementations used by survey runtime.
- Added automatic patch-version commits for each prepared public release
  candidate, synchronized across root/client manifests and lockfiles. Public
  release tooling, pre-push checks, CI, and worker-release metadata now enforce
  the shared version, while minor and major bumps remain explicit
  operator-directed decisions.
- `/new` now capability-filters optional fields even after `Customize`: pure
  Cloudflare sessions omit block, faucet, and contract controls, persist
  generic Worker/Group defaults, and may set a Worker-enforced closing
  timestamp that stops participant resource use and mutations while preserving
  reads and signed admin access. Explicit Cloudflare + on-chain SBT profiles
  expose only their network and Group Factory subset; decentralized profiles
  retain their chain controls. Worker Group creators now prefill the configured
  generic tags with legacy `defaultSbtTags` fallback. Joining a Worker Group now
  reports success and changes the membership action to **Leave**; authenticated
  participants can remove only their own membership through `/groups/leave`.
  Permission-visible Groups expose a paginated SBT-style member browser without
  leaking Worker storage keys, and unlimited capacity now uses only the
  infinity icon instead of repeating “Unlimited.”
- Telegram group approval no longer creates bearer-capability `startgroup`
  URLs. Bot, Mini App, and Agent API compatibility surfaces now direct a
  configured session admin to approve from inside the target group with
  `/join <session>`, while legacy approval payloads fail closed. Mini App
  onboarding now accepts signed Telegram `initData` only in a POST JSON body or
  the canonical request header; GET and query-string credential transport are
  rejected.
- Worker-canonical sessions now project setup, account settings, Admin metadata,
  diagnostics, secrets, and route errors from the active capability profile.
  Pure Cloudflare sessions use passkey access, Worker config, AI, storage, and
  native Groups without presenting RPC, gas, faucet, Arweave, Lit, registry, or
  SBT requirements; explicitly enabled hybrid and registry sessions retain
  their chain controls. Profile compilation, persistence, canonical readback,
  and Worker validation now reject schema-only, unavailable, malformed, and
  cross-lineage combinations instead of inferring capabilities from legacy
  chain fields. Profile-bearing Worker records now require one matching
  canonical storage object, including exact backend, payload policy, and access
  conditions; incoherent deploys, mutations, and public readbacks fail closed.
  Public-result claims require unencrypted public storage. Session pages also suppress wallet/network controls, Lit hooks,
  SBT auto-mint and filters, non-Cloudflare document references, and Polis
  blockchain metadata for pure Worker profiles, clearing stale chain-backed
  state when the active capability profile changes.
- The native `/new` deployment path now presents an honest Cloudflare dashboard
  checklist with copy controls, return guidance, and Worker URL/CORS/canonical
  config verification before success. Its entry chooser removes redundant
  infrastructure guidance, identifies decentralized RPC access and gas as
  `EVM RPC URL` and `EVM Gas (TX Fees)`,
  and links directly to the README architecture diagram on GitHub. The
  deploy-helper remains a collapsed legacy fallback.
- Worker route failures now distinguish missing discovery, reachability, CORS,
  missing canonical config, and identity mismatch, while native Group cards add
  stable detail/share links and state the current admin-managed leave boundary.
- Worker-canonical web sessions now use native Cloudflare Groups instead of
  opening the on-chain SBT deployment form. Group records support names,
  descriptions, HTTPS images, open or admin-added membership, and visibility
  without contract addresses, chain transactions, gas, RPC, or burn settings.
  They also retain SBT-style tags and public reference URLs plus Worker-native
  member limits, self-join deadlines, and group-admin addresses; limits and
  deadlines are enforced in the authoritative Durable Object membership path,
  and participant creation derives the admin address from the signed principal;
  their creator now shares the compact URL, clipboard-paste, file-upload, and
  preview workflow used by the SBT creator, publishing uploaded files through
  the active session storage policy before group creation;
  the client pins the exact Worker origin while nonce/login, JWT, Group
  request/response, record, and Durable Object state bind the canonical slug and
  session ID. Missing or conflicting identity and pre-existing same-slug data
  fail closed with reconciliation required, late cross-session responses are
  discarded, Worker/SBT hybrids label their configured on-chain conditions
  separately as Advanced access, Worker-native creation stays scoped to the
  active session, and registry-backed sessions retain the SBT flow. Native
  Group card bodies now open the full SBT-style detail layout in a new tab;
  canonical list links use `/groups?sessionName=<slug>` and non-address
  Worker detail links use `/group/<groupId>?sessionName=<slug>`. Legacy
  `/groups/:slug` links normalize to those routes, while address-shaped
  Worker IDs remain at `/groups?sessionName=<slug>#group-<groupId>` so
  `/group/<address>` stays reserved for SBT detail.
  Full detail translates SBT stats into member capacity and a live join
  deadline, exposes member counts and identities only through authenticated
  visibility-aware responses, and renders the Group's public document
  references and tags in the shared More section.
  Legacy per-session Worker question payloads without an embedded session ID
  remain readable from their verified Worker authority, while present
  mismatched or malformed IDs still fail closed; cache readiness now commits
  after the final Worker hydration state so session question collections render
  immediately.
- Every `/new` mode now offers an admin-only or all-participants group-creation
  policy. Worker participants use an authenticated, chain-free create route
  that forces open session-visible groups while admin mutation controls remain
  signed. Independently, explicitly public, unencrypted, ungated Worker modes
  expose only redacted, session-visible group metadata before sign-in; private
  modes and all joining, creation, memberships, member identities, and member
  counts remain authenticated. Public group routes stay anonymous even when the
  browser remembers an account, deferring Worker authentication until a visitor
  chooses Create or Join; session-scoped group routes also expose their
  canonical session identifier in the query string and a prominent link back
  to the active session. Registry sessions enforce the creation choice across
  their session and SBT page controls while disclosing that public factories
  remain independently callable on-chain. Legacy Worker configs remain
  admin-only.
- Git-backed Netlify builds now bind the native Cloudflare Deploy Button to
  Netlify's exact public `COMMIT_REF`; builds without a public commit remain
  fail-closed with the native deployment card disabled.
- Public-release scrubbing now preserves the byte-stable generated Cloudflare
  Worker package while continuing to scan its bundled dependency contacts,
  preventing email-shaped wordlist data from being rewritten after hashing.
  Hosted public-text verification now builds a temporary canonical release
  artifact and scans its actual bytes, while direct source-tree verification
  remains strict.
- SBT claim and invite codes now default to explicit export without silent
  browser persistence; existing scoped recovery entries remain readable for
  compatibility.
- Added explicit opt-in encrypted SBT recovery using AES-GCM, authenticated
  chain/address metadata, and a non-extractable IndexedDB key. Unsupported,
  missing-key, and tampered records fail closed to export-only behavior, and
  group-scoped local recovery can be cleared from the admin UI.
- Made Worker authorization current at request time. Login tokens now bind a
  server-managed session authorization epoch, effective config changes
  invalidate prior tokens, and protected routes fail closed unless both the
  signed scope and the current default/route-specific policy allow access.
  Nonce redemption and route limits now use the mandatory Session Durable
  Object, closing cross-isolate replay and concurrent-limit overshoot without
  persisting principal identifiers in coordinator records.
- Encrypted every canonical Session Worker secret record at rest with
  session-bound AES-256-GCM before deploy-helper or signed-admin KV writes.
  Current/previous KEK recovery is bounded, legacy plaintext records are
  read-only compatible and migrate on signed update, all new deployments
  receive an independent KEK, and interrupted activation cannot silently bind
  ciphertext to a lost replacement key.
- Closed the legacy first-signer Worker bootstrap path. Initial session config
  now requires either the deployment-bound bootstrap admin or an existing
  registry session whose on-chain admin matches; missing registry wiring and
  unregistered slugs fail closed.
- Enforced client entry, non-vendor chunk, and temporary AppShell byte budgets
  from Vite's build manifest, with protected no-growth policy and generated-doc
  drift checks. Removed an unconsumed static-image compatibility copy that
  duplicated 21 emitted assets (16,618,799 bytes); future cross-tree image
  duplicates now fail the post-build gate.
- Made client test-universe claims complete and monotonic. One instrumented
  Jest run now accounts for every tracked production source while preserving a
  fixed legacy comparison metric; recursive Node discovery closes nested test
  omissions; and every tracked typed test/helper is classified under a
  real-framework-type diagnostic ratchet. Coverage exclusions, floors, legacy
  membership, and typed-test debt now fail closed against protected baselines.
- Bound Worker releases to the exact bytes produced by successful aggregate
  CI. SHA-keyed artifacts now carry source/replay/tree, builder-run, recipe,
  lockfile, and bundle-digest provenance; publication refuses failed or
  mismatched runs and never rebuilds. Immutable releases no longer move
  `latest` automatically, while a serialized, protected manual promotion keeps
  stable and previous rollback refs. GitHub Actions are pinned immutably.
  Session Setup and Admin Wrapped deploys now bind the corresponding manifest
  digest before request coordination and reject changed bytes before any
  Cloudflare mutation, including retry and repair paths.
- Unified local and hosted CI behind `scripts/ci-gates.json`. The local
  aggregate now runs the full client coverage and tracked root Node universes once,
  hosted jobs execute the same named gates, aggregate results fail closed
  against the hosted profile, and `verify:release` remains a separate
  non-coverage release rehearsal. Public-package scrubbing keeps retained gate
  commands aligned with retained scripts.
- Hardened new-session profile continuity and enforcement: explicit saved
  profiles now survive `/new` reloads behind a clear continue action, invalid
  profiles fail before publish side effects and are rechecked against the live
  draft after asynchronous preflight, stage-local errors identify the
  setting to fix, storage backend changes preserve an explicit Cloudflare role
  gate without carrying Cloudflare fields into Arweave, and unsupported
  result/export promises remain visible but unavailable. The compact selectors
  now support arrow keys and editable multi-digit group thresholds.
- Made Telegram Mini App an independently enforced session surface that still
  requires Telegram, while keeping Agent Session Wrapped independent. The
  Bridge now consumes canonical nested result-exposure settings before legacy
  aliases and excludes Mini-App-disabled sessions from every Mini App picker
  and route; onboarding cannot mint a credential for a disabled Mini App,
  activity and settings requests fail closed when no enabled session remains,
  and launch-bound settings cannot target a different session.
- Made direct Agent HTTP authorization independent of Telegram for user invite,
  service bootstrap, and ordinary authenticated API requests. Explicit session
  profiles now enforce `surfaces.agentHttp`; pre-profile Bridge records retain
  their historical direct API behavior unless they explicitly disable it.
- Integrated hosting customization into the existing session setup stages:
  storage, encryption, decryption access, and result visibility now live in
  Privacy; optional participation channels live in Worker; and export policy
  lives in Deploy. The compact header no longer opens a large technical
  popover, profile-based drafts no longer show a duplicate legacy storage
  editor, and custom decryption rules stay hidden until the creator overrides
  the explicit Cloudflare defaults.
- Moved session hosting selection into a compact header control, kept the
  selected Cloudflare, decentralized, or custom profile visible in the title,
  and previewed Corporate hosting as unavailable without changing publishing
  semantics. Cloudflare token guidance now explains that the linked form
  prefills permissions for users already signed in.
- Restored the two primary `/new` setup choices as large, requirement-aware
  entry cards. Selecting Centralized or Decentralized now transitions to
  the existing compact header selector; the native fast path identifies its
  creator inputs as a Cloudflare login and one AI API key.
- Made `contextengine.sh` the canonical public URL across site metadata,
  discovery assets, documentation, and Agent Bridge links. Worker and Bridge
  bootstrap allowlists now prefer `.sh` while retaining `.xyz` as redirect
  compatibility.
- Replaced the placeholder emoji favicon family with an optically centered
  white Context Engine circuit C on transparent browser, Apple touch, and
  Android icon backgrounds, using the high-resolution circuit artwork for the
  larger touch and installed-app assets.
- Added a repository-owned Netlify build contract for strict, Node 20 client
  builds from public `main`, with pull-request preview guidance and the existing
  manual-deploy redirect fallback retained.
- Refreshed the AI discourse corpus with verified 2026 policy, safety,
  evaluation, and practitioner sources; consolidated duplicate records,
  repaired primary-source provenance and tweet metadata, synchronized the
  client sample, and added normalized-URL and duplicate-title quality gates.
- Toolchain correction (2026-07-19): Vite is the canonical client dev/build
  path, and normal client installs again use npm's strict peer resolution.
  Earlier entries describing Create React App as canonical or durable
  `legacy-peer-deps` installation reflect superseded intermediate states.
- Unified Agent Bridge authentication around session-bound user, browser, and
  named service credentials. Telegram is now an optional identity adapter;
  one-time invites can onboard an opaque non-Telegram user, the root token is
  limited to bootstrap/break-glass semantics, and browser exchange returns
  separate Bridge and session-worker credentials.
- Added the hybrid Agent Session Wrapped path for worker-canonical and
  registry-canonical sessions through one deployment-pinned session-Worker
  membership verifier. Dedicated Bridges now require explicit one-session
  policy, use the sole `surfaces.agentHttp` capability bit, deploy without the
  unused Durable Object or Telegram resources by default, exchange Worker
  credentials for at-most-24-hour session-bound `ceagt_` member credentials,
  and accept Wrapped answers over HTTPS/KV without an agent-originated EVM
  transaction. Session Setup and Admin support request-only enable, retained-
  resource disable-access, health, and idempotent redeploy controls with
  capability publication only after durable verification. Ordinary Wrapped
  uses canonical session questions, explicit historical/agent-only configs
  retain proposal windows and storage prefixes, and posters default to the
  deterministic local renderer with separately configured optional OpenAI
  generation.
- Added direct session-worker access-group views and open self-join controls to
  agent-enabled sessions, plus signed group and member administration in the
  existing Admin surface. The Agent Bridge does not proxy or mirror this state.
- Removed the unused mock OpenClaw forwarding module and catalog entry while
  retaining transport-neutral direct HTTP and optional host-agent adapters.
- Completed the frontend modernization baseline with typed domain boundaries,
  downward-only type-debt and size ratchets, decomposed session, survey, and
  application shells, split CI/release verification, synchronized worker-bundle
  checks, and public-release surface validation.
- Added stable automation hooks for gate-lock state and gate selection without
  changing user-facing behavior.
- Hardened public documentation packaging so operator runbooks and internal
  planning material are stripped, while retained Markdown is checked for
  private references, unavailable commands, and broken local links.
- Hardened public release artifacts so private file inventories are not
  published, retained text is scanned for private references, and unowned image
  files fail verification; removed unused image assets without changing the
  active animated logos.
- Reduced the two active logo GIFs by about two thirds while preserving their
  dimensions, duration, looping behavior, luminosity-blended presentation, and
  current Navbar and SBT loading owners.
- Enlarged the sparse three-card Tools view so its image cards use the available
  full-screen width and viewport height while retaining compact mobile sizing.
- Replaced the default Tools image-card status frame with UserPage-style 3D
  depth, keeping live/future borders visible only while demo mode is enabled.
- Moved desktop main-screen Welcome controls into a compact bottom strip and
  kept titles, artwork, and copy within one viewport-capped frame, including
  ultra-wide/short displays, without changing session welcome slides.
- Added theme-owned Welcome artwork detail controls so Classic 95 can present
  legacy slide images with visible detail and readable native final actions
  while Context Engine preserves its original treatment.
- Added the agent bridge worker and its test runner to the public release
  surface, with public-safe setup examples and artifact-level PII verification.

### Fixed

- Corrected passkey account creation so Chromium-compatible registration offers
  ES256 and RS256, uses PRF output from registration without an unconditional
  sign-in-style second prompt, and labels the pending action as creation.
  Worker-canonical sessions now retain their verified dedicated Worker during
  response submission, skip chain-only block scans and automatic faucet calls,
  finish durable Cloudflare response writes without an EVM transaction, and
  hydrate those responses after reload under a stable chainless cache scope.
  Response list metadata is bound to the authenticated Worker uploader instead
  of trusting a self-claimed responder address in the stored JSON.
- Replaced the About-page Google Drive video embed and thumbnail dependency
  with the repository-owned `about-demo.mp4` on desktop and mobile, so public
  playback no longer depends on third-party cookies or Drive playback limits.
- Kept registry-backed session scans bounded when Arweave metadata is temporarily
  unavailable by deriving the creation block from the registry tuple timestamp
  before attempting legacy event-log recovery.
- Kept history-preserving public releases self-testing when the Agent Bridge
  cutover follows a source-only baseline by restoring its narrow root test
  command alongside the audited worker and runner snapshot, while using the
  artifact scrubber to remove commands whose private runners are stripped.
- Made Agent Bridge credential rotation publish replacements before retiring
  prior records, rejected query-string bearer credentials and nested browser
  exchanges, pinned credentials to their issued session, and made managed
  account issuance fail closed without signer configuration.
- Enforced `session_member_aggregate` result visibility against live canonical
  worker membership and the configured minimum group size for JSON and image
  results, failing closed when membership cannot be checked. Telegram-optional
  user and service exchanges now derive their worker wallet from the stored
  credential principal.
- Granted the explicit worker-group scope after a registry-backed participant
  passes the session's default gate, restoring direct group reads and joins
  without weakening group membership checks.
- Prevented worker-native group state from silently switching to an unrelated
  D1 or envelope-audit binding: session-worker groups now use only the explicit
  group KV or storage-index KV aliases, and D1-only group configuration fails
  as unconfigured.
- Kept worker-envelope key-release audits on the explicit audit KV or storage
  index KV, ignored unrelated D1 aliases, and preserved fail-closed
  audit-before-decrypt behavior when persistence is unavailable.
- Required the explicit `groups` JWT scope for worker group listing,
  self-membership reads, and joins instead of accepting the legacy `arweave`
  storage compatibility scope.
- Stopped generated session-worker Cloudflare profiles from advertising an
  unused D1 primitive; payload indexes, envelope audits, and group records now
  describe the KV authority that the deployed worker actually binds.
- Made KV index rows authoritative for per-item Cloudflare R2 authorization
  metadata: uploads now require a readable/writable index binding, and reads
  fail closed without a valid matching row instead of falling back to weaker
  object metadata.
- Bounded Cloudflare storage listings to opaque-cursor pages and preserved
  manual continuation in the Document Library when authorization filtering
  produces an empty page with a later cursor.
- Made targeted survey-response refreshes merge into the latest cache snapshot,
  resolve concurrent same-responder updates without regressing newer or
  unorderable values, keep scan watermarks monotonic, and publish their UI
  revision only after durable cache persistence succeeds; detached initial
  refresh failures are now caught and logged at the results lifecycle boundary.
- Made the remaining survey and question discovery, response hydration, and
  application event cache commits merge only their active deltas into the
  latest managed-cache snapshot. Concurrent metadata, responder recency,
  retry state, and monotonic watermarks are preserved, while readiness,
  revisions, and awaited success are withheld when persistence fails.
- Serialized first-use worker-envelope keys and signed session-config writes
  through one per-session coordinator, rejected unreadable R2-only envelope
  writes, and removed unsafe unused key-changing Admin actions. Cloudflare
  uploads retain documented at-least-once retry behavior.
- Hardened the `Surveys` source contract and client preflight so zero survey or
  question IDs, zero content or response hashes, and mismatched optional
  survey-response pairs fail before ambiguous state or wallet submission.
- Required configured deterministic SBT deployments to be submitted by the
  configured SBT admin in both the source contract and ethers-v5 client
  preflight, preventing public callers from front-running predicted addresses.
  These immutable-contract fixes require a separate testnet redeploy before
  they are live at configured addresses.
- Fixed passkey survey-response uploads by preserving object-valued EIP-1193
  providers through worker authentication, kept SBT metadata and image reads on
  AR.IO while direct mode is enabled, and serialized shared RPC reads per
  endpoint so one 429 stops queued requests before they create a console burst.
- Fixed active-session SBT loading and sponsorship reporting by avoiding full
  registry enumeration, refreshing selected worker fields before survey
  uploads, moving the rate-limited Tenderly OP Sepolia gateway to the last
  fallback, and reading boolean-only resource presence from the session worker.
- Prevented repeated RPC retries against browser-forbidden (`403`) endpoints,
  and constrained returning passkey-wallet unlocks to the stored credential so
  SBT mint/sign prompts do not reopen the passkey account chooser.
- Removed failing anonymous OP Sepolia fallback fanout from cold session loads,
  deferred worker resource-presence checks until account settings are opened,
  and resolved Vite's browser `buffer` shim explicitly.

## [0.7.0] - 2026-07-06

### Added

- Published the M1 source release with a curated public tree and public-safe
  history on `main`.
- Added the mode-first session creation entry flow for Cloudflare-backed and
  decentralized sessions, with the existing setup UI revealed after Continue.
- Added public release PII scanning and stricter public push protection for
  release branches.
- Added a default-off MetaMask build profile. Passkey-only builds remove the
  MetaMask login control and fail if MetaMask/RainbowKit connector modules or
  assets enter the emitted client bundle.

### Fixed

- Fixed public CI regressions in passkey PRF normalization, public contact
  email handling, stripped corpus helper scripts, and private E2E script naming.
- Kept public package scripts and release-surface checks aligned with stripped
  private runner paths.

### Operator TODOs

- Tag `v0.7.0` after the public `main` state and latest worker-bundle release
  asset smoke check are confirmed.

## 2026-07-03

### Completed TODOs

- Added the public `/posts` route backed by root-level Markdown files, a default-on `REACT_APP_CE_ABOUT_POSTS_ENABLED` toggle, an About-page Posts link, static Vite serving/copying for `posts/`, per-post attachment directories, manifest header images, Markdown image blocks, and initial `ce-viz` post exhibits for category dot grids, ranked theme panels, theme networks, and quote walls.

## 2026-06-09

### Completed TODOs

- Added a public-release surface verifier that blocks JavaScript/TypeScript imports into stripped paths before release branches are imported or pushed, changed the Worker Chipotle tests to read the public client action catalog instead of a private mirror, and made release replay run public `test:node` before push so stripped public-copy regressions fail locally.

## 2026-06-06

### Completed TODOs

- Added a signed worker `secret-presence` admin action that returns allowed-key booleans without exposing secret values, and updated `/admin` Worker secrets cards so blank write-only inputs show unknown/configured/empty status from the worker presence manifest instead of local draft emptiness.

## 2026-05-25

### Completed TODOs

- Added the first Session Results HTML report export slice: redacted snapshot/HTML helpers, safe embedded JSON, a SurveyResults confirmation/download flow, and focused regression coverage.
- Extended Session Results exports with logged-in downloader metadata, visible artifact watermarking, explicit unavailable reasons, section checkboxes, exported viewer/static HTML/single-page PDF options, and local AI-generated analysis artifacts that use synthetic participant IDs before provider calls.
- Simplified the Session Results export modal copy, fixed light-mode checkbox/radio layout, and added demo preview mode for local demo analysis sections without wallet auth.

## 2026-05-17

### Completed TODOs

- Added a Vite sidecar for the React client with separate `dev:vite`, `build:vite`, and `preview:vite` scripts, `build-vite/` output, CRA-compatible env/static-asset shims, and focused ethers ESM import compatibility while keeping CRA/react-app-rewired as the canonical client path.

## 2026-05-13

### Completed TODOs

- Kept uploaded sponsored Custom RPC URLs out of public registry fields while preserving the `sponsored_rpc` flag, and made sponsored RPC access fall back to the session's default on-chain gate when no resource-specific RPC gate is set.

## 2026-05-09

### Completed TODOs

- Hardened worker-mediated Lit Chipotle encryption by forwarding worker env credentials into authenticated execution, allowing non-holder authors to encrypt for a target SBT audience, enforcing SBT ownership only for check/decrypt, deriving decrypt/check RPC URLs from worker-approved config/defaults, verifying action-side chain IDs, binding v2 wrapped CEKs to canonical policy fingerprints, rejecting legacy Chipotle wrapped-key formats, and documenting the required Lit Action CID re-provisioning step.

## 2026-05-08

### Completed TODOs

- Added the session storage routing layer with normalized `storageRef` compatibility, worker `/storage/upload`, `/storage/read`, and `/storage/list` contract tests, Cloudflare-safe opaque refs backed by mocked R2/KV contracts, Lit-Arweave document enforcement, and Document Library routing for Arweave, Lit-Arweave, and plaintext Cloudflare docs/context while preserving legacy `/arweave/upload` and `arweaveTxId` behavior.
- Threaded `storageRef` compatibility into client question/survey/response reads and CE-CC agent question/response summaries where legacy Arweave tx ids are still the contract source of truth.
- Added explicit dual-field helpers, made question/survey/response client and CE-CC records prefer `storageRef` before legacy `arweaveTxId`, extended worker storage tests for `questions`, `surveys`, and `responses`, and documented the future canonical `storageRef` naming migration.
- Routed Cloudflare-configured session question, survey, and response writes through sessionCorsWorker `/storage/upload`, using opaque bytes32-compatible Cloudflare IDs in existing Surveys pointer fields without changing the contract ABI; readers now try Cloudflare `storageRef` resolution before Arweave fallback.
- Clarified Cloudflare setup permissions for R2 payload blobs, D1/KV metadata indexes, and Durable Objects only for signer/runtime coordination.
- Added the then-current `/new` Cloudflare payload aliases:
  `worker_sbt_gate` was the default in this release and `lit_encrypted` required
  pre-encrypted payloads. Both names are now legacy read compatibility; current
  profiles use explicit `gate` and `encryption` fields, and pure Worker profiles
  do not default to an SBT gate.
- Fixed encrypted Document Library image thumbnails so scoped Lit hooks arriving after initial render trigger preview loading.

### Remaining TODOs

- Finish the Cloudflare `encryption: "lit"` envelope producer/reader (legacy
  alias `lit_encrypted`) so documents, private questions/responses, surveys, and
  generated artifacts can be encrypted before `/storage/upload` without routing
  through Lit-Arweave.
- Once all public and agent readers are storageRef-aware, rename the top-level payload pointer contract to `storageRef` in API docs and schemas, leaving `arweaveTxId` as a deprecated Arweave compatibility alias.

## 2026-05-04

### Completed TODOs

- Made direct encrypted-question routes fail soft while fresh Arweave metadata propagates by rendering a masked `[encrypted]` question placeholder and continuing background retries, and restored AR.IO-only Arweave read routing as the default while leaving legacy gateway fanout behind an explicit opt-out.
- Routed Survey contract hash/metadata/response/event reads through the session-aware read provider so open or verified sponsored `rpcUrl` / `rpcUrlsByChainId` entries are actually used for that session before the normal anonymous fallback stack.
- Deprioritized the OP Labs public OP Sepolia RPC in browser fallback ordering and added endpoint-level exponential backoff after RPC 429s so throttled providers are not hammered by repeated reads.
- Added an explicit `Decrypt Prompt` action to gated single-question notices so masked prompts are not only clickable through the `[encrypted]` badge.
- Kept single-question route load passive by preventing legacy Porto session restore from showing a passkey prompt until a signer is actually needed, and fixed the Wagmi RPC backoff wrapper TypeScript build error.
- Made automatic gated prompt/response decrypt respect Porto session-key auto-sign readiness: passive restores no longer trigger repeated passkey prompts during single-question bootstrap, while an unlocked Porto session can auto-decrypt SBT-gated prompts; non-creator metadata decrypts now prefer Lit SBT recipients before self-sign unwraps.
- Preserved per-question source session slugs on profile question cards so created/answered question links use their real session, such as `demo-4`, instead of falling back to the current profile page session.

## 2026-05-01

### Completed TODOs

- Hardened SBT mint-policy enforcement by storing an explicit on-chain `mintMode`, making `claim()`, password minting, reusable group signatures, and invite signatures fail closed outside their declared modes, rejecting contradictory factory deploy args, threading the resolved mode through CreateSBTGroup and deferred session-wizard publish state, and adding regression coverage for the old public-claim group-password vulnerability. Existing vulnerable unlimited `groupPassword` SBTs are not compatibility targets and should be rotated to newly deployed replacements.

## 2026-04-19

### Completed TODOs

- Made the local historical-avatar asset set canonical for demo personas, removed tracked placeholder avatar sentinel strings from the historical figure manifests and demo fixtures, rewrote avatar-source tests to ban placeholder-style sentinels and unapproved hotlinks, cleaned up planning-backed inline TODO comments in `SessionWizard` / `SingleQuestionResponse`, and removed the remaining `sponsoredSbtAddress` compatibility reads so `sponsored.gates` is the only canonical sponsored-SBT shape.

## 2026-04-17

### Completed TODOs

- Pinned `client` devDependency `typescript` to exactly `5.8.3` to match `@lit-protocol/contracts@0.9.1`'s strict peer, and adopted `--legacy-peer-deps` as the durable client install contract via `client/.npmrc` so `npm install` / `npm ci` no longer require the flag at the CLI. Strict restoration of plain `npm install` at the dep-graph level is deferred to the Phase 2 toolchain decision to move off `react-scripts@4` / CRA.

## 2026-04-16

### Completed TODOs

- Taught the shared client read-provider resolver to normalize browser-visible session RPC fields (`rpcUrlsByChainId`, `rpcEndpoint`, `rpcUrl`) alongside legacy `rpc.providers.path.*` overrides, so participant-facing session reads can use session-sponsored RPC directly when the on-chain `rpc` gate is open or the current wallet already has a cached grant, while restricted/unverified cases still fail closed onto the normal fallback stack; added focused regression coverage for worker-only, open, granted, and denied session-RPC selection paths.

## 2026-04-15

### Completed TODOs

- Strengthened crawler-visible discovery by adding a raw-HTML `noscript` summary to `client/public/index.html`, linking the canonical GitHub repo plus the live `main` branch source tree, adding a static `discoverability.html` summary page and `llms.txt`, limiting the sitemap to raw-HTML crawlable pages, and adding tests/docs so the public discovery links stay in sync.

## 2026-04-14

### Completed TODOs

- Stopped tracking generated worker bundle artifacts in `dist/`, updated CI and release verification to rebuild bundles before verifying them, removed the client-served `/worker/sessionCorsWorker.bundle.js` fallback path so normal and sponsored deploy flows now use the hosted GitHub release asset by default while still allowing one-off manual bundle URL or upload overrides after a fetch failure, explicitly marked automated worker-bundle GitHub releases as latest so the client's `releases/latest/download/...` URL stays current, refreshed Session Wizard fallback copy to explain the retry options, and updated docs/tests to treat `dist/*.bundle.js` as generated local fallback output rather than committed repo state.
- Added JSON-LD structured data for the public site so search engines can associate `contextengine.xyz` with the public GitHub repository via `sameAs`, while keeping the structured data synced with SPA route changes.
- Updated the public metadata description to align more closely with the README framing around AI-enhanced deliberation, large-group sensemaking, permanent records, and cryptographic access control.

## 2026-04-13

### Completed TODOs

- Strengthened root-site discovery metadata by updating the SPA shell title/description/canonical/social tags, added static `robots.txt` and `sitemap.xml` crawl assets, pointed root and client `homepage` metadata at `https://contextengine.xyz/`, refreshed the README opening section with stronger public framing and key links, and verified the client build copies the crawl assets into `client/build/`.

## 2026-04-06

### Completed TODOs

- Removed unused client dependencies `react-copy-to-clipboard`, `react-iframe`, `react-moment`, `fetchival`, `html-react-parser`, `papaparse`, `react-tooltip`, and `request`; regenerated `client/package-lock.json`; verified the production client build on Node 20.
- Removed unused client dependencies `axios`, `react-markdown`, `react-chartjs-2`, `chart.js`, `lucide-react`, and `moment`; removed dev dependencies `imagemin-cli` and `redux-devtools-extension`; replaced `classnames`, `react-hot-toast`, `react-datepicker`, and `idb-keyval` with repo-owned client code; regenerated `client/package-lock.json`; verified targeted tests locally and the production client build on Node 16; plain Node 20 `npm run build` still hits the repo's existing Webpack/OpenSSL incompatibility.

### Remaining TODOs

- Outstanding: complete the higher-risk peer-dependency cleanup still needed for clean no-flags `cd client && npm install`, especially `react-rangeslider`, `react-select`, and `reactstrap`.
