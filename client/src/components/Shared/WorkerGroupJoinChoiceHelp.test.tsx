import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkerGroupJoinModeHelp } from './WorkerGroupJoinChoiceHelp';

jest.mock('reactstrap', () => ({
  UncontrolledTooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
}));

describe('WorkerGroupJoinModeHelp', () => {
  // The Worker lets anyone signed in join an open group, from the list or by its id.
  it('says a Public URL group is open to anyone signed in, not only to whoever has the link', () => {
    render(<WorkerGroupJoinModeHelp modes={['open']} />);
    expect(screen.getByTestId('tooltip')).toHaveTextContent('Public URL: Anyone signed in can join');
    expect(screen.getByTestId('tooltip')).not.toHaveTextContent('Anyone with the link');
  });
});
