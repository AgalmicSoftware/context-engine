import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import UserPageComparePanel from './UserPageComparePanel';
import UserPageSimulatedActions from './UserPageSimulatedActions';

jest.mock('reactstrap', () => ({
  Collapse: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) => (
    <div data-testid="compare-collapse" data-open={String(isOpen)}>
      {children}
    </div>
  ),
}));

describe('UserPage render chrome', () => {
  it('renders compare children inside the collapse when not minimized', () => {
    render(
      <UserPageComparePanel collapseOpen={true} minimized={false}>
        <div data-testid="compare-child">compare content</div>
      </UserPageComparePanel>,
    );

    expect(screen.getByTestId('compare-collapse')).toHaveAttribute('data-open', 'true');
    expect(screen.getByTestId('compare-child')).toBeInTheDocument();
  });

  it('omits the compare collapse when minimized', () => {
    render(
      <UserPageComparePanel collapseOpen={true} minimized={true}>
        <div data-testid="compare-child">compare content</div>
      </UserPageComparePanel>,
    );

    expect(screen.queryByTestId('compare-collapse')).toBeNull();
    expect(screen.queryByTestId('compare-child')).toBeNull();
  });

  it('renders simulated actions only for simulated users and calls the parent handler', () => {
    const onViewResponses = jest.fn();
    const { rerender } = render(<UserPageSimulatedActions isSimulated={false} onViewResponses={onViewResponses} />);

    expect(screen.queryByText('View Simulated Responses')).toBeNull();

    rerender(<UserPageSimulatedActions isSimulated={true} onViewResponses={onViewResponses} />);

    fireEvent.click(screen.getByText('View Simulated Responses'));
    expect(onViewResponses).toHaveBeenCalledTimes(1);
  });
});
