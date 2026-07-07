import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtPageAdminSection from './SbtPageAdminSection';

describe('SbtPageAdminSection', () => {
  it('renders admin actions when the admin section is open', () => {
    const onToggle = jest.fn();

    render(
      <SbtPageAdminSection
        adminActions={<button type="button">Admin action</button>}
        isAdmin
        onToggle={onToggle}
        sectionHeaderClassName="section-header"
        toggleState={{ isOpen: true, shouldRenderOpenIcon: true }}
      />,
    );

    fireEvent.click(screen.getByRole('heading', { name: /ADMIN/i }));

    expect(screen.getByRole('button', { name: 'Admin action' })).toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not render for non-admin users', () => {
    const { container } = render(
      <SbtPageAdminSection adminActions={<button type="button">Admin action</button>} isAdmin={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
