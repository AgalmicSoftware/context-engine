import { getPolicyStatusGroup, POLICY_FILTERS } from './PolicyGlobe';

describe('policy lifecycle filters', () => {
  test.each(['passed_one_chamber', 'passed_legislature'])('%s remains proposed until enactment', (status) => {
    expect(getPolicyStatusGroup({ status })).toBe(POLICY_FILTERS.proposed);
  });

  test.each(['repealed', 'superseded'])('%s is inactive even with an enactment date', (status) => {
    expect(getPolicyStatusGroup({ status, date_enacted: '2024-01-01' })).toBe(POLICY_FILTERS.inactive);
  });

  test('enacted policies remain live', () => {
    expect(getPolicyStatusGroup({ status: 'enacted' })).toBe(POLICY_FILTERS.live);
  });
});
