# User Cache Structure

See [`docs/cache/README.md`](README.md) for the shared backend, key format, and
managed-namespace behavior.

The user cache namespace is:

- `userCache` -> `dg:userCache:<slug>`

This cache is written during profile deep scans and then read back by `UserPage` and
related profile views.

Top-level keys are lowercase wallet addresses.
Second-level keys are chain ids stored as strings such as `"84532"`.

## Per-user / per-chain shape

```jsonc
{
  "0x1234567890abcdef1234567890abcdef12345678": {
    "84532": {
      "lastBlockScanned": 18450000,
      "lastScanTimestamp": 1700000000,
      "scanIncomplete": false,
      "sbtLastBlockScanned": 18450000,
      "sbtScanIncomplete": false,
      "sbtBackfillComplete": true,
      "data": {
        "sbts": [
          {
            "sbtAddress": "0xSbtAddress",
            "slug": "edge",
            "blockNumber": 18449000,
            "creationBlock": 18400000,
            "sbtInfo": { "name": "Edge Group" },
            "mintedCountByAddress": {
              "0x1234567890abcdef1234567890abcdef12345678": 1
            },
            "burnedCountByAddress": {}
          }
        ],
        "createdSurveys": [
          {
            "id": "0xsurveyid",
            "data": { "title": "Survey title", "questionIDs": ["0xq1"] }
          }
        ],
        "createdQuestions": [
          {
            "id": "0xquestionid",
            "data": { "prompt": "Question prompt", "type": "freeform" }
          }
        ],
        "surveyResponses": [
          {
            "surveyId": "0xsurveyid",
            "responder": "0x1234567890abcdef1234567890abcdef12345678",
            "response": { "responses": [] },
            "blockNumber": 18450000,
            "transactionIndex": 2,
            "logIndex": 9,
            "timestamp": 1700000000
          }
        ],
        "questionResponses": [
          {
            "questionId": "0xquestionid",
            "responder": "0x1234567890abcdef1234567890abcdef12345678",
            "response": { "answer": { "value": "Example" } },
            "blockNumber": 18450000,
            "transactionIndex": 2,
            "logIndex": 10,
            "timestamp": 1700000000
          }
        ]
      }
    }
  }
}
```

## Field semantics

- `lastBlockScanned`: activity watermark for surveys/questions/responses
- `lastScanTimestamp`: last completed scan timestamp for that address+chain bucket
- `scanIncomplete`: marks activity results as uncertain/incomplete
- `sbtLastBlockScanned`: independent SBT watermark
- `sbtScanIncomplete`: marks SBT discovery as uncertain/incomplete
- `sbtBackfillComplete`: whether SBT history has been fully backfilled from the session start block
- `data`: aggregated payloads found for that user within the session slug represented by the outer cache key

## Array item shapes

`data.sbts[]`

- derived from the SBT cache / on-chain reads
- may include `slug`, `creationBlock`, `blockNumber`, `sbtInfo`, `mintedCountByAddress`, `burnedCountByAddress`

`data.createdSurveys[]`

- `{ id, data }`
- `data` is the hydrated survey payload object

`data.createdQuestions[]`

- `{ id, data }`
- `data` is the hydrated question payload object

`data.surveyResponses[]`

- `{ surveyId, responder, response, blockNumber?, transactionIndex?, logIndex?, timestamp? }`

`data.questionResponses[]`

- `{ questionId, responder, response, blockNumber?, transactionIndex?, logIndex?, timestamp? }`

The recency fields are used when merging profile data back into live question-response views.

## Important runtime behavior

- One `userCache` object exists per session slug, so profile pages aggregate across multiple
  `dg:userCache:<slug>` keys.
- Survey, question, and response cache hydration update only the data arrays and activity
  watermarks they produce. Atomic merges retain independent profile/SBT scan flags and
  unrelated data arrays from the latest user-cache snapshot.
- `UserPage` can fall back across chain buckets when the active chain bucket is missing but
  another cached chain bucket for the same address contains data.
- List-scope profile scans can keep `attemptedSlugs` scoped while still allowing off-list SBT fanout,
  so the presence of SBT data in a bucket does not always mean full activity fanout also ran for that slug.

## Key examples

```text
dg:userCache:
dg:userCache:edge
dg:userCache:test-10
```
