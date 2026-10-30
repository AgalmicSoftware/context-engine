import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';

import DevE2eNav, { buildDevNavAtlasTarget } from './DevE2eNav';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

describe('DevE2eNav atlas routing', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('adds the demo query when atlas is opened from a simulated-user route', () => {
    render(
      <MemoryRouter initialEntries={['/su/Franklin?e2eNav=1']}>
        <DevE2eNav />
      </MemoryRouter>,
    );

    expect(screen.getByTestId(E2E_TESTIDS.NAV_ATLAS)).toHaveAttribute('href', '/atlas?e2eNav=1&demo=1');
  });

  it('offers active navigation without removed standalone pages', () => {
    render(
      <MemoryRouter initialEntries={['/?e2eNav=1']}>
        <DevE2eNav />
      </MemoryRouter>,
    );

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href')?.split('?')[0]);
    for (const removed of ['/debate', '/beta', '/contributors', '/matrix', '/demos']) {
      expect(hrefs).not.toContain(removed);
    }
    expect(hrefs).toContain('/atlas');
    expect(hrefs).toContain('/about');
  });

  it('keeps the standard atlas target outside simulated-user routes', () => {
    expect(buildDevNavAtlasTarget('/questions', '?e2eNav=1')).toBe('/atlas');
  });
});
