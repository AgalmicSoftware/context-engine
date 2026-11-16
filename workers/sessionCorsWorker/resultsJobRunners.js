// How the session's coordinator runs each kind of results job (resultsJobs.js):
// the same build the admin's request ran before, now with the coordinator's
// own stores in place of calls back to it.
import { buildDebateAtlas } from './debateAtlasBuild.js';
import { generateResultsAnalysisDraft } from './resultsAnalysisGeneration.js';
import { dispatchResultsBuildStore } from './resultsBuildStore.js';
import { buildRiskMatrix } from './riskMatrixBuild.js';

// The build store as callBuildStore answers it, called in the coordinator.
const storeCall = (coordinator, kind) => async (_env, _slug, operation, payload = {}) => {
  const response = await dispatchResultsBuildStore(coordinator, kind, operation, payload);
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body?.ok === true, status: response.status, body };
};

const configOf = async (coordinator, slug) => (await coordinator.readCurrentSessionConfig(slug))?.config || null;

const resultsBuildRunner = (kind, build) => ({
  run: async ({ coordinator, job }) => {
    const store = storeCall(coordinator, kind);
    // A build run again restarts its lease, which may have run out while the first stopped.
    const touched = await store(null, job.slug, 'touch', { attemptId: job.attemptId });
    if (!touched.ok) {
      // The stopped run may have kept its build before it could say so.
      const kept = (await store(null, job.slug, 'read', {})).body?.builds?.[0];
      if (kept && Date.parse(kept.builtAt) >= job.startedAtMs) return { ok: true, status: 200, buildId: kept.id };
      return { ok: false, status: touched.status || 409, error: touched.body?.error || 'This build is no longer current.' };
    }
    const config = await configOf(coordinator, job.slug);
    if (!config) {
      await store(null, job.slug, 'finalize', { attemptId: job.attemptId });
      return { ok: false, status: 404, error: 'Session config not found.' };
    }
    const result = await build({
      env: coordinator.env,
      slug: job.slug,
      config,
      body: job.input?.body || {},
      headers: {},
      builderAddress: job.input?.builder,
      attemptId: job.attemptId,
      deps: { now: coordinator.now, callBuildStore: store },
    });
    return { ...result, buildId: result?.build?.id };
  },
  abandon: ({ coordinator, job }) => storeCall(coordinator, kind)(null, job.slug, 'finalize', { attemptId: job.attemptId }),
});

const aiViewsDeps = (coordinator, slug) => ({
  now: coordinator.now,
  getSessionConfig: () => configOf(coordinator, slug),
  readCoordinatedResultsAnalysisStatus: async () => ({ ok: true, state: await coordinator.readResultsAnalysisStatus() }),
  reserveCoordinatedResultsAnalysis: async ({ reservation } = {}) => coordinator.reserveResultsAnalysis(reservation || {}),
  finalizeCoordinatedResultsAnalysis: async ({ finalization } = {}) => coordinator.finalizeResultsAnalysis(finalization || {}),
});

export const RESULTS_JOB_RUNNERS = Object.freeze({
  'ai-views': {
    run: async ({ coordinator, job }) => {
      const body = job.input?.body || {};
      // A request run again first gives back the reservation its stopped run left.
      if (job.runs > 1) await coordinator.releaseResultsAnalysisRequest(body.requestId);
      const config = await configOf(coordinator, job.slug);
      if (!config) return { ok: false, status: 404, error: 'Session config not found.' };
      const result = await generateResultsAnalysisDraft({
        env: coordinator.env,
        slug: job.slug,
        config,
        body,
        trigger: 'manual',
        deps: aiViewsDeps(coordinator, job.slug),
      });
      // A press that joined this job finds the draft under this request's id.
      return { ...result, requestId: body.requestId };
    },
    abandon: ({ coordinator, job }) => coordinator.releaseResultsAnalysisRequest(job.input?.body?.requestId, {
      status: 503,
      error: 'The build stopped before it finished. Press again to start a new one.',
    }),
  },
  // Called through, so the build modules, which import the coordinator's, load first.
  'debate-atlas': resultsBuildRunner('debate-atlas', (args) => buildDebateAtlas(args)),
  'risk-matrix': resultsBuildRunner('risk-matrix', (args) => buildRiskMatrix(args)),
});
