import { workerGroupNavigationPort } from './workerGroupNavigationPort';

describe('workerGroupNavigationPort', () => {
  it('reads the owning session from canonical and legacy group links', () => {
    expect(workerGroupNavigationPort.readSessionSlugFromSearch('?sessionSlug=alpha&sessionName=other')).toBe('alpha');
    expect(workerGroupNavigationPort.readSessionSlugFromSearch('?sessionName=alpha')).toBe('alpha');
  });

  it('exposes canonical Worker Group list and detail navigation', () => {
    expect(workerGroupNavigationPort.buildPath({ sessionSlug: ' demo-sh ' })).toBe('/groups?sessionSlug=demo-sh');
    expect(
      workerGroupNavigationPort.buildPath({
        groupId: 'public reviewers',
        sessionSlug: ' demo-sh ',
      }),
    ).toBe('/group/public%20reviewers?sessionSlug=demo-sh');
    expect(workerGroupNavigationPort.readGroupIdFromPath('/group/public%20reviewers')).toBe('public reviewers');
    expect(workerGroupNavigationPort.readGroupIdFromHash('#group-public%20reviewers')).toBe('public reviewers');
  });
});
