# Doc Library (Sessions + SBT Groups)

This feature adds a shared Doc Library backed by Arweave transactions indexed via tags. Documents can be:
- plaintext (`arweave` storage), or
- encrypted Arweave envelope payloads (`lit-arweave` storage), where decrypt access is either private to the uploader's self-recipient wallet signature or gated by SBT ownership conditions.

Docs can be associated with:
- a **Session** (discoverability by `sessionIdHex`), and/or
- an **SBT Group** (discoverability by `chainId + sbtAddress`).

## UI Surfaces

- Session docs page: `/session/:token/docs`
  - `:token` may be a session slug or a UUID-like session id token.
  - When `:token` is a session id, the app keeps the URL stable (no rewrite to slug) on this subroute.
- Tool Explorer `Data` panel:
  - `Add` keeps the existing question-generation ingest flow.
  - In `Add`, manual ingest creates questions through `Generate Questions`; the older direct `Add to Library` action is not shown in this surface.
  - When one or more files/images are uploaded in `Add`, a title field appears at the top of the ingest surface and is reused as the doc title / filename when possible.
  - Files and images share a single upload control in `Add`; image paste stays in the shared compact chooser, the main `Add URL` field is the only URL entry path, and queued images render previews before question generation or context save.
  - In `Add`, typed or queued extra URL/file/photo sources can optionally be saved into session context on `Generate Questions`.
  - Saved Tool Explorer sources are written as encrypted session docs with an audience of either `only me` or the session `docUploads` gate when that gate exists. The closed UI shows this audience behind a lock icon. `only me` uses the local `self-eip712-v1` recipient envelope and does not require Lit hooks; the session audience uses the Chipotle/Lit SBT-gated path.
  - When the save option is enabled, generated surveys store doc-library viewer URLs for those saved extra sources instead of the raw source URLs.
  - `View` defaults to the sample demo corpus viewer used on `/session/demo` when demo surfaces are enabled.
  - The demo corpus viewer keeps its Context title and corpus actions on one compact desktop header row, then renders each source in a medium-native form: tweets as social posts, policy as a map/list split, papers as academic summaries, LessWrong as argument essays, interviews as transcript cards, sci-fi as book/timeline cards, metrics as charts, and cross-corpus debates as linked source networks.
  - The local `Demo corpus` checkbox starts checked in demo-enabled mode; unchecking it switches the panel to the real session Doc Library when a session context is available.
  - When demo surfaces are disabled globally, `View` opens directly to the real session Doc Library or its empty state, and the local demo toggle is hidden.
  - In `View`, the session Doc Library is browse-only: upload/link entry controls stay in `Add`.
  - Image docs render inline thumbnails in the browse list, and opening them still shows the full preview/download viewer.
- SBT detail page: `SBTPage` shows a “Docs” section for the current SBT group.

## Storage Provider Abstraction (Per Session)

Session metadata can select a backend-owned session storage profile. This is storage routing for session payloads, not a user preference/profile setting.

```json
{
  "storageProfile": {
    "type": "session_storage_profile",
    "version": "session-storage-profile-v1",
    "backend": "arweave",
    "resources": {
      "docsContext": "active",
      "questions": "staged",
      "surveys": "staged",
      "responses": "staged",
      "generatedArtifacts": "staged",
      "media": "staged"
    }
  },
  "docLibrary": {
    "provider": "arweave",
    "arweave": { "index": "graphql", "graphqlUrl": "https://permagate.io/graphql" }
  }
}
```

Defaults:
- If missing, `storageProfile.backend` defaults to `arweave`; worker storage routes also accept legacy `docLibrary.provider = "cloudflare"` as a Cloudflare routing signal when no storage profile backend is present.
- `lit-arweave` remains available and represents encrypted Arweave envelope payloads. Selecting it for session docs forces encrypted Doc Library uploads.
- `cloudflare` routes plaintext session docs/context through the session worker `/storage/*` routes and keeps Cloudflare object identifiers private. Lit-encrypted Cloudflare document upload/read is intentionally blocked until the encrypted-envelope path is implemented.
- `ipfs` and `local` `docLibrary.provider` values remain stubbed (UI disables list/upload with a “not implemented” notice).

Storage records normalize to:

```json
{
  "storageRef": {
    "backend": "arweave",
    "id": "<opaque-id-or-arweave-tx-id>",
    "uri": "ar://<tx-id>",
    "contentType": "application/json",
    "encrypted": false,
    "gate": "docUploads",
    "resource": "docsContext",
    "createdAt": "2026-05-08T00:00:00.000Z"
  },
  "arweaveTxId": "<legacy-compatible-tx-id>"
}
```

Cloudflare `storageRef` values must stay opaque: do not expose account IDs, bucket names, raw R2 object keys, worker tokens, long-lived signed URLs, or secrets.

Note: GraphQL here refers to Arweave’s public indexing API. The client now prefers `https://permagate.io/graphql`, then falls back to `https://g8way.io/graphql`, and only then to `https://arweave.net/graphql`, so a single flaky gateway does not blank the Arweave/Lit-Arweave Doc Library.

## Tag Schema (Arweave Index)

All doc-library uploads add Arweave tags with `CE-` prefix.

Common:
- `CE-DocLibrary`: `"1"`
- `CE-DocKind`: `"file"` or `"link"`
- `CE-DocStorage`: `"arweave"`, `"lit-arweave"`, or `"cloudflare"`

Plaintext-only optional metadata:
- `CE-DocName`: human label / filename
- `CE-DocMime`: mime type (best-effort)
- `CE-DocSize`: byte size (best-effort)

Session association:
- `CE-SessionId`: `"<sessionIdHex>"` (example: `0x…` 32 hex chars)

SBT group association:
- `CE-SbtChainId`: `"<chainId>"`
- `CE-SbtAddress`: `"<0x… lowercase>"`

A single upload may include both the session tag and the SBT tags so it appears in both libraries.

## Listing (Arweave GraphQL)

Arweave and Lit-Arweave listing is client-side via Arweave GraphQL:

- Session docs query:
  - `CE-DocLibrary=1 AND CE-SessionId=<sessionIdHex>`
- Group docs query:
  - `CE-DocLibrary=1 AND CE-SbtChainId=<chainId> AND CE-SbtAddress=<addr>`

The client paginates via cursors and inserts newly uploaded txIds optimistically (to hide indexing lag).

Cloudflare listing is session-scoped and worker-mediated via `GET /storage/list?resource=docsContext`. Each request returns at most 100 raw index rows before per-item authorization filtering, plus an opaque `cursor` and `listComplete`. A filtered page can therefore contain no visible items and still require continuation; the document library keeps **Load more** available for that cursor and labels the page as having no accessible documents instead of silently draining later pages. Returned items carry safe `storageRef` objects and tag-like metadata; raw R2 keys and bucket/account identifiers are not returned to the browser.

## Encryption UX Rules (No Gate Fallback)

Session docs are indexed by `sessionIdHex`.

For the main Doc Library panel, encryption is based on SBT conditions:

- If SessionRegistry’s `docUploads` gate has at least one SBT address:
  - upload defaults to **Locked (Encrypted)** using that gate’s SBT set (Any/All).
  - Lit contract-gated access conditions use the gate’s configured EVM chain; OP Sepolia is the default E2E target, not a Lit limitation.
- If the `docUploads` gate is empty or unavailable:
  - upload defaults to **Unlocked (Plaintext)**.
  - users can still encrypt by selecting **Custom SBT(s)** manually.
- There is no fallback to any “general” docUploads gate when `docUploads` is missing/unavailable.

For Tool Explorer `Data -> Add` saved extra sources:
- saves are always encrypted
- the audience can be `only me` or the session `docUploads` gate
- `only me` wraps the content encryption key with the existing `self-eip712-v1` recipient, so private saves can upload and reopen with the connected wallet without Lit/Chipotle hooks
- the session `docUploads` audience stays on the Chipotle/Lit SBT-gated recipient path
- when the session `docUploads` gate is unavailable, Tool Explorer falls back to `only me`

## “Add URL” Link Records

The UI supports adding a URL without uploading remote content. It stores a small JSON “link record” on Arweave:
- plaintext or Lit-encrypted (same Lock toggle)
- indexed via the same tags (`CE-DocKind=link`)

This keeps the design open for intranet, IPFS, or local backends where content is not stored on Arweave.

## Inline Viewing

After decrypt (or for plaintext), the viewer supports:
- `image/*` inline (`<img>`)
- `application/pdf` inline (`<iframe>`)
- `audio/*` inline (`<audio controls>`)
- `video/*` inline (`<video controls>`)
- `text/*` / JSON inline (`<pre>`)
- fallback: download link

For Lit-encrypted payloads that decode to a blob, the viewer provides “Download decrypted file”.
