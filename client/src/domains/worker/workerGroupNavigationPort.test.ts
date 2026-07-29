import { workerGroupNavigationPort } from './workerGroupNavigationPort';

describe('workerGroupNavigationPort', () => {
  it('exposes canonical Worker Group list and detail navigation', () => {
    expect(workerGroupNavigationPort.buildPath({ sessionSlug: ' demo-sh ' })).toBe(
      '/groups?sessionName=demo-sh',
    );
    expect(
      workerGroupNavigationPort.buildPath({
        groupId: 'public reviewers',
        sessionSlug: ' demo-sh ',
      }),
    ).toBe('/group/public%20reviewers?sessionName=demo-sh');
    expect(workerGroupNavigationPort.readGroupIdFromPath('/group/public%20reviewers')).toBe(
      'public reviewers',
    );
    expect(workerGroupNavigationPort.readGroupIdFromHash('#group-public%20reviewers')).toBe(
      'public reviewers',
    );
  });
});
