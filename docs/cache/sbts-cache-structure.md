# SBT Cache Structure

See [`docs/cache/README.md`](README.md) for the shared backend, key format, and
managed-namespace behavior.

The SBT cache namespace is:

- `sbtCache` -> `dg:sbtCache:<slug>`

`<slug>` is the canonical session slug (`""` for the general session).

Network keys inside cache values are strings such as `"84532"`.

## Per-network shape

```jsonc
{
  "84532": {
    "lastBlock": 32562007,
    "sbtList": {
      "0xd417c701cf8ef4282cb62bfbf047b338b2f4feb8": {
        "sbtAddress": "0xd417C701Cf8ef4282CB62bFBf047B338b2f4FeB8",
        "slug": "edge",
        "creationBlock": 32560000,
        "blockNumber": 32562007,
        "sbtInfo": {
          "name": "Edge Group",
          "description": "Membership for Edge 2025",
          "image": "https://arweave.net/TxIdEdgeExample",
          "tokenURI": "https://arweave.net/TxIdEdgeExample",
          "admin": "0x1234567890abcdef1234567890abcdef12345678",
          "maxTokens": "10000",
          "mintingEndTime": 1767225600,
          "hasPasswordMint": true,
          "burnAuth": 1,
          "chainID": 84532,
          "creator": "0x1234567890abcdef1234567890abcdef12345678",
          "network": "Base Sepolia",
          "sessionSlug": "edge",
          "sessionName": "Edge 2025",
          "groupName": "Edge 2025",
        },
        "mintedAddresses": [
          "0xabc0000000000000000000000000000000000abc",
          "0xdef0000000000000000000000000000000000def",
        ],
        "burnedAddresses": [],
        "mintedCountByAddress": {
          "0xabc0000000000000000000000000000000000abc": 1,
          "0xdef0000000000000000000000000000000000def": 1,
        },
        "burnedCountByAddress": {},
        "mintedEventCount": 2,
        "burnedEventCount": 0,
        "historySummary": {
          "totalMinted": "2",
          "totalBurned": "0",
          "activeSupply": "2",
          "currentHolderCount": "2",
          "historicalHolderCount": "2",
        },
        "countsScanCheckpoint": {
          "phase": "activity",
          "blockNumber": 32562007,
          "scanStartBlock": 32560000,
          "scanToBlock": 32562007,
          "mintedCountByAddress": {
            "0xabc0000000000000000000000000000000000abc": 1,
            "0xdef0000000000000000000000000000000000def": 1,
          },
          "burnedCountByAddress": {},
          "mintedEventCount": 2,
          "burnedEventCount": 0,
        },
      },
    },
  },
}
```

## Field semantics

- `lastBlock`: session+network SBT discovery watermark
- `sbtList[addressLower]`: one entry per SBT contract
- `slug`: cache/source bucket slug for the entry
- `creationBlock`: best-known SBT creation block
- `blockNumber`: last block at which that entry was refreshed or updated
- `sbtInfo`: merged tokenURI/on-chain metadata
- `mintedAddresses` / `burnedAddresses`: convenience sets materialized as arrays
- `mintedCountByAddress` / `burnedCountByAddress`: authoritative holder-count source for newer cache consumers
- `mintedEventCount` / `burnedEventCount`: total event counts observed for that contract
- `historySummary`: compressed count-only snapshot sourced from `getHistorySummary()` or derived from a full `SBTActivity` scan
- `countsScanCheckpoint`: resumable single-pass `SBTActivity` checkpoint for holders-modal/history reads

## `sbtInfo` expectations

The cache may contain many optional tokenURI fields, but the current code most strongly
depends on:

- `name`
- `description`
- `image`
- `tokenURI`
- `admin`
- `maxTokens`
- `mintingEndTime`
- `hasPasswordMint`
- `burnAuth`
- `chainID`
- `creator`
- `documentURLs` (canonical document/source links; readers normalize legacy
  aliases such as `docURL`, `docURLs`, `documentUrl`, and `documents[].href`)

Session-linking fields may also appear:

- `sessionSlug` (preferred)
- `sessionName`
- `groupName` (legacy-compatible alias)

Concrete session-scoped UI should treat `sbtInfo.sessionSlug` as the authoritative link
when it is explicit, and may fall back to supported legacy metadata fields (`slug`,
`groupSlug`, or legacy session-name mapping). The cache bucket `slug` by itself is not
authoritative for concrete session membership.

## Holder-count behavior

Modern code prefers the count maps:

- `mintedCountByAddress`
- `burnedCountByAddress`

When only counts are needed, newer reads can also use:

- `historySummary.totalMinted`
- `historySummary.totalBurned`
- `historySummary.activeSupply`
- `historySummary.currentHolderCount`
- `historySummary.historicalHolderCount`

The address arrays remain useful for compatibility and convenience, but `CommunityTab`
and other newer reads can backfill or recompute count maps when they are missing in
older caches.

## General-session key examples

The default/general session uses an empty slug:

```text
dg:sbtCache:
```

Other examples:

```text
dg:sbtCache:edge
dg:sbtCache:test-10
```

## Password and invite recovery

SBT password/invite recovery is intentionally separate from the managed SBT
metadata cache above:

- Export/download is the only durable recovery path.
- Optional recovery keeps codes in module memory for the current mounted tab.
  Reloading, closing, or leaving the authoring surface clears them.
- Codes are never written to localStorage, sessionStorage, IndexedDB, URLs, or
  copied claim links.
- On load, compatibility cleanup removes the retired
  `ce:sbtPasswordRecovery:v1` and `ce:sbtPasswordRecovery:v2` storage entries
  and requests deletion of the old `ce-sbt-password-recovery-keys` IndexedDB
  database. Retired values are not imported into memory.

Pending CREATE2 SBT drafts follow the same rule because they contain claim and
deployment secrets. The wizard holds them only in mounted tab memory and purges
the retired `ce:sessionWizardPendingSbtDrafts:v1` entry. A reload requires the
user to recreate the pending SBT draft.

## LocalStorage-only readiness flags

These are documented centrally in [`docs/cache/README.md`](README.md):

- `dg:cacheHasLoaded:<slug>`
- `dg:sbt:partialReady:<slug>`
- `dg:sbt:deferredFullScanNeeded:<slug>`
- `dg:sbt:fullScanInProgress:<slug>`
