# Telegram Agent-Only Hermes Prompt

This is the stable paste-ready prompt for running Agent Village Wrapped from
Hermes. Keep the prompt conservative: the agent should not expose bearer tokens,
should verify v41 before doing work, and should stop before fetching statements
if it cannot verify enough credit for the default model.

## Current Prompt

```text
Use the Context Engine Telegram agent handoff skill:
https://ce-agent-bridge-worker.agalmic.workers.dev/telegram/agent/api/skill?v=41

Run Agent Village Wrapped for my Telegram principal.

Worker origin: https://ce-agent-bridge-worker.agalmic.workers.dev

Before starting, verify my Hermes / OpenRouter balance through a normal Hermes
balance surface, gateway balance endpoint, or OpenRouter credential already
available to your current process. Minimum balance: $2.00 for the default
gemini-3.5-flash run. Do not hunt for credentials in `/proc`, logs, shell
history, or other process environments. If the balance is below $2.00, or you
cannot verify it safely, stop and tell me exactly: "You need to add more credit
before I can run Agent Village Wrapped." Do not fetch statements or submit answers
until the balance is verified.

Before fetching statements, run a short preferences step. Explain in one or two sentences that this is for Context Engine research on whether personal agents can predict their principals, and that the results can produce a shareable Agent Village Wrapped image. Tell me this can take about 10 minutes and may be better to run at the end of the day. Ask only these preferences: whether I want to run it now and whether you may ingest and use my EdgeOS profile as high-level, non-sensitive context. Tell me I can reply "yes" to continue with the default Wrapped image and EdgeOS profile access, or I can say no / change preferences. Generate the standard Agent Village Wrapped image after submission unless I say no. If I decline EdgeOS profile access, do not use profile data. If I allow EdgeOS profile access, use it only for non-sensitive, high-level signals and never quote private profile or memory text. Do not continue until I answer these preferences.

Read the skill URL or use the installed Context Engine skill if available; installing the skill is not required when you can fetch the URL directly. Use the current Hermes/Telegram principal context and the Context Engine agent-only onboarding flow from the skill; do not ask me to manually provide or reveal credentials. First check /telegram/agent/api/skill-version and confirm it reports v41. Then fetch /telegram/agent/api/agent-only/start and follow the returned instructions exactly.

Page through /telegram/agent/api/agent-only/statements until cursor is empty.
Do not stop after the first page; if the response includes a non-empty cursor,
fetch the next page even when the first page contains 50 statements.
Submit predicted answers for every statement, then submit both linear and
quadratic token allocations.

After submitting, generate and display the standard Agent Village Wrapped image by following the image instructions from the skill/start payload. Prefer the returned `image_url`: render, attach, or link that HTTPS PNG. If `image_url` is absent, decode the returned PNG bytes from `image_base64` and display or attach the image if your host supports it. If the endpoint returns `agent_only_wrapped_incomplete_predictions` or `all_statements_covered: false`, re-fetch statements, resubmit predictions or privacy skips once, then call the image endpoint again before presenting the image. Do not print the raw base64 or full image prompt. Do not say the Wrapped image is ready until the image has actually been displayed, attached, or linked. If image generation fails or you cannot display/link the image, report the exact endpoint reason in one short sentence and ask whether to retry.

When answering questions that depend on memory, usage history, model history, events attended, messages per day, non-default skills/tools tried, or other personal context: do not hallucinate. Use only memory/context you actually have. If you do not know, answer "N/A". Do not infer private facts from thin evidence. Do not quote private memory verbatim unless I explicitly ask. Use memory only as high-level, non-sensitive signal.

After submitting, show me the Agent Village Wrapped image. Then tell me only:
"Your Agent Village Wrapped is ready. To inspect or change your agent's responses, open [Context Engine Telegram Bot](https://t.me/contextengineer_bot?start=agent_onboarding__agent-village-wrapped) and tap Open Mini App. Want the optional Agent Norms Compass meme too?"

If image generation succeeded, show me the image but do not add extra report text beyond the single sentence above. If the image was not displayed or attached, do not send the ready sentence; instead tell me the endpoint `reason` / `upstreamReason` or the local display problem and ask whether to retry. If I say yes to the Agent Norms Compass meme, generate and display it using the skill/start payload instructions. Do not print my ceagt token, confidences, rationales, raw private memory, raw image prompt, or image_base64 in chat.
```

## Notes

- The `$2.00` minimum is tied to the default `gemini-3.5-flash` run. If Hermes changes the default model or exposes a model-specific estimator, update the threshold text here.
- The prompt intentionally requires a verified balance before fetching statements so failed or underfunded runs do not consume the launch window with partial work.
- The balance check is for Hermes/OpenRouter credit only and must use normal credential surfaces, not process/env scraping.
- The preferences step is deliberately before statement fetching: the user should know the run can take about 10 minutes, that this is research, and that EdgeOS profile context is opt-in. Playful book/movie/game/AI Optimism guesses are image-time synthesis from actual predictions, not stored research questions; the Wrapped image prompt reserves the bottom-left visual slot for those chips when evidence supports them.
- The final report is short by design. Detailed predictions, edits, and review belong in the Context Engine Telegram mini-app.
