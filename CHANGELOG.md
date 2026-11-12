# Changelog

All notable changes to this project will be documented in this file.

## [0.9.6] - 2026-11-12

### Client — available when the site deploys

- A session's interview settings can turn on **Keep AI draft text for admins**, off by default. With it on, the text of the AI's drafted freeform answers and drafted comments is kept where only the session's config admins can read it, for research into how people change what an AI drafted for them. In session settings, an older Worker shows "Needs a newer Session Worker (0.9.6 or later)", and a session not hosted on a Session Worker shows "Needs a session hosted on a Session Worker." Either way the setting stays off.
- People see their own choice for it inside **AI submission info**, under the research details: **Let admins read the AI's draft text**, ticked for new drafts, which they can turn off while still sharing the rest. Unticking it, unticking **Share for research**, or encrypting the answer deletes their stored text at the next submit. If the setting turns on while someone has the review open after reading that no text is kept, nothing is kept for them in that sitting. If the text can't be updated, they are told their answers were saved and the text was not.
- The Admin page gives a session's config admin **Download AI draft text**. Co-admins without config rights, results admins and members are not offered it.
- In Results, **How well AIs predicted people** withholds its hidden-draft score and its platform rows together when showing them side by side would reveal fewer people than the minimum; a withheld tile says "Withheld".
- The site waits and tries again when a session is briefly busy, for reads, voice interview starts and answers that can be sent again safely, where it showed "Session config coordination is unavailable; retry."
- The API that outside AI agents use to take part is called Agent HTTP throughout the docs; four places said "Session Agent HTTP". The agent page's test ids now start `ce-agent-http-`. Routes, credentials and stored values are unchanged.

### Workers — requires redeployment

- Session Workers keep AI draft text at `/storage/draft-text/put`, `/storage/draft-text/delete` and `/storage/draft-text/export`, and report `draft_text_v1` in `/capabilities`. A person writes only their own row, only while the setting is on, only for a question the session has, with each field capped at 8,000 characters; deleting needs only a sign-in, so it works after the setting is turned off, the session has ended, or the person was removed from the session's gate. Only the session's admin address or admin hat can export. No response list or read, backup, AI feature, Session Agent, MCP tool or Results view reads it, and the public record carries only that the person agreed.
- Session Workers put less load on a session's coordinator. With about 75 or more people answering at once, or 50 voice interviews starting together, it stopped answering, and the Worker gave `503` to answers and to signed-out reads alike. An answer no longer queues an AI Views run unless the session runs them automatically, requests arriving together share one read of the session's settings, and AI Views receipts are cleaned up a page at a time.
- The Worker logs why a session's coordinator could not answer: Cloudflare's own error and its retry flags, never the session, addresses or content.

### Agents and MCP

- MCP 0.3.4, a patch: the server waits and tries again when a session is briefly busy, for reads and for answers that carry a request id.

### Local tooling

- The agent fidelity report scores interview, typed-note and group-recording drafts on their own rows, never in the AI-prefill score, and adds breakdowns by model and by context used. `--predictions` writes an optional pseudonymous per-draft CSV with whether each answer and comment changed. Rows by condition (shown, hidden, made separately) and by group are withheld together with the origin, platform, model and context rows, and per-person rows name only a shown origin.
- The same script turns an admin's AI draft text download into pseudonymous input for clustering tools (`--draft-text` with `--clio`), leaving out text whose latest saved response no longer carries the person's agreement.

## [0.9.5] - 2026-11-12

### Client — available when the site deploys

- `/new` and a session's Settings turn the **Session Agent** on and off under AI, for sessions on a Session Worker. Turned on, everyone signed in may ask and gets General answers. Admins add audiences, which go first, for members of chosen groups or SBT holders, reorder them, pick each one's answer style, and may rewrite each style's instructions; the fixed rules are listed behind the "?", which also says that anyone can read the instructions, as they can the session's other settings. A setting that can't be saved says why, and `/new` won't create the session until it's fixed. With no audiences, only admins may ask. Settings can also give the Session Agent its own reasoning effort.
- Settings offers the Session Agent once the session's Worker runs this release. On an older Worker it says to update the Worker first, where saving would have failed with a field error. `/new` leaves an off Session Agent out of the settings it sends, so creating a session on a Worker from an earlier release still works.
- Once an admin turns it on, everyone signed in can open the **Session Agent** from a session's Context. It says it's a preview and how they'll be answered, takes a question of up to 500 characters, and shows only the latest answer, of at most 150 words, with what it drew on; nothing is kept, and errors say what went wrong. Its switch lets anyone keep their answers and files out of it, even when it doesn't answer them. A robot by the session's title tells everyone, signed in or not, that it's on, and links to how it works.
- Under the Session Agent in `/new` and Settings, **Skip questions with under 3 answers** is on by default. Its "?" says what turning it off allows: a question only one member answered is used, so that person's answer can come back as the members' view. Admins always get every question.
- While the Session Agent is on, the interview dialog, where AI-drafted answers are reviewed and submitted, carries a line at its foot, **Session Agent may use my answers and files**, with a "?". It is the same switch as in the Session Agent's own dialog. A change is saved before any answer is stored; if it can't be saved, nothing is submitted and the dialog says why.
- Drafts made after claiming part of a group recording are recorded as from the group recording, so research can tell them from a solo voice interview.
- Interview drafts no longer fail on a long question list. Drafting from a conversation, from a claimed part of a group recording or from added context asked the AI for a reply of at most 8,000 tokens, which a list of about 50 questions could overflow, losing every draft. It now asks for up to 32,000 on a model with room for it (GPT-5, GPT-6, the o-series, GPT-4.1, and Claude from 4.5 on); any other model, and any model on a custom endpoint, keeps 8,000. On the session's AI key, the session's Worker has to run this release for the larger reply; an older Worker still stops it at 8,000.
- When the AI's reply for interview drafts is cut off or unreadable, the page says so, that the drafts can be generated again, and to tell the session's host if it keeps happening, where it showed a JSON parser's message. An empty AI reply, which a model can give after spending its whole limit on reasoning, is called an empty reply in place of "Unexpected AI response format".

### Workers — requires redeployment

- Session Workers accept a **Session Agent** setting: an ordered list of who may ask (everyone signed in, members of chosen groups, or SBT holders, matching any or all of their rules) and whether each gets General or Detailed answers, with optional instructions for each style. Admins always get Detailed answers, and with no setting the Session Agent is off. Saving it signs no one out. The public config sets `sessionAgentReady: true`, so the site knows the Worker takes the setting.
- Session Workers answer the Session Agent at `POST /session-agent/ask` through the session's own AI, under the `/ai` rate limit, and say how a person would be answered at `POST /session-agent/status`. The Worker checks who is asking on every question, including that they have the session's AI access, and gathers the material their answer style allows: General answers read the session's context, the files open to everyone (when the session's own file rule admits the asker) and the results that person may see; Detailed answers read every file they may read and members' answers, without names. The page sends only the question, and replies hold the answer and how much it drew on, never the material itself.
- A Detailed answer draws on every member's answer, however large the session. For each question it is given how many members answered and, where the question has set options, how many chose each, counted from all the answers, with what a rating's numbers mean. What members wrote is a sample in an order drawn afresh for each question asked, so one person's answers can't be followed from question to question. The questions closest to the one asked get room first, and the AI is told when some questions' answers did not fit. Unless the session's admin turns the rule off, someone who is not an admin gets nothing from a question fewer than three members answered, so a single person's answer doesn't come back as the members' view. In a session of 50 people and 40 questions, one question reads all 2,000 answers in about 65 storage operations.
- Results reach a Session Agent answer for the people the Results page shows them to: admins and results admins on any session, and others under the session's results setting, members-only results included.
- Each person can turn off the Session Agent's use of their answers and the files they added at `POST /session-agent/opt-out`, and turn it back on; it starts on. The Worker keeps the choice in the session's coordinator and checks it on every question, leaving out the answers and files of everyone who turned it off, and answers that carry no address. The published results, which count everyone's answers, are still read.
- A file's **Visible to** rule on SBTs that the chain can't answer, because its RPC isn't set up, the session's RPC secret can't be read or no endpoint answers, now gives a retryable `503`, as a group rule does, instead of refusing the read. The Session Agent then refuses the question rather than passing the person to a later audience. A list leaves out a file or answer whose own rule can't be checked, rather than failing for every reader.
- The AI proxy sends Anthropic a request's system messages as its system prompt, as Anthropic requires, rather than as messages it refuses.
- The Session Agent setting takes `minAnswers`, a whole number from 1 to 3: how many members must have answered a question before someone who is not an admin hears anything from it. It is 3 unless set, and 1 turns the rule off.
- The Session Agent follows the session's own lock. Where a session needs a group or an SBT to view it, someone it keeps out is refused whatever the audiences say; before, they could sign in, match an audience and ask, and under a Detailed audience hear members' answers. If the lock can't be checked just now, the question is refused with a retryable `503`.
- Session Workers allow interview mapping (`interview-map`) a reply of up to 32,000 tokens, up from 8,000, on a model whose provider documents room for it; any other model, and any model on a custom endpoint, keeps 8,000.

### Agents and MCP

- MCP 0.3.3. No change in what the tools do: the package is rebuilt with this release's shared session-settings code.

## [0.9.4] - 2026-11-12

### Client — available when the site deploys

- Group recordings: the **Give each person their part** codes open only once every part is transcribed, and say when a part failed.
- A claimed part of a group conversation survives a reload or a passkey sign-in in the same tab, until its review is submitted or discarded.
- A recorder who reloads still hands out codes that join the table's group.
- Recording restarts the microphone once by itself when a headset or Bluetooth microphone drops or the recorder stops, restarts after 15 seconds of silence from the recorder, and plays an alarm (and buzzes where possible) if recording still stops. A paused recording stays paused until **Resume**.
- Speaker labels stay on after a single refusal; they turn off only after two in a row, and the host can turn them back on.
- A chunk whose labelled upload keeps being cut off, as by a network that drops quiet connections after 60 seconds, is sent again without labels, so later chunks keep moving; the claim screen says which parts have no labels.
- A speaker number is never given to two different voices, including after **Record more**; voices heard in one part only are named on the claim screen so the host can join them.
- At a chunk boundary, a second person echoing the first keeps their words.
- Pausing no longer makes a recording chunk longer than three minutes of recorded time.
- Someone whose browser has no passkeys, such as an app's built-in browser after scanning a QR code, is told to open the link in Safari or Chrome, with a **Copy link** button.
- A recording's uploads never ask for a passkey or wallet signature mid-conversation; a part that needs a sign-in waits with **Retry**, and pressing Retry may ask.
- On a private session, a voice interview that follows new questions now sees them, including questions only the signed-in person's groups may see.
- A group's auto-join link can be shown as a QR code beside **Copy auto-join link**; both session QR codes now use error-correction level M.
- The prompt for a person's own AI accepts a review link only on this site's own session page, so a Worker reached through someone else's link cannot send their drafted views elsewhere.
- The AI that turns an interview into draft answers reads its instructions before the transcript, and the session's groups after it.
- The interview settings say each AI is instructed never to go on health, religion and similar personal data, rather than promising it.
- Fonts are served from the site itself instead of Google Fonts; the site also sends HSTS, a site-wide nosniff header and a Permissions-Policy that allows only its own microphone and camera.
- A listed session's name opened through a different Worker shows **Not the listed session** with a link to the listed one.
- Signing out also ends your sign-in at each Session Worker, so a copied sign-in token stops working.
- Results load much faster on large sessions whose Worker runs this release: answers are read 100 at a time, so 500 answers take 10 requests instead of 505.

### Workers — requires redeployment

- A Worker-hosted session refuses an answer to a question it doesn't have, or a value the question can't take (a 9000 on a 1–5 rating, two picks on a pick-one question), with a message saying why. An answer sent as a whole encrypted payload is refused unless the session uses Lit encryption. An answer that names two different questions is refused.
- One person can keep at most 20 versions of an answer, and five saved answers per question the session has (hidden questions included), agents' answers included; past that the upload is refused with a message. A survey's bundle is counted apart from its answers, under the same allowance. Answers stored before this release don't count.
- Sign-in trusts only `contextengine.sh` and `www.contextengine.sh` by default. The retired `.xyz` addresses and local development servers are no longer trusted unless a Worker is set up for them (`ADMIN_TRUSTED_ORIGINS`, or `CE_ALLOW_LOCAL_ORIGINS=true` for local servers). The deploy helper's default allowed origins are the `.sh` site only.
- `POST /auth/logout` ends a sign-in at the Worker.
- Admin actions must be signed within ten minutes of use.
- `POST /storage/read-batch` reads up to 100 stored items in one request, each under the access check a single read gets, and stops at 8 MiB of text; an item it refuses carries the reason, and one it leaves out answers 413. The Worker reports it as the `storage_read_batch_v1` feature.

### Agents and MCP

- MCP 0.3.2. The server signs in only as `contextengine.sh` (with or without `www`) or `CE_MCP_APP_ORIGIN`; the retired `contextengine.xyz` site is no longer trusted.

### Documentation

- `LICENSING.md` names the LGPL and other third-party items. The docs say real sessions need Cloudflare's Workers Paid plan, give the deployment profiles one home, and correct statements that contradicted the code. `CONTRIBUTING.md` has how-to recipes for adding a route, a config field and a question type.

### Local tooling

- The navigation smoke no longer stubs Google Fonts: the site doesn't request them, and such a request now fails the smoke like any other outside call.

## [0.9.3] - 2026-11-12

### Client — available when the site deploys

- Admins, co-admins and results admins get **Build risk matrix** beside **Build atlas** in the open Results menu, with a "?" saying what it builds. While it runs, the status line counts the time, names the AI model and shows the prompt under **Show AI prompt**. The newest build opens as **Risk Matrix**, with a **Version** picker for earlier builds, in place of the demo's or AI Views' risk matrix; each note says how many participants hold it.
- The Risk Matrix shows AI Views' notes as written: it no longer adds the demo's historical figures, sources and atlas scenarios when their areas share the demo's names. A cell between two areas now lists only their notes, where a note could also show up when one of its subareas had an area's name.
- The Risk Matrix reads clearly in Context Engine and Classic 95. A cell's figure sits on a chip of its own, where the strongest cells were as low as 2.1:1, and the diagonal's dots are no longer faint. In Classic 95 a cell's notes sit on white cards rather than black ones, where their text was 1:1, and a note group's title stays readable when hovered. In every theme **Clear X** and **Clear Y** stay readable while there is nothing to clear; in Civic they were 2.4:1.
- The **Version** picker of a debate atlas or risk matrix shows its text in the panel's colour in Context Engine, where it was 2.1:1.
- **Session members see all answers** is a new **Who sees results** choice, and new sessions on `/new` start with it: everyone signed in to the session sees every answer and the AI Views, and a signed-out visitor is asked to sign in. It needs the Session Worker, so choosing on-chain hosting moves it to public results, or to own answers when answers are encrypted. Sessions created earlier keep their setting; Settings offers the new choice once the session's Worker runs this release.
- **Suggest questions**, under the question list on `/new`, drafts five questions from the page's context with the OpenAI key typed under AI, following **Question prompt** and **Tag suggestions**. It reads the name, description, context text and links, and the files added to Context. Drafts join the list, where you can edit or remove them before **Create**. The key goes only to OpenAI, from your browser.
- **Runs on** is now a toggle at the top of `/new`, **Centralized** (a Session Worker on Cloudflare) or **Decentralized** (an on-chain registry with Arweave), where it was a dropdown under Hosting and storage. Its "?" says what each needs.
- **Colors** on `/new` and in Settings now sit under **Appearance** in Basics, which opens by itself when a session has colours of its own.
- **Every option on `/new`** now has its own "?" saying what it does and what it needs, including the interview settings, the results analysis, the access rules and each key field. Help that showed as text under an option has moved into its "?", and screen readers still read it with the option. The interview and results analysis settings show the same "?" in Settings and on `/admin`, and the key fields now have labels.
- The faucet card under Hosting and storage is titled **Test gas faucet**, where it showed the code **TXGAS**.
- **Sign-in** and **Permissions**, on `/new` and in Settings, and **Storage** on `/new` now show as text with a "?", since **Runs on** allows only one of each; their dropdowns and checkboxes could only cause conflicts. **SBTs grant permissions** stays a choice on Centralized sessions. When a template brings values Runs on doesn't allow, **Match Runs on** puts back what it needs, and **Session Worker** encryption can't be chosen on a Decentralized session.
- **Session members see their own answers**, which looked like **Each person sees their own answers** on the web, is now **Own answers; agents need a group**, and **Anyone can see the results** is **Anyone can see all answers**. The "?" beside **Who sees results** says what each choice shows.
- Older text on `/new` is now readable in every theme: the Worker name under Hosting and storage, **ANY** and **ALL** on an access rule when hovered, **Create Group** while pressed, and **Add Address** once an address is typed. In Classic, access rules and group pickers, with their **+ By Address**, address chips and group menus, read dark on light wherever they appear, where they were light on light, and in Context Engine the group picker's placeholder is brighter.
- The account menu has **Your AI agent**, with two ways to bring an agent to the session. **As itself** copies a Claude Code command that adds the Context Engine MCP with the agent named "<your name>'s Kami", and a prompt that joins the session. **On my behalf**, when the session has Agents (HTTP API) on, makes a key that lets your agent read the questions, save drafts and submit the answers you approve, as you. The key comes inside a terminal command that sets `CE_AGENT_TOKEN`, so it stays out of the chat: the prompt you paste there names the variable, not the key. The key is kept only while the dialog is open, and works until your sign-in ends.
- `/skill.md` and `/llms.txt` tell an agent to ask the person it works for which way to take part, and say what each way needs.
- **Settings** shows which Context Engine release the session's Worker runs; a Worker from before 0.9.3 shows "before 0.9.3".
- Results admins can start **AI Views** on Worker-hosted sessions and see their progress, as they already build atlases and risk matrices. Only the admin can publish AI Views from answers the browser supplies, as on-chain sessions do.
- The About page's **Representative Models** card now says training representative AI models is planned, where it read as available today. The group recording guide (`docs/session-listening-mode.md`) no longer says handing each speaker their part by code is unavailable.

### Workers — requires redeployment

- Admins, co-admins and results admins can build a session's risk matrix with AI, as they build its debate atlas (`POST /admin/risk-matrix/build`, read at `GET /risk-matrix`). One call names the areas the responses discuss, each with a few subareas, and writes notes on where two areas meet, each an opportunity or a risk with an intensity from 1 to 10. A note is kept only when it cites someone who answered a question it cites. The session's context reaches the AI as untrusted material. Builds are kept and read like atlas builds: the newest 8, each stamped with its time and response count, under the same viewer rule. The public config reports `riskMatrix: true`.
- AI Views and the debate atlas read a session's answers 100 at a time, so about 80 people answering 30 questions now fit the Worker's read limit. Before, a session was refused from about 400 answers. An answer that can't be read now stops the build with a message to retry, instead of being left out.
- New results visibility `session_member_full`. `/storage/list` and `/storage/read` give a signed-in participant who holds the `storage` (or `arweave`) scope every answer, and the AI Views, Debate Atlas and Risk Matrix reads follow; a signed-out visitor, or a sign-in without that scope, reads none. Per-answer access rules still apply. Only Worker-hosted sessions with Cloudflare storage can choose it.
- On such sessions the Agent HTTP results routes need a credential whose account passes the session's sign-in rules, and refuse others with `agent_membership_denied`.
- The public config sets `memberResults: true`, so the site knows the Worker offers this visibility.
- `/api/agent/questions/next` no longer fails with `question_queue_unavailable` in sessions whose questions were added on the website. Their IDs have the same shape as a private key, so the secret check refused to save which questions an agent had been served. Fields named for question IDs may now hold exactly that shape, and nothing else that looks like a secret.
- Agent HTTP results no longer fail with `agent_storage_unavailable` once a session has about 500 answers from agents. `/api/agent/results` and `/api/agent/results-image` now read only the permanent copy of each answer, 100 per KV read. Cloudflare stops a request after 1,000 KV operations; in a test salon of 80 agents answering 30 questions, with 16 changing their answers, the busiest results request uses 167. A stored answer can be half a megabyte, so a read that Cloudflare refuses for passing its 25 MB reply limit is read again in halves.
- An agent submitting many answers in one `/api/agent/preferences` request no longer reloads every question for each answer. A 30-answer submit used more than 1,000 KV operations and failed; it now uses about 490.
- `/capabilities` reports the Worker's Context Engine release as `release`, so a public GET tells which release a Worker runs.
- Results admins may call `POST /admin/results-analysis/generate` and read its status on Worker-stored answers; a request that supplies its own answers is still the admin's alone.
- An agent's submitted answer no longer fails with a 500 about once in 50,000 submissions, when the random ID its stored copy was given happened to look like an API key.
- `POST /api/agent/credentials/delegate` gives a signed-in person a key for their own agent, with `read_questions` and `draft_answers` for their address, so what it submits counts as their answer. It never carries their admin powers, and in an on-chain session it only drafts, since its answers would not be signed as them. It ends with the sign-in it came from and when they make a new one, can't be exchanged for a website sign-in, and isn't given to a sign-in an agent made. The Agent HTTP skill, now v46, says how an agent uses it.

### Agents and MCP

- MCP 0.3.1. `get_results` reads a members-only session's results for an agent signed in to it. It reports `resultsPublic: false` with a note that the results are for signed-in members only.
- `get_results` reads up to 10,000 answer records by default, 16 at a time, instead of 2,000, so a 30-question session of 80 people, which lists about 2,900, is counted in full rather than marked partial.
- The MCP server's instructions tell an agent to ask the person it works for whether to take part as itself, with these tools, or on their behalf, with a key from the account menu.

### Local tooling

- CI runs the Agent HTTP tests once. The Session Worker suite already includes them, so the workers gate no longer runs `test:worker:agent` as well; the test wiring check now requires the suite to keep including them.
- `npm run ai:test-theme:results-builds` checks the built debate atlas and risk matrix in each theme at phone and desktop widths; `ai:test-theme:atlas` is gone.

## [0.9.2] - 2026-11-11

### Client — available when the site deploys

- When the AI proposes a comment for a question you've already commented on, the review card keeps your comment and puts the AI's after it. **Both**, **Mine** and **AI’s** switch between them under a quote of your earlier comment, the text stays editable, and a locked comment stays unless you choose the AI's or write in the box. A submit pressed before your saved answers load waits for you to check any card whose comment doesn't match one that loaded, saying **Saved answers loaded. Check drafts that change an earlier answer or comment, then submit.**
- A review card that would change your earlier answer now quotes free-text answers and quadratic votes too, so you can compare them; a long answer is cut short with **Show all**, and an encrypted one is only mentioned.
- After you claim your part of a conversation, "still fit" counts only the answers the AI compared. A locked or encrypted answer, which the AI never sees, is no longer said to fit, and a comment the AI proposes beside a locked or encrypted comment is offered for review, keeping yours unless you choose the AI's.
- When you claim your part while signed in, the review says it's waiting for your saved answers until they load, and if they can't be read, drafting now waits until **Retry saved answers** reads them, instead of drafting without them.
- When you claim your part, answers and comments you've changed or cleared on the page but not submitted, including an unsent draft restored after a reload, reach the AI marked as unsubmitted instead of as saved answers.
- For a draft you leave out, research sharing records the AI's comment as you left it, never a comment of yours from the page that you haven't submitted.
- In interview review, an answer or comment you encrypted counts as locked even after you unlock it on the page: an encrypted answer stands and isn't quoted, and for an encrypted comment the card shows **Your locked comment stays.** and keeps it unless you choose the AI's or write in the box. No answer or comment you encrypted, nor anything you type into an encrypted field, goes to the voice interviewer or the next round of drafting.
- A signed-in participant can now add a link to a session's context from the session page as well as a file. The form offers it only while the session takes participants' additions and hasn't ended, and only on a Session Worker from this release.
- The context list marks what an AI agent added: "<its name> (agent)", or its short address with "(agent)" when it gave no name. The agent sets the mark itself, as with its answers' agent marker, and the mark grants nothing.
- `/skill.md`, the guide for AI agents, names `leave_group` and `add_context` and says the MCP shows a session's instructions when an agent joins. It and `/llms.txt` say a session may invite agents to add context.
- In Classic 95 the Debate Map is drawn as a Windows 95 program rather than dark glass: the theme's font, square raised buttons with the chosen view pressed in, and sunken white canvases. `/atlas` and a topic's panel have navy title bars, the panel's staying in view as it scrolls, and **Top Debates** opens as a gray window. On a phone its toolbar wraps, so the legend and **Filter Depth** stay on screen. **Suggest New Topic** opens as a gray dialog; its path, field label and **Cancel** were white on white.
- The **Session Doc Library**'s link and title fields are readable in the Context Engine theme, where typed text was 1.93:1, and their hint text is readable in Classic 95, where it was 1.82:1. On phones the file field takes a whole line, so the chosen file's name shows.

### Workers — requires redeployment

- Signed-in participants may add links to context (`/storage/context` `add-link`) while the session doesn't limit context to admins and hasn't ended. Their links follow the same link rules as admins', need their `fetch` scope and count against the per-address daily limit as fetches too. Every link passes the upload's access check before the Worker fetches the page. Refreshing a link and having a PDF read stay with admins. `/capabilities` reports `participant_context_links_v1`.
- A refresh must name the same link, and keeps its title, privacy and who added it.
- A context item may carry an agent's self-declared mark: `CE-AdderKind` `agent`, with its name in `CE-AdderName`, up to 80 characters of plain text without control characters or marks that reorder text. Any other mark is refused, as is a name without the mark. A refreshed link keeps its mark.
- Prompts that read a session's context say it comes from its hosts and participants, AI agents among them. They call it untrusted material and tell the AI never to follow instructions inside it.

### Agents and MCP

- MCP 0.3.0. A normal session link, without `worker=`, goes to the Session Worker that the link's site lists for it in `/known-sessions.json`, once that Worker reports the listed session ID. A slug the site doesn't list stays on-chain, as before, and a `worker=` in the link still wins. When the list can't be read, `join_session` says so and asks for a link with `worker=`.
- New `add_context` tool: an agent adds a local file, a link or text (stored as Markdown) to a hosted session's context when the session invites it.
  - Everyone in the session sees what it adds unless it passes `adminsOnly`, and each item is marked as an agent's, under its display name.
  - It never adds a file from the MCP's state folder or a hidden folder, a hidden file, or text that looks like a key, token or password.
  - Sessions that limit context to admins, sessions that have ended, sessions that keep their files where the Session Worker can't read them, and on-chain sessions refuse it.
- `join_session` and `get_session` show:
  - the session's instructions for agents, marked as from its admins and as adding to the general guidance;
  - its groups, with how joining works and who may end a membership;
  - its invitation to add context, with the limits.
- `join_session` no longer joins a group named in the link. It names the group, says when the agent is already in it, and its next step says to read the session's instructions, then call `join_group`. New `leave_group` tool, which says why when a group doesn't let members leave.
- After a restart, the MCP checks that a hosted session it joined is still the same session behind its Worker, and asks the agent to join again when it isn't.

### Release verification

- The MCP publish workflow reads npm every ten seconds, for up to three minutes, until it lists the new version as `latest` with provenance. It no longer fails when npm takes a moment to list the version.

## [0.9.1] - 2026-11-10

### Client — available when the site deploys

- Voice mode's Interview and Group Conversation screens have a **Back** button to the two choices, which then has focus on the one you left; the address keeps `?mode=voice`, so a reload reopens them. Back is off while an interview or recording is under way, and while Group Conversation finishes its recording and uploads before going back. Leaving an interview with unsaved work asks first. The Interview screen also offers **Let your AI draft your answers** until there's something to review.
- In an interview's review, **Share for research** sits beside **AI submission info**, with a **?** that says what it shares, and starts ticked: `interviewMode.shareDraftChangesByDefault` is now on unless a session turns it off. Sessions set up before this release start ticked too, even where an admin chose off, because off was saved by leaving the setting out; to keep it off, an admin saves it off again in Settings. **AI submission info** no longer opens by itself to show the choice.
- When a session page's Context section is open, its header has **Add** and **View**, as the Tool Explorer does. **Add** opens and closes the form to add a file, or an admin's **Manage files and links**, and keeps what you've typed while closed; **View**, with a **?** that explains it, replaces **Show my groups' files**.
- In Safari, Group Conversation keeps its audio on the device, so a reload can recover the recording. Safari refused to store it, and as soon as recording began the page warned that the recording couldn't be recovered after a reload ("Error preparing Blob/File data to be stored in object store").
- On a session page, the check after you submit answers opens your profile in that session, as do a group's admin and member links, the addresses on Results' response cards and their answer pages, and an SBT page's addresses. They opened it in the default session, which doesn't hold those answers, or showed "Browser origin not allowed" on a site whose address that session's Worker doesn't accept.
- The green check after you submit answers on a session page goes away after 10 seconds, keeping its place so nothing moves; it waits while pointed at or focused. Each new submit shows it again.
- The site opens a session from a normal link, with no `worker=`, only when the repo's `known-sessions.json` lists it, and only when its Worker reports the session ID listed there; the site's built-in demos, such as `demo-interview`, still open from their normal links. The list holds EDDY 2026 (`eddy26`), the demo session `demo-sh`, the Reverse Alignment salon `rxc-ra-26` and, for now, `rxc-ra-test-5`, whose link is on the RxC films and slides; other sessions open from their `worker=` links. The site also serves the list at `/known-sessions.json`.
- `/session/demo-sh` now opens from the demo session's own Worker, which must report the listed session ID, instead of from the site's built-in copy of its settings.
- The About page's **Demo** button opens the Reverse Alignment test session, `rxc-ra-test-5`, whose Worker runs voice interviews, group recording and the prompt for your own AI. It opened `demo-sh`, whose Worker predates them.
- The short links such as `/rxc-ra-test-6` are gone. `rxc-test`, `demo-interview-5`, `rxc-ra-test`, `rxc-ra-test-2`, `rxc-ra-test-3` and `rxc-ra-test-6` now open only from their `worker=` links.
- AI agents opening the site find `/skill.md`, a short guide to taking part in a session: every page links it, and `/llms.txt` has a section on it. `/.well-known/` addresses answer 404 instead of the app.
- Sessions on a Session Worker have an optional **Instructions for AI agents** setting at `/new` and in Settings: Markdown that agents read before taking part, such as which group to join or what to focus on, in addition to the site's guide. Admins type them or load a .md or .txt file. Its **?** says anyone can read them without signing in, at the Worker's `/session-config` and `/llms.txt`. Saving them signs no one out.
- Interview review, after a voice interview or an AI prefill, lists groups that fit a person's answers in a collapsible **Groups** section right below the drafts, each with a tick box. A join link's group still waiting for sign-in comes first, ticked; unticking it cancels that link's join, as the link notice's **Cancel** does, and a ticked link still joins at sign-in. Every other group starts unticked, for the person to tick. While any group is ticked, the submit button reads **Submit and join**, and the ticked matches are joined once the answers save, through the Worker's usual join route. The section reports each group joined or not joined, with the reason, and keeps a failed group ticked to try again. While a group is still joining or left ticked after a submit, **Back** asks first, as it does for unsaved work, and reopening Voice mode returns to the review. Its ticks survive another interview round and edits to the drafts, but not another account signing in.
- New interview setting **Suggest groups to join** (`interviewMode.joinMatchingGroups`, off by default), in session Settings and on `/new`, is the only switch for matching people to groups: groups that fit someone's answers are suggested for them to tick, and the person's own AI can suggest groups in its prefill too. Off, no groups are matched. **Suggest open groups that fit participants’ answers** and its **Join** buttons are gone; saved configs that carry `suggestGroups` still save. Matches are no longer capped at four groups, and signed-in participants on private sessions now get them, through their saved Worker sign-in.
- With **Suggest groups to join** on, **The AI may use** sets what the session's AI and each person's own AI may base a group suggestion on (`interviewMode.groupSuggestionData`): **Country**, **Work** and **Interests and causes** by default; **Town or city** only when ticked. No AI may go on health, disability, religion, ethnicity, sexuality, gender identity, age, family life, or party or union membership, whatever is ticked. With none ticked, no AI suggests groups, and only groups named like a chosen answer are listed. The choice is saved only while the switch is on, and a stored value that isn't a list allows nothing.
- Each group in the interview's **Groups** section shows its image beside its name. On a private session, a group's stored image shows once the person has a saved Worker sign-in; the section never asks them to sign in for it.
- Each suggested group's reason in the **Groups** section starts with how well it fits: **Strong fit**, **Moderate fit** or **Weak fit**, from the AI's confidence, in the same bands as the drafts' confidence. Suggestions keep their order rather than sorting by fit.
- The session's AI picks groups in the same reply that drafts someone's answers, by the rule their own AI follows, instead of in a second AI call afterwards. Its picks no longer need a quote of the person's words, and all the matches show together once the drafts are ready.
- Every AI in interviews places someone no more precisely than their country: the voice interviewer, the drafts made from an interview, the prompt for the person's own AI, and group match reasons. A question asking for a smaller place, such as a city, is left for the person to answer.
- A join link shows a signed-out visitor on a private session the group names that the link's group members can see, so its notice names the group instead of showing its ID, and group suggestions work before sign-in.
- Background requests never open a passkey prompt: refreshes of the Results group filter on focus and every minute, group images, context files read for an AI, Community group counts, and tag-page groups. Each uses the page's Worker sign-in, or signs in silently while the passkey wallet is unlocked, and otherwise keeps what it shows. Someone signed in is asked for the passkey rather than shown what a signed-out visitor sees on a session page: its Groups panel, context files, and Results group filter, a filter saved or in a link included, ask in one shared prompt when the session needs a new sign-in, as in a new tab. Before the first sign-in, a private session shows a **Sign in** button there instead.
- A Worker sign-in now survives a reload in the same tab for the rest of its four hours, so a private session doesn't ask you to sign in to it again. Each tab keeps its own in sessionStorage, never localStorage; a new tab asks once, and a sign-out or account switch in any tab ends every saved sign-in. What the wallet signs itself, such as an encrypted answer, still asks for the passkey once after a reload.
- The passkey wallet now stays unlocked while you use the page: each click, tap or key press keeps it open for another 60 minutes, where before it locked 15 minutes after its passkey prompt, so signing in to a session and submitting don't ask for the passkey again while you keep using the page. However much it's used, it locks 8 hours after the prompt, and reloading the page still locks it.
- The prompt that lets your own AI draft your answers works on private sessions. Signed in, the copied catalog link carries a ticket of yours, so your AI reads the questions you may see, those shown only to your groups included, and suggests only groups you could join and haven't; the prompt tells it the link is private and lasts an hour at most, and the page renews it quietly before it runs out. If you haven't signed in to the session, checking the prompt asks once while the page is open; declining still offers the signed-out prompt, and **Retry** asks again. Signed out on a session whose questions need a sign-in, the card says to use **Log in** at the top of the page, and **Interview & share**, whose prompt is for sharing and never carries a ticket, says each person copies their own prompt once signed in. Checking an imported prefill uses your ticket too, without asking you to sign in.
- Switching networks and back no longer leaves the passkey wallet looking unlocked without its key, where a transaction then failed as if it might already have been sent. It asks for the passkey instead.
- Worker groups have a **Who can remove members** setting, like an SBT's Burn Auth: **Admins and the member** (the default), **Admins only**, **The member only** or **No one**, with a **?** that says what each means. It's chosen wherever a group is made: `/new`'s **Groups to create**, Settings → Groups and the Create group page, participants' groups included; admins change it later in Settings. A session page shows **Leave** only when members may leave, and a group's details say who can remove members; Settings shows **Remove** only when admins may. On a Session Worker from before 0.9.1 every group works as **Admins and the member**, and choosing anything else in Settings or on the Create group page says so.
- A group's **Join period ended** and **Admin add required** labels are readable in Civic and Classic 95, where they measured 4.14:1 and as low as 3.02:1.
- Answers submitted right after signing in, as when you sign in to submit an interview, keep their question's type and text. Sent while the questions reloaded, they were saved as free text with no question. The pile no longer stays empty after that submit, and the interview's drafts and score show the questions instead of their IDs.
- On a session with no questions yet, the page settles on **No questions available.** after its usual 20-second check. It could show **Loading...** forever: when the page's question cache finished starting up after the questions were first read, or when a request had been rate-limited in the two minutes before.
- Every file picker's button now uses the theme's control colours, at rest, pointed at and pressed. In the Context Engine theme the browser's own button had left its label at 3.95:1 when pointed at, and the chosen file's name was below 2.3:1 in admin **Backup & restore** and the **Session Doc Library**.

### Workers — requires redeployment

- `GET /llms.txt` returns a session's instructions for AI agents, `agentInstructions` in its public config, as `text/markdown` that a browser never runs as a page (`nosniff`, sandboxed), and 404 when it has none.
- `set-config` and the deploy helper accept `agentInstructions` as text of up to 8,000 characters, and editing it signs no one out. A self-deployed Worker from before this release refuses the field, so `/new` sends it only when instructions are set or the Worker already holds some; to give agents instructions on such a Worker, update it first.
- A signed-out `GET /groups/list` on a private session returns the session-visible groups when it carries a join link's `joinGroup` for a group someone could join on their own: open, visible to the session, and before any joining deadline. That's what the group's members see, less who runs each group; groups shown only to their members or admins stay hidden, and member counts are never included. Other requests are refused as before.
- With `interviewMode.joinMatchingGroups` on, the interview prefill catalog lists the groups the visitor could join on their own, as data, with `groupSuggestionData`, the session's allowed kinds of detail in words; the clipboard prompt says how an AI may suggest them. Session Workers before 0.9.1 refuse both settings, so `joinMatchingGroups` is saved only when on and `groupSuggestionData` only when it isn't the default.
- The interview prefill catalog can read as a signed-in person. `POST /agent/interview-catalog-ticket` gives the session page a ticket, lasting an hour at most and never past the sign-in, for the catalog link it hands that person's own AI. With it, the catalog lists the questions that person may see, those shown only to their groups included, and the groups they could join on their own and haven't. Another session or an access edit ends a ticket early, signing out of the page doesn't, and a ticket is never a sign-in. Without one, a session that lets no signed-out visitor list its questions now answers 401 `sign_in_required` instead of asking for a retry.
- Each group has `removalAuth`: `both` (the default), `admin_only`, `member_only` or `neither`. `/groups/leave` works only on `both` and `member_only` groups, otherwise answering 403 `worker_group_leave_denied`, and `groups/remove-member` only on `both` and `admin_only` groups, otherwise 403 `worker_group_removal_denied`. A refusal leaves the membership as it was, and deleting a group still works. Admin create and update and participant `/groups/create` accept it; another value answers 400 `invalid_removal_auth`. Every group list and result reports it, the public listing included, and groups saved before this release report `both` and work that way. A Session Worker before 0.9.1 ignores the setting.
- Changing an interview setting, even turning voice interviews off, no longer signs participants out: each interview request reads the settings afresh, and no sign-in holds them. Session Settings lists these edits under **Keeps everyone signed in**. A Session Worker before 0.9.1 still signs participants out for them.

## [0.9.0] - 2026-11-02

0.9.0 also contains the 0.8.1 changes listed below, which were never released on their own.

### Release verification

- Reject raw provider-key shapes in release scans, including test fixtures, and generate synthetic secret-detection inputs at runtime.

### Client — available when the site deploys

- Session admins can press **Build atlas** in the open Results menu to build a debate atlas from the responses at that moment. While it runs, the status shows the seconds since it started, the AI model, and the prompts it sends under **Show AI prompt**. **Debate Map** shows it as read-only circles: branches and their topics. A branch or topic opens to its summary, the positions found in it, and a political compass whose two axes the AI chose from its main disagreement, with those positions and up to 40 of the participants who answered placed on it by avatar and address. Beside each participant is the AI's reading of their answers, labelled as such. Every build is kept, stamped with its time and response count, and a picker opens earlier ones. Everyone who can see a session's full Results sees its atlases; on other sessions only those who may build do.
- Closing a branch or topic of a session's atlas keeps you on the session page. Its link button copies `/atlas/<topic>?session=<slug>`, which opens that session's Results at the topic, for those who may see them.
- A compass's legend names its own kinds of point, Position and Participant on a built atlas, and a compass with no one placed on it says so.
- A branch or topic's panel leads with a summary no longer than a tweet, and so does an AI Views circle's. **Show more** shows the rest and lists an atlas's positions, each named in bold with how many of those who answered hold it and a bar for their share. New builds ask the AI for a summary under 280 characters and record how many answered each topic.
- Hovering a participant on a compass shows their address, which was drawn dark on the dark tooltip. Selecting them shows it underlined, as the link to their profile it is. Participants the AI placed on one spot now sit on half rings below it, and no two avatars or a position's dot overlap, at the chart's edges too.
- A topic's questions look like the session's question cards, and each opens its own page in a new tab, where it can be answered. Question cards in other Debate Map panels take the same Agree, Unsure and Disagree colours, and a freeform question's preview is readable in Context Engine.
- The picker of a session's earlier atlases is called **Version**, and a built atlas calls its levels Category and Topic in its legend, panels and List filter.
- In Civic and Classic 95 the Debate Map's List colours each level and its Tree draws its connecting lines. Classic 95's Tree category buttons, cards and card icons are readable.
- The Debate Map's tree view asks for a category to draw the **Tree Chart**, as its button is named.
- Question Results shows a spinner in place of its question and response counts, and each question's count, until they load, instead of 0.
- The status line under Results, shown while AI Views or an atlas builds, is readable in Civic, where it measured 3.35:1.
- The Results menu buttons, the Debate Map view switch and legend, a topic's panel and its compass are readable in Civic, Context Engine and Classic 95: some labels were as low as 1:1. `npm run ai:test-theme:results-builds` (named `ai:test-theme:atlas` until 0.9.3) checks them in each theme at phone and desktop widths.
- The Agent Village post is readable in Classic 95, where its tags, chart labels and tooltips, List view and evaluation protocol measured as low as 1.1:1. A pinned tooltip's close button also stays visible on hover and focus there and in Civic. `npm run ai:test-theme:civic` now checks the post in Classic 95 too.
- The About page says Soulbound Token groups instead of SBT groups, and names the Cloudflare Worker alternatives: Worker Groups for access control, and Worker encryption beside Lit for on-chain sessions.
- The RxC sessions no longer show twelve pre-filled topic circles: Debate Map appears once an atlas is built, on rxc-ra-test too. On a demo session, a built atlas replaces the demo atlas.
- Session Settings has a **Results admins** list under Results visibility, where an admin adds or removes the addresses that may build atlases. Saving it signs no one out.
- A session's error pages show their title and message on a readable card, with their actions as a row of matching buttons.
- A link styled as a button matches the theme's buttons and keeps its readable colour on hover.
- In a Group Conversation's transcript, each speaker's label is bold and has its own colour.
- Group Conversation can hand each speaker their part: the recorder taps a person, and that person scans a looping code with their own phone, signed in or not, to open the interview with their answers drafted from what they said. The part goes from screen to phone without being stored; on the phone, the session's AI drafts the answers from it, and nothing is saved until they submit. It's slow enough to work over a shared screen on a video call, and **Copy link instead** covers a phone whose camera can't be used. The QR-code icon in the dialog's header starts the same scan, and a speaker's label in the transcript opens their code, as their button does.
- When the recorder gives one person two labels, drag one person's button onto the other's to make them one (on a touch screen, hold it still first): the transcript shows their lines under one label, and one code carries the whole part. **Same person as…** in a person's code does the same without dragging, the × on a merged button splits it again, and merges stay with the recording through a reload.
- When someone claims their part, the answers and files they already have in the session are reconsidered against it: a changed answer shows for review, and answers that still fit stay as they are.
- Group Conversation's **Add transcript to context** box, on the **Submit questions** line, uploads the transcript as a context file for the group or the session, off by default.
- The question selector no longer shows "(cache error)" when a signed-out visitor's request for other people's answers is refused on a private session.
- Results group sizes, vote bars, overall figures, representative statements and AI group summaries now count only people who answered enough to be in the analysis, as pol.is does, in every view. People with few answers still appear on the map in their nearest group. Representative statements keep a group's five strongest before showing agreements first, and uneven or very small sets of responses no longer break the Results maps.
- Recording is less likely to stall on networks that close a connection after a minute of silence: while a chunk waits for its transcript, the page sends a small request every 20 seconds to keep the connection in use.
- The `/docs` page and Tool Explorer descriptions match current behavior: new sessions start public, storage depends on the session, and Lit protects only the fields you lock. `/docs` shows the current deployment diagram.
- The setup page's Results summary shows the saved analysis choice instead of always saying manual.
- The "Set up with your AI" heading on `/new` is readable on the Context Engine theme.
- The About page's Agent Mirror Test and Agent Village links open the published post.
- Worker setup help no longer calls the API token deploy legacy, says a blank anonymous IP budget means no cap, and says a disabled embedded helper refuses sponsored deploys.
- Removed unreachable setup branches, the hidden hologram assistant, unused styles, and Bridge-era session flags, with no visible change.
- Refresh the light-theme About page with colored use-case buttons, pressed selection states, teal actions, compact sections, and consistently sized Recognition logos.
- Keep About actions on one line on narrow phones, enlarge resource touch targets, move section previews below their headings, and give the mobile video a clearly visible play icon.
- Improve footer contrast, link directly to the CommonGround environments and Truth-Seeking AI grant program, and refresh the README feature slideshow and architecture artwork.
- Let long question prompts use spare card space at phone and tablet widths, moving answer controls down before reducing text size. Extremely long prompts remain keyboard-scrollable.
- Match the Minimal mobile Login button height to the visible C logo artwork, excluding the SVG's transparent padding.
- Correct light-theme contrast in raw question results, expanded answers, sorting/export controls, bookmarks, sync indicators and Worker group notices, including Classic 95 counters, links and binary-answer labels. Keep the results title readable at narrow widths. Browser coverage now checks these surfaces in all three themes.
- The login dialog's Create and Login buttons keep their fill when hovered, focused or pressed, so their labels stay readable in every theme; in Minimal, Create's label vanished on hover.
- The locked-answers controls in Raw Results are readable in every theme, hovered, focused or pressed: Decrypt, Log in, the required-group links, the toggle that opens them, and their focus rings.
- Primary buttons keep a readable fill in every theme, hovered, focused or pressed, including See Questions, the Agent token Login and the Worker group and document buttons. They use the theme's action colours instead of a purple that reached only 3.70:1 with their white label.
- The HTML report's Cancel, Download and Generate buttons and the Admin and Sponsor action buttons are readable in every state and theme.
- Decrypt on answers and questions takes the surface's own text colour, so it no longer disappears on Classic 95's teal. The locked-question notice and the locked-questions banner are readable in every theme.
- Create and Login fit the login dialog at phone width.
- A link with both `mode` and `joinGroup` shows the group notice inside the voice dialog, where it can be read and cancelled before signing in.
- Creating a group says when sign-ins are rate limited instead of showing an internal code.
- Session settings shows **Sign in** as a clear button at the start of its sentence. The buttons on the Setup and Settings pages have a fill, so Minimal no longer shows them as plain words.
- Session settings says which account you're signed in as when it isn't one of the session's admins.
- New groups start open to anyone who can see the session, with their members visible to it. Admins can still choose to add members themselves.
- `rxc-ra-test-5` and `rxc-ra-test-6` open from their clean links on a device that has never seen them.
- The Groups panel, its create and edit forms, the session's Results and Groups headers, and the Session Admin page's heading, labels and cards are readable in every theme.
- Group Conversation offers a compact Record button and an icon-only **+** menu for audio uploads, transcript files, and pasted text. Imported audio keeps the recorder’s retry/download recovery. Internal audio parts stay hidden; downloads combine the audio not yet transcribed into one local MP3. Typed draft cards include a top-right remove button and **Submit questions**. Input guidance sits in the title tooltip.
- Protected question storage shows a sign-in requirement instead of a generic cache error while signed out. Standard session pages omit the interview sharing panel; **Interview & share** remains on admin and publish screens.

- Drop the retired Goerli test network from wallet connections and a collection metadata lookup that always failed.
- Trust a cached Worker sign-in only when it records the Worker, session and account it was issued for; the older unscoped format, which nothing writes, is ignored.
- Group Conversation shows who spoke as `Person 1:`, `Person 2:` lines. A five-second sample of each new voice goes with later chunks, so up to four voices keep their number across three-minute chunks; a fifth voice, or one heard only briefly, is numbered within its chunk. With a Session Worker before 0.9.0, numbers restart in each chunk and the recorder says so.
- The voice dialog's close button asks before it stops a recording.
- The recorder notes when the device takes the microphone, as a call can, and marks the gap in the transcript. Capture that stops without telling the page gets a fresh microphone stream.
- On a computer, which keeps recording in a background tab, switching tabs no longer raises the hidden-page notice while audio keeps arriving. A gap in the audio, a muted microphone or a phone still gets it.
- Only one tab at a time opens a recording; another tab says so and takes over once the first closes it.
- The session page says when audio kept by Close and keep the audio is still waiting to upload, after a reload too, and offers Reopen recording.
- Group Conversation is readable in every theme, hovered or focused too: recorder status, transcript details and errors, the Record, Stop, Generate questions and Reopen recording buttons, destructive confirmations, dark dialog titles and close buttons, question-type chips, draft fields, tag remove buttons, icons, focus rings and the recording timer. Civic, the default, uses system monospace fonts, and its "Transcribing…" is no longer white on white.
- Group recording opens the transcript once it has text, in a taller box on phones, and keeps it on the newest line unless the host scrolls up. A "new draft questions" cue appears above the recorder while new drafts are out of view, and scrolls to them; it takes no space otherwise.
- Draft review on phones shows each question and its options in full at the dialog's width, and keeps Submit questions at the bottom once every draft has been seen. Question fields resize again after fonts load or the theme changes.
- The upload success list names each question by its text, with its ID beneath; the JSON and AI prompt views are in a closed disclosure.
- Recorder warnings (microphone paused, screen lock, hidden page) look like notices, and Close and keep the audio, Retry and Download look like buttons. "Record speaker audio" is now "Recording voices coming from this device".
- If device storage fails, the session page says a closed recording can't be recovered after a reload, and the browser asks before a reload, for pasted transcripts too, until the recording is reopened and saved or cleared. Audio not yet transcribed stays downloadable meanwhile, even during capture.
- Group Conversation deletes each chunk's audio from the device once its transcript is saved, and its voice samples once every chunk is transcribed. Audio goes only to the Session Worker, which passes it to the transcription service and stores none. A reload or a closed tab can lose up to the last 10 seconds. Clear always asks first.
- Imported audio up to 30 minutes is split on the device into three-minute parts, saved together, each uploaded and retried on its own. Longer or unreadable files are refused with a message. Record and closing wait while a file decodes.
- Group Conversation keeps draft questions, with the host's edits and removals, after closing or reloading until they are submitted or deleted, and drafts only new conversation.
- Draft question cards, in Group Conversation and the voice interview's review, preview the answer: Agree/Unsure/Disagree, the rating slider, the options or the credits.
- Drafts generated while Submit uploads join the list afterwards as new drafts instead of undoing the upload, so the success list always appears and uploaded drafts can't be sent twice. Submit reads "Waiting for new drafts…" while drafts generate.
- Text pasted while a chunk transcribes no longer stops that chunk's automatic questions, and Retry transcription appears only for failed or stalled uploads.
- The bundled session list includes rxc-ra-test-3, so its group recorder link opens on a device that has never visited the session.
- `/skill.md` sends agents to the session's Session Worker instead of the removed Agent Bridge.
- `/new` is one page. Each section shows a summary, a conflict shows as a plain message beside the option, and Create confirms with your passkey, then deploys and saves.
- Admins edit sessions at `/session/<slug>/settings`, which replaces the `/admin` metadata editor; `/admin` links there. The page says which edits sign participants out, saves only changed fields and copies the group recorder link. For an on-chain session it uploads the new metadata, has the admin's wallet update the SessionRegistry, shows each step and the transaction link, then syncs the session's Worker.
- The settings page edits AI models, reasoning effort (for the session and per task) and transcription model; default question filters; highlighted and hidden questions and surveys; moving on after an answer; and SBT defaults. On-chain sessions also get contracts, block range, faucet amounts and SBT lists. Edits typed while the page loads are kept. Request limits and co-admins aren't editable there yet.
- Session templates: Export, Import and share links (`/new#template=`) carry a setup's questions and context, never keys. Context files are listed by name and privacy, to attach again. Import refuses a file over 256 KB before reading it.
- Setup offers only current OpenAI and Claude models and is readable in every theme at phone width. New sessions use GPT-6.1 Terra for everyday tasks and GPT-6.1 Sol for harder ones, and transcribe with gpt-transcribe.
- The account presets are GPT-6.1 Terra and Sol, GPT-6 Astra, Claude Sonnet 5.5 and Claude Opus 5.5. A saved preset that no longer exists uses the default.
- Generated questions state one plain, neutral idea each and don't repeat; breakout questions cover concrete next steps.
- Audio summaries no longer send the transcript twice, and `$&` in typed or spoken text no longer corrupts a prompt.
- The HTML report uses the same analysis prompt as the Results views.
- "Set up with your AI" on `/new` copies a setup prompt, or opens it in ChatGPT or Claude. Your AI interviews you and returns a link that fills in the page, or JSON to paste under Import. Nothing is created until you review the page, add keys there and press Create.
- `/new` reads `#setup=` links (plain base64url JSON, which an AI can write) as well as `#template=` share links, and removes either from the address bar once read.
- Setup, share and prefill links share one decoder: wrapped links and missing padding work, invalid text is refused, and a cut-off or damaged link says which.
- A broken prefill link opens the interview with its reason and a box to paste the AI's JSON. Drafts the page leaves out are counted instead of disappearing.
- Admins can copy the group recorder link (`?mode=groupRecording`, with any Worker pin) from the Join panel. Unknown `mode` values are ignored and removed from the address.
- The Context section on `/new`, on the settings page and, for admins, on the session page takes files (PDF, Markdown, text, CSV, JSON) and links for the session's AI. Each item is for everyone or for admins only; others don't see the section while the session has no context.
- Question generation and the voice interviewer read the session's notes and links, plus the files and links the person may read, as untrusted background.
- Setup and the settings page check context against shared limits: up to 6 paragraphs of 2,000 characters, 8 https links, and no text that looks like a secret.
- GPT-5 and GPT-6 requests send their JSON schema in the form every released Session Worker passes to OpenAI, so question generation, summaries, profile analysis, tags and the AI filter keep working on Workers from 0.6 to 0.8.0.
- A session that stores no AI model, and the admin AI test, let the Worker pick the model, so Workers from 0.8.0 and earlier don't refuse them.
- Transcription with models other than whisper-1 sends audio in pieces of at most five minutes, so long recordings and uploads aren't cut short.
- The settings page shows the highlighted and hidden lists read-only on an older Session Worker instead of failing the whole save, and checks only an edited context against the context rules. On-chain saves keep an older "don't feature SBTs" choice and AI provider, check the admin wallet's account and network before the paid upload, and offer "Retry the Worker sync" after a failed sync.
- When a session's metadata can't be loaded, the page keeps its last usable name, Worker link and settings, so the settings page can't publish a stripped copy.
- Clearing the cache also drops writes still waiting to save, and the cache keeps working when the browser blocks site storage.
- SBT pages show the chain's holder count, not 0, until a full count loads.
- An already-saved interview answer reports "Responses already saved" while another answer has an unsent edit, and a tag removed while AI suggestions load stays removed.
- A link padded with thousands of `=` no longer freezes the page, and a setup link opened over a draft with a problem lists what it changes.
- If another account signs in while Group Conversation records, recording stops and its chunks wait on the device until the account that made them signs back in. A recording started signed out belongs to the first account that signs in during it. A sign-out still uploads signed out.
- HTML and PDF reports hold what the exporter can see in Results: question text they decrypted, answers, comments, conviction and responder addresses. Answers still locked for them stay out. AI analysis, and the Generated AI views that other viewers open, still leave out questions whose text the author encrypted, and their answers.
- Reports carry the exporter's full address in the file's data and on the page. A PDF also has it in its properties and as text on every page, and the Polis report PDF is stamped the same way.
- A long report's PDF is captured a block at a time, so it no longer outgrows what one image can hold. Its closed items are open. A very long report takes a while and makes a large file: 3,000 answers took about 20 seconds and 50 MB.
- Reports show each rating's scale, and the browser's AI analysis receives it, so a saved analysis of a session with ratings is generated again once.
- A transcription reply that can't be read, such as one cut off by a dropped connection, no longer counts as silence, which deleted that chunk's audio. The chunk keeps its audio and retries, and dictation shows an error instead of an empty transcript.
- Clear reports a failed delete and can be tried again, even after an earlier save failed, instead of saying the recording is gone while chunks stay on the device.
- An ended on-chain session reads each answer at a block, never at the latest state, so an edit made during the read can't appear as an answer from before the end.
- The Agent page asks each rating on its own scale and step, with its end labels, and a single-choice question holds one option.
- Results drops answers decrypted for one account when the account changes, including a decryption that finishes after the change, and stops decrypting the remaining rows.
- Question text, survey titles and survey document links decrypted for one account are locked again when another account signs in or the account signs out, until they are decrypted for the current reader. A Decrypt Prompt that finishes after an account change is neither shown nor saved.
- Session context files and links reset when the reader or the session's Worker changes, so the next reader never sees or sends the previous reader's admins-only items.
- Profile SBT badges are kept per chain, so a badge burned on one chain no longer hides one earned at the same address on another.
- Results analysis of on-chain sessions keeps answers to options whose text has repeated spaces.
- Creating an SBT group stops before the next upload, transaction or draft save if the wallet account changes after Create.
- Stats show cached counts within a few seconds while live group counts load or wait for a sign-in, and later updates don't wait for those counts again.
- A changed multiple-choice draft is always saved; some option labels containing commas could make it look unchanged.
- The Results report ignores ratings that are off the question's step grid.
- Interview drafts snap ratings to the question's step.
- Answer commitments in encrypted envelopes bind the exact answer: rating hashes keep the value on any scale, and Poseidon commitments include each value's length. Existing envelopes still decrypt; only new commitments change.
- An earlier session's questions, surveys or answers finishing late no longer change whether the session you switched to counts as loaded, whether they succeed or fail.
- A question an admin hid, from the admin panel or the settings list, and its answers leave the Results report, its filters, Raw Results, the AI's input and every export, including for admins.
- The hidden and highlighted question lists in session settings apply in the browser for Worker-hosted sessions. They only took effect there for on-chain sessions before.
- An admin on a session with public Results can sign in and generate AI views when no report exists yet. The check button stayed disabled.
- A signed-out visitor to a session whose Results aren't public is asked to log in, in the report and in Raw Results. The report offered a Retry that couldn't work, and Raw Results read as if nobody had answered.
- New sessions start with public Results, so anyone can read them and answers are stored unencrypted. Encryption and other Results visibility stay available in setup. Existing sessions keep their settings.
- Closing the login dialog no longer stops a dialog beneath it, such as Raw Results or Group Conversation, from scrolling.
- An on-chain survey edit checks the stored copy again just before sending, so an edit saved from another tab or device moments earlier isn't overwritten.
- Adding a template's questions to a session removes only what was uploaded. A question edited or added while the upload ran stays in the draft.
- A rating with the same wording but a different scale, step or end labels is no longer reported as already published when another author owns its ID. The upload is refused instead, because the two still share an ID.
- Results no longer keeps showing the previous account's survey title, links and answers after you sign out or switch accounts.
- Question and survey text decrypted for one account shows as locked to anyone else using the same browser, including after a reload while signed out. Signing out or switching accounts also clears that text from the browser's saved copy, and signing back in decrypts it again.
- If the wallet switches accounts during an answer or survey upload, the transaction isn't sent from the other account; the app asks you to switch back and try again.
- When a sent transaction's result can't be read, the app says it was sent but not confirmed, and to check your wallet before retrying, instead of reporting a failure or a revert. Creating an SBT group no longer suggests a retry that could deploy a second one.
- Lowering a session's end block removes later answers from Question and Survey Results, showing a person's earlier answer within the range instead. Raising it again brings the later answers back.
- A session keeps its name, Worker link and hidden questions when a reload can't read its metadata, instead of losing them.
- On private sessions, signed-in people can lock a context file to one of the session's groups; before, the group list stayed empty. The list no longer shows another session's or account's groups.
- **Add transcript to context** uploads as the account that submitted and skips an upload still queued when you switch accounts. Submitting again before the last upload finishes replaces its copy instead of adding the transcript twice. The next account to submit on the same device adds its own copy and leaves the previous account's in place.
- The questions CSV includes each question's rating scale, pick-one setting and pick limit.
- Dictation longer than about five minutes is transcribed in parts instead of failing, and a failed transcription says so and stays on screen.
- On `/new` and the settings page, the Context section's **Format** takes typed text or one HTML file. The file keeps its own CSS, in style blocks and style and class attributes, but loses its scripts, event handlers, frames, forms and `@import` before it's saved, along with any CSS that tests the site around the page or escapes an @-rule's name, and a preview shows the result and what was removed. The session page shows it in its context section, cleaned again each time, in a box of its own: its CSS styles only the page, can't place anything outside the box, and can use the site's colours as `--ce-context-*` variables.
- The Reverse Alignment atlas is no longer built into the client. A session shows it as its HTML context page, where its areas and topics open in place, and the RxC session list only gives those sessions their short links. A session on an older Worker, such as `rxc-ra-test-3`, shows its typed context instead.
- Links in a session's context, typed or in an HTML page, use the context panel's own text colour, so they read in every theme. In Classic 95 the typed links were about 3:1 against the panel.
- The Tool Explorer's question generator uploads a transcript summary to Arweave, where it is public and permanent, only when **Upload Summary** is ticked, which it no longer is by default. A summary marked **Encrypt Summary** isn't uploaded at all, because the upload can't encrypt yet. Before, both went up as plain text.
- On `/new`, a starting file can be locked to groups set up before Create, under Access and identity: its **Visible to** lists them, and Create makes the groups before the files are added. A file goes only to the groups Create made, or to admins alone if it made none of them, never more widely. An exported template carries a locked file as admins-only.
- Wherever a context file is added, on `/new`, the settings page, the session page or with a group conversation's transcript, **Visible to** is a dropdown of toggles like the question filter's tags: everyone in the session, admins only, or any mix of up to 20 of the session's groups, whose members may each read the file.
- Admins see a **Group Agent** button in a session's context section. For now it only says the Group Agent is coming.

### Workers — requires redeployment

- `POST /admin/debate-atlas/build` builds an atlas from the responses the Worker stores. One planning call groups the questions into at most 5 branches and 12 topics, then one call per topic maps it and one per branch of several topics maps the branch, at most 6 at once and within 4 minutes, using the session's analysis model. Each response goes to its topic's call and its branch's, so a build reads about twice what one AI Views run does, and no participant address reaches the AI. A topic whose call fails is named on the atlas. One build runs at a time per session, and the newest 8 are kept. `GET /debate-atlas` reads the newest build, or one by `id`, and tells those who may build the model and prompts a build would use.
- The session's admin, its co-admins and the new `resultsAdminAddresses` (up to 20) may build atlases; results admins can do nothing else an admin does. The public config carries `resultsAdminAddresses`, and `debateAtlas: true` to tell the site that the Worker builds atlases.
- Anyone signed in to a session can add files to its context, each showing who added it. They can lock a file to up to 20 of the session's groups, whose members may each read it, or leave it for anyone who can see the session, and remove their own. The file list names a file's groups in `lockedGroupIds`. Admins can remove any file, and can limit adding to admins in Settings. The Worker's own AI features leave group-locked files out.
- Sessions deployed with Deploy to Cloudflare or a manual config can store questions and answers. These Workers bind only `GROUP_KV`, so the template and the manual guide now set `CE_STORAGE_IN_GROUP_KV=1` to keep payloads there; before, uploads returned 501 and `/capabilities` reported `storage_missing`. Other Workers without a storage index behave as before. Uploads and hide requests can no longer reach Cloudflare storage on a session not configured for it.
- Removed the retired Agent Bridge source. Agent HTTP stays in the Session Worker; admin metrics report `sessionsWithAgentActivity`, and agent on-chain answers record source `session-agent`.
- Encrypted-envelope export takes a session admin. The session config lists `responseExportAllowedAddresses`, `telegramResponseExportAllowedAddresses`, `export.allowedAddresses` and `export.adminAddresses` no longer grant it. Nothing in Context Engine writes them, and a Hosted session's settings can't set them.
- Removed unread Telegram fields and unused Worker exports. Stored record fields and KV prefixes are unchanged.
- Worker routes no longer read grant lists, export claims or a substitute Worker Group identity from login tokens. Nothing issued them, so nobody loses access. Reading another participant's individual response in a Hosted session whose results aren't public still takes a session admin. Worker Groups still use the signed-in address.
- Anonymous visitors have no daily per-IP request limit unless the session sets one. The per-wallet daily limit no longer doubles as one, so a room sharing one venue connection isn't cut off.
- A transcription reply with no readable text returns 502, so the browser keeps the chunk's audio and retries. Earlier Workers report such a reply as silence.
- Agent submissions count test-ETH payouts against the per-wallet daily faucet limit they share with participants. Past the limit, the submission carries on without funding.
- Voice interviews leave out the session's hidden questions, in the question list, its hash and the opening. Hiding a question has a saved opening written again.
- The Agent question list, answers, results and Wrapped statements, and Results analysis, leave out the session's hidden questions too, and an Agent list is complete even if a hidden question's stored object is lost. A published analysis keeps one hidden after it was generated, until it is generated again.
- Group transcription forwards up to four known-speaker samples (a name and a short WAV) to OpenAI, so voices keep their labels across chunks. Invalid samples are dropped without failing the chunk.
- Claude requests work on current models. The Worker sends no `temperature`, which Opus 5.5 and Fable 5.1 refuse and Sonnet and Haiku 5.5 refuse at 0.7, so older Claude models also sample at their default. It reads the answer from the reply's text blocks after any thinking, and a request without a model uses `claude-opus-5-5` instead of a model retired in 2025.
- Only admins add context items. For a link, the Worker fetches the page itself: https on a public host only, every redirect re-checked, up to 2 MB and 10 seconds. A PDF can be read by the session's own Claude or OpenAI key. Admins-only items never reach participants through reads, lists or the AI.
- The interview opening and results analysis use the context every participant may read.
- set-config checks a `sessionContext` it is sent.
- Saving part of a session's AI settings keeps the rest: set-config merges `ai` one level deep. The public config now shows reasoning effort and says that the Worker merges `ai`, so the settings page edits AI only on Workers that do.
- set-config accepts the highlighted and hidden question and survey lists, up to 500 IDs each. Changing them signs no one out.
- `fetch_url` and `fetch_image` need https on a public host and give up after 10 seconds; `fetch_url` also reads plain text and Markdown.
- Agent-proposed questions are no longer tagged "object".
- GPT-6.1 models use the Responses API, and every model is sent a reasoning effort it accepts.
- Requests to Claude 5.x, Opus 4.5 or later and Sonnet 4.6 or later carry the session's effort and any JSON schema. A refusal or an empty answer returns HTTP 422 instead of an empty reply.
- Interview mapping can run at medium effort on a low-effort session, and the interview opening allows 2,000 tokens, so models that think have room to answer.
- Results analysis accepts JSON wrapped in a code fence. Agent results record the model that actually ran.
- Wrapped posters use gpt-image-2.5-flare.
- Storage export manifests drop `rewrapRequiredForNewDeployment`, the deprecated copy of `deploymentKekContinuityRequired`, and Lit requests no longer read the retired `gateChainId` field; send `chainId`.
- After an upgrade from 0.8.0, a restore that 0.8.0 had already published is finished, instead of being offered for abandonment or deleted when it expires.
- A retried answer upload keeps its own storage ID, so a stalled first attempt that finishes late can't make the saved answer unreadable; the late attempt removes its own copy.
- An agent's overlapping next-question requests are handled one at a time, so none repeats a question or loses history, and a repeated `requestId` returns the same question. A restore target that holds agent question state is no longer treated as empty.
- Session context accepts Wikipedia, Notion and block-explorer links. The secret check also refuses Telegram bot tokens, RPC links carrying an Alchemy or Infura key, and Stripe and Hugging Face keys.
- A payload's own groups narrow a group-gated session's audience instead of adding to it, so a session member outside them can't read or list the payload.
- Session Wrapped loads catalogs of more than 200 questions instead of returning 503. It still reads at most 1,000 stored question rows, and re-uploaded or hidden questions count toward that.
- Context links drop hidden script, style and navigation text however the closing tag is written.
- A context link or PDF reading started by an admin who has since been replaced is refused instead of published.
- One request at a time reads a context PDF; another gets 409 "already being read", and readings and removals no longer undo each other.
- Faucet payouts take turns with their signing wallet, in hosted and registry sessions, for agents and for sponsored grants, so concurrent requests no longer fail on the same nonce, even when sessions share a key. A running payout keeps its turn; a request that waits 30 seconds gets 503 and leaves a sponsored grant unspent.
- Results analysis drops ratings off the question's step grid, agent-created rating questions keep their end labels, and the interview catalog and brief include each rating's step.
- Results analysis respects each answer's own access rule. The automatic queue lost the rule, so an answer limited to admins could reach the AI and the published analysis. Sessions that ran automatic analysis with such answers should regenerate it.
- Results analysis picks the current version of each question and answer before checking who may read it, so a newer restricted version no longer brings back the older public one.
- Automatic Results analysis uses the stored answer rather than its shortened copy in the queue, once the stored one is listed.
- A bootstrap upload applies the signed-origin check login uses, so an admin's signature made for another site is refused before its nonce is spent. It now needs a browser `Origin` header from a trusted origin.
- An access rule gives the same answer in any order. A member or admin who qualifies through one condition is let in while another condition's group check is down, instead of getting a 503, and a failed condition in an all-of rule refuses with 403.
- A first upload that fails partway no longer leaves its ID free for another author to claim; its author can retry it.
- Agent answer drafts are kept under the question's full ID, so a question with a crafted ID can't share another question's draft.
- When storage can't read an agent's earlier draft, saving the draft fails with the retryable `answer_draft_read_failed`, instead of resetting its edit count and origin.
- An agent re-posting a question can't change its options or scale under earlier answers, or bring back an archived one: the re-post is refused with `question_schema_conflict` or `question_archived`. An identical re-post leaves the stored question as it is.
- An agent's batch of new questions reports every question it stored. Before, it could report stored questions as skipped.
- Hiding a question from the Storage panel also has the saved interview opening written again, and an interview no longer shares an opening still being written for a different set of hidden questions.
- The Worker's AI features and the context list find context files among hundreds of other library files. Before, about 300 other files could leave the AI without context, with no sign of it; a failed context scan is now logged.
- A session's context can be an uploaded HTML page of up to 20,000 characters, in place of its paragraphs and links. Set-config refuses the two together and checks the page, as written and as its words, for anything that looks like a key. The session's AI reads the page as plain text, in no more room than typed paragraphs get, so attached files still fit.

### Benchmark

- Keep the standalone Raw Results heading readable and correctly wrapped at narrow widths, scope Risk Matrix heading colors to their own dialog, and give export buttons readable colors and descriptive accessible names.
- `answer --resume` asks again when the endpoint, model settings, declared model revision, routing or answer schema change. Answers saved by earlier versions are asked again once. Answer files record each model's revision, and a run that reaches two deployments of one model stops with an error.
- Typed answers and importance replies ignore drafts inside reasoning tags and refuse truncated reasoning.
- An importance reply holding two different allocations, or one cut off mid-object, is retried instead of scored by its first allocation.
- Flipped rating prompts are used only when flipped answers stay on the scale's grid.
- Mock ratings land on the scale's step grid.
- `compare-answers` skips a question that the answer file and the export define differently, and says what differs.
- `compare-answers` reports everyone apart from groups, so a group named `everyone` stays separate.

### Agents and MCP

- Several Agent HTTP names no longer say Telegram. In question sources and reasons, `telegram_only_*` is now `hosted_*`, `telegram_worker_question_index` is now `worker_question_index`, and a question with no id gets a `hosted-` one. In submit results, `telegram_submit_queue_*` is now `agent_submit_queue_*`. In group data, a `membershipSource` of `telegram_user` is now `agent_principal`. An agent that matches the old strings must switch to the new ones.
- Agent admin status no longer reports `canManageResponseExportAllowlist`, because sessions have no export allowlist.
- Agent fidelity takes the latest record by the time the Worker stored it, never by the participant's own clock, so a later withdrawal or edit counts.
- Agent fidelity and MCP `get_results` reject ratings off the step grid and allocations over the voice-credit budget.
- Agent fidelity keeps equally typical people in one group, so reordering records can't change the most-unusual and most-typical results. When everyone is equally typical, it reports no groups. Confident misses with equal confidence list in question order.
- Agent fidelity's AI score beside the most common answer, overall and in each typicality third, counts only the predictions that answer can be checked against, so the two differ by exactly the lift.
- Agents read an uploaded HTML context as its words, in `paragraphs`, never as markup; a page with no words gives no paragraph.

### Local tooling

- `npm run test:worker:agent` is the agent test command; `test:worker:agent-bridge` is gone. Public history replay keeps the audited cutover for old commits and accepts only a complete retirement of the Bridge subtree.
- Corrected documentation across the README, guides, spec, private runbooks and companion docs, and deleted finished audit notes. Three scripts now use kebab-case names.
- `deploy:evm` passes the RPC URL to `forge script`, which ignored `ETH_RPC_URL` and only simulated.
- `deploy:evm` stops with an error instead of printing wrong addresses when another transaction from the deployer moves its nonce.
- The public package no longer lists `ai:playwright-server`, whose script the public tree leaves out.
- Corpus freshness with `--as-of` ignores entries dated after that day.
- Rendering a film frame range that skips frame 0 still writes the video still.

## [0.8.1] - not released; included in 0.9.0

### Verification and shared rules

- Pin the recovery-key export test's clock to midday UTC so it no longer fails near midnight.

- Give the AI prediction results tests 8 seconds to show their scores; hosted CI under coverage needed more than 1.

- Separate the voice-mode modal shell and interview panel to keep client components within the release size limits.

- Include catalog completeness in the interview compatibility fixture.

- Complete mocked Lit provisioning checkpoints before testing atomic configuration writes.

- Give upload-diagnostics fixtures the durable storage targets required by receipts.

- Isolate SBT name tests by clearing their complete cache namespace.

- Use hexadecimal commitments in answer-size regression fixtures.

- Mark the Lit provisioning mock credential as an explicit fixture for release scans.

- Isolate community regression tests by clearing complete cache namespaces.

- Use complete encrypted-envelope fixtures in decrypt-and-resubmit regression tests.

- Verify interview submission leaves unrelated manual answers pending for ordinary Submit.

- Verify mixed-file generation retains rejected-file notices while sending only supported extracted text to the model.

- Provide the mocked wallet-action boundary in shared Jest setup for session-page imports as well as account components.

- Keep the wallet URI encoder override effective after npm hoisting and validate the installed query-dependency tree.

- Mock wallet disconnection in community and sponsorship lifecycle tests when importing the shared logout boundary.

- Install the Session Worker package in the hosted contracts job before its registry smoke imports Worker code.

- Refresh the client coverage inventory count without changing measured coverage or enforced floors.

- Cover the pinned Worker session route with read-only navigation fixtures and
  loaded-session assertions while keeping unmatched network requests blocked.

- Seed encrypted provisioned secrets in admin integration fixtures.

- Align integration assertions with explicit General comparison links and scanned
  SBT mint totals.

- Keep the analysis session-switch regression mock compatible with typed Jest.

- Preserve the Session Worker's isolated dependencies in public replay checks.

- Include shared answer validation in Worker release source comparisons.

- Check signed payment hashes in proof-authorized faucet integration tests.

- Verify authenticated faucet replies against the signed payment hash and amount.

- Preserve the original benchmark rating prompts for integer-origin, step-1
  scales; describe increments only for other rating grids.

- Reject eager client runtime import cycles in the wiring gate, with a zero
  baseline and exclusions for type-only imports and deferred loads.

- Use one rating bounds and step rule across browser sliders, agent drafts and
  submissions, Wrapped, MCP and benchmark answers; suggested buttons are display hints.

### Arweave

- Use one forced-refresh option across payload caches and in-flight requests.
  Evict malformed JSON replies so ordinary reads can retry immediately.

### Agents and MCP

- Keep up to 50 research runs per agent identity, up from 20, and state the limit in the agent instructions.

- Mark research summaries incomplete when they hold records an earlier Worker wrote without a participant or run, instead of showing an invented participant.

- Prepare MCP 0.2.0 with shared rating validation: fractional grids are supported, and new answers must follow the stored step (default 1). Existing answers remain unchanged. The minor version marks the changed accepted-input behavior; application and MCP versions remain independent.

- Summarize research runs from bounded per-principal journal coverage, storing each frozen question list once. Summary exports read attempt metadata and one answer state per principal instead of every answer event.

- Reuse registry creation-block lookup across MCP configuration refreshes.

- Bound MCP registry reads and cached/local answers to the configured session window, using historical pointers at its end.

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

### Local tooling

- Add an in-process participation rehearsal for concurrent invite, Wrapped prediction and signed-in browser response flows, with optional KV write throttling.

### Client — available when the site deploys

- Open the group recorder from `?mode=groupRecording` links; `?mode=recordGroup` no longer opens it.

- Keep a Group Conversation recording running when someone taps outside the dialog or presses Escape, and offer "Close and keep the audio" only after Stop.

- Retry a recording upload that stops responding instead of letting it hold up later chunks, and add Retry to uploading chunks.

- Let Clear work without device storage and with failed chunks, asking before it deletes audio. A recording stays with the account that made it: another account or a signed-out visitor starts fresh, and audio held only on this page stays until it is saved or downloaded.

- Require real speech, not just gap markers, before generating questions from a recording.

- Keep speaker labels on when one chunk's audio is rejected as too large or unreadable; any other refusal, such as an older Worker's, turns them off for the rest of the recording with a notice.

- Stagger chunk retries so rooms sharing a key don't retry together, and apply a slow speaker-label check that answers before Record is pressed.

- Save hidden-page notices with the recording so they survive a reload and reopening the recorder.

- Keep the voice dialog and its recording when someone signs in with a wallet on a different chain from a chain session's.

- Stop the unsaved-answers notice from returning after an interview submission and Clear.

- Report a skipped file once, on the next Generate, instead of on every later run or after the sources change.

- Leave hidden draft facts out of voice interviews wherever they appear, including the summary, while keeping shown facts that contain the same words intact.

- End the wallet connection when logout can't reach the wallet, so the next sign-in starts with a fresh connection.

- Shorten the passkey sign-out error to one sentence, with details behind a "?" button.

- Keep Group Conversation audio held only in memory when stored recordings can't be read on reopening, when the recorder is left without Close and keep the audio, and when Close and keep runs before saved audio has loaded.

- Show when the microphone or recorder stops ahead of the storage, offline and question-generation notices; the storage notice no longer says that recording continues. A chunk-rotation error clears once the next chunk starts.

- Keep Group Conversation audio held only in memory when its dialog is closed and reopened more than once, and retry saving it to the device on each reopening.

- Reject malformed WalletConnect query escapes with native URI decoding, removing the vulnerable decoder dependency while keeping the existing wallet stack.

- Remove the unused SBT canvas image-load callback; previews continue to use fetched image files.

- Preserve the pinned Worker session through the full question view, filters, and response editor so alias routes such as `/session/demo/questions` load without an EVM network.

- Remove the unused standalone `/debate`, `/beta`, `/contributors`, `/matrix`, and `/demos` pages and obsolete navigation. Preserve Atlas, simulated profiles, demo sessions, and the shared risk matrix.

- Preserve an in-flight SBT image when pasting supplies no usable replacement; only an applied image supersedes it.

- Keep bare question URLs unpinned until their session is explicit or found in cache, so General fallback cannot become permanent.

- Recheck invalid Arweave metadata after the terminal cooldown so a temporary gateway error cannot hide SBT metadata permanently.

- Omit imported facts tied only to hidden drafts from voice interview context, including copied context text.

- Give hidden-draft help an accessible description and keep its tooltip open while hovered.

- Keep rejected file names visible when question generation starts, while clearing stale extraction failures.

- Show passkey disconnect failures in the login modal after local sign-out clears the account, instead of leaving an unhandled button promise.

- Accept configured Claude model IDs for photo requests through Anthropic and OpenRouter without restricting the family name or version.

- Track all pending agent answers so navigating between concurrent submissions keeps each pending answer disabled until its own request finishes.

- Show the pending-page-answer notice beside Submit only after an interview submission leaves answers unsaved. Clear it after ordinary submission.

- Keep previous publication IDs and cache-hydration status out of saved authoring drafts.

- Preserve internal option spacing through the live Results controller so Breakdown counts match stored selections.

- Keep a closed profile analysis dialog closed when refreshed inputs invalidate its result.

- Disconnect wagmi and persist logout intent in shared teardown, including agent logout, so stale wallet props cannot sign the participant back in.

- Document phone recording limits, a dedicated powered recorder, and the revised 45-minute recovery rehearsal.

- Enable Group Conversation recording with plain transcription when the speaker-label provider check takes more than two seconds.

- Leave no empty recording chunk when microphone capture fails to start or rotate; retain the active chunk on rotation failure.

- Keep timestamped hidden-page recording notices after returning and stopping, until dismissed.

- Name recording uploads and audio downloads by their MIME container, including WebM, MP4, M4A, Ogg and WAV.

- Fall back to plain transcription on provider speaker-label rejections, including errors nested in the Worker response, while keeping temporary errors in the retry queue.

- Keep breakout capture and its transcript together across sign-in or delayed account restoration by pinning the recording scope until it is cleared.

- Retry temporary recording failures for as long as the page is open, keep failed audio with transcript gap markers, continue later chunks after permanent errors, and offer closing with pending audio kept for reopening.

- Keep recording and transcription running from memory when device storage fails or is unavailable. Save cumulative audio snapshots at most every ten seconds and retain audio until its transcript is saved.

- Enable speaker labels by default for OpenAI Group Conversation recordings, with the existing plain-transcription fallback.

- Keep recording chunks in IndexedDB until their transcripts are saved, retry uploads in order, and offer per-chunk retry/download controls with storage, offline and microphone guidance.

- Show concealed AI guesses as grey answer areas with readable help text in both themes until the participant answers.

- Preserve multiple-choice selections in generated results so options containing semicolons count correctly.

- Require at least one question type before generation and explain responses with no usable questions.

- Reuse cached and in-flight Arweave payloads when loading SBT metadata.

- Release agent login loading after account changes and allow independent answer submissions to finish.

- Keep profile analysis open across data refreshes while discarding stale results.

- Accept Claude 5 model names for photo analysis through Anthropic and OpenRouter.

- Clear stale source and rejected-file warnings when starting a new question generation.

- Keep tags entered during generation and exclude generation progress from saved drafts.

- Clear unchanged authoring drafts after publication even when their debounced save lagged behind the form.

- Recheck encrypted wallet storage before saving a newly created passkey wallet.

- Show the remaining unsubmitted page-answer count with Submit after an interview.

- Keep response scan watermarks unchanged when live events arrive, so refreshes retry earlier unreadable payloads.

- Fall back to plain transcription when speaker labels are unavailable, retain text-only replies, and hide the labels toggle for other providers.

- Preserve registry routing in join links and recover from invalid admin Worker fields when resolving interview compatibility.

- Preserve internal whitespace in Breakdown choice labels so valid selections and participant totals match the Report.

- Disconnect MetaMask before logout clears account props, preserve explicit disconnect intent, and surface passkey disconnect failures.

- Keep General-session question bookmarks, result links, and copied URLs pinned to General even when another session is selected.

- Preserve the latest SBT image choice and saved bytes when an earlier image request finishes late.

- Count Community groups by chain and contract address, while counting the same contract across session caches only once.

- Open the saved-filter loader in inline Results even when no filters are active or after clearing them; tokens and full URLs restore Group and Top question selections.

- Finish and save Group Conversation transcription before Close, Escape, or outside dismissal; keep failed audio available in the open dialog for retry.

- Count every quadratic step in double and triple clicks after pile auto-advance,
  while still ignoring leftover clicks from the previous question.

- Use session-sponsored AI and viewer authentication for Polis group analysis,
  and show failed requests with a working retry instead of caching a local summary.

- Preserve edited questions and saved drafts on failed regeneration, asking before a usable replacement overwrites edits.

- Count distinct demo personas separately from their modeled responses, omitting unknown persona counts.

- Accept photo sources with the built-in Claude presets using explicit preset image capabilities.

- Open Breakdown distributions directly and select questions even when no demographic segments exist.

- Include public response explanations in comparison AI input and expanded details.

- Keep pending AI tag suggestions attached to the question that requested them, releasing busy state after edits or removal.

- Cap question text once in Results analysis input and keep every included response linked to an included question.

- Keep profile analysis, cached results and pending updates bound to their original person, session and inputs.

- Clear all agent and Worker credentials on either logout, cancelling pending logins and requests before resetting mounted views.

- Generate questions only from extracted source text; name skipped files and stop offering PDF or PowerPoint generation input.

- Limit HTML report files and snapshot downloads to the selected sections; hide the JSON download when unchecked.

- Release participant Group creation after an account change while preserving its draft and ignoring old completions.

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

- Keep cluster AI explanations on the selected session Worker with the current viewer authentication context.

- Prioritize newer unanswered questions in the voice interview and personal AI-prefill prompt using the browser’s own answer state, preserving public catalog versions and fingerprints.

- Add optional Group Conversation speaker labels, stored per recording chunk in the local transcript draft. Speaker review and claiming remain unavailable.

- Keep Group Conversation and Interview screens awake where supported, and offer a remembered speaker-audio option for recording remote participants heard through the device speakers.

- Add a compact Join panel with a voice-interview QR code, a copyable session link and the existing review-only AI prompt on session, admin and publish-result pages.

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

- Update `follow-redirects` to 1.16.2, which fixes a case where custom credential
  headers could follow a redirect.

### Workers — requires redeployment

- Clear saved Lit setup only when Lit confirms it is gone (the saved key is refused, or a complete list lacks the saved group or wallet), including after an operator replaces a revoked key, so setup can start over; network, rate-limit and billing errors keep saved progress.

- Isolate Wrapped and submit permission revocation tests from invite removal.

- Mark interview discovery incomplete for temporary Cloudflare payload-read failures, and stop retrying permanently missing or malformed on-chain payloads.

- Preserve Lit accounts and setup resources across failed attempts. Authority-choice switches with a saved group, PKP or action name those resources and offer Resume; supplied keys are checked before reserving an attempt.

- Keep web and agent sessions signed in across effective content-only settings edits, including wizard verification, while revoking authorization for authority changes.

- Return speaker-labelled transcription segments for Group Conversation recordings.

- Recover lost restore handoff replies using a scoped, expiring completion receipt for the importing signer.

- Mark interview discovery incomplete when question pointers or payloads cannot be read, while retaining readable eligible questions and retryable empty results.

- Calculate research completion from each run’s own answer events and initial statement set.

- Allow failed Lit setup to restart with a fresh authority choice, reject conflicting credentials clearly, and preserve checkpoint writes across content revisions.

- Preserve rating scales and fractional steps through public agent questions and results scoring.

- Route automatic custom-provider results analysis through the same checked HTTPS fetch path as manual analysis, including redirect checks.

- Store and revoke General-session login tokens under one namespace, preserving explicit session isolation.

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

### Benchmark reports

- Compare importance shuffle and mock-allocation hashes in code-point order; model fingerprint ordering retains its explicit English locale.

- Omit full-bank importance from question-limited previews with an explicit integrity warning instead of silently dropping allocation runs.

- Require one schedule seed per release report and warn when previews combine different seeds.

- Allow completed benchmark runs at different repeat depths to share a report while preserving their seeds and strict resume checks.

- Keep importance prompt fingerprints stable across host locales.

- Bind preview importance allocations to the full question wording and order before display limits.

- Refuse preview reports with missing or mismatched question prompt hashes before answers can be exported against changed wording.

- Bind longitudinal snapshots to the persona instructions and prompt template actually used, rejecting changed or missing context.

- Parse benchmark answers after removing inline reasoning, and retry conflicting or truncated final answers.

- Publish rendered previews with the same validated analysis overlay, retaining HTML equality and integrity checks.

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

## [0.8.0] - 2026-10-28

### Agents and MCP

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

- File questions without valid answers under "no data" in the report's tag
  filter instead of "mixed / unsure".


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
