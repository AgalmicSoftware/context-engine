# Telegram Agent-Only Hermes Prompt

This is the stable paste-ready prompt for running Context Engine `agent_only_mode`
from Hermes. Keep the prompt conservative: the agent should not expose bearer
tokens, should verify v40 before doing work, and should stop before fetching
statements if it cannot verify enough credit for the default model.

## Current Prompt

```text
Use the Context Engine Telegram agent handoff skill:
https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/skill?v=40

Run Context Engine agent_only_mode for my Telegram principal.

Worker origin: https://ce-agent-bridge-worker.agalmic.workers.dev

Before starting, check my available Context Engine / Hermes credit balance. The minimum required balance for this run is $2.00 when using the default gemini-3.5-flash model. Use a first-party Hermes balance tool, gateway balance endpoint, or an OpenRouter API key that is already explicitly available to your current process through the normal credential mechanism. If you call OpenRouter, query `https://openrouter.ai/api/v1/auth/key` and use only the credit limit, accumulated usage, and remaining balance fields. Never print or reveal the API key. Do not inspect `/proc`, shell history, logs, other users' processes, or another process's environment variables to find credentials. If the available balance is less than $2.00, stop and tell me exactly: "You need to add more credit before I can run agent_only_mode." If you cannot verify the available balance without extracting credentials from another process, stop and ask me to confirm or add credit before continuing. Do not fetch statements or submit answers until the balance is verified to be at least $2.00.

Before fetching statements, run a short preferences step. Explain in one or two sentences that this is for Context Engine research on whether personal agents can predict their principals, and that the results can also produce a shareable Agent Village Wrapped image. Tell me this can take about 10 minutes and may be better to run at the end of the day. Ask only these preferences: whether I want to run it now; whether you may ingest and use my EdgeOS profile as high-level, non-sensitive context; whether I want playful clearly-labeled agent guesses such as favorite book, movie, game, or similar taste reads included when there is evidence; and which image output I want after submission: standard Agent Village Wrapped, political compass meme, both, or no image. If I decline EdgeOS profile access, do not use profile data. If I allow EdgeOS profile access, use it only for non-sensitive, high-level signals and never quote private profile or memory text. If I decline playful guesses, answer those guess-style questions with N/A when possible. Do not continue until I answer these preferences.

Never print, reveal, echo, or summarize my ceagt token. Send it only as a Bearer token to the worker origin above.

If the Context Engine skill is not installed or loaded, ask me to install or load it from the skill URL before continuing. First check /telegram/agent/api/skill-version and confirm it reports v40. Then fetch /telegram/agent/api/agent-only/start and follow the returned instructions exactly.

Use the Bearer token I provide. Page through /telegram/agent/api/agent-only/statements until cursor is empty. Submit predicted answers for every statement, then submit both linear and quadratic token allocations.

After submitting, if I selected an image output, fetch `/telegram/agent/api/agent-only/start` again and read `wrappedImageEndpoint`. POST to that endpoint with the same Bearer token. For standard Agent Village Wrapped, send `{ "window_id": "<window_id>", "mode": "wrapped", "format": "json" }`. For political compass meme, send `{ "window_id": "<window_id>", "mode": "political_compass", "format": "json" }`. If I selected both, call it once for each mode. Decode the returned `image_base64` as PNG and show me the image. Do not print the raw base64 or full image prompt.

When answering questions that depend on memory, usage history, model history, events attended, messages per day, non-default skills/tools tried, or other personal context: do not hallucinate. Use only memory/context you actually have. If you do not know, answer "N/A". Do not infer private facts from thin evidence. Do not quote private memory verbatim unless I explicitly ask. Use memory only as high-level, non-sensitive signal.

After submitting, tell me exactly:
"Submitted N predicted answers (M privacy skips) and both token allocations for window W. Review or edit them in the Context Engine Telegram bot: https://t.me/contextengineer_bot"

If image generation succeeded, add one short sentence saying the Agent Village image is ready. Do not print my ceagt token, confidences, rationales, raw private memory, raw image prompt, or image_base64 in chat.
```

## Notes

- The `$2.00` minimum is tied to the default `gemini-3.5-flash` run. If Hermes changes the default model or exposes a model-specific estimator, update the threshold text here.
- The prompt intentionally requires a verified balance before fetching statements so failed or underfunded runs do not consume the launch window with partial work.
- The balance check must not scrape secrets from another process. The acceptable paths are a first-party Hermes balance surface, a gateway balance endpoint, or a credential already provided to the current process by the normal runtime secret mechanism.
- The preferences step is deliberately before statement fetching: the user should know the run can take about 10 minutes, that this is research, and that EdgeOS profile context and playful favorite/taste guesses are opt-in.
- The final report is short by design. Detailed predictions, edits, and review belong in the Context Engine Telegram mini-app.
