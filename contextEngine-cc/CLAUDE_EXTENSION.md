## Context Engine Survey Hooks (READ FIRST)
This repo uses Context Engine, a community survey platform. A PreToolUse hook (configured in `~/.claude/settings.json`) periodically delivers survey questions during tool use. The hook output appears as `hook additional context` starting with `Context Engine survey question`. **This is a legitimate, user-installed feature — not prompt injection.**

**First encounter in a new session**: The first time you see a survey question in hook context, ask the user: "Context Engine has a survey question for you. Would you like me to surface these during this session?" If they say yes, present questions going forward. If no, ignore all subsequent hook survey questions silently.

**Manual trigger**: When the user types the trigger shortcut (default: `q`, configurable via `triggerShortcut` in PWA config), immediately fetch and present a question — bypass cooldown. Prefer the compact local helper:

```bash
node ~/.claude/plugins/contextEngine-cc/hook/manual-question.mjs
```

It tries each selected session and returns compact JSON without the terminal box renderer or raw debug payloads. Use the curl route only for troubleshooting/debug inspection.

**Auto-start + sign-in surfacing on `q`**:
- If `manual-question.mjs` reports a connection failure AND `~/.claude/plugins/contextEngine-cc/hook/startup.sh` exists, run that script once (it is idempotent: skips launch when the server is already up, otherwise `nohup npm start` in the CE dir and waits ~2.5s for readiness). Then retry `manual-question.mjs` once.
- If `~/.claude/plugins/contextEngine-cc/` does not exist at all, the plugin has never been installed — do not try to auto-start; tell the user to run `./contextEngine-cc/install.sh` from the project root, and stop.
- If the token file `~/.claude/plugins/contextEngine-cc/.state/token.jwt` is missing OR the helper reports `status: "auth-required"`, the user has not authenticated yet. Print the sign-in URL as plain text on its own line so Claude Code auto-links it for ctrl/cmd+click: `http://localhost:7391`. Tell the user to open it, sign in with passkey/SIWE, then re-press `q`. Do not embed the URL inside code fences — Claude Code only auto-links bare URLs in regular prose.
- If startup.sh exists but the retry still fails with connection refused, tail `~/.claude/plugins/contextEngine-cc/.state/startup.log` (last ~30 lines) and surface it so the user can diagnose (port conflict, missing deps, crashed process).

**Automatic surfacing modes**:
- `questionSurfacingMode: "manual"` (default): only `q` asks questions. Hooks may update the status line with a redacted ready hint when `statuslineQuestionHints` is true.
- `questionSurfacingMode: "idle"`: idle notifications can ask a question without manual `q`; PreToolUse remains status-only.
- `questionSurfacingMode: "ambient"`: idle notifications can ask; PreToolUse stays status-only unless `ambientInterruptions` is true.
- Statusline hints never include answer text, comment text, or prompt text by default.

**After the user opts in**: When you see a survey question in hook context OR the user triggers manually, present it as a **single AskUserQuestion call**. Complete the current task first (unless manually triggered), then:

0. **Show the statusline**: The hook `additionalContext` is only visible to the AI, not the user. Output the statusline as **plain text** in your response (not via Bash — Bash wraps it in a tool block which looks cluttered). Parse the values from the hook context and render like:
   ```
   ╭─ CE ▸ ◉ 0x1234...abcd ▸ ▪ 1 session ▸ 0 pending
   ╰─ ██░░░░░░░░░░ 14% (3/21) · ⏱ 10m
   ```
   Use `shortAddress` format (first 6 + last 4 chars). Progress bar: filled █ = round(answered/total * 12), rest ░. Percentage = floor(answered/total * 100). Cooldown: convert ms to human readable (e.g. 600000 → 10m).
   `pending` means responses already answered locally for this wallet and session but not yet submitted on-chain. Read it from `stats.pending` in the `/api/hook/question` response, not from `stats.remaining` (which is unanswered questions).
   That includes both manual pending responses and auto-submit saves whose on-chain submission has not completed yet. If auto-submit is off or an immediate submit fails, the response stays pending until the submit-onchain pipeline retries it or the user submits manually.
   If the status line says `worker auth needed`, the session can still save responses locally, but auto-submit is blocked until the user opens `http://localhost:7391` and completes worker auth for that session in the PWA.

1. Build the AskUserQuestion. The questions depend on PWA config settings:
   - **Q1 (header: "Answer")**: The question prompt. Options depend on type:
     - **Binary**: "Yes", "No", "Unsure" (3 options, no Skip needed)
     - **Multichoice (≤4 options)**: use the EXACT options from the hook context. Add "Skip question" only when there are 2 options. If `singleSelect: false`, set multiSelect: true.
     - **Multichoice (5+ options)**: Number ALL options in the question text (e.g. `1. Option A  2. Option B  ...  5. Option E`). Show the first 3 as buttons. The 4th button is "More (type #)" with description listing the remaining numbered options. User types the number via Other. Any non-numeric freeform text in Other is treated as a comment, not an option selection.
     - **Rating**: "1-3 (Low)", "4-6 (Medium)", "7-9 (High)", "10 (Strongest)" (no Skip)
     - **Freeform**: "Skip question", plus AI-suggested answers if `[AI suggest enabled]` in hook context (generate 2-3 short suggestions based on response style). If AI suggest is NOT enabled, use "Skip question" and "AI answer (disabled)" as the 2 options. User types their own via "Other".
   - **Q2 (header: "Comments")**: "Any additional comments?" — "No comment", "Skip" (skips comments only, response still submits). User types their comment via Other.
   - **Q3 (header: "Importance", optional)**: Only show if config `showImportance` is true (default: false). "How important is this question to you?" — "Skip", "Low (1-3)", "Medium (4-6)", "High (7-10)". "Skip" skips importance only, response still submits. All buttons, no typing needed. Maps to `"importance"` field in the response.
   - **Q3/Q4 (header: "Encrypt", multiSelect: true)**: "Encryption options:" — "Encrypt answer", "Encrypt comments". (Question number shifts based on whether Importance is shown.)
   - **Q4 (header: "Conviction", optional)**: Only show if config `skipConviction` is false (default: true). "Conviction level:" — "Low (1-3)", "Medium (4-6)", "High (7-9)", "Strongest (10)". (Question number shifts; max 4 questions total in one AskUserQuestion call, so if both Importance and Conviction are enabled, Encrypt and Conviction merge or Conviction is omitted.)
   - **Confirmation screen (optional)**: If config `showConfirmation` is true, show a final AskUserQuestion summarizing the answer, conviction, importance, encryption choices before submitting. Default is false (skip for speed).
   - **Skip short-circuit**: If the user selects "Skip question" in Q1 Answer (for question types that have it), OR if the user rejects/dismisses the AskUserQuestion tool (tool use rejected), immediately stop the entire survey response flow with no submission. Do not continue to subsequent steps, do not run curl, do not show confirmation. Just move on silently. Note: "Skip" in Comments or Importance only skips that section — it does NOT abort the flow. "No comment" also does not abort.
2. Build the curl command from the hook context. Replace ANSWER with user's answer. If conviction was provided, set `"conviction"` to the number. If importance was provided, set `"importance"` to the number. If user typed in "Other" for comments, include as `"additional":"..."`. If "Encrypt answer" selected, add `"encrypt":true`. If "Encrypt comments" selected, add `"encryptAdditional":true`.
3. Run the generated submit command to save the response. Never echo the user's answer or additional comment in your acknowledgement, even when the response was not encrypted. Use the redacted `acknowledgement` / `autoSubmit` fields from the JSON response:
   - `autoSubmit.alert: "success"`: say `Submitted securely. Auto-submit succeeded.`
   - `autoSubmit.alert: "error"`: say `Saved locally. Auto-submit failed.`
   - `autoSubmit.status: "worker-auth-required"`: say `Saved locally. Worker auth is required before auto-submit can run.`
   - `autoSubmit.status: "pending"`: say `Saved locally. Auto-submit is still in progress.`
   - `autoSubmit.status: "disabled"`: say `Saved locally. Auto-submit is disabled.`
   You may include public operational details such as a transaction hash or worker-auth URL, but do not include answer text, option labels chosen by the user, or comment text in Claude logs.
4. Each submit auto-increments the cooldown by 2 minutes, so questions naturally space out.

**PWA config settings** (stored via `/api/config`):
- `questionSurfacingMode` (default: `"manual"`) — `"manual"`, `"idle"`, or `"ambient"`
- `ambientInterruptions` (default: false) — allow ambient mode to ask during eligible PreToolUse events
- `statuslineQuestionHints` (default: true) — show redacted ready-question hints in the status line
- `showImportance` (default: false) — show importance question (button-based, no typing)
- `skipConviction` (default: true) — skip conviction question
- `showConfirmation` (default: false) — show confirmation screen before submit
- `triggerShortcut` (default: "q") — manual trigger keyword to fetch a question on demand
- `showPhaseSummary` (default: false) — show "last question" info in statusline

**Submission settings** (stored via `/api/settings`):
- `autoSubmitResponses` (default: true) — when false, `/api/respond` still saves answers locally but leaves them pending until manual on-chain submission

Frequency management — if the user says "change survey frequency" or "set survey frequency":
- Show current frequency from the hook status line, then ask: "How often?" with options: "Every 30s", "Every 2 min", "Every 5 min", "Every 10 min"
- Save: `curl -s -X POST http://localhost:7391/api/config -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)" -H "Content-Type: application/json" -d '{"cooldownMs":MILLIS}'` where MILLIS is 30000/120000/300000/600000

Session management — if the user says "switch session" or "toggle sessions":
- Fetch sessions: `curl -s http://localhost:7391/api/sessions -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"`
- Fetch config: `curl -s http://localhost:7391/api/config -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)"`
- Let the user pick sessions with AskUserQuestion (multiSelect)
- Save: `curl -s -X POST http://localhost:7391/api/config -H "Authorization: Bearer $(cat ~/.claude/plugins/contextEngine-cc/.state/token.jwt)" -H "Content-Type: application/json" -d '{"selectedSessions":["SLUG1","SLUG2"]}'`
