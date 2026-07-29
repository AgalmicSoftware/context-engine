import { buildWorkerGroupsPath, readWorkerGroupIdFromHash } from './workerGroupRoutes';

describe('workerGroupRoutes', () => {
  it('builds query-only session-scoped list and detail routes', () => {
    expect(buildWorkerGroupsPath({ sessionSlug: ' Demo-SH ' })).toBe('/groups?sessionName=Demo-SH');
    expect(
      buildWorkerGroupsPath({
        sessionSlug: 'demo-sh',
        groupId: 'reviewers / public',
      }),
    ).toBe('/groups?sessionName=demo-sh#group-reviewers%20%2F%20public');
  });

  it('preserves the supported list alias and PUBLIC_URL base path', () => {
    const originalPublicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce/';
    try {
      expect(buildWorkerGroupsPath({ rootPath: '/sbts', sessionSlug: 'alpha' })).toBe('/ce/sbts?sessionName=alpha');
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
});
