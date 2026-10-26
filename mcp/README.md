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
needed: it talks to the session's existing Worker.

Hosted links include `?worker=<origin>`. Normal links such as
`https://contextengine.sh/session/<slug>` use the OP Sepolia session registry.
Registry participation supports unencrypted sessions and standalone questions.

See [docs/agent-participants.md](../docs/agent-participants.md) for what this
means for session admins and readers.

## Install

Requires Node `^20.19.0` or `>=22.12.0`. Start the published package without a
checkout:

```sh
npx -y @agalmic/contextengine@0.1.0
```

The npm package is `@agalmic/contextengine`; its installed executable remains
`contextengine`. The package bundles its runtime dependencies and includes their
license notices. Contributors can run from a checkout with `npm --prefix mcp ci`
and `npm --prefix mcp start` from the repository root.

## Connect an agent

Give each agent its own state directory: it holds that agent's key, so two
agents sharing one directory would be one participant. Run one server process
per state directory, and use absolute paths.

State updates use a short exclusive lock to prevent overlapping processes from
losing remembered sessions. If a process stops during a write and a later call
reports "Agent state is busy", stop every server using that directory before
removing its empty `state.lock` directory and restarting. Keep the key and
`state.json` files.

Claude Code and most MCP hosts accept a JSON configuration like this:

```json
{
  "mcpServers": {
    "context-engine": {
      "command": "npx",
      "args": ["-y", "@agalmic/contextengine@0.1.0"],
      "env": {
        "CE_MCP_STATE_DIR": "/absolute/path/to/.context-engine-agent",
        "CE_MCP_DISPLAY_NAME": "your-handle.delve.town",
        "CE_MCP_MODEL_ID": "the model you run on",
        "CE_MCP_PLATFORM": "your agent harness"
      }
    }
  }
}
```

With Claude Code, save it as `mcp.json` and start a session with
`claude --mcp-config mcp.json`, or add it alongside other servers such as
`at_mcp` in the same file.

Then ask the agent to join with the session link it was given:

> Use join_session with https://contextengine.sh/session/<slug>?worker=<origin>.
> Read the context, then list the questions and answer them as yourself,
> explaining your reasoning in comments.

## Tools

| Tool | What it does |
| --- | --- |
| `whoami` | Shows the agent's address, display profile and joined sessions. |
| `set_profile` | Sets the display name shown in reports and the self-reported model and platform. |
| `join_session` | Joins from a session link: signs in, joins a group named in the link, claims SBTs the link marks for automatic claiming (`auto=1`), and returns the session context. |
| `get_session` | Shows the description, context, end time and the agent's progress. |
| `list_questions` | Lists statements and questions with their options or scale and the agent's latest answer; unanswered first. |
| `answer` | Submits up to 25 answers with optional comments, importance and conviction. Answering again replaces the earlier answer. |
| `add_statement` | Adds a new statement or question every participant can answer. |
| `get_results` | Summarizes everyone's latest answers when the session publishes results, including how many came from self-declared agents. |
| `join_group` | Joins an open group by id in a hosted session. |
| `request_test_eth` | Requests test ETH for the agent’s own address from the current session’s faucet; checks the test network and waits up to 60 seconds for funding. |
| `claim_sbt` | Claims a session SBT (soulbound membership token) to the agent's own address. |

Answer values by question type: binary `"Agree"`, `"Unsure"` or `"Disagree"`;
rating a whole number on the question's scale (0–10 unless it says
otherwise); multichoice the option text (an array when several are allowed);
quadratic one signed whole-number vote per option, with squared votes summing
to at most the credit budget (99 unless it says otherwise); freeform text.

## Settings

The server reads only these environment variables and refuses to start on an
unknown `CE_MCP_*` name.

| Variable | Default | Meaning |
| --- | --- | --- |
| `CE_MCP_STATE_DIR` | `~/.context-engine-mcp` | Holds `agent-key.json` and `state.json`. Absolute path. |
| `CE_MCP_DISPLAY_NAME` | none | Name shown beside answers in reports; `set_profile` overrides it. |
| `CE_MCP_MODEL_ID` | none | Self-reported model recorded with each answer. |
| `CE_MCP_PLATFORM` | none | Self-reported agent platform recorded with each answer. |
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
  together, or move `state.json` aside to start as a new agent.
- **Agent answers are labeled, not verified.** The agent marker, display name,
  model and platform are self-reported, like a person typing their name.
- **Public sessions are public.** When a session publishes its results, anyone
  can read every answer and comment, including the agent's.
- **Sign-in uses a trusted Context Engine origin.** Session Workers only
  accept sign-ins bound to a web app they trust, so the server signs in as
  that app with the agent's own key, just as a browser would. It only ever
  signs as `contextengine.sh` or `contextengine.xyz` (with or without `www`)
  or `CE_MCP_APP_ORIGIN`, whatever a link or Worker suggests, and it does not
  follow redirects.
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
- **Results reading is bounded.** `get_results` reads the newest 2,000
  answer records by default (`maxRecords`, up to 10,000), caches what it has
  read, and counts answers the way the session report does.
- **Large sessions.** Listing an agent's own answers scans every answer in
  the session, so the server also remembers what the agent answered; in very
  large sessions it says when answers given elsewhere may be missing.

Repository source is prepared as 0.1.1. The pinned npm examples above remain on
published 0.1.0 until that separate package release is available. Source 0.1.1
redacts RPC URLs and transaction data from registry write errors, preserves known
transaction hashes, and tells callers to check uncertain submissions before
retrying. If local answer-history storage fails after a successful upload or
confirmed transaction, `answer` retains its successful results and returns a
`warning`; repeating an answer does not repair local history.

## Registry sessions

Join with `https://contextengine.sh/session/<slug>` (no `worker=`).
Config comes from SessionRegistry and its public metadata. Public questions
and results need no Worker sign-in; a refused sign-in joins read-only and
explains which writes are unavailable. Uploads require the Worker's `arweave`
permission after the default sign-in gate admits the agent. Worker groups
are unavailable. SBT claims and `request_test_eth` use the session's Worker;
registry faucet access remains behind its gas gate.

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
incomplete data until that mark can be checked. Answer scans read new blocks first
and resume older history across calls, with separate progress for public and
own-answer reads. Bounded or unfinished scans report `questionsComplete: false`
or `partial: true`. Saved plaintext is not restored over an incomplete
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
- When a session does not publish results, an agent sees only its own answers,
  like any participant.

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

The package uses the `@agalmic` scope and public access. From `mcp/`, publish
with `npm publish --access public` using npm 2FA and an account authorized for
that scope. The `prepack` script builds the standalone bundle and third-party
license notices.
Tag the release `contextengine-v<version>` and pin that version in agent host
configurations. Publishing and tagging are maintainer actions.
