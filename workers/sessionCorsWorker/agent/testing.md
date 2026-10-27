# Agent runtime regression coverage

Run `npm run test:worker:agent` (the historical `test:worker:agent-bridge`
command is an alias) and `npm run test:worker:session-cors` from the repository
root. Tests execute the canonical Session Worker entry point, in-process
services and coordinator, plus retained pure-domain fixtures.

The table identifies retained scenarios, not assertion-for-assertion parity with
the former Bridge suites. Paths without
a prefix below are relative to `workers/sessionCorsWorker/`.

| Former Bridge suites | Maintained coverage |
| --- | --- |
| `agentHttp`, `agentHttpSurface`, `worker`, `agentTransportRemoval`, `agentQuestionCreateScope` | `agentRequestBoundary.test.mjs`, `agentRoutes.test.mjs`: route/method rejection before effects, CORS, signed admin, scoped credentials, disabled surface, typed hosted participation |
| `agentClientLogin.worker`, `sessionWorkerAuthority`, `sessionPolicyIdentity` | `agentRequestBoundary.test.mjs`: same-origin exchange, identity/audience/source expiry/revocation, participant access; client `agentClientLogin.test.ts` |
| `agentInviteRedemptionCoordinator` | `agentRequestBoundary.test.mjs`: concurrent single winner, independent journals, lost finalization and missing coordinator |
| `agentSessionRuntime`, `agentApprovedAnswers`, `agentRatingRecovery`, `ratingScaleSubmit`, `sessionQuestions` | `agentRequestBoundary.test.mjs`, `agentReviewRegression.test.mjs`, `agentQueue.test.mjs`: current question schema, saved approval, canonical hosted writes, current read gates, incomplete pagination |
| `agentGroups`, `agentOnlyMode`, `agentQuestionProposals` | `agentRoutes.test.mjs`, `agentRequestBoundary.test.mjs`: scoped auxiliary groups, visibility, proposals/votes and explicit approval |
| `agentSubmitQueue`, `submitQueueRecovery` | `agentQueue.test.mjs`: duplicate delivery, retries, publication loss, ambiguous effects, persistence-only recovery, authorization changes |
| `managedSigner`, `onChainResponses` | `agentSigning.test.mjs`, `agentReviewRegression.test.mjs`: deterministic fresh identities, ethers v6 transaction signing, final authorization, RPC failures and redaction |
| `sessionPolicy`, `sessionPolicyLoader`, `registrySessions` | `agentRequestBoundary.test.mjs`, `agentRoutes.test.mjs`, `agentReviewRegression.test.mjs`: canonical-only policy, bounded registry source pages, current per-payload authorization |
| `wrappedQuestionSource`, `skillVersionLinks` | `agentRoutes.test.mjs`, `agentReviewRegression.test.mjs`: scoped current links and statements, historical answer wording and current visibility filtering, predictions and exports |
| `agentSessionWrappedDeployment`, `deployHelperApply`, `deployHelperPlan` | `tests/root/deployHelper.worker.test.js`, `sponsoredBootstrapRedeemDispatch.test.mjs`: one application Worker, fresh secret, retry preservation, obsolete bundle pins ignored |
| `runtimePrimitives` | `agentAi.test.mjs`, `agentStorage.test.mjs`, retained domain tests: bounded fetch/body deadlines, response limits, scoped namespace/cursors |
| `agentAnswerSchema`, `agentOnlyConcurrentVotes`, `agentQuestionNumbers`, `agentSettings`, `agentTopicMap`, `draftProvenance`, `kvReadHelpers`, `opaqueActions`, `quadraticAllocation`, `questionScaleCache`, `questionTypeAliases`, `ratingScaleParity`, `ratingScaleSteps`, `resultImage` | Named test files under `agent/` retain the applicable domain behavior |

`agentAuthorizationRegression.test.mjs`, `agentAuthorityRecheck.test.mjs` and
`agentMembershipRegression.test.mjs` exercise scope denial, service login,
recommend-only auto-apply denial, stale epochs/origins, gate loss and canonical
membership minimums through the dispatcher. Membership cases include callers
with no group, a small group and an unrelated larger group, then admission and
removal from a qualifying group. Signed operator writes bind `httpMethod` and
ignore query inputs. Registry RPC tests cover stalled bodies and size limits.

`agentStoragePreflight.test.mjs` covers ended sessions, withdrawn scopes and
rate limits. `agentSubmissionDurability.test.mjs` covers post-effect authority
changes, direct/queued pre-send retry, independent instances sharing the
coordinator, admission and outcome projection failures, a KV mock enforcing one write per key
per second, alarm repair after restart, retained upload IDs, server timestamps,
invalid direct/queued payloads, queued-success projection repair and its unavailable-recovery case, exact replay after question edits, and skipped
submissions. `agentDataIntegrity.test.mjs` covers exact saved wording/schema after question edits,
stale statement versions, readers with different visibility, no shared writes
from member reads, rejection of the removed window route, config/answer/vote KV
read failures, the explicit 2,000-proposal cap and forged export cursors. The
same suite covers source switches and secondary-source outages, changed retry
content after partial publication, coordinator restart, one-write-per-second
KV enforcement, and concurrent batches preserving both answer summaries.
`agentQueue.test.mjs` checks that unexpected processing failures remain queued.
The Wrapped coordinator journal also participates in the empty-restore-target check.
The revocation tests first assert a successful real statement read, then exact 401
source-revoked and 403 membership-denied results. Client native verification tests carry the capability
through the saved draft into Admin; deploy tests reject foreign origins.
The helper test also exercises a not-ready capability and recovery without
allocating another Worker.

Additional coverage includes `agentBackup.test.mjs` and
`sessionBackup.test.mjs` for credential/invite/key exclusion and empty-target
restore (including an occupied agent target through signed HTTP); `workerCapabilities.test.mjs` for optional-resource readiness; client
native setup/admin tests and `scripts/agent-token-client-login-smoke.js` for
verified one-origin setup, memory-only login, questions and explicit submission.

Retired behavior is deliberately not preserved: Bridge deployment/probing,
root/environment-global credentials or policy, compatibility route aliases,
Telegram/Mini App adapters, scheduled transport work, weekly Wrapped windows,
window snapshots/opening actions, and legacy state import.
The historical `workers/agentBridgeWorker/PUBLIC_RELEASE_CUTOVER` marker remains
only for public-history export safeguards; it is not a deployment target.
