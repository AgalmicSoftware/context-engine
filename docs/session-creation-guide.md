# Session Creation Guide

This guide walks through the `/new` setup page: the default Cloudflare path and
the opt-in on-chain and Lit variants. The default path has no OP Sepolia or
Arweave publish step.

Related docs:

- [Cloudflare worker reference](session-cors-worker.md)
- [Arweave payload shapes](arweave-payloads.md)
- [SessionRegistry reference](session-registry.md)
- [Sponsored resource keys](resource-keys.md)

## What a New Session Needs

`/new` is one page. Basics (name, description, image, colors) is always open;
Context, Questions, Participation, Results visibility, Access and identity,
Hosting and storage, and AI each show a one-line summary and open from their
caret. A new draft starts on the default profile: a Session Worker on
Cloudflare, with answers stored unencrypted, that every signed-in session member
can read and signed-out visitors can't. Public results open them to everyone;
own-answers visibility keeps each person to their own.
Labels stay short; a "?" beside a label opens its explanation, which screen
readers also get through `aria-describedby`.

The quick path needs only a name, a Cloudflare API token and the OpenAI key.
**Create** lists whatever is still missing and stays disabled until it is
filled. Signing in with your passkey is the confirmation step: Create then
deploys the Session Worker through the deploy helper, saves the signed session
config and reads it back. **Deploy the Worker now** runs the deploy step early
if you want to check the Worker first.

The token and keys are request-only: they are never stored in the browser, the
address bar, templates or the session config. The default deploy helper is the
project's, and its operator can see the token, the keys sent with it, and the
Worker secrets it generates; see [API token setup and
handling](session-cors-worker.md#api-token-setup-and-handling).

The token-free path is a guided Cloudflare dashboard handoff under Hosting and
storage → More. Once its Worker is verified, Create needs no token. Lit profiles
cannot use it. Both paths need a Cloudflare account, and a real session needs
its Workers Paid plan ([why](#1-cloudflare-account)).

The app's passkey-derived EOA supplies the admin identity and signs the worker
config, but it does not submit a transaction and needs no gas. For the
dashboard handoff, Context Engine generates two independent setup values,
`TOKEN_HMAC_SECRET` and `CE_STORAGE_ENVELOPE_KEK`, for Cloudflare's encrypted
Worker-secret fields. They are secrets for the new Session Worker, not
Cloudflare credentials, and stay in the current browser tab during setup. The
AI key is written only to the worker's session-secrets store.

Every option is checked against the session mode rules as you choose it. A
choice that conflicts with another, such as Worker encryption with Arweave
storage, shows a plain explanation beside the option, opens its section and
blocks Create until it is resolved; Create lists each conflict with a button
that jumps to its section. Changing the session network updates every SBT
rule; check each contract address on the newly selected network. Draft Group
secrets are cleared when the page closes or the signed-in account changes. An
owner-written Interview opening must contain a question before the session can
be created.

For private Cloudflare storage, participants can read their own submitted
responses; admins and authorized agents can read session-wide responses when
storage rules allow it. Participant aggregate summaries are not implemented.
Unencrypted Arweave data is public, while Lit rules govern decryption of encrypted
Arweave data. The export-policy selection is a saved preference; the current
exporter follows existing access permissions and does not enforce that preference.

Use this matrix when choosing a non-default profile:

| Input                                                      | Why it is needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Required?                                                                    | Can a sponsored bundle cover it?                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Passkey account                                            | Supplies the admin identity and signs worker or on-chain actions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Yes; the default path creates it in the app                                  | No                                                                    |
| Ethereum Gas (TX Fees)                                          | Pays registry/SBT transactions; this is OP Sepolia ETH on the default chain                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decentralized or other on-chain profiles only                                | Partially                                                             |
| Session Worker                                             | Provides the session's APIs; it does not serve the website. For Cloudflare profiles it owns canonical config, auth, AI, storage, fetch, and optional faucet routes. For on-chain profiles it handles AI, auth and Arweave uploads while the Ethereum registry and Arweave remain canonical. | Yes for every reachable `/new` profile                                       | Yes, if the sponsor gives you a deploy-ready bundle                   |
| Cloudflare API token                                       | Lets **Create** deploy the Session Worker through the deploy helper. The token-free alternative is the dashboard handoff under Hosting and storage → More. | Yes on the default path, unless a verified dashboard-deployed Worker is in place | Indirectly, through a short-lived deploy grant                        |
| AI provider key(s)                                         | Powers AI generation, chat, and transcription routes for every provider selected by the session's models                                                                                                                                                                                                                                                                                                                                                                                                                                                              | One or more for every reachable `/new` profile                               | Yes                                                                   |
| Arweave JWK                                                | Pays for Arweave metadata/payload uploads                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decentralized or explicitly Arweave-backed profiles only                     | Yes                                                                   |
| Ethereum RPC URL                                                | Provides chain reads and writes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Decentralized, Lit/on-chain gating, or explicitly chain-backed profiles only | Yes                                                                   |
| Faucet private key                                         | Lets the session sponsor small OP Sepolia ETH grants for onboarding/publish support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Optional                                                                     | Yes                                                                   |
| Lit credentials for gated fields or Lit-encrypted payloads | Needed only when the session uses worker-mediated Lit/Chipotle encryption, `lit-arweave`, or Cloudflare `encryption: "lit"`. Setup asks for one Lit API key, stored as the `litAccountApiKey` Worker secret. The Worker derives `litUsageApiKey` plus `litApiBase` / `litGroupId` / `litPkpId` / `litActionCid` after deploy when needed. Cloudflare `encryption: "none"` and `encryption: "worker_envelope"` profiles do not require a Lit key. | Optional                                                                     | Yes                                                                   |

Important:

- The default worker-canonical path does not require an Arweave JWK, Lit key,
  user-supplied RPC URL/key, wallet connector, faucet key, publish funding, or
  transaction gas.
- Hosted profiles with on-chain SBT rules can enable **Send participants test ETH
  for gas**. It starts off and requires every SBT rule to use the session network
  (OP Sepolia, or best-effort Base Sepolia). Enabling it shows the Faucet private
  key field and its derived address. Supply a valid key and fund that address
  with test ETH on the displayed network. The key is deployed and synced as a
  private Worker secret; turning the switch off excludes it from those writes.
  Removing the SBT rules or changing the backend or network turns the switch off.
- This toggle writes the `faucet_self` participant grant, which needs a 0.7.0 or
  later deploy helper and Session Worker: older helpers reject it and older
  Workers ignore it. Do not substitute `faucet`, which older Workers issue as an
  unrestricted faucet scope.
- Hosted payouts send 0.0002 ETH when the recipient balance is at most 0.001 ETH,
  only to the signed-in wallet, up to three payouts in 24 hours. Refused requests
  do not consume a payout. The admin faucet test remains registry-only.
- For participants, Settings shows **Tx gas** after the Worker confirms a faucet.
  The existing low-balance auto-funding preference applies to these hosted
  sessions even while Settings is closed. Chainless hosted sessions do not
  request funds or probe for a faucet in the background.
- Selecting Lit adds the Lit credential and chain/RPC requirements. Choosing the
  on-chain registry adds Arweave, registry, wallet-transaction, and gas
  requirements, and it still needs a compatible Session Worker.
- Secrets live in the worker's secrets store or encrypted sponsored bundles,
  never in public Worker config or Arweave session metadata.

### Settings by hosting

Each section shows only the settings the chosen hosting supports:

| Hosting | Settings shown |
| --- | --- |
| Session Worker on Cloudflare | End time, instructions for AI agents, question defaults, Worker Group tag defaults, and Worker-backed privacy and results controls |
| Session Worker with on-chain SBT access | The Cloudflare settings plus SBT curation and the network controls that access needs |
| On-chain registry (Arweave) | Registry network, SBT gates and SBT curation. Contracts, block range and faucet amounts use chain defaults; edit them on the session's settings page after creation |

A pure Worker session does not display or persist block numbers, registry
contracts, Surveys contracts, faucet settings, or an Ethereum network.

Most sessions can leave Participation at its defaults. **Who can create groups**
is a dropdown: **Anyone in the session** or **Admins only**.

Each Worker group also has **Who can remove members**, chosen when the group is
created and changeable later from the Admin page's groups panel:

- **Admins and the member** (`both`, the default): members can leave, and
  admins can remove them.
- **Admins only** (`admin_only`): admins can remove members; members can't
  leave.
- **The member only** (`member_only`): members can leave; admins can't remove
  them.
- **No one** (`neither`): memberships last until the group is deleted.

A Session Worker before 0.9.1 ignores the setting and keeps the old rule, which
is `both`. The Worker's side is in [Worker-Native
Groups](session-cors-worker.md#worker-native-groups). **Voice interviews
and AI prefill** defaults on. **Interview settings** show only while it is on;
turning it off hides them and keeps their values.

Interview settings for the call:

- **Interview voice model** is the OpenAI voice model, `gpt-live-1` by default.
  `/new` publishes it as `interviewMode.realtimeModel` for both Worker-canonical
  and Arweave-backed sessions.

- The opening: owners can supply an opening question, add an optional
  `interviewMode.steeringPrompt`, or use the default generated opening.
  Generation waits for public questions and uses the session's fast model with
  the Worker-held key for its provider.

- Automatic regeneration and discovery of new questions during a call are off by
  default; when enabled, their default addition threshold is 20%. Question
  suggestions are optional and off by default. Admin refresh is on by default.

- **Suggest groups to join** (`interviewMode.joinMatchingGroups`, off by
  default) suggests the session's open groups that fit each participant after
  an interview or AI prefill: the ones they tick join when they submit, and
  their own AI can suggest groups too. Off, no groups are matched. The older
  `interviewMode.suggestGroups` is no longer read. While it is on, **The AI may
  use** (`interviewMode.groupSuggestionData`) sets what an AI may base a
  suggestion on: Country, Work, and Interests and causes by default; Town or
  city only when ticked. Every AI is instructed never to go on health,
  disability, religion, ethnicity, sexuality, gender identity, age, family life,
  or party or union membership.

Interview settings for research:

- **Measure how well AI represents participants**, at the top of Interview
  settings, turns on three of the settings below together: research sharing by
  default, hidden drafts for 1 in 5 AI-prefill drafts, and the participant
  score. Turning it off sets them back to their defaults, and each stays
  editable; see [Measure how well AI represents
  participants](#measure-how-well-ai-represents-participants).

- **Share AI draft changes for research by default**
  (`interviewMode.shareDraftChangesByDefault`, on when unset) sets the initial
  **Share for research** checkbox beside **AI submission info**. Participants can
  change it before submitting, and their saved choices are retained.

- **AI draft research detail** (`interviewMode.researchDetail`) decides what a
  shared comparison keeps: `minimal` (the default) has no AI notes or drafted
  text; `full` adds them and drafts for skipped questions.

- **Hidden AI drafts** (`interviewMode.hiddenDraftShare`, off by default) hides
  a share of each participant's AI-prefill drafts until they answer, to measure
  how much seeing a draft sways answers. It applies only while they share draft
  changes.

- **Show participants how well their AI predicted them**
  (`interviewMode.showFidelityScore`, off by default) shows a private score
  after someone submits AI-prefill drafts.

- **Show “How well AIs predicted people” in Results**
  (`interviewMode.showFidelityResults`, off by default) adds that section to the
  Results report once its responses include AI-prefill drafts from 5 people.
  **Smallest group shown in “How well AIs predicted people”**
  (`interviewMode.fidelityMinimumPeople`), under it, changes that number;
  **Off** shows every figure.

Older Session Workers reject settings they don't know, so each is saved only
when changed from its default. The sharing default needs a 0.7.0 or later
Session Worker; `full` detail, hidden drafts, the score, the Results section and
its smallest group need one newer than 0.8.0, and
suggesting groups to join needs 0.9.1 or later. See
[session-interview-research.md](session-interview-research.md),
[session-listening-mode.md](session-listening-mode.md) and [Interview settings
and lifecycle](session-listening-mode.md#interview).

Results analysis input includes each question prompt once, capped at 900 characters
(including any response-provided fallback text). Response rows refer to included
questions by ID; answers for questions outside the input cap are omitted.

**Results AI views** default to manual generation. The shared session setting is
`resultsAnalysis` with `generationMode` (`manual`, `automatic`, or `both`),
view toggles for Circles, Breakdown, and Risk Matrix,
`autoAfter: { threshold: 10, unit: "distinctParticipants" }`,
`inputScope: "submitted"`, and `publication: "latest_success_visible"`.
The threshold counts newly seen distinct submitted participants since the last
successful run. Circles renders the DebateMap-style argument map and atlas.
Risk Matrix axes are generated from the session subject matter rather than a
fixed likelihood/impact template. Generation inherits the session's configured
AI provider and model routing, including object-shaped `ai.models.thinking`
entries; owners do not choose a separate generated-results model.

Successful runs are immediately visible as the latest successful generated
artifact. Viewer reads are available only when the session profile exposes
`public_full_if_storage_public` or `session_member_full`, `aggregateResultsEnabled` is true, and the
caller can pass all three existing Cloudflare storage read gates for
`generatedArtifacts`, `questions`, and `responses`. The viewer endpoint returns
a safe `jobState` with the artifact and frozen submitted snapshot; it does not
return active reservations, retry receipts, failure internals, or wallet
mappings. Failed or active runs keep showing the last successful artifact.
Admin-only status and Generate/Refresh controls use the separate admin status
and signed generate routes.

Automatic background generation is supported only for Worker-canonical
Cloudflare storage, where the Worker can count authoritative submitted
participants and queue durable alarm work. Registry/Arweave and other
non-canonical profiles can still use explicit admin manual generation from a
sanitized same-session browser snapshot when local submitted responses are
hydrated and unlocked. Unsupported profiles report a capability reason instead
of silently spending provider calls or using seeded demo data. In
`automatic`-only mode, an admin manual retry is still permitted after a failed
automatic run so owners can recover without changing generation mode.

The optional **End time** is a timestamp for Worker-canonical sessions.
It must be in the future when the session is published. At that instant the
Session Worker stops participant AI, transcription, fetch, upload, Group
creation, and Group join work. Existing public or authorized Groups, stored
payloads, and results remain readable, and signed admin recovery/configuration
routes remain available.

The optional **Instructions for AI agents**, also for Worker-canonical
sessions, add to the site's guide for agents at `/skill.md`: what to know
before taking part, such as which group to join or what to focus on. They are
Markdown of up to 8,000 characters, typed or loaded from a .md or .txt file,
and can ask more of agents but not lift the guide's rules. The Session Worker
serves them as text at `<worker origin>/llms.txt`, never as a page; anyone can
read them there and in its public `/session-config`. Editing them signs no one
out.

**Group tags** in Participation seeds the tags in both participant and admin
Worker Group creation. Worker sessions that carry only `defaultSbtTags` fall back
to that value; new pure Cloudflare sessions save `defaultGroupTags`.

## Sponsored Bundles: Skip Manual Config

If you do not want the recipient to paste worker secrets manually into `/new`, use `/sponsor`.

High-level flow:

1. An existing session admin opens `/sponsor`
2. They choose which worker-backed resources to sponsor
3. The page uploads an encrypted bundle to Arweave
4. It returns an ID-only share URL shaped like `/new?sponsored=<txId>` and displays
   the decryption key separately
5. The recipient opens the URL, enters the separately delivered key, and the wizard
   applies the bundled config client-side
6. Decrypted credentials and the decryption key remain memory-only; a reload requires
   the key again unless the bundle is still available in the current page runtime

What the sponsored bundle can supply to the recipient:

- OpenAI / Anthropic / OpenRouter keys
- Arweave JWK
- custom RPC URL
- faucet private key or faucet grant token
- Lit authority-bundle mode: one disposable Lit API key per bundle, carried through `litAccountApiKey` internally, so `/new` can create a fresh group / PKP / usage key for each new session
- scoped Lit runtime values when intentionally pre-provisioned: `litApiBase`, `litGroupId`, `litPkpId`, `litActionCid`, `litUsageApiKey`
- bootstrap worker URL and deploy grant token for grant-backed worker deploys

What it does not send directly:

- The raw Cloudflare API token. `/sponsor` swaps that for a deploy grant token and keeps the raw token only in the sponsoring worker's server-side grant record until redeem or expiry.
- The recipient's passkey identity. They need it for signed worker admin actions;
  only an on-chain profile also needs it to submit registration transactions.

When a sponsored bundle is deploy-ready, the page hides the Cloudflare token
input and **Create** deploys through the grant, so the recipient needs no token.

A deploy grant lends the sponsor's Cloudflare token, not a choice of code: the
sponsoring Worker deploys only the release configured on it. If that release is
missing, the page says so. See
[Sponsored deploy release](session-cors-worker.md#sponsored-deploy-release),
which also covers sponsoring Workers older than 0.6.8.

### Temporary standard sponsored links fixture

For short-lived demos, `client/public/standard-sponsored-links.json` can publish
up to ten ID-only sponsored `/new` URLs. The checked-in file keeps every slot
inactive and empty. A URL cannot be redeemed without its separately delivered
key; never add keys to the file. The file does not track use or enforce spend
limits, so back each URL only with low-budget, revocable resources. See
[`docs/standard-sponsored-links-fixture.md`](standard-sponsored-links-fixture.md)
for the manifest contract and steps.

## Prerequisites

### 1. Cloudflare account

The session worker is the canonical config, auth, AI, and payload-storage host
for the default profile. A real session needs the account on Cloudflare's
**Workers Paid** plan. On the free plan Workers KV takes 1,000 writes a day, and
each answer uses two and each sign-in one, so after roughly 450 answers in a day
uploads fail until 00:00 UTC. Reads run out too: one Results view loads every
answer, so a few dozen viewers of a large session use up the free day. The free
plan is enough to try the app with a few people.

Create or sign in to a Cloudflare account at <https://dash.cloudflare.com/>, then
choose how to deploy:

- **API token (default).** The link beside the **Cloudflare API token** field
  opens a prefilled Cloudflare token form. Paste the token into that field.
  **Create** sends it once to the deploy helper, which creates the Worker and KV
  namespace in that account. See
  [API token setup and handling](session-cors-worker.md#api-token-setup-and-handling)
  for account selection, one-attempt handling, expiration, and revocation
  requirements.
- **Dashboard handoff (no token).** Under Hosting and storage → More, the deploy
  button opens Cloudflare's deployment flow for the isolated package in
  `deploy/cloudflare/session-worker/`. Cloudflare provisions the Worker, KV
  namespace, and Durable Object in that account. Paste the slug, public admin
  address, and the generated Worker runtime secrets the page shows (two normally;
  three when Agents (HTTP API) is on); then deploy and paste the resulting
  `workers.dev` URL back into the page.

The dashboard deploy URL must pin an exact 40-character commit so the reviewed
source is immutable. The hosted client uses the public commit it was built from
(`REACT_APP_CE_CLOUDFLARE_NATIVE_DEPLOY_REPLAY_COMMIT`, set from Netlify's
`COMMIT_REF`), the same commit whose release the wizard downloads Worker bundles
from. Builds without it, such as local and self-hosted builds, use the release
pinned in `client/src/variables/workerReleasePin.json`. Each release moves that
pin to the newest published Worker release, which is the previous release
because a release's own bundles are published after its merge. The private source
commit is not interchangeable with its public replay SHA. Moving branches, tags,
abbreviated hashes, and non-GitHub sources are rejected.

Hosting and storage → More also separates daily request budgets for signed-in and anonymous users. `Authenticated requests per wallet per day` controls signed Worker credentials. `Anonymous requests per IP per day` controls anonymous public reads plus enabled AI, transcription, and realtime routes for everyone sharing the same public IP address, such as shared Wi-Fi. New sessions default the anonymous IP field to `0`, which disables this Worker-level shared-IP daily cap while leaving provider limits and access policy in force. A config that omits the field leaves it blank, and the Worker then applies no shared-IP daily cap.

### 2. AI provider keys

Provide a key for every provider used by the selected fast, thinking, and
transcription models. The default model choices use only OpenAI and therefore
require one OpenAI key. Mixed assignments require every distinct provider key;
for example, Anthropic text models with OpenAI transcription require both
Anthropic and OpenAI keys. Each key is AES-GCM encrypted in the per-session
Worker KV secrets envelope under a Worker-only KEK; it is never stored in the
public session config returned to browsers. This protects KV contents at rest,
but the session Worker and Cloudflare runtime can decrypt it.

### 3. A signing identity

The default client build is passkey-only and uses the Context Engine passkey EOA
to sign Worker SIWE login messages and admin actions. Chain-backed profiles use
the same account for OP Sepolia transactions.

Deployments built with `REACT_APP_CE_ENABLE_METAMASK_CONNECTOR=true` can also use MetaMask. The separate WalletConnect fallback remains opt-in; see `docs/public-client-config.md`.

The same identity is used for:

- Cloudflare worker admin signatures during setup
- Session registration transactions in decentralized profiles
- Optional SBT deployment transactions

### Advanced only: Arweave wallet (JWK)

The default Cloudflare profile does not use Arweave. You need a JWK only after
choosing the on-chain registry or explicitly switching storage/publish
behavior to Arweave.

Generate a wallet:

- Web wallet: [arweave.app](https://arweave.app) and download the keyfile JSON (JWK)
- Wallet guide: [Arweave.app Web Wallet](https://docs.arweave.org/developers/wallets/arweave-wallet)
- CLI option: `npx arweave key-create arweave-keyfile.json`

Fund the wallet with AR:

- Send AR directly to the wallet address from an exchange or another wallet
- Or use ArDrive/Turbo if you want a fiat-friendly path into Arweave uploads:
  [Fund Your Wallet](https://help.ardrive.io/hc/en-us/articles/5258520347419-Fund-Your-Wallet)
  and [Turbo overview](https://docs.ardrive.io/docs/turbo/what-is-turbo.html)

Operational notes:

- Treat the JWK like a private key. Anyone with the file controls the wallet.
- Keep a backup offline.
- In Context Engine, the JWK belongs in worker secrets, not in public metadata.

### Advanced only: OP Sepolia ETH

The default worker-canonical publish uses no transaction and needs no gas. You
need OP Sepolia ETH only when the selected profile registers the session
on-chain or deploys an SBT during publish.

Useful links:

- Optimism faucet directory: <https://docs.optimism.io/app-developers/tools/faucets>
- Superchain faucet: <https://console.optimism.io/faucet>
- QuickNode faucet: <https://faucet.quicknode.com/optimism/sepolia>
- Explorer: <https://optimism-sepolia.blockscout.com/>

Registration cost notes:

- `SessionRegistry.createSession(...)` requires a `0.0001 ETH` creation fee on top of gas
- `setSessionFields(...)` and `setResourceGates(...)` are separate follow-up transactions

## Session Creation Walkthrough

Open `/new`. The app canonicalizes that route to `/session/new`, but `/new` is the intended entry point.

The page opens on the default profile; **Runs on**, at the top of Basics,
switches between the two hosting models, **Centralized** and **Decentralized**,
and every other option adjusts that profile in place:

- **Centralized** (a Session Worker; Hosted & Fast) compiles to a Cloudflare-backed,
  worker-canonical session shape whose signed-in members see every answer, with
  no encryption by default; Cloudflare-internal worker encryption
  (`worker_envelope`) is an option in setup. Create asks for a name, a Cloudflare API token
  (or a verified dashboard-deployed Worker) and the OpenAI key. It does not ask for
  Arweave, Lit, RPC, funding, faucet, or gas inputs.
- **Decentralized** (an on-chain registry; Trustless & Slower)
  compiles to the Arweave + Ethereum smart-contract session shape. It needs a
  compatible Session Worker for AI, auth and Arweave uploads, the Arweave
  wallet/JWK, an Ethereum RPC URL, Ethereum gas for transaction fees, the OpenAI
  key, and a Lit key when encryption is enabled. The Ethereum registry and Arweave
  remain the canonical authority and metadata store.

The validated version-1 profile, rather than legacy top-level fields, determines
which capabilities are reachable:

| Reachable `/new` profile                   | Canonical authority and storage                              | Identity and Groups                                                                                | Chain-dependent capabilities                                                          |
| ------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Default (`/new` starts here)               | Session Worker + Cloudflare; `gate: "role_gate"`, `encryption: "none"`, members see all answers | Passkey + **Native Worker Groups**                                                                 | None; `evm.registryChainId` is `null`                                                 |
| Cloudflare, no encryption, public results  | Session Worker + Cloudflare; `gate: "none"`, `encryption: "none"` | Passkey + **Native Worker Groups**                                                                 | None; `evm.registryChainId` is `null`                                                 |
| Cloudflare, Worker envelope                | Session Worker + Cloudflare; `gate: "role_gate"`, `encryption: "worker_envelope"` (the `fast_cheap_cloudflare` preset) | Passkey + **Native Worker Groups**                                                                 | None unless an explicit `sbt_onchain` condition is added                              |
| Cloudflare + explicit `sbt_onchain`        | Session Worker + Cloudflare; Worker envelope                 | Passkey + **Native Worker Groups**; SBT conditions are separate **Advanced on-chain access gates** | Positive chain ID and RPC; wallet/gas only when `/new` must create an SBT             |
| Cloudflare + Lit                           | Session Worker + Cloudflare; `encryption: "lit"`             | Passkey + **Native Worker Groups**                                                                 | Positive chain ID, RPC, and Lit credential; this does not make the registry canonical |
| On-chain registry                          | Ethereum registry + Arweave; Session Worker for AI, auth and Arweave uploads; `encryption: "none"` or `"lit"` | Wallet with passkey support + on-chain Soulbound Tokens (SBTs) for Groups                | Compatible Session Worker, chain/RPC, registry transactions, gas, and Arweave; Lit also needs its credential |

Agent Session Wrapped, result-visibility, and export choices do not change that ownership split. Profiles marked
schema-only or unavailable, and malformed or cross-lineage profiles, do not
receive partial capabilities: publication and downstream projection fail
closed. A stored config with no version-1 profile may use the bounded legacy
registry compatibility path only when its registry identity and positive chain
are present; legacy chain fields never turn a validated chain-free Worker
profile into a hybrid.

The profile's settings are grouped by section:

- Results visibility owns who sees results and small-group protection. Admin-only
  and public-redacted result modes have no option; a template that carries one is
  flagged until you choose another.
- Access and identity owns sign-in, what grants permissions, encryption and
  decryption access rules. Switching storage from Arweave to Cloudflare
  installs an explicit role gate; switching back removes Cloudflare-only access
  fields.
- Hosting and storage owns where the session runs and is stored, **Agents (HTTP
  API)** (Agent Session Wrapped, on Worker-hosted sessions), export policy and the
  Worker deployment. The website is always enabled. Agent access is off by default
  and uses the same Session Worker: authorized agents can use the HTTP API once the
  service is deployed and verified, subject to session access rules. There are no
  bot or Mini App setup controls. Selected-channel export also has no option; a
  template that carries it is flagged the same way.
- **Require users to pay for usage** appears only for on-chain registry
  (Ethereum registry + Arweave) sessions. Worker-hosted Cloudflare sessions,
  including those using Lit, do not show this option, and their Worker secrets
  stay on.

Every edit marks the profile `custom`, and storage has one visible authority.
Publishing writes `sessionModeProfile` as the source of truth and compiles it to
the storage profile and payload-access fields the runtime reads. The publish
boundary sends one canonical object-valued `storageProfile`; its backend,
payload gate, encryption mode, and effective access-condition document must
agree with the validated profile. Deploy, signed config mutation, and public
Worker readback all fail closed on missing, ambiguous, or divergent
profile/storage policy.

Switching **Runs on** also replaces storage, identity and authorization:
Centralized uses Cloudflare with passkey plus Worker roles, while Decentralized
uses Arweave with wallet plus on-chain SBT authorization. A stale wallet, Worker
role, or legacy top-level chain ID cannot survive that switch as a hidden
capability. Since each choice allows only one of each, **Sign-in** and
**Permissions** in Access and identity and **Storage** in Hosting and storage
show as text with a "?". **SBTs grant permissions** stays a choice on
Centralized sessions. If a template brings values Runs on doesn't allow, **Match
Runs on** beside the conflict puts back what it needs.

The wizard validates the profile at the publish boundary and rechecks the live
draft after asynchronous identity and duplicate-session preflight, so a profile
edit made while preflight is running still stops before upload, worker, or
registry side effects. Invalid settings also show beside the option. Mode values
are exact enums at every write boundary: explicit blanks, friendly aliases,
unknown values, and reserved key providers are rejected rather than normalized
to a less-protective default. Legacy aliases remain readable only for stored
compatibility.

Enabling Agent HTTP adds token login alongside ordinary wallet/passkey web
participation; it does not replace the web session page. New client writes keep
the reserved `surfaces.telegram` and `surfaces.miniApp` booleans false.

`/new` has no steps. The rest of this walkthrough groups its sections by topic:

1. Naming and session details: Basics, Context, Questions, Participation and AI
2. Privacy and access control: Results visibility, and Access and identity
3. Worker deploy and secrets: Hosting and storage
4. Registration and publish: Create

### 1. Naming and session details

The core session metadata:

- `sessionName`
- `sessionInfo`
- `sessionContext` for optional public background shown on the session page,
  in one of two forms, chosen with **Format**: typed text and HTTPS links (up
  to 6 paragraphs and 8 links), or one uploaded HTML file of up to 20,000
  characters, under the same title. The file keeps its own CSS (style blocks,
  and style and class attributes) but loses its scripts, event handlers,
  frames, forms and `@import` before it is saved, along with any style block
  or attribute that tests the site around the page (`:host-context`, style
  queries) or escapes an @-rule's name. A preview shows the
  result and what was removed; the session page cleans it again each time it
  shows it. The page renders in a box of its own: its CSS styles only the page
  and can't place anything outside the box. It can use the site's colours as
  CSS variables: `--ce-context-text`, `--ce-context-muted`,
  `--ce-context-link`, `--ce-context-focus`, `--ce-context-border` and
  `--ce-context-surface`. Either form must not contain secrets, and the
  session's AI reads its words. The Context section also takes
  files (PDF, Markdown, text, CSV, JSON), each for everyone, for admins only, or
  for any of the groups set up under Access and identity, chosen in its
  **Visible to** dropdown; they are added after **Create**, when PDFs can be read by the session's AI and
  the links' pages read for it. See [Session context](session-context-sources.md).
- **Suggest questions**, under the Questions list, drafts five questions from
  the name, description, context text, link titles and addresses (it doesn't
  open the pages), and the files added to Context, admins-only ones too. It
  follows **Question prompt** and **Tag suggestions** under AI, skips questions
  already in the list, and uses the session's question types. It needs the
  OpenAI key typed under AI: the browser sends the request straight to OpenAI's
  Responses API, unstored, and the key goes nowhere else. Text files go in as
  text, and PDFs with **Analyze with the session’s AI** on go in as files, up to
  32 MB together; the page names any it leaves out. The context is marked as
  untrusted material, as the session page's question generator marks it.
  Drafts join the list, where you can edit or remove them; nothing reaches the
  session before **Create**.
- **Colors**, under **Appearance** in Basics: `Context Engine`, `Ocean`, or
  `Amber`. This controls only documented session accents/chrome and does not
  change the app theme.
- slug: the page makes it from the name and shows the resulting link.
  It starts with a lowercase letter or number, then uses only lowercase letters, numbers, `_`, or `-`, up to 128 characters. Participant links open only slugs in this form. Slugs whose link opens a different session are reserved: `general` (the default session), `debate` (the session Worker opens `rxc` instead), `constructor` and `prototype`.
- session ID, which the page generates
- chain-backed profiles only: the network, from **Registry network**. Contract
  defaults and `blockLimits.start` (the current chain head) are filled in for you.
- optional session header image URL; Arweave-backed sessions can also upload the image file with their metadata

AI configuration also lives in the session metadata draft:

- `ai.models.fast`
- `ai.models.thinking`
- `ai.models.transcription`
- `interviewMode.realtimeModel` (OpenAI interview voice; defaults to
  `gpt-live-1`)
- `interviewMode.steeringPrompt` (optional owner-authored interview guidance;
  defaults to empty and is capped at 3000 characters)

What gets stored where:

- For `worker_canonical`, the session worker stores the sanitized canonical
  identity, text metadata, AI model choices, authority policy, and storage
  profile in Worker KV. This includes exactly one public
  `appearance.colorSchemeId`, never palette values. Publish verifies a
  read-after-write of that config before showing the session URL.
- Decentralized and explicit Arweave-backed profiles keep storing the
  human-readable session config on Arweave: name, description, AI defaults,
  block limits, contract pointers, featured lists, the same
  `appearance.colorSchemeId`, and any Lit-encrypted fields. The EVM registry
  stores only the metadata pointer; it does not duplicate the scheme ID.
- The default profile uses `storageProfile.backend = "cloudflare"` with
  `gate: "none"` and `encryption: "none"`. Choosing other results visibility
  switches to `gate: "role_gate"` with Worker-role/agent-grant access, and
  choosing **Session Worker** encryption adds `worker_envelope`.
  Advanced Cloudflare profiles can add an explicit `sbt_onchain` access
  condition, which makes the profile hybrid and requires its configured
  chain/RPC before the Worker serves bytes. That is a separately labelled
  Advanced on-chain gate; it does not replace the session's Worker-native
  Groups and is not end-to-end encryption.
- **Storage** in Hosting and storage follows Runs on: Arweave for Decentralized,
  which is permanent and can receive payloads encrypted before upload, and
  Cloudflare for Centralized, which is mutable and not permanent.
- **Encryption** in Access and identity offers
  `none` (payload bytes are stored as provided), `lit` (locked fields are encrypted
  before upload and a Lit Action releases their key after an on-chain SBT check;
  the key passes through the session worker, so the Worker operator and Lit
  account administrators remain trusted; scoped usage keys alone cannot
  authorize decryption, and it is not end-to-end), and
  Cloudflare `worker_envelope`: data is encrypted before Cloudflare stores it,
  and the session worker decrypts only after checking access. `lit` requires a
  registry network, RPC connection, and Lit credentials. `worker_envelope` is
  available only with Cloudflare storage. The operator and Cloudflare runtime
  can decrypt; it is not decentralized, not end-to-end, and not private from
  the session operator or Cloudflare runtime.
- New sessions start with `session_member_full`: every signed-in member reads
  every answer and the AI Views. It needs the Session Worker with Cloudflare
  storage, so choosing on-chain hosting moves it to public results, or to
  participant aggregate when answers are encrypted.
- Public stored-results visibility requires unencrypted storage; choosing
  encryption moves it to `session_member_full` on the Session Worker and to
  participant aggregate on chain. On Cloudflare, public results also need a
  payload gate of `none` with no access conditions in either profile policy
  branch, and signed-out visitors can then read them without any anonymous
  scope. On any other visibility, a signed-out visitor who opens Results is
  asked to log in.
- When `/new` deploys a custom worker for Cloudflare storage, the deploy helper receives the normalized storage profile before Worker upload so it can bind the storage index KV and any requested R2 bucket. For every Session Worker, the helper also generates the worker secret used as the deployment KEK, unless you supply your own recovery key; it is not written to session metadata.
- Worker-envelope key provider is fixed to `worker_secret`. In a nonpublic Worker-canonical session, the normal participant storage scope permits submitting and reloading their own responses. Reading another participant's individual response additionally requires a current session admin; ordinary `storage: true` isn't enough. Existing item access conditions still apply. Aggregate-only visibility does not permit downloading everyone's raw answers to calculate a summary in the browser; combined summaries require an authorized server-generated aggregate. Turning off **Default access rules** lets you combine Session role (`worker_role`), SBT holders (`sbt_onchain`), or Authorized accounts (`agent_grant_scope`) rules with any/all matching; the wizard writes those conditions to `storageProfile.payloadAccessControl.accessConditions` for the worker.
- `SessionRegistry` does not store long-form content directly. Decentralized
  profiles store a metadata URI pointer plus minimal session identity fields;
  the default worker-canonical profile skips registry writes entirely.

Important:

- A newly deployed Worker-canonical session needs the `worker=` URL parameter
  for first-time visitors unless the repo's `known-sessions.json` lists it (see
  [Normal links on the hosted site](#normal-links-on-the-hosted-site)).
  Deployment alone does not register a slug-only URL.
- `blockLimits.start` is required for chain-scanned profiles. The default
  worker-canonical profile does not require a chain scan window. After its
  canonical worker config is verified, reloads keep that session out of EVM
  discovery even when the original share URL has been normalized.
- Restored start blocks remain explicit unless the draft records an automatic
  default. Blank starts use the current chain head; saved defaults follow a
  chain change after its new head arrives. The provenance stays in the local
  draft and is omitted from published metadata and Worker configuration.
- Chainless worker-canonical profiles do not request testnet faucet funds.
- The wizard strips secrets and worker-only runtime config out of the Arweave payload before upload.
- Draft recovery keeps only the stable color-scheme ID. Sponsored setup changes
  Worker resources without resetting the selected scheme. Missing or invalid
  IDs use `context-engine`; viewing an older session does not rewrite it.

### 2. Privacy and access control

On-chain sessions use the **Privacy & Access** panel in Access and identity to
decide who can decrypt locked metadata fields and who can access sponsored
resources.

The default worker-canonical profile uses worker roles/groups and the persisted
version-1 `workerAuthority` policy. It does not require an SBT, registry, RPC,
or Lit key. Participant and anonymous scopes, plus any login gate, are evaluated
by the session worker. By default no login gate is written, so any passkey
account can sign in and receive participant scopes: a non-public session is not
invite-only.

Before publishing a worker-canonical session, the **Session Access** panel in
Access and identity can queue Groups through the same form used by normal Worker
Group creation. Queued Group drafts collapse independently while preserving
their edits. Each draft supports a name, description, image URL or local image
file, tags, public HTTPS reference URLs, member limit, self-join deadline,
group-admin address, join mode, and member visibility.

Durable text and URL metadata stays in the recoverable browser wizard state. A
selected local image file stays only in the current tab; after the canonical
Worker origin, slug, and session ID are verified, publish uploads it through the
selected session storage and writes the resulting public URL back into the draft
before creating the Group.

Publish then creates queued Groups with stable IDs and merges the session's
default Group tags with each draft's tags. If creation is interrupted, retrying
reuses an identical already-created ID and continues instead of duplicating it.
A conflicting record, failed image upload, or other Worker error leaves the
wizard recoverable and reports the failure instead of marking the session
complete.

After publishing, the session's Groups section manages those native Cloudflare
records and adds the full editing surface. The worker admin supplies the group
name, optional description and HTTPS image, tags, public HTTPS reference URLs,
an optional per-group member limit, an optional self-join deadline, group-admin
address, join mode, and visibility. The deadline closes participant self-join;
configured session admins can still manage membership. No SBT contract is
deployed, so there is no contract address, network transaction, gas payment, RPC
setting, or burn authorization.

Image input supports a direct HTTPS URL, clipboard paste, or local upload with
preview; uploaded files are published through the selected session storage
before the group record is created. Public, ungated sessions can render stored
group artwork before sign-in, while private-session storage reads keep using the
authenticated session credential.

The client pins the validated Worker origin, canonical slug, and canonical
session ID. Worker-canonical nonce/login requests, login responses, JWTs, Group
requests, Group responses, stored records, and the Durable Object coordinator
all carry or verify that same slug/session-ID pair. A failed, unreachable,
mismatched, stale, or empty Worker response never falls back to a generic Worker
cache, SBT discovery, or a global session scan.

A Worker/SBT hybrid still uses native Worker Groups for participation. Its
configured SBT conditions appear separately as **Advanced on-chain access
gates**, with chain/RPC requirements but no implied registry ownership. A
Worker/Lit hybrid likewise remains Worker-canonical while exposing only its
explicit Lit/RPC requirements. Registry-canonical sessions continue to use the
on-chain SBT group flow below.

The **Who can create groups** dropdown is in Participation for every hosting
model and is persisted as `groupCreationPolicy`:

- **Anyone in the session** is the new-session default. In Worker-native sessions,
  an authenticated participant with the `groups` scope can join or create an
  open, session-visible group without a wallet transaction. Participants can
  supply the same tags, reference URLs, member limit, and join deadline as an
  admin; the Worker generates the ID and records the signed participant address
  as the group administrator instead of trusting a submitted address. Session
  admins retain edit, delete, and membership controls. In
  registry-canonical sessions, the session's SBT creation UI remains available
  to participants.
- **Admins only** hides and rejects the session-bound creation path for other
  participants. Worker configs that omit the field get this fail-closed default.
  For on-chain sessions this is a Context Engine UX
  policy, not a factory-level access control: the deployed public SBT factory
  can still be called independently outside the session UI.

Group discovery is a separate privacy decision. A valid Worker-canonical mode
with public stored results, unencrypted Cloudflare storage, and no payload
access gate exposes only redacted, session-visible group metadata before
sign-in. Participant-, member-, or admin-visible results modes and any gated or
encrypted storage mode keep group discovery and results behind authentication,
regardless of who may create groups.

Ordinary pure-Worker session pages project that same chain-free contract
downstream. Account settings do not offer Ethereum, MetaMask, or testnet
controls; the session shell and Polis report do not show a network/blockchain;
Lit hooks, SBT auto-mint, and SBT question filters do not run; and the Document
Library accepts only Cloudflare references without exposing Arweave/Lit
controls. If navigation or live config changes from a chain-backed profile to a
pure Worker profile, stale auto-mint timers, stored targets, filter state,
network values, and non-Cloudflare document references are cleared or ignored
before the next operation.

Advanced chain-backed profiles add these controls:

- One or more SBT gates
- Gate mode: `Any` or `All`
- Default gate for the session
- Optional per-resource overrides (`ai`, `arweave`, `rpc`, `txGas`, `lit`, and other resource keys)
- Optional inline SBT creation if the required SBT does not exist yet

For those advanced profiles:

- If you created new SBT drafts in the wizard, publish can deploy them first through `SBTFactory.createSBT(...)` or its deterministic variant
- The final gate definitions are written on-chain through `SessionRegistry.setResourceGates(...)`
- Lit-encrypted metadata keeps references to the selected gate IDs, but gate authority itself remains on-chain in `SessionRegistry`

The standalone Create SBT (`/sbts/new`) and global Smart Contracts references
in Docs remain optional on-chain tools. Opening them from a Worker-native
session does not add them to that session's native Groups authority.

In the on-chain Group form, changing the image URL, choosing a local file,
clearing the image, or restoring a draft supersedes any earlier image request.
Late previews and errors cannot replace that choice or its saved image bytes.

### 3. Worker deploy and secrets

Every reachable hosting profile uses a Session Worker. For on-chain sessions it
handles AI, auth and Arweave uploads while the registry and Arweave remain
canonical. The deployment controls are in Hosting and storage, and both deploy
paths need a Cloudflare account.

On the default path you provide:

- a Cloudflare API token, which **Create** sends once to the deploy helper
- a key for each AI provider the selected models use

The dashboard handoff under More replaces the token with a Cloudflare dashboard
deployment. For it, the page generates the session slug, passkey-derived public
admin address, and independent Worker runtime secrets: two normally, plus a third
agent signing secret when Agent HTTP is selected. It provides a copy control for
each value, opens Cloudflare in a separate tab, and waits for you to return with
the resulting `workers.dev` URL. An eligible decentralized profile can instead
attach an existing compatible Worker. Advanced profiles may additionally expose
Arweave, Lit, RPC, faucet, or custom-provider inputs when their selected
capabilities actually require them.

Common combinations:

- Default session:
  - Cloudflare account, plus an API token or a verified dashboard-deployed Worker
  - one OpenAI API key for the default text and transcription models
- Worker/SBT hybrid:
  - Cloudflare account, AI provider key, and RPC
  - wallet and gas only when the wizard must create a new SBT
- Worker/Lit hybrid:
  - Cloudflare account, AI provider key, RPC, and Lit credential
- Decentralized session:
  - compatible Session Worker, Arweave JWK, RPC, wallet/registry transaction
    funding, AI provider key, and Lit credential only when Lit encryption is
    selected
- Session created from a sponsored bundle:
  - the profile's signing identity: passkey for a pure Worker session, or wallet
    plus passkey support for a registry session
  - session details
  - no manual worker-secret entry, as long as the bundle is deploy-ready

What happens during deploy:

- The deploy-helper calls Cloudflare’s Workers API
- For every first-party publish, it creates an isolated physical worker name by
  deriving a deterministic suffix from the publish generation's stable
  `deploymentRequestId`. A retry after a lost or gateway-shaped response reuses
  that ID and resumes or replays the same physical deployment instead of
  allocating another worker. Starting an explicit new generation produces a
  new deterministic identity; only legacy requests without an ID receive a
  random suffix.
- It fetches the account `workers.dev` subdomain and creates/changes it only when explicitly needed
- It returns the final worker URL
- The wizard auto-fills `corsWorkerUrl`
- The wizard signs the config with the selected profile's session admin account
  or wallet and persists it.
  Worker-canonical profiles must also verify public `/session-config` readback.
  Decentralized profiles instead require the signed `/admin/set-config` write
  to confirm acceptance; they do not turn the Worker into discovery authority.
  An initialized registry-canonical Worker cannot be reassigned to another
  session ID.
- A custom Worker is publish-ready only while that verified deployment still
  matches the selected Worker identity, the complete canonical session-mode
  profile, each effective AI provider/model assignment, and every required
  secret value. Changing any of them requires a new deploy/sync verification.
  Sponsored auto-deploy writes this verified tuple to the live publish runtime
  before its promise resolves, so the same publish attempt can consume it without
  depending on a React render. This proof is kept in memory only: secret values
  and secret verifiers are not written to the wizard cache. After a reload, the
  wizard may retain the safe public Lit runtime descriptor, but it must replay
  deployment/synchronization checks before a custom Worker becomes publish-ready
  again. A deploy-ready sponsored flow keeps its own readiness path.
- Worker config persistence captures one immutable draft/identity/secrets
  snapshot. After the signed write and the profile-appropriate verification
  (public canonical readback or decentralized signed-write acceptance), the
  wizard compares the live publish inputs and rebuilt config with that exact
  snapshot, then repeats that comparison immediately before writing settlement
  markers or clearing the cache. Any edit made before settlement stops the flow
  and leaves the draft intact for an explicit retry; an unchanged publish settles
  and clears only the captured verified session identity.
- For Lit profiles, an account key authorizes bootstrap but is not runtime
  readiness evidence. Publish stays blocked until the Worker has a usage key
  and the complete Lit runtime descriptor, and failed post-deploy synchronization
  retains enough local bootstrap authority for an exact retry.
- Cleanup deletes a failed deployment only when the deploy helper can prove the
  script still carries that deployment's ownership marker. It preserves
  pre-existing or ownership-ambiguous scripts and reports any orphaned resource.
- If a remote bundle is definitively rejected after stable resources were
  staged, the manual-file fallback reuses the same deployment request, Worker,
  and KV namespace. Only corrected bundle bytes may change; all non-bundle
  deployment fields stay bound, existing secret bindings are preserved, and
  the request remains recoverable until its terminal receipt is durable.
- The helper verifies its ownership marker after upload and stops before
  hostname and secret activation if ownership does not match.

When Agent Session Wrapped is selected, the same Session Worker serves it.
The helper creates an independent fresh managed root secret; the dashboard handoff adds
`AGENT_MANAGED_ROOT_SECRET` in Cloudflare. Setup verifies same-origin capability
readiness after saving canonical configuration. Admin enable/disable uses signed
session configuration without a deployment token.

Worker-canonical and registry sessions use their existing login/membership
gates. An unlocked workerless registry session must attach a compatible Worker;
a permanently locked one cannot. Wrapped member credentials are capped by
24 hours and source-JWT expiry, with source revocation and membership checked
on every request. Predictions use HTTPS/KV and remain separate from ordinary
responses. No resources, identities or invites from the retired Agent Bridge
are transferred.

What gets stored where:

| Store                              | Contents                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Worker KV `session:{slug}:config`  | canonical worker session identity/content plus public authority, storage, CORS, limits, and `appearance.colorSchemeId`; no credentials |
| Worker KV `session:{slug}:secrets` | OpenAI/Anthropic/OpenRouter keys, Arweave JWK, faucet private key, and other runtime secrets                      |
| Arweave metadata                   | decentralized/Arweave profiles only; includes `appearance.colorSchemeId`, never palettes or worker secrets         |
| `SessionRegistry`                  | decentralized/registry profiles only; skipped by `worker_canonical`                                               |

### 4. Registration and publish

When you click **Create session** with the default worker-canonical profile, after
your passkey confirms, the flow is:

1. Deploy the per-session worker if it is not already ready
2. Persist the sanitized, admin-signed canonical config to the session worker
3. Read it back and verify its identity, revision, authority, and worker URL
4. Surface reload-safe session and admin URLs containing the public HTTPS
   `worker` query parameter

There is no `uploadMetadata`, `registerSessionOnChain`, registry cache refresh,
or gas-funded transaction on this path. Decentralized and explicit
Arweave/registry profiles upload their metadata to Arweave, then run the on-chain
registration sequence:

1. `SessionRegistry.createSession(slug, sessionId, chainId, metadataURI, encryptedMetadataURI)`
2. `SessionRegistry.setSessionFields(...)`
3. `SessionRegistry.setResourceGates(...)`

What each write does:

- `createSession(...)`
  - stores the slug, session ID, chain ID, metadata URI, encrypted metadata URI, admin address, and timestamps
- `setSessionFields(...)`
  - stores lightweight string fields such as `corsWorkerUrl` and the sponsored capability flags
- `setResourceGates(...)`
  - stores the authoritative SBT gate config per resource

After success, the wizard generates:

- worker-canonical session URL:
  `/session/<slug>?worker=https%3A%2F%2F<worker-origin>`
- worker-canonical admin URL:
  `/admin?sessionId=<uuid>&sessionSlug=<slug>&worker=https%3A%2F%2F<worker-origin>`
- decentralized session URL: `/session/<slug>`
- decentralized admin URL:
  `/admin?sessionId=<uuid>&chainId=11155420`

## Worker Deployment Options

### Deploy helper with an API token (default)

This is the path `/new` shows first. **Create** sends the request-only Cloudflare
API token to the deploy helper, which creates the Worker, discovers its URL, and
seeds config automatically. The default helper is the project's, and its operator
can see the token, the keys sent with it, and the Worker secrets it generates. See
[API token setup and handling](session-cors-worker.md#api-token-setup-and-handling).

### Cloudflare dashboard handoff (no API token)

This path is under Hosting and storage → More. Lit profiles cannot use it.

High-level flow:

1. Generate setup values for a new Worker, or paste an existing compatible
   Worker URL when the selected decentralized profile is eligible for direct
   attachment.
2. Copy the session slug, public admin address, `TOKEN_HMAC_SECRET`, and
   `CE_STORAGE_ENVELOPE_KEK` with the adjacent copy controls.
3. Open the immutable Cloudflare deployment package, paste those values into
   Cloudflare, and complete the dashboard deployment.
4. Return to the still-open Context Engine tab and paste the resulting
   `workers.dev` URL.
5. Select `Verify Session Worker`. Context Engine checks Worker reachability,
   a non-empty CORS allowlist containing the current browser origin, and the
   exact session identity. CORS entries must be exact origins; wildcards are
   rejected. Registry-backed attachment also writes the selected public RPC
   URL/map and retries private secret delivery while the accepted config
   becomes visible.
   Worker-canonical profiles require public canonical-config readback;
   decentralized profiles require signed config acceptance while their EVM
   registry and Arweave records remain canonical. Registry attachment requires
   the connected signer, requested Worker admin, and on-chain session admin to
   match. The template deploys with `DEPLOY_HELPER_ENABLED` set to `"0"`, so
   when you generated setup values for this session slug and admin, the
   wizard records that the Worker you verify has no embedded deploy helper
   and `/sponsor` does not offer deploy grants from it. The wizard remembers
   that you generated them, but not the values, across reloads of this tab. An
   attached existing Worker without generated setup values keeps the draft's
   embedded deploy-helper setting, because no route reports the binding.

The runtime secrets remain in the current tab and Cloudflare's encrypted
Worker-secret store. They are not placed in the deployment URL, logs, analytics
payloads, or a Context Engine-controlled origin. There is no automatic callback
from Cloudflare, so keep the page's tab open and return to it manually.

The dashboard handoff supports unencrypted and Worker-envelope sessions, eligible
decentralized attachment, and optional on-chain SBT checks. Agent HTTP and Session
Wrapped work once the additional managed root secret is configured.

Reference: [session-cors-worker.md](session-cors-worker.md)

### Sponsored `/sponsor` handoff

Use this when one session admin wants to help someone else launch a session without manually sharing raw worker secrets.

Best fit:

- onboarding a collaborator who should not have to paste OpenAI / Arweave / faucet credentials by hand
- shortening the guided `/new` handoff for internal pilots
- preloading a worker deploy grant so the recipient does not need to enter a raw Cloudflare API token

What the recipient still needs:

- the signing identity required by the selected profile (passkey for a pure
  Worker session; wallet plus passkey support for a registry session)
- session name / slug / metadata choices
- enough publish authorization to complete the flow

Deep reference: see the `Sponsored bundle flow` section in [session-cors-worker.md](session-cors-worker.md).

### Self-hosted with Wrangler

Use this when you want to own the Cloudflare project directly and deploy the worker outside the helper flow.

Repo path:

- `workers/sessionCorsWorker/`

Minimal setup:

1. Install the worker dependencies:

   ```bash
   cd workers/sessionCorsWorker
   npm install
   ```

2. Create a `wrangler.toml` in that folder. The repo ships none for this worker, so create your own minimal config:

   ```toml
   name = "my-session-worker"
   main = "worker.js"
   compatibility_date = "2025-01-01"
   compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]

   [[kv_namespaces]]
   binding = "GROUP_KV"
   id = "<cloudflare-kv-namespace-id>"

   [durable_objects]
   bindings = [
     { name = "CE_SESSION_COORDINATOR", class_name = "SessionWriteCoordinator" },
   ]

   [[migrations]]
   tag = "ce-session-write-coordinator-v1"
   new_sqlite_classes = ["SessionWriteCoordinator"]

   [vars]
   DEFAULT_SESSION_SLUG = ""
   BOOTSTRAP_ADMIN_ADDRESS = "<public-admin-address-from-wizard>"
   CE_WORKER_GROUPS_BOOTSTRAP = "fresh-template-v2"
   CE_STORAGE_IN_GROUP_KV = "1"
   DEPLOY_HELPER_ENABLED = "false"
   ```

3. Add the two required secrets. Use independent, high-entropy values and do
   not commit them to `wrangler.toml`:

   ```bash
   npx wrangler secret put TOKEN_HMAC_SECRET
   npx wrangler secret put CE_STORAGE_ENVELOPE_KEK
   ```

4. Deploy:

   ```bash
   npx wrangler deploy
   ```

Operational notes:

- `GROUP_KV` is required. `CE_STORAGE_IN_GROUP_KV=1` keeps Cloudflare payloads in
  it; without that, bind `CE_STORAGE_INDEX_KV`
- Keep `CE_WORKER_GROUPS_BOOTSTRAP=fresh-template-v2` only when `GROUP_KV` is a
  new namespace, and remove it before attaching existing Group data. Without it
  or a deploy-helper proof, Group writes return 503
- `CE_SESSION_COORDINATOR` and the `ce-session-write-coordinator-v1` SQLite
  migration are required; signed config writes fail closed without them
- `TOKEN_HMAC_SECRET` and `CE_STORAGE_ENVELOPE_KEK` are separate required
  Worker secrets
- A new `/new` session must bind `BOOTSTRAP_ADMIN_ADDRESS` to the public admin
  address shown by the wizard before the first signed config write. Omit this
  binding only when an existing registry session and the Worker's configured
  registry/RPC can attest the exact session ID and that the signer and requested
  config admin are that session's on-chain admin.
- Leave `DEFAULT_SESSION_SLUG` empty for a multi-tenant worker, or set it to a specific session slug for a single-tenant worker
- After deploy, paste the resulting worker URL back into the wizard before publishing

If you also want helper-assisted deployments from your own wizard instance
later, separately self-host the deploy helper described in
[session-cors-worker.md](session-cors-worker.md).

### Manual Cloudflare dashboard upload

This is separate from the dashboard handoff above, which clones the checked-in
`deploy/cloudflare/session-worker/` template. A manual deploy uploads only a
generated Worker bundle. Use it when you want to avoid Wrangler and the Git
template.

Recommended source files:

- Bundled release asset: `https://github.com/AgalmicSoftware/context-engine/releases/download/worker-bundles-<commit>/sessionCorsWorker.bundle.js`. The hosted client uses the commit it was built from (Netlify's `COMMIT_REF`); local and self-hosted builds use the commit in `client/src/variables/workerReleasePin.json`
- Adjacent provenance manifest: `https://github.com/AgalmicSoftware/context-engine/releases/download/worker-bundles-<commit>/worker-release-manifest.json` (the deploy helper verifies its expected SHA-256 before Cloudflare mutation)
- Generated repo-local fallback bundle after `nvm use 20 && npm run worker:bundle`: `dist/sessionCorsWorker.bundle.js`
- Canonical worker source: `https://github.com/AgalmicSoftware/context-engine/tree/main/workers/sessionCorsWorker`

Dashboard checklist:

1. Create a new Worker in Cloudflare
2. Paste or upload the bundled worker source
3. Enable `nodejs_compat` and `global_fetch_strictly_public` compatibility flags
4. Add the `GROUP_KV` binding and the `CE_SESSION_COORDINATOR` Durable Object binding with its `ce-session-write-coordinator-v1` SQLite migration
5. Add `BOOTSTRAP_ADMIN_ADDRESS`, `CE_STORAGE_IN_GROUP_KV=1`, `CE_WORKER_GROUPS_BOOTSTRAP=fresh-template-v2` for a new namespace, and the secrets `TOKEN_HMAC_SECRET` and `CE_STORAGE_ENVELOPE_KEK`
6. Deploy the worker
7. Copy the worker base URL into the wizard or `/admin`

This is the most manual option, but it works if the helper path is unavailable.

## Post-Creation

### Verify the session on `/admin`

Open the admin URL generated by the wizard, or manually visit:

- worker canonical:
  `/admin?sessionId=<session-id>&sessionSlug=<slug>&worker=<encoded-https-worker-origin>`
- decentralized:
  `/admin?sessionId=<session-id>&chainId=11155420`

Confirm that `/admin` can resolve:

- session slug and session ID
- worker URL
- resource gates
- canonical name/content from Worker KV for `worker_canonical`
- metadata URI, registry chain/address, and sponsored flags for decentralized
  sessions

### Manage Agent Session Wrapped

Compatible worker-canonical and registry-canonical sessions show an Agent
Session Wrapped panel in `/admin`. **Enable Wrapped** and **Disable access** save
signed session configuration and need no Cloudflare token. `Check health` verifies
the recorded protocol, session slug, access bit, and pinned session-Worker origin.
Disabling access retains deployed resources and publishes `enabled: false`.

### Test worker health

Use the `Worker Tests` panel in `/admin` to run:

- `/health`
- AI test
- Arweave upload test when the selected profile uses Arweave
- transcription test
- faucet test on on-chain registry sessions

If `/health` or the other worker calls fail with browser network errors, use the `/admin` CORS allowlist editor (`Add recommended origins`, then `Save allowlist`) and test again.

### Edit a session

An admin edits a session at `/session/<slug>/settings`, whether it is
Worker-hosted or on chain; the **Edit settings** link on `/admin` opens it. The
page reuses the setup sections. The slug, session
ID, Worker URL and hosting are shown as fixed facts, not inputs, and so are an
on-chain session's registry network, registry admin and metadata URI. Before
saving, it lists which edits sign participants out (authority changes such as
who can create groups or access rules) and which do not (content such as the
name or prompts), using the same classifier as the Worker, and the button reads
**Save and sign participants out** when any authority edit is pending. **Copy
group recorder link** copies the session link with `?mode=groupRecording`. If
the Worker's copy of the settings arrives while you are typing, your edits are
kept on top of it.

Besides the setup fields, the page edits:

- **Questions:** the question list's default filters (a JSON object, or a query
  such as `tag=housing`), whether the pile moves on after an answer, and the
  highlighted and hidden question and survey IDs, one per line (up to 500 in
  each list). These lists keep everyone signed in. Like AI below, they are
  read-only on an older Session Worker, which refuses them.
- **AI:** the provider, the everyday and thinking models, reasoning effort, the
  effort for single tasks, and the transcription model. A saved model that setup
  no longer offers stays selected until you pick another. The page edits AI
  only when the Session Worker says its `set-config` merges `ai`; on an older
  Worker the section is read-only and says why.
- **Access**, where SBTs grant access: SBT tags, featured SBTs, and whether the
  session's own SBTs are featured.
- **On-chain sessions only:** the contracts, the block range, the test ETH
  faucet amounts and the featured and ignored SBT lists. The faucet's key stays
  a Worker secret, changed in Admin.

A Worker-hosted session saves the changed fields the Worker accepts for
`set-config`, signed by your passkey. An on-chain session saves new metadata,
showing each step as it runs and the transaction link at the end:

1. check that the wallet is the registry admin's and is on the registry network
   the page names, before anything is paid for;
2. upload the new metadata to Arweave;
3. update the SessionRegistry from that wallet (the encrypted metadata URI is
   kept);
4. update this browser's copy of the registry entry;
5. sync the session's Worker with `set-config`. A failed sync is reported on its
   own, since the on-chain update still stands, and **Retry the Worker sync**
   sends the same sync again without saving on chain again.

Saving needs a start block, and it is refused while the page shows contract
addresses it took from chain defaults because the metadata could not be read,
until you correct or confirm them. An on-chain session's questions are added on
its session page, not from a template here.

### Read feedback about the app

A session page whose Session Worker is on 0.9.8 or later has a **Feedback**
button in the page's footer. It opens a short form where anyone, signed in or
not, can say what worked in the app and what didn't; the session's admins read
it. It is about the app, not the session's subject: nothing sent is part of
anyone's answers, Results, AI views, the Session Agent's reading or any export.

Where the session pays for AI, a microphone beside the box writes speech down
into it, as on an answer: the audio goes through the session's Worker to its AI
provider on the session's AI allowance and limits, and is not kept. The words
can be edited before **Send**, and count against the limit.

Each message is up to 2,000 characters of plain text. With it go the part of the
page that was open (never the page's address, which can carry invites), the
theme, whether the screen was a phone, tablet or desktop, and the app's and the
Worker's releases. Nothing names the sender; the admins see only whether they
were signed in.

A full admin reads the messages under **Feedback** on the session's settings
page: **Show messages**, **Download CSV**, and **Delete** for one message or all
those listed. The **Feedback box** setting there, on by default, takes the button off
the session page; changing it signs no one out.

### Templates and share links

**Export** downloads the draft as a `ce.session-template/v1` JSON file;
**Import** takes an uploaded file or pasted JSON. A template carries only
portable fields: names, prompts, questions, the session mode profile, context
text and its URLs. It never carries keys, tokens, files or deployment
identifiers, and unknown fields are rejected. Before an import is used, the page
lists every field it would change.

**Copy share link** puts the draft in a `/new#template=` link. Someone who
opens it sees **This draft came from a link** and the differences from their
own draft before anything is used; after they accept, the button becomes
**Copy link with my changes** so the draft can travel back. A draft too long for
an 8,000-character link offers the `.json` download instead. On the settings
page, an imported template keeps the session's own hosting.

Two link forms carry a template in the URL fragment, which the browser never
sends to a server:

- `/new#template=<data>`: share links. The compact JSON is deflated
  (`deflate-raw`), then written as base64url.
- `/new#setup=<data>`: links an AI writes. The JSON's UTF-8 bytes are written
  as unpadded base64url, without compression, because an AI can't deflate.

The page reads both the same way, through the decoder that participant prefill
links also use. Spaces, line breaks and `=` padding, as wrapped chat links
have, are ignored. Data that isn't UTF-8 is refused, never repaired. A link cut
off when it was copied says so, a damaged one says what is wrong, and either
suggests pasting the template's JSON under **Import** instead. A template with
an unknown field, a value of the wrong type, or text that looks like a key is
refused, and the notice names each field. The page removes `#template=` and
`#setup=` from the address bar as soon as it reads them, so a reload or a
copied address doesn't carry the draft again; the notice keeps it until you
answer.

### Set up with your AI

**Set up with your AI**, at the top of `/new`, gives you a prompt for ChatGPT,
Claude or another AI. **Copy prompt** copies it. **Open in ChatGPT** and **Open
in Claude** open a new chat with it, and copy it too in case the site doesn't
fill it in; **Show prompt** shows it to copy by hand. Like the participants'
prefill prompt, it is your own request, and anything the AI reads is data, not
instructions.

The AI interviews you about the goal and who will take part, the topics and any
questions you already have, how people take part (the web page, their own AI,
or a voice interview), who sees the results, timing, and links to read. It then
returns a `ce.session-template/v1` template with only the fields the prompt
lists, each with its allowed values: the name, description, end time, context,
questions, the question-generation prompt, who may create groups, and the
interview switch and prompts. It leaves out models, AI providers, hosting,
sign-in, encryption and anything secret, so the page's defaults apply, and you
add keys on the page, never in the chat. Who sees results and encryption are
set on the page; the AI tells you which options to pick.

The AI returns one of two things:

- **A link**, when it can run code and the compact JSON is at most 6,000
  characters: `/new#setup=...`, about 8,000 characters at most.
- **The JSON**, otherwise, to paste under **Import** → **Or paste it**, then
  **Check**. A salon-sized template, with 28 questions, context links and
  interview prompts, is about 10,000 characters of JSON: about 13,400
  characters as a `#setup=` link and 5,300 as a `#template=` share link, so the
  AI gives the JSON.

Either way, the page lists what the template would change before anything is
used. Nothing is created until you review the page, add the keys your hosting
needs, press **Create** and confirm with your passkey.

### Add questions

Once the session exists, you can start populating it:

- use the session's settings page (`/session/<slug>/settings`) to change its
  defaults and the question-generation prompt
- add questions or surveys through the normal authoring flow for that session
- use the AI audio generator flow if you want AI-assisted question generation

When questions/surveys are published:

- worker-canonical sessions store active question/survey payload resources in
  Cloudflare worker storage
- decentralized sessions keep the existing Arweave payload and `Surveys`
  contract registration flow

Participant responses follow the same authority boundary. For a
worker-canonical session, the client keeps the verified session config through
submission, uploads response resources to that session's dedicated Worker, and
returns the durable Cloudflare storage references without sending an EVM
transaction. Chain-backed profiles submit answers on-chain through
`Surveys.submitResponses`, a wallet transaction.

On reload, the client paginates the dedicated Worker's `questions`, `surveys`,
and `responses` indexes and hydrates the stable `worker` cache scope. Question
and survey payloads must repeat the exact canonical slug and session ID before
they enter the cache; mismatched rows are isolated. Response rows are keyed by
responder metadata that the Worker bound to the authenticated uploader, so a
response payload cannot claim another participant's address. These reads use
the current passkey context when the storage policy is authenticated. A Worker
read, auth, or pagination failure remains a retryable Worker error and never
falls through to registry discovery. Workers deployed before trusted responder
metadata was added must be upgraded before their newly stored rows can
participate in fresh-browser response hydration.

For payload examples, see [arweave-payloads.md](arweave-payloads.md).

### Measure how well AI represents participants

A session can measure how well people's own AI assistants predict their
answers ([agent-fidelity.md](agent-fidelity.md)):

1. Turn on **Measure how well AI represents participants** at the top of the
   setup page's Interview settings (Participation), or later on the session's
   settings page. It turns on research sharing by default, hides 1 in 5 of each
   person's AI-prefill drafts until they answer, and shows people their score.
   AI prefill needs voice interviews, which are on by default; the switch also
   turns them back on if they were off. These settings need a
   Session Worker newer than 0.8.0.
2. Before anyone answers, write down the primary measure
   ([Fix the plan before looking](agent-fidelity.md#fix-the-plan-before-looking)).
3. Share the session link with `?mode=voice`. It opens the microphone's
   chooser with **Let your AI draft your answers**: people copy its prompt
   into ChatGPT or Claude, open the link it returns, and review the drafts
   before submitting.
4. After submitting, each person sees how well their AI predicted them,
   whether or not they share their draft changes; by default this private
   score is the session's only fidelity result. Results, the command-line
   report and hidden drafts use only people who keep research sharing on. To
   show everyone's results together too, turn on **Show “How well AIs
   predicted people” in Results**: the section appears once responses include
   AI-prefill drafts from 5 people. **Smallest group shown in “How well AIs
   predicted people”**, under that switch, changes the number, and **Off**
   shows every figure, even one person's, so use it only where everyone knows
   small groups' figures are visible. For the full analysis, download **JSON:
   Questions + Responses** from Results and run
   `node scripts/agent-fidelity-report.mjs --export results.json --out reports/`,
   adding `--min-participants <n>` if the session changed its smallest group.

### Share the session URL

The public entry point is:

`/session/<slug>?worker=<encoded-https-worker-origin>` for worker-canonical
sessions, or `/session/<slug>` for registry-discovered decentralized sessions.

Keep the `worker` query parameter in copied worker-canonical links. A fresh
browser uses it only to locate `GET /session-config`; it is not an authorization
credential. The client rejects unsafe production targets (non-HTTPS origins,
URL credentials, paths, and private-network hosts), binds the worker origin to
the exact slug/session identity, and prompts before replacing a conflicting
trust-on-first-use pin.

### Normal links on the hosted site

The hosted site opens a session from a normal link, `/session/<slug>` with no
`worker=`, only when the repo's `known-sessions.json` lists it. Each entry says
where the session's Worker is:

```json
{
  "<slug>": {
    "worker": "https://<worker-origin>",
    "sessionId": "0x<32 hex digits>",
    "name": "<session name>"
  }
}
```

- `worker` is the Worker's HTTPS origin, with no path or trailing slash.
- `sessionId` is the ID the Worker reports: `0x` and 32 lowercase hex digits.
  The session opens only when the Worker's verified config carries this ID.
- `name` is optional; the Worker's config supplies every setting.

Add the entry with a pull request. Normal links work once it's on `main` and the
site has deployed; until then, share the `worker=` link. Any other session opens
only from its `worker=` link, except the site's built-in demos, such as
`demo-interview`, which open from the demo data bundled with the site. The site
also serves the file at `/known-sessions.json`, so agents can find a session's
Worker from its slug.

The file lists EDDY 2026 (`eddy26`), the demo session (`demo-sh`), the Reverse
Alignment salon (`rxc-ra-26`) and `rxc-ra-test-5`. The About page's **Demo**
button opens `rxc-ra-test-5`, and the films, stills, promo slides and writeup
carry its link. Delete its entry only once those links switch to `rxc-ra-26`'s
and the button opens another listed session. A listed session that also has
demo data in `demo_sessions.json`, as `demo-sh` does, keeps that data; the list
sets only its Worker, its session ID and its normal link.

## Troubleshooting

### Worker deploy fails

For the dashboard handoff, check these first:

- the selected Cloudflare account owns the newly deployed Worker
- the account has an active `workers.dev` subdomain
- all displayed setup values were copied into the matching Cloudflare fields
- the returned URL is the HTTPS `workers.dev` origin, without a path
- the Worker allows the current Context Engine browser origin

If deployment succeeds but verification fails:

- re-open `/admin`
- verify or restore the Worker URL
- use the Worker Tests panel to confirm `/health`
- confirm the canonical config slug and public admin identity match the wizard

For the API token path, also verify that the request-only Cloudflare API token
has permission to manage Workers scripts and KV and that it can see exactly one
account.

Hosted Worker verification writes and reads back the prepared public
configuration without finalizing publication. You can edit and verify again;
**Create** writes the final publication revision. Verifying an edited session
description preserves existing sign-ins; authority changes still revoke them.

Edits replace what an earlier verification stored: a blank end time is sent as
`""` and blank request limits as `null`, so a cleared value does not stay on the
Worker. Blank instructions for AI agents are sent as `""` only when the Worker's
config already has the field, which a Worker from before it refuses; the browser
reads the config first. If that read fails, nothing is signed or saved, so you
can try again. The browser compares the shared public fields, including session
appearance and the Worker URL's origin. It skips fields the Worker sets itself:
the authorization epoch, the publication marker, the response field encryption
it reports on every read, and, before publication, a revision the deploy helper
staged. If verification fails, the wizard shows the reason: the Worker's error
for a rejected write, or where the read-back config differs, naming the fields
it lacks or adds.

Retrying queued Group creation compares canonical HTTPS image and document URLs,
so a host-only URL and the same URL with a trailing slash reuse the saved Group.

The wizard restores custom allowed origins from its tab-scoped draft after reload, including an explicitly empty field. Drafts without a saved origins field use the normal defaults.

### Questions are not loading

The two most common causes are bad scan bounds and a missing `Surveys` contract reference.

These checks apply to chain-scanned profiles. A verified worker-canonical
session obtains its questions from its dedicated Worker and does not require
`blockLimits.start` or a `Surveys` contract.

Check:

- `blockLimits.start` in session metadata
- `contracts.surveys.address`
- `contracts.surveys.chainId`

Why this matters:

- the app uses `blockLimits.start` to decide where question and survey discovery begins
- question creation later fails if the session does not have a valid `Surveys` contract address

### Auth issues

Check both CORS and SIWE assumptions:

- `allowOrigins` must be non-empty and include the exact browser origin you are using; `*` and wildcard hosts are unsupported, while an empty list means open CORS at runtime and is rejected by native `/new` verification
- the SIWE message's `domain` must match the host in its own `uri`, that `uri` must
  have the browser's origin, and its resources must name this Worker and session
- the active passkey-derived EOA or connected wallet must match the configured
  session admin for signed admin actions
- Worker-canonical discovery must resolve one validated HTTPS Worker origin,
  slug, and canonical session ID; an old `worker` query hint is not authority
  after canonical config discovery

Typical symptoms:

- `Failed to fetch` or `Load failed` from worker auth endpoints usually means the origin is missing from `allowOrigins`
- `SIWE domain does not match URI host.` means the signed message's `domain` differs from the host of its own `uri`. `SIWE uri origin does not match request Origin.` means its `uri` isn't the page's origin, and `Signed login resources do not match this Worker and session.` means it was signed for another Worker or session. Signed admin actions report audience errors instead, such as `Admin audience does not match request origin.`

### Default AI models

New sessions use `gpt-6.1-terra` for everyday tasks such as tagging and drafts,
and `gpt-6.1-sol` for harder ones such as analysis and Interview response mapping,
with low reasoning effort. Interview mapping asks for medium effort, which the
Worker allows unless the session sets an effort for that task. New sessions
transcribe with `gpt-transcribe`; group recordings label speakers with
`gpt-4o-transcribe-diarize`, which OpenAI shuts down on 2027-02-26 and has
named no replacement for. Transcription models after `whisper-1` can stop short
on long audio, so uploads to them go in pieces of at most five minutes. OpenAI
requests use standard processing (`service_tier: default`) unless a caller
explicitly selects another tier. GPT-Live voice settings are separate.

Setup offers `gpt-6.1-terra`, `gpt-6-luna`, `gpt-6.1-sol` and `gpt-6-astra` from
OpenAI, and the Claude 5.5 models and Claude Fable 5.1 from Anthropic. The
account presets are GPT-6.1 Terra and Sol (the default), GPT-6 Astra, Claude
Sonnet 5.5 and Claude Opus 5.5; a saved preset follows its current models, and a
removed one falls back to the default.

Existing sessions keep the models they store. A session that stores none names
no model in its requests, so its Worker chooses: `gpt-6.1-terra` for both lanes
from 0.9.0, and `gpt-5.6-terra` on earlier Workers. Bundled demos without their
own Worker use these defaults; a demo with its own Worker keeps the models it
stores.

Claude 5 models, Claude Opus 4.5 or later and Claude Sonnet 4.6 or later get the
reasoning effort and any JSON schema; older Claude models get neither and follow
the answer format the prompt describes. A Claude refusal or empty answer comes
back as an error.

### Sharing questions

Question links preserve their source session: `?session=general` pins General,
and `?session=<session-slug>` pins a named session. Bookmarks, result links, and
copied question URLs retain that pin even when another session is selected.
A question URL without a session hint still discovers its session from the
available caches and then records the resolved session in the URL.

### Exploring group tags

Click a tag in a session’s SBT or worker-group details to open the tag explorer
without leaving the session. The originating session is preselected; you can
change it using the dropdown in the top-right of the modal, or compare additional tags. **Open tag page** opens the
full explorer with the selected session included as `?session=<session-slug>`
(`?session=general` for General). Ctrl/Cmd-click on a tag opens its session-scoped
link directly.

### Question pile controls

The question pile’s microphone button sits beside the question-actions menu on
small screens and remains directly visible in the desktop toolbar. It opens the
voice-mode chooser when the session supports voice features, or resumes an
unfinished interview. Its idle appearance matches the adjacent controls; an
interview in progress keeps the microphone emphasized even after closing the
modal.

Closing stops audio capture and retains the transcript and review edits on the
current page. Reopen to continue, submit, or explicitly discard the interview.
Reloading or leaving the page clears this in-memory interview; closing does not
submit responses. Importing a different prefill packet starts a new review,
while reopening the same packet retains review edits.

At narrow phone widths (480px and below) the layout adjusts as follows; wider
views retain their existing typography, button sizes, and answer layout.

- Submit and Clear stay beside the menu and microphone. Submit and its pending
  count retain full-size text.

- When the controls need more width, the navigation arrows wrap onto a
  right-aligned row below, with extra vertical space separating them from Clear.
  On that row the arrows closely frame a horizontal question counter (for
  example, **5 / 50**), which only stacks when it needs to fit into a shared
  control row.

- Question cards keep the same height across question types and prompt lengths,
  so the navigation stays in place. Long prompts use the space left by each
  answer type and shrink only when they overflow, down to the normal body-text
  size. Longer text remains scrollable.

- Binary choices use their original larger sizing when the full-size prompt and
  controls fit; otherwise they share one compact row. Rating sliders sit at the
  card's vertical center when the prompt and footer leave enough room.
  Multichoice options use two rows with horizontal scrolling.

Above 768px, the navigation arrows and question-action icons form one evenly
spaced vertical rail alongside the full card height, with the question counter
between the two arrows.

The compact question-actions menu labels its controls **Filter questions**,
**Add questions**, and **All questions**. Opening it blurs the page behind it;
selecting an action, clicking outside, or pressing Escape dismisses the menu.

In the expanded question-card rating controls, Conviction and Importance each
show their value directly beside the label. For quadratic questions, these
expanded controls sit below the centered option-scroll arrows.

### Group drafts and tag suggestions

Participant Group drafts remain attached to the session ID, slug and Worker URL.
Configuration refreshes preserve edited fields. New default tags update only an
untouched tags field; changing session identity starts a fresh draft.

Changing the signed-in account or credential during Group creation releases
the busy state and keeps the draft. A superseded request cannot apply its result
or clear the busy state of a newer request.

AI tag suggestions belong to the question ID, text and request generation that
started them. Removing or editing that question discards its pending result and
releases its busy state; moving another row cannot redirect tags or add a row.
