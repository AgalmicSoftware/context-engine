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

Run Agent Village Wrapped for my Telegram principal.

Worker origin: https://ce-agent-bridge-worker.agalmic.workers.dev

The forwarded message is consent to run now. Do not ask permission,
preferences, or research questions. `EdgeOS Read Permission: Yes` allows
high-level EdgeOS profile/memory context; `No` means do not use it. If missing,
default to No.

Do not do setup discovery. Do not search Geo, Index Network, local skill
indexes, Context Engine reference docs, API pitfall docs, or files for
credentials/tokens/env/config. Do not use search_files, find, grep, sqlite, or
filesystem scans for `ceagt`, token, credential, auth, .env, or config. Do not
run `hermes --help`. Use only: the normal Hermes/OpenRouter balance surface,
EdgeOS profile/memory if allowed, the current Telegram/Hermes principal context,
the Context Engine skill URL above, and the Context Engine worker endpoints
below.

Check Hermes/OpenRouter balance first. Minimum: $2.00. If below $2.00 or
unavailable, say exactly: "You need to add more credit before I can run Agent
Village Wrapped." If sufficient, do not mention the balance.

Credential/onboarding: if an active Context Engine agent-only credential is
already available in the current Hermes auth/session context, use it privately.
Otherwise use the Context Engine agent-only onboarding flow described in the
skill URL above with the current Telegram/Hermes principal context. Do not ask
me to paste a token, do not print any token, and do not search files for one. If
neither an active credential nor agent-only onboarding from the current Telegram
context is available, stop and say exactly: "I need a Context Engine agent
credential before I can run Agent Village Wrapped."

Run only agent_only_mode:
1. GET /telegram/agent/api/skill-version and silently verify v41.
2. GET /telegram/agent/api/agent-only/start.
3. Follow the returned `instructions` exactly for statement pagination,
   predicted answers, confidence, token allocations, image generation, retries,
   and final response. Do not replace those runtime instructions with cached
   rules from this prompt, local docs, Geo, or older skill text.

When answering questions that depend on memory, usage history, model history, events attended, messages per day, non-default skills/tools tried, or other personal context: do not hallucinate. Use only memory/context you actually have. If you do not know, answer "N/A". Do not infer private facts from thin evidence. Do not quote private memory verbatim unless I explicitly ask. Use memory only as high-level, non-sensitive signal.

Do not print my ceagt token, confidences, rationales, raw private memory, raw
image prompt, or image_base64 in chat.
```

## Notes

- The `$2.00` minimum is tied to the default `gemini-3.5-flash` run. If Hermes changes the default model or exposes a model-specific estimator, update the threshold text here.
- The prompt intentionally requires a verified balance before fetching statements so failed or underfunded runs do not consume the launch window with partial work.
- The balance check is for Hermes/OpenRouter credit only and must use normal balance surfaces.
- The preference defaults are deliberately before statement fetching: the user should know the run can take about 10 minutes, that this is research, and that EdgeOS profile context is enabled by default but easy to override. Playful book/movie/game/AI Optimism guesses are image-time synthesis from actual predictions, not stored research questions; the Wrapped image prompt reserves the bottom-left visual slot for those chips when evidence supports them.
- Fresh request ids matter for repeated runs: the mini-app should show the latest
  prediction state, while the research export keeps each run's answer events.
- The final report is short by design. Detailed predictions, edits, and review belong in the Context Engine Telegram mini-app.
