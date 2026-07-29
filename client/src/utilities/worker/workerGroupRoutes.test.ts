import {
  buildWorkerGroupsPath,
  readWorkerGroupIdFromHash,
  readWorkerGroupIdFromPath,
} from './workerGroupRoutes';

describe('workerGroupRoutes', () => {
  it('builds a query-scoped list route and a path-scoped detail route', () => {
    expect(buildWorkerGroupsPath({ sessionSlug: ' Demo-SH ' })).toBe('/groups?sessionName=Demo-SH');
    expect(
      buildWorkerGroupsPath({
        sessionSlug: 'demo-sh',
        groupId: 'reviewers / public',
      }),
    ).toBe('/group/reviewers%20%2F%20public?sessionName=demo-sh');
  });

  it('preserves the supported list alias and PUBLIC_URL base path', () => {
    const originalPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';
    try {
      expect(buildWorkerGroupsPath({ rootPath: '/sbts', sessionSlug: 'alpha' })).toBe('/ce/sbts?sessionName=alpha');
      expect(buildWorkerGroupsPath({ groupId: 'reviewers', sessionSlug: 'alpha' })).toBe(
        '/ce/group/reviewers?sessionName=alpha',
      );
      expect(readWorkerGroupIdFromPath('/ce/group/reviewers')).toBe('reviewers');
    } finally {
      if (originalPublicUrl === undefined) delete process.env.PUBLIC_URL;
      else process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

  it('reads only canonical Worker Group fragments', () => {
    expect(readWorkerGroupIdFromHash('#group-reviewers%20%2F%20public')).toBe('reviewers / public');
    expect(readWorkerGroupIdFromHash('#other-reviewers')).toBe('');
    expect(readWorkerGroupIdFromHash('#group-%E0%A4%A')).toBe('');
  });

  it('reads only canonical Worker Group detail paths', () => {
    expect(readWorkerGroupIdFromPath('/group/reviewers%20%2F%20public?sessionName=demo-sh')).toBe(
      'reviewers / public',
    );
    expect(readWorkerGroupIdFromPath('/groups/reviewers')).toBe('');
    expect(readWorkerGroupIdFromPath('/group/reviewers/extra')).toBe('');
    expect(readWorkerGroupIdFromPath('/group/%E0%A4%A')).toBe('');
  });
});
