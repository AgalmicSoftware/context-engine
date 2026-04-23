import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import AgentPage from './AgentPage';

describe('AgentPage', () => {
  afterEach(() => {
    delete window.__ceAgent;
  });

  it('renders disabled status when the agent is unavailable', () => {
    render(<AgentPage />);

    expect(screen.getByText('Enabled:')).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('Log is empty.');
  });

  it('steps through the first configured action when an agent is available', async () => {
    const perform = jest.fn(async () => ({ ok: true }));
    window.__ceAgent = {
      getState: () => ({ route: '/agent', account: '0xabc' }),
      perform,
    };

    render(<AgentPage />);

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.AGENT_STEP));

    await waitFor(() => {
      expect(perform).toHaveBeenCalledWith(expect.objectContaining({ type: 'navigate', to: '/compare/' }));
    });
    await waitFor(() => {
      expect(screen.getByTestId(E2E_TESTIDS.AGENT_LOG)).toHaveTextContent('step:result');
    });
  });
});
