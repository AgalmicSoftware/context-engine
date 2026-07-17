# Surveys + Questions Cache Structure

See [`docs/cache/README.md`](README.md) for the shared backend, key format, and
managed-namespace behavior.

This doc covers the two session-scoped content caches:

- `surveysCache` -> `dg:surveysCache:<slug>`
- `questionsCache` -> `dg:questionsCache:<slug>`

`<slug>` is the canonical session slug (`demo_sessions.json`, registry slug, or `""`
for the general session).

Network keys inside these cache values are always strings such as `"84532"`.

## `surveysCache`

Per-network shape:

```jsonc
{
  "84532": {
    "surveysLatestBlock": 21346115,
    "surveys": {
      "0xsurveyid": {
        "surveyID": "0xsurveyid",
        "title": "AI Safety Survey",
        "questionIDs": ["0xq1", "0xq2"],
        "creator": "0xcreator",
        "sessionName": "Edge 2025",
        "groupName": "",
        "sessionSlug": "edge",
        "sessionSlugExplicit": true
      }
    },
    "surveyResponses": {
      "0xsurveyid": {
        "0xresponder": {
          "surveyID": "0xsurveyid",
          "responder": "0xresponder",
          "timeStamp": 1733934624299,
          "responses": []
        }
      }
    },
    "surveyResponsesLatestBlock": {
      "0xsurveyid": 21346115
    },
    "pendingSurveyMetadata": {
      "0xsurveyid": {
        "attempts": 2,
        "nextRetryAtMs": 1763769305000,
        "creationBlock": 21340000,
        "state": "transient",
        "lastStatus": 404,
        "message": "Arweave content not available yet. Retry later."
      }
    }
  }
}
```

Semantics:

- `surveysLatestBlock`: watermark for survey discovery for that session+network
- `surveyResponsesLatestBlock[surveyId]`: per-survey response watermark
- `surveys[surveyId]`: hydrated survey payloads
- `surveys[surveyId].sessionSlugExplicit`: `true` when metadata authoritatively declared the session slug; `false` when the cache derived a slug from legacy name mapping or rebucketed unresolved metadata to general
- `surveyResponses[surveyId][responder]`: latest known response payload for a survey responder
- `pendingSurveyMetadata[surveyId]`: retry/backoff state for survey metadata that failed to hydrate from Arweave
- Survey discovery and `SurveyAdded` event commits merge only the surveys,
  pending-metadata entries, and watermark produced by the active scan or event
  into the latest snapshot. Unrelated surveys, responses, and retry entries are
  retained, and discovery watermarks never move backward.
- Targeted survey-response refreshes atomically merge only the fetched responder delta into the
  latest managed-cache snapshot. Trusted newer chain positions win same-responder conflicts;
  older or equal positions stay unchanged. Unorderable concurrent values are preserved and leave
  the frontier retryable. The client publishes its response revision only after the write succeeds.
- Initial response hydration follows the same responder-recency and contiguous-
  frontier rules. Cache readiness and response revisions are published only
  after the corresponding managed-cache write succeeds.

`pendingSurveyMetadata` entries may contain:

- `attempts`
- `nextRetryAtMs`
- `creationBlock`
- `state`
- `lastStatus`
- `message`

## `questionsCache`

Per-network shape:

```jsonc
{
  "84532": {
    "questionsLatestBlock": 21079000,
    "questionsDiscoveryCheckpointBlock": 21070000,
    "questions": {
      "0xquestionid": {
        "id": "0xquestionid",
        "type": "multichoice",
        "prompt": "Which approaches are most effective?",
        "options": ["Option A", "Option B"],
        "singleSelect": false,
        "associatedSurveyId": "0xsurveyid",
        "creator": "0xcreator",
        "sessionName": "Edge 2025",
        "groupName": "",
        "sessionSlug": "edge",
        "sessionSlugExplicit": true,
        "arweaveTxId": "Vqw8D5USJYcEQ6e4nEzbvej78ZKiCXkmRnAYeR5qlyU",
        "storageRef": {
          "backend": "arweave",
          "id": "Vqw8D5USJYcEQ6e4nEzbvej78ZKiCXkmRnAYeR5qlyU",
          "uri": "ar://Vqw8D5USJYcEQ6e4nEzbvej78ZKiCXkmRnAYeR5qlyU",
          "resource": "questions"
        }
      }
    },
    "questionResponses": {
      "0xquestionid": {
        "0xresponder": {
          "type": "multichoice",
          "answer": { "value": ["Option A"], "encrypted": false }
        }
      }
    },
    "questionResponsesLatestBlock": 21079000,
    "questionResponsesMeta": {
      "0xquestionid": {
        "0xresponder": { "bn": 32567890, "txi": 1, "li": 3, "ts": 1733934624299 }
      }
    },
    "pendingQuestionMetadata": {
      "0xquestionid": {
        "attempts": 2,
        "nextRetryAtMs": 1763769305000,
        "state": "transient",
        "lastStatus": 404,
        "message": "Arweave content not available yet. Retry later."
      },
      "0xresponseonlyquestionid": {
        "attempts": 0,
        "nextRetryAtMs": 0,
        "state": "discovered-from-response",
        "lastStatus": null,
        "message": "Question response discovered before question metadata; awaiting Arweave hydration."
      }
    },
    "arweaveTxCache": {
      "Vqw8D5USJYcEQ6e4nEzbvej78ZKiCXkmRnAYeR5qlyU": {
        "text": "{\"id\":\"0xquestionid\",\"prompt\":\"Which approaches are most effective?\"}",
        "savedAtMs": 1763769201000
      }
    },
    "arweaveTxFailureCache": {
      "missing-or-invalid-tx-id": {
        "attempts": 7,
        "firstFailedAtMs": 1763769203000,
        "lastFailedAtMs": 1763769803000,
        "nextRetryAtMs": 1763769863000,
        "lastStatus": 404,
        "state": "transient",
        "message": "Arweave content not available yet. Retry later."
      }
    },
    "questionHydrationMeta": {}
  }
}
```

Semantics:

- `questionsLatestBlock`: stable completed discovery watermark
- `questionsDiscoveryCheckpointBlock`: in-progress checkpoint used for resume-after-refresh behavior
- `questions[qid].sessionSlugExplicit`: `true` when metadata authoritatively declared the session slug; `false` when the cache derived a slug from legacy name mapping or rebucketed unresolved metadata to general
- `questions[qid].__ceQuestionMetadataPending`: temporary placeholder marker used when a response has been discovered before its question metadata has hydrated
- `questionResponsesLatestBlock`: response watermark for the session+network
- `questionResponsesMeta[qid][responder]`: recency guard used to reject stale response payload writes
- `pendingQuestionMetadata[qid]`: retry/backoff state for question metadata hydration failures and response-discovered metadata gaps
- `arweaveTxCache[txId]`: cached raw Arweave payload text
- `arweaveTxFailureCache[txId]`: bounded negative cache for failed Arweave fetches
- `questionHydrationMeta`: reserved per-question hydration metadata map
- Question discovery, encrypted-metadata refresh, response hydration, and
  `QuestionsAdded`/`ResponsesSubmitted` events merge their active field deltas
  into the latest snapshot. Concurrent question metadata, response recency,
  pending retries, Arweave caches, and unrelated network branches are retained.
- A completed discovery pass clears `questionsDiscoveryCheckpointBlock` while
  monotonically advancing `questionsLatestBlock`; a partial or failed pass keeps
  its retryable frontier. Readiness and UI revisions are published only after
  persistence succeeds.

## Important normalization rules

- Question and survey ids are stored lowercase.
- Responder addresses are stored lowercase.
- Session-scoped hydration only keeps question/survey metadata in a non-general cache bucket when metadata authoritatively binds to that session, or when legacy `sessionName`/`groupName` maps there. Unresolved metadata is re-bucketed to the general (`""`) session with `sessionSlugExplicit: false`.
- `questionResponses` values may be hydrated objects or legacy JSON strings; readers must tolerate both.
- `questionResponsesMeta` entries are compared by `(bn, txi, li, ts)` recency before overwriting cached responses.
- `questionsDiscoveryCheckpointBlock` is cleared after a successful completed discovery pass and merged into
  `questionsLatestBlock`.

## Arweave retry behavior

Question/survey metadata hydration uses two layers of retry state:

- persistent per-session cache entries (`pendingQuestionMetadata`, `pendingSurveyMetadata`, `arweaveTxFailureCache`)
- an in-memory tx-level cooldown memo inside the Arweave helpers

Important consequences:

- successful payload reads clear prior failure-cache entries for the same `txId`
- prolonged 404/missing-tx behavior is classified into terminal cooldown states instead of hammering gateways
- question discovery can resume after refresh using `questionsDiscoveryCheckpointBlock`

## LocalStorage-only readiness flags

These are documented centrally in [`docs/cache/README.md`](README.md):

- `dg:cacheHasLoaded:<slug>`
- `dg:sbt:partialReady:<slug>`
- `dg:sbt:deferredFullScanNeeded:<slug>`
- `dg:sbt:fullScanInProgress:<slug>`
