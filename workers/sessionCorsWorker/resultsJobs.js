// Results builds an admin starts (AI Views, the atlas, the risk matrix) run as
// jobs in the session's coordinator, not in the request that asked for them.
// A page that drops or reloads loses nothing: the build finishes and is kept,
// and the next read or press finds it. One job of each kind runs at a time,
// and a press while one runs joins it rather than paying for another.
//
// A running job writes a heartbeat. A job whose heartbeat stops (the
// coordinator restarted, or the work was cut off) is run again by the next
// alarm, read or press of its kind, at most RESULTS_JOB_MAX_RUNS times in all;
// every alarm schedule includes the moment a heartbeat would go stale.

export const RESULTS_JOB_KINDS = Object.freeze(['ai-views', 'debate-atlas', 'risk-matrix']);
export const RESULTS_JOB_MAX_RUNS = 2;
export const RESULTS_JOB_HEARTBEAT_MS = 15 * 1000;
export const RESULTS_JOB_STALE_MS = 60 * 1000;
const ERROR_CHARS = 500;

const keyOf = (kind) => `results-job-v1:${kind}`;
const nowOf = (coordinator) => Number(coordinator.now()) || Date.now();
// Kinds this coordinator is claiming at this moment, so two callers never claim one job.
const claiming = (coordinator) => (coordinator.resultsJobsClaiming ??= new Set());
const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const randomHex = (coordinator, bytes) => [...(coordinator.crypto || globalThis.crypto).getRandomValues(new Uint8Array(bytes))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
// Only a fresh heartbeat says a run is alive: a run held in memory whose
// heartbeat stopped may never finish, and is run again.
const isLive = (coordinator, job) => nowOf(coordinator) - (Number(job.heartbeatAtMs) || 0) < RESULTS_JOB_STALE_MS;

/** What a job shows a request waiting on it: never its input. */
export const resultsJobSummary = (job) => (job ? {
  jobId: job.jobId,
  state: job.state,
  startedAtMs: job.startedAtMs,
  ...(job.state === 'done' ? { finishedAtMs: job.finishedAtMs, outcome: job.outcome } : {}),
} : null);

// What a finished job keeps of its runner's result: its status and error, and
// the id of the build it kept. The build itself is kept by its own store.
const keptOutcome = (result) => ({
  ok: result?.ok === true,
  status: Number(result?.status) || (result?.ok === true ? 200 : 500),
  ...(result?.ok === true ? {} : { error: text(result?.error, ERROR_CHARS) || 'The build failed.' }),
  ...(text(result?.jobState, 20) ? { jobState: result.jobState } : {}),
  ...(text(result?.reason, 80) ? { reason: result.reason } : {}),
  ...(Array.isArray(result?.reasons) ? { reasons: result.reasons.slice(0, 10).map((reason) => text(reason, 200)) } : {}),
  ...(text(result?.buildId, 80) ? { buildId: result.buildId } : {}),
  ...(text(result?.requestId, 200) ? { requestId: result.requestId } : {}),
});

/**
 * When the alarm must next look at a running job: when its heartbeat would go
 * stale, and never sooner than a second from now; Infinity with none.
 */
export const nextResultsJobAt = async (coordinator) => {
  let next = Infinity;
  for (const kind of RESULTS_JOB_KINDS) {
    const job = await coordinator.state.storage.get(keyOf(kind));
    if (job?.state === 'running') next = Math.min(next, (Number(job.heartbeatAtMs) || 0) + RESULTS_JOB_STALE_MS);
  }
  return Number.isFinite(next) ? Math.max(next, nowOf(coordinator) + 1000) : next;
};

const alarmBy = async (coordinator, at) => {
  const storage = coordinator.state.storage;
  if (typeof storage.setAlarm !== 'function') return;
  const scheduled = await storage.getAlarm?.();
  if (scheduled && scheduled <= at) return;
  await storage.setAlarm(at);
};

// This run is still the job's own: not finished, and not run again since.
const isThisRun = (stored, job) => stored?.jobId === job.jobId && stored.state === 'running' && stored.runs === job.runs;

const runJob = async (coordinator, runners, job) => {
  const storage = coordinator.state.storage;
  const runner = runners[job.kind];
  // The heartbeat says this run is alive; the last beat lands before the job ends.
  let beat = Promise.resolve();
  const timer = setInterval(() => {
    beat = beat.then(async () => {
      const current = await storage.get(keyOf(job.kind));
      if (isThisRun(current, job)) await storage.put(keyOf(job.kind), { ...current, heartbeatAtMs: nowOf(coordinator) });
    }).catch(() => {});
  }, RESULTS_JOB_HEARTBEAT_MS);
  timer?.unref?.();
  let result;
  try {
    if (job.runs > RESULTS_JOB_MAX_RUNS) {
      await runner.abandon?.({ coordinator, job });
      result = { ok: false, status: 503, error: 'The build stopped before it finished. Press again to start a new one.' };
    } else {
      result = await runner.run({ coordinator, job });
    }
  } catch (error) {
    // A run already run again leaves the lease to the run that replaced it.
    try {
      if (isThisRun(await storage.get(keyOf(job.kind)), job)) await runner.abandon?.({ coordinator, job });
    } catch { /* The kind's own lease ends on its own. */ }
    result = { ok: false, status: 500, error: error?.message || 'The build failed.' };
  } finally {
    clearInterval(timer);
    await beat;
  }
  // A newer job of this kind, or a later run of this one, is never overwritten.
  if (!isThisRun(await storage.get(keyOf(job.kind)), job)) return;
  const { input: _input, attemptId: _attemptId, runs: _runs, heartbeatAtMs: _heartbeatAtMs, ...kept } = job;
  await storage.put(keyOf(job.kind), { ...kept, state: 'done', finishedAtMs: nowOf(coordinator), outcome: keptOutcome(result) });
};

/**
 * Runs every job of these kinds no one is running, each kind at once, and
 * settles when they finish. `runners[kind]` is `{ run({ coordinator, job }), abandon?(…) }`.
 */
export const runResultsJobs = async (coordinator, runners, kinds = RESULTS_JOB_KINDS) => {
  const storage = coordinator.state.storage;
  const started = [];
  for (const kind of kinds) {
    if (!runners?.[kind] || claiming(coordinator).has(kind)) continue;
    claiming(coordinator).add(kind);
    try {
      const job = await storage.get(keyOf(kind));
      // A new job has no heartbeat yet, so it is never live.
      if (job?.state !== 'running' || isLive(coordinator, job)) continue;
      // The claim's fresh heartbeat keeps every other caller off this run.
      const claimed = { ...job, runs: (Number(job.runs) || 0) + 1, heartbeatAtMs: nowOf(coordinator) };
      await storage.put(keyOf(kind), claimed);
      started.push(runJob(coordinator, runners, claimed));
    } finally {
      claiming(coordinator).delete(kind);
    }
  }
  await Promise.all(started);
  const next = await nextResultsJobAt(coordinator);
  if (Number.isFinite(next)) await alarmBy(coordinator, next);
};

// Starts the kind's jobs in the background of the request that asked; its
// heartbeat and the alarm cover a run that is cut off.
const kick = (coordinator, runners, kind) => {
  runResultsJobs(coordinator, runners, [kind]).catch(() => {});
};

/**
 * Starts a job of this kind, or joins the one running. `reserve` takes the
 * kind's own lease before the job is kept and returns `{ ok, attemptId? }` or
 * a refusal, which is returned as it is.
 */
export const startResultsJob = async (coordinator, { kind, slug, input, reserve, runners }) => {
  if (!RESULTS_JOB_KINDS.includes(kind)) return { ok: false, status: 404, body: { error: 'Not found.' } };
  const storage = coordinator.state.storage;
  const current = await storage.get(keyOf(kind));
  if (current?.state === 'running') {
    if (!isLive(coordinator, current)) kick(coordinator, runners, kind);
    return { ok: true, joined: true, job: resultsJobSummary(current) };
  }
  const reserved = reserve ? await reserve() : { ok: true };
  if (!reserved?.ok) return reserved;
  const job = {
    kind,
    slug,
    jobId: randomHex(coordinator, 8),
    state: 'running',
    startedAtMs: nowOf(coordinator),
    runs: 0,
    input,
    ...(reserved.attemptId ? { attemptId: reserved.attemptId } : {}),
  };
  await storage.put(keyOf(kind), job);
  // The alarm that looks again should this run be cut off.
  await alarmBy(coordinator, nowOf(coordinator) + RESULTS_JOB_STALE_MS);
  kick(coordinator, runners, kind);
  return { ok: true, joined: false, job: resultsJobSummary(job) };
};

/** The kind's latest job; one whose heartbeat stopped is run again. */
export const readResultsJob = async (coordinator, kind, runners) => {
  if (!RESULTS_JOB_KINDS.includes(kind)) return null;
  const job = await coordinator.state.storage.get(keyOf(kind));
  if (job?.state === 'running' && !isLive(coordinator, job)) kick(coordinator, runners, kind);
  return resultsJobSummary(job);
};

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * In the Worker: starts or joins the kind's job, then waits on it while the
 * page that asked is connected, up to `waitMs`, checking soon and then every
 * few seconds. Returns the coordinator's refusal, or `{ ok: true, job }`,
 * whose state is 'running' if it is still going.
 */
export const awaitResultsJob = async ({ call, input, waitMs, now = Date.now, wait = sleep }) => {
  const started = await call('start', { input });
  if (!started.ok) return started;
  let job = started.body?.job;
  const deadline = now() + waitMs;
  let pollMs = 250;
  while (job?.state === 'running' && now() < deadline) {
    await wait(pollMs);
    pollMs = Math.min(pollMs * 2, 3000);
    const read = await call('status', {});
    // A read that fails is tried again; a newer job means this one ended unseen.
    if (!read.ok) continue;
    if (read.body?.job?.jobId !== job.jobId) return { ok: true, job: { ...job, state: 'replaced' } };
    job = read.body.job;
  }
  return { ok: true, job };
};
