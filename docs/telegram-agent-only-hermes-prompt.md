# Telegram Agent-Only Hermes Prompt

This is the stable paste-ready prompt for running Agent Village Wrapped from
Hermes. Keep the prompt conservative: the agent should not expose bearer tokens,
should verify v41 before doing work, should stop before fetching statements if
it cannot verify enough credit for the default model, and should not pause for a
separate EdgeOS permission question when the prompt includes explicit defaults.

## Current Prompt

```text
Use the Context Engine Telegram agent handoff skill:
https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/skill?v=41

Run Agent Village Wrapped for me.

Worker origin: https://ce-agent-bridge-worker.agalmic.workers.dev

Hard limits for this run:
- Do not ask permission or preference questions; this forwarded message is consent.
- Do not use old images, previous image URLs, cached files, or previous responses.
  Always POST the wrapped-image endpoint fresh after submitting answers/votes, and
  display only the image returned by that same response.
- Do not use Geo, Index Network, context-engine local skills, local reference docs,
  API-pitfall docs, search_files, grep, find, sqlite, filesystem scans, or
  skill_view to discover setup, credentials, prompts, or procedures.
- Do not read local files for tokens, auth, env, config, API keys, balance, or
  token usage.

The forwarded message is consent to run now. Do not ask permission,
preferences, or research questions. `EdgeOS Read Permission: Yes` allows
high-level EdgeOS profile/memory context; `No` means do not use it. If missing,
default to No.

Do not do setup discovery. Do not run `hermes --help`. Use only: an
already-exposed Hermes/OpenRouter balance command or UI surface, EdgeOS
profile/memory if allowed, the current Telegram/Hermes principal context, the
Context Engine skill URL above, and the Context Engine worker endpoints below.

Check Hermes/OpenRouter balance first only through an already-exposed Hermes
balance command or UI surface. Do not read config files, env files, auth files,
or API keys to check balance. Minimum: $2.00. If the exposed balance is below
$2.00, say exactly: "You need to add more credit before I can run Agent Village
Wrapped." If no balance surface is immediately available without reading files,
skip the balance check silently and continue.

Credential/onboarding: if an active Context Engine agent-only credential is
already available in the current Hermes auth/session context, use it privately.
Otherwise use the Context Engine agent-only onboarding flow described in the
skill URL above only if the required inviteToken and Telegram principal context
are already present in the current message/session context. Do not ask me to
paste a token, do not print any token, and do not search files for one. If
neither an active credential nor a complete in-context agent-only onboarding
payload is available, stop immediately and say exactly: "I need a Context
Engine agent credential before I can run Agent Village Wrapped."

Run only agent_only_mode:
1. GET /telegram/agent/api/skill-version and silently verify v41.
2. GET /telegram/agent/api/agent-only/start.
3. Follow the returned `instructions` exactly for statement pagination,
   predicted answers, confidence, token allocations, image generation, retries,
   and final response. Do not replace those runtime instructions with cached
   rules from this prompt, local docs, Geo, or older skill text.

Image delivery is mandatory. If the wrapped-image endpoint returns `image_url`,
show it exactly once: either as a native attachment/photo or as a Markdown
image, not both. If you attach/upload the image, do not also include a Markdown
image, raw link, or link preview. Do not run vision/image-analysis/QA tools on
it. Do not describe or summarize the poster. Do not reuse an old local PNG,
previous image_url, cached attachment, or old image response. A text-only
"ready" message is not a completed run.

When answering questions that depend on memory, usage history, token usage
across sessions, model history, events attended, messages per day, non-default
skills/tools tried, or other personal context: do not hallucinate. Use only
memory/context you actually have. If you do not know, answer "N/A". Do not infer
private facts from thin evidence. Do not quote private memory verbatim unless I
explicitly ask. Use memory only as high-level, non-sensitive signal. Do not use
or mention where I live, where I am from, my current city, coordinates, hotel,
venue, or travel origin in the poster or chat summary.

If token usage is visible through an already-approved balance/session/history
surface, include it in `agent_metadata.token_usage` on answer and vote POSTs:
`current_run_total_tokens`, `recent_sessions_total_tokens`, and `source` when
known. Fast optional check: run at most one command,
`hermes insights --days 30 --source telegram`, and use a clear total token line
from that output if present. If that exact command is unavailable, errors, or
does not show a clear total, omit token usage. Do not use `skill_view
token-usage-audit`, search, Python scripts, or file/env/config/auth/API-key
reads to calculate it. The poster will omit the Token Use chip when this
metadata is absent.

Do not print my ceagt token, confidences, rationales, raw private memory, raw
image prompt, or image_base64 in chat. In the final message, make "Context
Engine Bot" a Markdown link to
https://t.me/contextengineer_bot?start=agent_onboarding__agent-village-wrapped
and tell the user to tap Open Mini App.
```

## Notes

- The `$2.00` minimum is tied to the default `gemini-3.5-flash` run. If Hermes changes the default model or exposes a model-specific estimator, update the threshold text here.
- The balance check is for Hermes/OpenRouter credit only. It must use an already-exposed balance surface, never config/env/API-key file reads.
- Checkpoint 2026-06-24: this direct-prompt path is user-reported working on GLM 5.2 and GPT-3.5/Gemini-3.5-class small model runs. Keep future edits narrow and retest both model families.
- The preference defaults are deliberately before statement fetching: the user should know the run can take about 10 minutes, that this is research, and that EdgeOS profile context is enabled by default but easy to override. Playful book/movie/game/AI Optimism guesses are image-time synthesis from actual predictions, not stored research questions; the Wrapped image prompt reserves the bottom-left visual slot for those chips when evidence supports them.
- Fresh request ids matter for repeated runs: the mini-app should show the latest
  prediction state, while the research export keeps each run's answer events.
  The runtime `/agent-only/start` instructions also require a fresh `run_id` on
  every answer, vote, and wrapped-image POST for each user-requested run.
- The final report is short by design. Detailed predictions, edits, and review belong in the Context Engine Telegram mini-app.
