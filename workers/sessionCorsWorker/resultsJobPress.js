// An admin's press of a results build, in the Worker: it starts the build as a
// job in the session's coordinator (resultsJobs.js), or joins the one running,
// and answers when the job finishes while the page is still waiting. If the
// page drops, the job carries on and keeps its build; the next read finds it.
import { generateResultsAnalysisDraft } from './resultsAnalysisGeneration.js';
import { resultsBuildRefusal, resultsBuildReserveFailure } from './resultsBuild.js';
import { RESULTS_BUILD_KINDS } from './resultsBuildStore.js';
import { awaitResultsJob } from './resultsJobs.js';
import { callSessionConfigCoordinator } from './sessionConfigAuthority.js';

// A build's own deadline is 4 minutes, and an AI Views call's 8.
export const RESULTS_BUILD_WAIT_MS = 5 * 60 * 1000;
export const RESULTS_ANALYSIS_WAIT_MS = 9 * 60 * 1000;

const trim = (value) => (typeof value === 'string' ? value.trim() : '');
const lower = (value) => trim(value).toLowerCase();

const jobCall = ({ env, slug, kind, deps }) => deps?.callResultsJob
  ? (operation, payload) => deps.callResultsJob(kind, operation, payload)
  : (operation, payload) => callSessionConfigCoordinator({ env, slug, path: `results-job/${operation}`, kind, ...payload });

const waitFor = ({ env, slug, kind, input, waitMs, deps }) => awaitResultsJob({
  call: jobCall({ env, slug, kind, deps }),
  input,
  waitMs,
  ...(deps?.now ? { now: deps.now } : {}),
  ...(deps?.wait ? { wait: deps.wait } : {}),
});

/** An atlas or risk matrix press: the build, its failure, or that it is still being built. */
export const pressResultsBuild = async ({ env, slug, kindName, config, body = {}, builderAddress, deps = {} } = {}) => {
  const kind = RESULTS_BUILD_KINDS[kindName];
  const refusal = resultsBuildRefusal(kindName, config, body);
  if (refusal) return refusal;
  const waited = await waitFor({
    env, slug, kind: kindName, deps, waitMs: RESULTS_BUILD_WAIT_MS,
    input: { builder: lower(builderAddress), body: { source: { kind: 'worker-canonical' } } },
  });
  if (!waited.ok) return resultsBuildReserveFailure(kindName, waited);
  const { job } = waited;
  if (job?.state !== 'done') {
    // The site shows the running build and checks back for it, as for anyone else's.
    return {
      ok: false,
      status: 409,
      reason: kind.running,
      error: `${kind.aName} is still being built for this session. It appears here when it finishes.`,
      active: { startedAtMs: job?.startedAtMs },
    };
  }
  const { outcome } = job;
  if (!outcome?.ok) return { ok: false, status: outcome?.status || 500, error: outcome?.error || `The ${kind.name} build failed.` };
  const read = deps.callBuildStore
    ? await deps.callBuildStore(env, slug, 'read', { id: outcome.buildId })
    : await callSessionConfigCoordinator({ env, slug, path: `${kindName}/read`, id: outcome.buildId });
  if (!read.ok || !read.body?.build) {
    return { ok: false, status: read.status || 503, error: `The ${kind.name} was built and kept; reload to see it.` };
  }
  return { ok: true, status: 200, build: read.body.build };
};

/**
 * An AI Views press from the responses the Worker stores: the same reply the
 * request gave when it ran the build itself, or 202 while the job runs, which
 * the site follows on the status route.
 */
export const pressResultsAnalysis = async ({ env, slug, config, body = {}, headers, deps = {} } = {}) => {
  const requestId = trim(body.requestId || body.id) || `manual:${globalThis.crypto.randomUUID()}`;
  const jobBody = {
    requestId,
    refresh: body.refresh === true,
    ...(body.sections !== undefined ? { sections: body.sections } : {}),
    source: { kind: 'worker-canonical' },
  };
  const waited = await waitFor({ env, slug, kind: 'ai-views', deps, waitMs: RESULTS_ANALYSIS_WAIT_MS, input: { body: jobBody } });
  const running = { ok: true, status: 202, jobState: 'running', reservation: { requestId } };
  if (!waited.ok) {
    return { ok: false, status: waited.status || 503, jobState: 'failed', error: waited.body?.error || 'AI Views could not start; retry.' };
  }
  const { job } = waited;
  if (job?.state !== 'done') return running;
  const { outcome } = job;
  if (!outcome?.ok) {
    return {
      ok: false,
      status: outcome?.status || 500,
      jobState: outcome?.jobState || 'failed',
      error: outcome?.error || 'Results analysis generation failed.',
      ...(outcome?.reasons ? { reasons: outcome.reasons } : {}),
    };
  }
  if (outcome.jobState === 'running') return running;
  // The job kept its draft under its request's id, which now finds it without another AI call.
  return (deps.generateResultsAnalysisDraft || generateResultsAnalysisDraft)({
    env, slug, config, body: { ...jobBody, requestId: outcome.requestId || requestId }, headers, trigger: 'manual', deps,
  });
};
