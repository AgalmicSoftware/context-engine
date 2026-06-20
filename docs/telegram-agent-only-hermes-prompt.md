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

Before starting, check my Hermes/OpenRouter balance through a normal balance
surface already available to you. Minimum: $2.00 for the default
gemini-3.5-flash run. If the balance is below $2.00, or cannot be checked
safely, stop and say exactly: "You need to add more credit before I can run
Agent Village Wrapped." Do not fetch statements or submit answers first.

Run defaults, editable by the user before launch:
- EdgeOS Read Permission: Yes.
- Standard Agent Village Wrapped image: Yes.
- Optional Agent Norms Compass meme: ask after the Wrapped image.

This is Context Engine research on whether agents can predict their principals,
may take about 10 minutes, and produces a shareable Agent Village Wrapped image.
Proceed with the defaults unless I explicitly override them. If I set EdgeOS
Profile Read Permission to No, do not use profile data. With permission enabled,
use EdgeOS only as high-level, non-sensitive context. Never quote private
profile or memory text.

Read the skill URL or use the installed Context Engine skill if available; installing the skill is not required when you can fetch the URL directly. Use the current Hermes/Telegram principal context and the Context Engine agent-only onboarding flow from the skill; do not ask me to manually provide or reveal credentials. First check /telegram/agent/api/skill-version and confirm it reports v41. Then fetch /telegram/agent/api/agent-only/start and follow the returned instructions exactly.

Page through /telegram/agent/api/agent-only/statements until cursor is empty.
Do not stop after the first page; if the response includes a non-empty cursor,
fetch the next page even when the first page contains 50 statements.
Submit predicted answers for every statement, then submit both linear and
quadratic token allocations. Treat this as a fresh run: use new request_id
values for each answer-batch POST and for both vote submissions, and reuse a
request_id only when retrying the exact same failed request.

After submitting, generate and display the standard Agent Village Wrapped image
using the skill/start image instructions. Prefer `image_url`; otherwise decode
`image_base64` to PNG and display or attach it. If the endpoint returns
`agent_only_wrapped_incomplete_predictions` or `all_statements_covered: false`,
fetch remaining statements, submit missing predictions/skips once, then retry
the image. Never print base64 or the full image prompt. Do not say ready until
the image is actually displayed, attached, or linked. If generation/display
fails, give the exact reason and ask whether to retry.

When answering questions that depend on memory, usage history, model history, events attended, messages per day, non-default skills/tools tried, or other personal context: do not hallucinate. Use only memory/context you actually have. If you do not know, answer "N/A". Do not infer private facts from thin evidence. Do not quote private memory verbatim unless I explicitly ask. Use memory only as high-level, non-sensitive signal.

After submitting, show me the Agent Village Wrapped image. Then tell me only:
"Your Agent Village Wrapped is ready. To inspect or change your agent's responses, open [Context Engine Telegram Bot](https://t.me/contextengineer_bot?start=agent_onboarding__agent-village-wrapped) and tap Open Mini App. Want the optional Agent Norms Compass meme too?"

If I say yes to the Agent Norms Compass meme, generate and display it using the
skill/start payload instructions. Do not print my ceagt token, confidences,
rationales, raw private memory, raw image prompt, or image_base64 in chat.
```

## Notes

- The `$2.00` minimum is tied to the default `gemini-3.5-flash` run. If Hermes changes the default model or exposes a model-specific estimator, update the threshold text here.
- The prompt intentionally requires a verified balance before fetching statements so failed or underfunded runs do not consume the launch window with partial work.
- The balance check is for Hermes/OpenRouter credit only and must use normal balance surfaces.
- The preference defaults are deliberately before statement fetching: the user should know the run can take about 10 minutes, that this is research, and that EdgeOS profile context is enabled by default but easy to override. Playful book/movie/game/AI Optimism guesses are image-time synthesis from actual predictions, not stored research questions; the Wrapped image prompt reserves the bottom-left visual slot for those chips when evidence supports them.
- Fresh request ids matter for repeated runs: the mini-app should show the latest
  prediction state, while the research export keeps each run's answer events.
- The final report is short by design. Detailed predictions, edits, and review belong in the Context Engine Telegram mini-app.
