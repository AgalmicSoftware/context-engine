# Doc Library (Sessions + SBT Groups)

This feature adds a shared Doc Library backed by Arweave transactions indexed via tags. Documents can be:
- plaintext (`arweave` storage), or
- Lit-encrypted (`lit-arweave` storage), where decrypt access is gated by SBT ownership conditions.

Docs can be associated with:
- a **Session** (discoverability by `sessionIdHex`), and/or
- an **SBT Group** (discoverability by `chainId + sbtAddress`).

## UI Surfaces

- Session docs page: `/session/:token/docs`
  - `:token` may be a session slug or a UUID-like session id token.
  - When `:token` is a session id, the app keeps the URL stable (no rewrite to slug) on this subroute.
- Tool Explorer `Data` panel:
  - `Add` keeps the existing question-generation ingest flow.
  - In `Add`, queued extra URL/file sources can optionally be saved into the session Doc Library on `Generate Questions`.
  - Saved Tool Explorer sources are written as Lit-encrypted session docs with an audience of either `only me` or the session `docUploads` gate when that gate exists.
  - When the save option is enabled, generated surveys store doc-library viewer URLs for those saved extra sources instead of the raw source URLs.
  - `View` defaults to the sample demo corpus viewer used on `/session/demo` when demo surfaces are enabled.
  - The local `Demo corpus` checkbox starts checked in demo-enabled mode; unchecking it switches the panel to the real session Doc Library when a session context is available.
  - When demo surfaces are disabled globally, `View` opens directly to the real session Doc Library or its empty state, and the local demo toggle is hidden.
- SBT detail page: `SBTPage` shows a “Docs” section for the current SBT group.

## Storage Provider Abstraction (Per Session)

Session metadata may include a non-authoritative `docLibrary` config:

```json
{
  "docLibrary": {
    "provider": "arweave",
    "arweave": { "index": "graphql", "graphqlUrl": "https://arweave.net/graphql" },
    "ipfs": {},
    "local": {}
  }
}
```

Defaults:
- If missing, provider defaults to `arweave`.
- `ipfs` and `local` providers are currently stubbed (UI disables list/upload with a “not implemented” notice).

Note: GraphQL here refers to Arweave’s public indexing API (`https://arweave.net/graphql`). It is not something the session worker needs to run; the client queries it directly.

## Tag Schema (Arweave Index)

All doc-library uploads add Arweave tags with `CE-` prefix.

Common:
- `CE-DocLibrary`: `"1"`
- `CE-DocKind`: `"file"` or `"link"`
- `CE-DocStorage`: `"arweave"` or `"lit-arweave"`

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

Listing is client-side via Arweave GraphQL:

- Session docs query:
  - `CE-DocLibrary=1 AND CE-SessionId=<sessionIdHex>`
- Group docs query:
  - `CE-DocLibrary=1 AND CE-SbtChainId=<chainId> AND CE-SbtAddress=<addr>`

The client paginates via cursors and inserts newly uploaded txIds optimistically (to hide indexing lag).

## Encryption UX Rules (No Gate Fallback)

Session docs are indexed by `sessionIdHex`.

For the main Doc Library panel, encryption is based on SBT conditions:

- If SessionRegistry’s `docUploads` gate has at least one SBT address:
  - upload defaults to **Locked (Encrypted)** using that gate’s SBT set (Any/All).
- If the `docUploads` gate is empty or unavailable:
  - upload defaults to **Unlocked (Plaintext)**.
  - users can still encrypt by selecting **Custom SBT(s)** manually.
- There is no fallback to any “general” docUploads gate when `docUploads` is missing/unavailable.

For Tool Explorer `Data -> Add` saved extra sources:
- saves are always encrypted
- the audience can be `only me` or the session `docUploads` gate
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
