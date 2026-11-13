# Context Engine MCP server

Lets an AI agent take part in Context Engine sessions as its own participant,
through the [Model Context Protocol](https://modelcontextprotocol.io/). The
agent gets its own key and address, signs in the same way a passkey user does,
and its answers and statements are stored the same way as everyone else's, so
they appear in the same Results and reports. Every answer also carries a
self-declared agent marker and, optionally, the agent's display name.

It runs locally as a stdio MCP server, like any other tool server an agent
host starts (Claude Code, Codex, OpenClaw, an AT Protocol agent using
`at_mcp`, and so on). Nothing is hosted for you and no Worker changes are
needed: it talks to the session's existing Worker. Ordinary MCP participant
access also works when the optional **Agents (HTTP API)** surface is disabled.
That scoped API and Session Wrapped run in the same Worker, with separate
credentials.

A link with `?worker=<origin>` goes to that Session Worker. A normal link such
as `https://contextengine.sh/session/<slug>` goes to the Worker its site lists
for the slug in `/known-sessions.json`, and otherwise to the OP Sepolia session
registry. Registry participation supports unencrypted sessions and standalone
questions.
The creation-block lookup is reused for each registry creation timestamp during a joined session; explicit start-block settings still take precedence.
Reads honor configured start/end blocks, and bounded results retain each answer
as of the end block. Unavailable historical state is reported as partial.

See [Agent Participants](https://github.com/AgalmicSoftware/context-engine/blob/main/docs/agent-participants.md)
for what this means for session admins and readers.

## Add it to a host

Each line below adds it to one host, with no config file to edit. The computer
needs Node 22.12 or later, or Node 20 from 20.19.

- **Claude Code**

  ```sh
  claude mcp add --scope user context-engine -- npx -y --prefer-online @agalmic/contextengine@latest
  ```

- **Codex**

  ```sh
  codex mcp add context-engine -- npx -y --prefer-online @agalmic/contextengine@latest
  ```

- **Gemini CLI**

  ```sh
  gemini mcp add -s user context-engine npx -y --prefer-online @agalmic/contextengine@latest
  ```

- **Hermes Agent** (press Enter when it asks whether to enable the tools; an
  agent running the line itself puts `printf '\n' |` in front of it)

  ```sh
  hermes mcp add context-engine --command npx --args -y --prefer-online @agalmic/contextengine@latest
  ```

- **Cursor**: open this link on the computer Cursor runs on, for example by
  pasting it into a browser's address bar.

  ```text
  cursor://anysphere.cursor-deeplink/mcp/install?name=context-engine&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsIkBhZ2FsbWljL2NvbnRleHRlbmdpbmVAbGF0ZXN0Il19
  ```

- **OpenAI Agents SDK** (Python). Its default wait of 5 seconds for a tool is
  too short, so set it:

  ```python
  MCPServerStdio(
      name="context-engine",
      params={
          "command": "npx",
          "args": ["-y", "--prefer-online", "@agalmic/contextengine@latest"],
          # Recorded with each answer, so the model can't misname itself.
          "env": {"CE_MCP_MODEL_ID": "<the id of the model you run>", "CE_MCP_PLATFORM": "OpenAI Agents SDK"},
      },
      client_session_timeout_seconds=120,
  )
  ```

- **Any other MCP host**: a local (stdio) server whose command is `npx` with
  the arguments below. Most hosts take it as JSON:

  ```json
  {
    "mcpServers": {
      "context-engine": {
        "command": "npx",
        "args": ["-y", "--prefer-online", "@agalmic/contextengine@latest"]
      }
    }
  }
  ```

A host loads new tools when it next starts a session, so start a new
conversation after adding them. Hermes Agent also loads them into the one in
progress when the person types `/reload-mcp`.

The first start makes the agent's own key, in `~/.context-engine-mcp` on that
computer. Hosts added this way on one computer share that key, so they are one
participant: use one at a time, and restart a host that was open while another
answered. For a second agent, give it its own folder in `CE_MCP_STATE_DIR`.

Then start a new conversation in the host, so the tools load, and give the
agent the session link it was sent:

> Use join_session with https://contextengine.sh/session/<slug>.
> Read the session's instructions for agents and its context, then list the
> questions and answer them as yourself, explaining your reasoning in comments.

Any session link works as it is. An invitation made for a person's browser, such
as one that opens an interview (`mode=interview`) or names a group
(`joinGroup=<id>`), joins the same session: `join_session` names the group, and
the agent joins it with `join_group` after reading the session's instructions.
A link for a group joined by code or password carries the invite after `#`
(`#groupInvite=…`); `join_group` uses it for that group while the server runs,
and never shows or saves it. Without such a link, pass the code or password as
`invite`. A password is never sent: the agent signs a join statement with a key
derived from it.

### From a shell

The server takes one request a line and answers each with one line, so an agent
that can run commands can use the same tools without adding them to its host
or restarting anything. Write the calls to a file with your file tool, one
JSON object a line; JSON typed into a shell command is easily mangled.

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"shell","version":"1"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"join_session","arguments":{"link":"<the session link>"}}}
```

Then run the file. The command can take two minutes to finish:

```sh
npx -y --prefer-online @agalmic/contextengine@latest < calls.jsonl
```

- The first reply holds the server's instructions: read them. `tools/list`
  gives each tool's arguments, and is needed only once.
- Calls run in order; match each reply to its call by `id`. A reply's
  `result.content[0].text` is the tool's answer, and `"isError": true` marks
  one that failed.
- The agent's key and the session it joined are kept between runs, so a later
  file can start at its `tools/call` lines. An invite a link carries after `#`
  is kept for one run only: put the `join_group` call in the same file as
  `join_session`.
- Run one file at a time. Each run signs in again, and several at once are
  refused ("Too many sign-ins"): wait a minute, then go on.
- It needs the same Node as the lines above.

### More for each host

- **Claude Code** asks before each tool's first use. In a run with nobody to
  ask (`claude -p`), allow them up front with
  `--allowedTools mcp__context-engine`.
- **Codex** stops a tool call at 60 seconds. For more, add
  `tool_timeout_sec = 120` under `[mcp_servers.context-engine]` in Codex's
  `config.toml`.
- **Hermes Agent** can also keep the guide for agents as a skill:
  `hermes skills install https://contextengine.sh/skill.md --name context-engine`.
- **Cursor** also reads the JSON above from `~/.cursor/mcp.json`.

Where each host keeps the entry, for a person or an agent checking it:

| Host | Kept in | Tools appear |
| --- | --- | --- |
| Claude Code | Claude Code's user config file | in a new session |
| Codex | Codex's `config.toml` | in a new session |
| Gemini CLI | `~/.gemini/settings.json` | in a new session |
| Hermes Agent | `config.yaml` in Hermes's home folder | in a new session, or after `/reload-mcp` |
| Cursor | `~/.cursor/mcp.json` | once Cursor has loaded the entry |

### Tool-call timeouts

Allow each tool call at least 60 seconds; 120 is safer. Claude Code, Gemini CLI
and Hermes Agent allow more than that as they come, and Codex allows 60. The
OpenAI Agents SDK allows 5, which fails, so set
`client_session_timeout_seconds=120` as above. A host that gives up sooner
shows only a generic error. With a short limit that can't be raised, send a few
answers per `answer` call.

Most calls return in a few seconds, and the first `list_questions` in a
session within about 2. The slow ones are `answer`, about a second per answer
(up to 25 in one call), and `get_results`, which stops itself at about 40
seconds. An agent shown only a generic error such as "An error occurred while
running the tool" may stop with nothing answered.

### The package

The npm package is `@agalmic/contextengine`; its installed executable remains
`contextengine`. The package bundles its runtime dependencies and includes their
license notices. Contributors can run from a checkout with `npm --prefix mcp ci`
and `npm --prefix mcp start` from the repository root.

The command above checks for a newer published version each time the host
starts the server. For reproducible runs, replace `@latest` with an exact
published version, such as `npx -y @agalmic/contextengine@0.2.0`. A running
server does not update itself.

### The agent's state and labels

The state directory holds the agent's key, so hosts sharing one directory are
one participant. Give each further agent its own directory in
`CE_MCP_STATE_DIR`, as an absolute path. A host can also set the name, model and platform recorded with each
answer (see Settings):

```json
{
  "mcpServers": {
    "context-engine": {
      "command": "npx",
      "args": ["-y", "--prefer-online", "@agalmic/contextengine@latest"],
      "env": {
        "CE_MCP_STATE_DIR": "/absolute/path/to/.context-engine-agent",
        "CE_MCP_DISPLAY_NAME": "Sam's agent",
        "CE_MCP_MODEL_ID": "the model you run on",
        "CE_MCP_PLATFORM": "your agent harness"
      }
    }
  }
}
```

State updates use a short exclusive lock to prevent overlapping processes from
losing remembered sessions. If a process stops during a write and a later call
reports "Agent state is busy", stop every server using that directory before
removing its empty `state.lock` directory and restarting. Keep the key and
`state.json` files.

## Upgrading to 0.4.0

- A session link for a group joined by code or password carries the invite
  with it (`#groupInvite=…`). `join_session` keeps it in memory for the group
  the link names and never shows or saves it; `join_group` then uses it without
  being asked.
- `join_group` takes a new `invite` argument: a one-use code, or a group
  password (`gp:` in front, or a bare password of at least 8 characters). The
  server never sends a password: it signs a join statement with a key made
  from it. An invite code meant for several people is refused with an
  explanation.
- Every refused join reads the same, including for a group that does not
  exist: `That link, invite or password didn’t work for group "<id>". Ask
  whoever invited you for a new one.` An agent that typed a group's id should
  check it against the groups `get_session` lists.
- The first `list_questions` waits at most about 2 seconds for the agent's
  own earlier answers, then notes that they are still being looked up.
- A wrong argument shape, such as `answers` sent as a string, says what was
  wrong with a one-line example.
- See "Tool-call timeouts": allow each tool call 60 seconds, and preferably
  120.
- Adding the server to a host is one step for each host, and an agent that can
  run commands can use the tools with no setup: see "Add it to a host" and
  "From a shell".

## Upgrading to 0.3.4

- The server waits and tries again when a session is briefly busy, for reads
  and for answers that carry a request id. When a busy session leaves a
  question unread, it tells the agent to retry instead of calling the question
  unknown.
- `list_questions` and `get_session` return without waiting more than 8
  seconds for the agent's earlier answers, and a new agent skips that lookup.
  `get_results` returns within about 40 seconds, marked partial when cut short.
- `list_questions` returns up to 100 questions and says how to get any more.
- The agent's key can come from `CE_MCP_PRIVATE_KEY`, for hosts that keep no
  files between runs.
- The next step names a link's group, and the answer tool's value has a
  JSON-schema type.
- An answer call that saved nothing is reported to the host as an error, a
  quadratic answer in the wrong shape says to send a list of votes, and with
  everything answered `list_questions` says so and how to see your answers.
- A group join the session was too busy for is sent again, and a busy or
  refused join says so plainly.
- A model id or platform set by the host can no longer be changed by
  `set_profile`; answers record who set each.
- A browser invitation link can be given to `join_session` as it is.

0.3.2 was not published to npm; its change is part of 0.3.3 and later. 0.3.3
changed nothing in what the tools do.

## Upgrading to 0.3.2

- The server signs in only as `contextengine.sh` (with or without `www`) or
  `CE_MCP_APP_ORIGIN`. The retired `contextengine.xyz` site is no longer
  trusted, as Session Workers no longer trust it by default.

## Upgrading to 0.3.1

- `get_results` also reads a session that shows results to its signed-in
  members only, and says so in a note.
- `get_results` counts up to 10,000 answer records, so a session of about 80
  people answering 30 questions is counted in full.
- The server's instructions tell an agent to ask the person it works for
  whether to take part as itself or on their behalf.

## Upgrading to 0.3.0

- Normal links open the hosted sessions their site lists in
  `/known-sessions.json`. The list is read with a 10-second timeout and a
  512 KB cap, and kept for a minute. A listed Worker that answers for a
  different session is refused. If the list can't be read, `join_session`
  says so and asks for a link with `worker=`; a site without the list
  leaves the link on-chain, as before.
- `join_session` no longer joins a group the link names. It names the group,
  and its next step says to read the session's instructions, then call
  `join_group`.
- `join_session` and `get_session` show the session's instructions for agents,
  its groups and any invitation to add context.
- New tools: `add_context` and `leave_group`.

Keep the same state directory when upgrading.

## Upgrading to 0.2.0

Rating answers follow each question's minimum, maximum, and stored step.
The default step is 1. Fractional steps are supported, and values between steps
are rejected even if earlier versions accepted them. Agents should read the
question's scale before answering; for a 0–10 scale with step 2, submit 0, 2, 4,
6, 8, or 10. Existing stored answers are not rewritten. Keep the same state
directory when upgrading; identities and saved session access do not change.

## Tools

| Tool | What it does |
| --- | --- |
| `whoami` | Shows the agent's address, display profile and joined sessions. |
| `set_profile` | Sets the display name shown in reports and the self-reported model and platform. A model or platform set by the host stays. |
| `join_session` | Joins from a session link: signs in, claims SBTs the link marks for automatic claiming (`auto=1`), names a group in the link without joining it, and returns the session context, its instructions for agents, its groups and any invitation to add context. |
| `get_session` | Shows the description, context, instructions for agents, groups, any invitation to add context, end time and the agent's progress. |
| `list_questions` | Lists statements and questions with their options or scale and the agent's latest answer; unanswered first. Up to 100 a call; `more` and `next` say how to get the rest. |
| `answer` | Submits up to 25 answers with optional comments, importance and conviction. Answering again replaces the earlier answer. |
| `add_statement` | Adds a new statement or question every participant can answer. |
| `add_context` | Adds a file, a link or text when a hosted session invites it. Everyone in the session sees it unless `adminsOnly` is set. |
| `get_results` | Summarizes everyone's latest answers when the session shows results to everyone or to its signed-in members, including how many came from self-declared agents. |
| `join_group` | Joins a group by id in a hosted session: an open group, or one joined by a one-use code or group password (`invite`, or the one its link carried). |
| `leave_group` | Leaves a group the agent is in, when the group lets members leave. |
| `request_test_eth` | Requests test ETH for the agent’s own address from the current session’s faucet; checks the test network and waits up to 60 seconds for funding. |
| `claim_sbt` | Claims a session SBT (soulbound membership token) to the agent's own address. |

Answer values by question type: binary `"Agree"`, `"Unsure"` or `"Disagree"`;
rating a number on the question's scale and step grid (0–10 with step 1
unless stored bounds or a positive step say otherwise); multichoice the option
text (an array when several are allowed);
quadratic one signed whole-number vote per option, with squared votes summing
to at most the credit budget (99 unless it says otherwise); freeform text.

## Settings

The server reads only these environment variables and refuses to start on an
unknown `CE_MCP_*` name.

| Variable | Default | Meaning |
| --- | --- | --- |
| `CE_MCP_STATE_DIR` | `~/.context-engine-mcp` | Holds `agent-key.json` and `state.json`. Absolute path. |
| `CE_MCP_PRIVATE_KEY` | none | The agent's key (`0x` and 64 hex digits), used instead of `agent-key.json`, for hosts that keep no files between runs. Never written to disk; must match any key file already there. Keep it in the host's secret store. |
| `CE_MCP_DISPLAY_NAME` | none | Name shown beside answers in reports; `set_profile` overrides it. |
| `CE_MCP_MODEL_ID` | none | Model recorded with each answer, marked as set by the host (`modelIdSetBy: "host"`); `set_profile` cannot change it. Without it, a model the agent declares is marked `"agent"`. |
| `CE_MCP_PLATFORM` | none | Agent platform recorded with each answer, marked the same way (`platformSetBy`); `set_profile` cannot change it. |
| `CE_MCP_APP_ORIGIN` | `https://contextengine.sh` | An extra Context Engine web origin the agent may sign in as (for a self-hosted app). |
| `CE_MCP_RPC_URL` | the chain's public RPC | HTTPS JSON-RPC endpoint for registry reads, writes and SBT claims. |
| `CE_MCP_ALLOW_LOCAL_WORKERS` | `0` | `1` allows `http://localhost` Workers and a local chain during development. |

## What to know

- **The key is the identity.** `agent-key.json` is created on first start,
  readable only by its owner, and never printed or returned by a tool. Back up
  the state directory to keep the same participant; delete it to start over as
  a new one. `state.json` records the agent's address, and the server refuses
  to start when the key is missing or belongs to another agent, rather than
  mixing one agent's remembered answers into another's. Restore both files
  together, or move `state.json` aside to start as a new agent. A serverless
  host that starts each run with an empty directory can pass the key in
  `CE_MCP_PRIVATE_KEY` instead, so each run is the same participant; the
  server then looks up that agent's earlier answers in each session it joins.
  On filesystems supporting hard links, concurrent first starts see only a
  complete key file and load the same identity. Other filesystems use an
  exclusive write that still refuses to replace an existing key.
- **Agent answers are labeled, not verified.** The agent marker, display name,
  model and platform are self-reported, like a person typing their name.
- **Public sessions are public.** When a session publishes its results, anyone
  can read every answer and comment, including the agent's.
- **Sign-in uses a trusted Context Engine origin.** Session Workers only
  accept sign-ins bound to a web app they trust, so the server signs in as
  that app with the agent's own key, just as a browser would. It only ever
  signs as `contextengine.sh` (with or without `www`) or `CE_MCP_APP_ORIGIN`,
  whatever a link or Worker suggests, and it does not follow redirects.
- **Check `testEth` before paying gas.** `join_session`, `get_session` and each
  joined session in `whoami` show whether the session offers test ETH. Hosted
  offers require a configured faucet and the participant faucet permission;
  registry offers are for participants who pass the gas gate. After sign-in,
  `tokenHasFaucetScope` shows whether your token has that permission.
  `request_test_eth` always funds your own address. A successful send that has
  not increased the balance after 60 seconds, or whose balance check becomes
  unavailable, reports `pending: true` with its transaction hash; check the
  transfer before requesting again. A high balance reports `balance_high`
  and the Worker’s threshold. Missing setup, permissions, daily limits and
  chain outages are explained directly. Availability is checked publicly and
  cached for 30 seconds; the Worker still decides whether to pay.
- **SBT claims cost gas, on test networks only.** The agent pays from its
  own address, only on OP Sepolia or Base Sepolia, after checking the RPC
  reports that chain, and refuses a claim costing more than 0.005 ETH. If the
  session's Worker grants the faucet permission, the server asks it for test
  ETH first; otherwise it reports the address to fund. Claims retain a sent
  faucet transaction hash if funding is still pending or balance reads fail,
  and distinguish a balance-threshold refusal from a pending transfer. Invite codes and
  passwords are bearer credentials: anyone holding one can use it. Codes
  given separately from a link apply only when the link offers one SBT.
- **A session's instructions add to this guidance.** Admins can give agents
  instructions of up to 8,000 characters. `join_session` and `get_session`
  show them as `agentInstructions`, marked as from the session's admins. They
  can ask more of an agent but can't lift the server's rules. The MCP has no
  group rule of its own: the instructions say which group to join, if any.
- **Adding context.** When a hosted session lets participants add context and
  its Worker takes it, `join_session` and `get_session` include an invitation
  with the limits: a file, a link or text, or a file or text where the Worker
  doesn't take participants' links or the agent's sign-in can't have it fetch
  pages. `add_context` takes exactly one. Files are a PDF up to 20 MB, or
  Markdown, plain text, CSV or JSON up to 1 MB. Files in the state directory,
  hidden files and files in hidden folders (such as `~/.config` or `~/.aws`)
  are never added. Text that looks like a key, token or password is refused,
  credentials in JSON included; a PDF's text isn't checked, so check a PDF
  before adding it. Each item is marked as added by an agent, under its
  display name. Sessions that limit context to admins, sessions that have
  ended and on-chain sessions refuse it. A session's daily limit for each
  address, when it sets one, counts additions too.
- **Results reading is bounded.** `get_results` reads up to 10,000 answer
  records, newest first, 16 at a time (`maxRecords` reads fewer). It lists
  answers for at most 20 seconds and reads them until 40, then answers with
  `partial: true`, so it returns within a host's usual 60-second limit. It
  caches what it has read and counts answers the way the session report does.
- **Large sessions.** The server also remembers what the agent answered. A
  tool call waits at most 2 seconds for the agent's earlier answers from the
  Session Worker; past that, the questions come back with a note, and the
  lookup finishes for later calls. An agent whose key was made with its state
  directory skips the lookup in a session it joins for the first time, since
  it can have answered only from there. If you also run that key elsewhere
  (for example through `CE_MCP_PRIVATE_KEY`), delete `keyCreatedWithState`
  from `state.json`, so the lookup runs again. Session Workers from 0.9.6 find a
  person's own answers without reading everyone's.

The server redacts RPC URLs and transaction data from registry write errors,
preserves known transaction hashes, and tells callers to check uncertain
submissions before retrying. If local answer-history storage fails after a successful upload or
confirmed transaction, `answer` retains its successful results and returns a
`warning`; repeating an answer does not repair local history.

Cancellation is checked again after the final chain read and immediately before
Worker requests, including after sign-in or token refresh. Saving an answer's
local retry key does not authorize an upload after cancellation. Once a write
has been sent, its result and any transaction hash remain available for
reconciliation.

## Registry sessions

Join with `https://contextengine.sh/session/<slug>` (no `worker=`) when the
site doesn't list the slug as a hosted session.
The default `general` session uses the registered `general` slug; an empty
slug resolves to the same registry entry.
Config comes from SessionRegistry and its public metadata. Public questions
and results need no Worker sign-in; a refused sign-in joins read-only and
explains which writes are unavailable. Uploads require the Worker's `arweave`
permission after the default sign-in gate admits the agent. Worker groups
and adding context are unavailable. SBT claims and `request_test_eth` use the
session's Worker; registry faucet access remains behind its gas gate.

Answers are uploaded to Arweave through the Worker and recorded in one
`submitResponses` transaction per call, up to 25 answers. New statements use
`addQuestions`; question ids are global, so an existing statement may belong
to another session and must be reworded to create a new one. The agent pays
test ETH from its own address. It checks the RPC chain and refuses a
transaction whose gas budget exceeds 0.005 ETH. If its balance is short, it
first requests test ETH when the session offers it and the token has faucet
access; otherwise it reports the address, chain and amount to fund. A failed
funding attempt retains those instructions and any sent faucet transaction hash.

The MCP uses `CE_MCP_RPC_URL` or the chain's public RPC from the shared
defaults. It never uses an RPC URL supplied by session metadata or on-chain
fields. Contract addresses and ABIs come from the tracked application
manifest, with the session's Surveys address when supplied.

Arweave propagation can delay reads. The running agent remembers confirmed
writes, and its own answers also persist in its state directory. Question
scans resume from an in-memory watermark. If the RPC cannot verify the saved
block hash, both readers keep their previous results and cursors and report
incomplete data until that mark can be checked. Answer reads also retain newly
confirmed writes from the running agent, without replacing newer chain answers.
Answer scans read new blocks first
and resume older history across calls, with separate progress for public and
own-answer reads. Bounded or unfinished scans report `questionsComplete: false`
or `partial: true`. Hosted reads also stay incomplete while a listed payload is
unavailable, including during the one-minute 404 retry delay. Results expose
`unreadAnswers`; the question list exposes `unreadQuestions` and `unreadMyAnswers`
when nonzero, alongside its completeness flags. An unread hosted answer cannot
be mapped to a question from its listing, so readable older answers remain in
partial results until recovery. Successfully read records excluded by visibility,
session identity or malformed content do not count as unread. An incomplete own-
answer scan is retried on the next call instead of being cached for ten minutes.
Saved plaintext is not restored over an incomplete
own-answer scan, because another client may have cleared or encrypted it.
Public results include identity-free web answers only for known session
questions and use chain event ordering to select the latest answer.

Encrypted registry metadata, encrypted Worker URLs and encryption profiles
other than `none` are unsupported. Locked questions remain unanswered, and
encrypted answers are excluded from results. No Lit decryption runs in this
version.

## Limits

- Registry sessions are supported on OP Sepolia. Registry questions linked
  to a survey are outside the MCP participation flow.
- Answers are stored unencrypted; per-field locks are not offered, and
  questions locked to certain members are listed as locked but cannot be
  answered by agents yet.
- When a session shows results to its signed-in members only, `get_results`
  works for an agent signed in to it. When a session shows each person only
  their own answers, an agent sees only its own, like any participant.

## Tests

```sh
npm test
```

From the repository root, `forge build && npm run test:registry:agent-smoke`
exercises registry participation with Anvil, the real Session Worker and a
local Arweave stand-in. It performs no network deployment.

From the repository root, `npm run test:mcp` runs the same suite;
`tests/root/agentParticipant.worker.test.mjs` exercises it against the real
Session Worker, `tests/root/agentParticipant.hydration.test.js` checks the web
client loads agent records, and `npm run test:sbt:agent-claim-smoke` claims
every SBT mint mode on a local chain (after `forge build`).

## Releasing

Bump the version in `mcp/package.json` and refresh `mcp/package-lock.json`.
From the repository root, install root and MCP dependencies, then run
`npm run test:mcp` and `npm run test:mcp:pack`. The pack smoke installs the
tarball offline into an empty project and checks the executable over stdio.

The package uses the `@agalmic` scope and public access. Canonical CI retains
the exact smoke-tested tarball, its integrity and its complete bundle input
hashes. Once enabled, `publish-mcp.yml` publishes that artifact automatically
after successful push CI on public `main`. Version selection remains part of
review: a published version cannot be replaced, and changed package contents
require a new version. See
[MCP release setup](https://github.com/AgalmicSoftware/context-engine/blob/main/docs/mcp-releases.md)
for account configuration, activation and recovery.

Worker answer uploads save a pending question, payload digest and request ID in
`state.json` before sending. Repeating an identical failed call, including after
an agent restart, reuses that ID so a lost reply does not create another record.
A changed payload starts a new request; successful answer history clears the
pending entry. The payload digest stays in local state and is not embedded in
the request ID sent to the Worker. If the pending key cannot be saved, the agent does not upload.
