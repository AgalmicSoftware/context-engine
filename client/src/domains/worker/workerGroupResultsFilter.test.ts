import {
  filterWorkerGroupResponses,
  groupPrincipalMatches,
  normalizeWorkerGroupSelection,
  usesWorkerGroupFilters,
  type WorkerGroupCohort,
} from './workerGroupResultsFilter';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
import { deserializeFilterState, serializeFilterState } from '../../utilities/survey/filterStateUtils';
const a = '0x' + 'a'.repeat(40),
  b = '0x' + 'b'.repeat(40),
  c = '0x' + 'c'.repeat(40);
const scope = { sessionSlug: 'test', sessionId: '0x' + '1'.repeat(32), workerUrl: 'https://worker.example/' };
const group = { groupId: 'eddy-2026', label: 'EDDY-2026' };
const other = { groupId: 'other', label: 'Other' };
const selection = { ...scope, creatorInclude: [], creatorExclude: [], responderInclude: [group], responderExclude: [] };
const cohort: WorkerGroupCohort = {
  active: true,
  status: 'ready',
  message: '',
  selection,
  members: { 'eddy-2026': new Set([a, b]), other: new Set([b]) },
};
const rows = { q: [{ responder: a }, { responder: b }, { responder: c }] };
const metadata = { q: { creator: a } };
it('includes the union and gives exclusion precedence, normalizing address case', () => {
  expect(groupPrincipalMatches(a.toUpperCase().replace('0X', '0x'), [group], [], cohort.members)).toBe(true);
  expect(groupPrincipalMatches(b, [group], [other], cohort.members)).toBe(false);
  expect(
    filterWorkerGroupResponses(rows, metadata, {
      ...cohort,
      selection: { ...selection, responderInclude: [group, other], responderExclude: [other] },
    }),
  ).toEqual({ q: [{ responder: a }] });
});
it('filters question creators separately from responders and fails closed for unknown creators', () => {
  expect(
    filterWorkerGroupResponses(rows, metadata, { ...cohort, selection: { ...selection, creatorExclude: [group] } }),
  ).toEqual({});
  expect(
    filterWorkerGroupResponses(rows, {}, { ...cohort, selection: { ...selection, creatorInclude: [group] } }),
  ).toEqual({});
  expect(filterWorkerGroupResponses(rows, metadata, cohort)).toEqual({ q: [{ responder: a }, { responder: b }] });
});
it('distinguishes a genuinely empty cohort from an unset filter and never leaks pending/error results', () => {
  expect(filterWorkerGroupResponses(rows, metadata, { ...cohort, members: { 'eddy-2026': new Set() } })).toEqual({});
  for (const status of ['loading', 'error'] as const)
    expect(filterWorkerGroupResponses(rows, metadata, { ...cohort, status })).toEqual({});
  expect(filterWorkerGroupResponses(rows, metadata, { ...cohort, active: false })).toBe(rows);
});
it('rejects copied filters for a different Worker, slug or canonical session', () => {
  for (const change of [
    { workerUrl: 'https://other.example' },
    { sessionSlug: 'other' },
    { sessionId: '0x' + '2'.repeat(32) },
  ]) {
    expect(() => normalizeWorkerGroupSelection({ ...selection, ...change }, scope)).toThrow('different session');
  }
  expect(normalizeWorkerGroupSelection(selection, scope)).toEqual(selection);
  expect(() => normalizeWorkerGroupSelection({ ...selection, responderInclude: ['bad'] }, scope)).toThrow(
    'invalid Group',
  );
});
it('persists only native selection identities in filter URLs, alongside unchanged SBT state', () => {
  const state = { workerGroupFilter: selection, sbtFilter: { selectedSBTGroupsResponder: [{ address: a }] } };
  const restored = deserializeFilterState(serializeFilterState(state));
  expect(restored.workerGroupFilter).toEqual(selection);
  expect(restored.sbtFilter).toEqual(state.sbtFilter);
});
it('does not enable native Group filtering for on-chain sessions', () => {
  expect(
    usesWorkerGroupFilters({
      sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
    }),
  ).toBe(true);
  expect(usesWorkerGroupFilters({ chainId: 11155420, contracts: {} })).toBe(false);
});

it('keeps AI cache entries separate even for same-size cohorts and different answers', () => {
  const { buildWorkerGroupAnalysisKey } = require('./workerGroupResultsFilter');
  expect(buildWorkerGroupAnalysisKey('same', selection, [a], [[1]])).not.toBe(
    buildWorkerGroupAnalysisKey('same', selection, [b], [[1]]),
  );
  expect(buildWorkerGroupAnalysisKey('same', selection, [a], [[1]])).not.toBe(
    buildWorkerGroupAnalysisKey('same', selection, [a], [[-1]]),
  );
});
it('leaves registry SBT selections intact while pure Cloudflare ignores stale SBT state', () => {
  const { reportFilterStateForSession } = require('./workerGroupResultsFilter');
  const filters = { sbtFilter: { selectedSBTGroups: [{ address: a }] }, workerGroupFilter: selection };
  expect(reportFilterStateForSession({ chainId: 11155420 }, filters)).toBe(filters);
  expect(
    reportFilterStateForSession(
      { sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE) },
      filters,
    ).sbtFilter,
  ).toBeNull();
});
