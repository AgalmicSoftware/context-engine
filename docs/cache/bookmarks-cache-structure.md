# Unified Bookmarks Cache Structure (`bookmarksCache`)

See [`docs/cache/README.md`](README.md) for the shared backend, key format, and
managed-namespace behavior.

The `bookmarksCache` namespace is stored under logical keys `dg:bookmarksCache:<slug>`.

Writes/reads go through `client/src/utilities/cache/cacheScripts.ts`:

- Primary backend: IndexedDB (`idb-keyval`) in `ce_cache_v1 / ce_cache_entries_v1`
- In-memory mirror provides synchronous reads
- IndexedDB fallback uses localStorage under the same logical key

When parsed, each cache value has the following top-level shape (arrays may be empty):

```json
{
  "surveys": ["0xSurveyId1", "0xSurveyId2"],
  "questions": ["0xQuestionId1", "0xQuestionId2"],
  "sbts": ["0xSbtAddress1", "0xSbtAddress2"],
  "users": [
    "0xUserAddressLegacyString",
    {
      "address": "0xabc123abc123abc123abc123abc123abc123abcd",
      "nickname": "Alice",
      "username": "alice.base",
      "networkId": "8453"
    },
    {
      "address": "0xdef456def456def456def456def456def456def0",
      "username": "bob",
      "networkId": "84532"
    }
  ],
  "filters": ["serializedFilterString1", "serializedFilterString2"]
}
```

## Fields

- `surveys`: Array of survey IDs (strings).
- `questions`: Array of question IDs (strings).
- `sbts`: Array of SBT contract addresses (strings).
- `users`: Mixed array supporting two compatible entry shapes:
  - String (legacy): an Ethereum address, e.g., `"0xUserAddress1"`.
    - Case may vary; consumers must compare addresses case-insensitively.
  - Object (new): `{ address, nickname?, username?, networkId? }`.
    - `address` (string, required): the user's address, stored lowercased.
    - `nickname` (string, optional): user-provided label.
    - `username` (string, optional): on-chain or app username if available.
    - `networkId` (string, optional): chain/network identifier (e.g., `"8453"`, `"84532"`).
- `filters`: Array of serialized filter strings (reserved/optional).

## Notes and compatibility

- Readers must handle both `users` entry shapes without mutating them.
- When writing new object entries, store `address` in lowercase; legacy string entries may retain original case.
- Unknown fields on object entries should be ignored for forward compatibility.
- Malformed entries should be safely ignored (do not crash parsers).
- A convenient UI label can be derived as: `nickname || username || shortened(address)`.
- The default empty cache shape is:

```json
{ "surveys": [], "questions": [], "sbts": [], "users": [], "filters": [] }
```

## Related keys

- `dg:bookmarksCache:<slug>`: Group-scoped bookmarks namespace (managed by cacheScripts)
- `dg:filters:<slug>`: Filter namespace (includes migrated `questionFilterState_questions`, `questionFilterState_results`, `bookmarkedFilters`)
- `bookmarks`: Legacy SBT bookmarks store, shaped as `{ "sbts": [] }`
- `bookmarkedNodes`: Debate map node IDs

The `/bookmarks` page aggregates across `bookmarksCache` and `filters` namespaces, plus legacy fallback keys where present.
