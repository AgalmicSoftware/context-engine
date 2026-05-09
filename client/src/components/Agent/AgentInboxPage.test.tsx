import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import AgentInboxPage, { buildAgentInboxApiPath } from './AgentInboxPage';

describe('AgentInboxPage', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders safe activity history and abbreviates account addresses', async () => {
    window.history.replaceState({}, '', '/inbox?session=alpha');
    const fetchInbox = jest.fn(async () => ({
      activityCount: 1,
      requests: [{ requestId: 'agent_req_alpha123' }],
      pendingResponses: [],
      activity: [
        {
          eventId: 'ce_activity_1',
          accountId: '0x1234567890123456789012345678901234567890',
          subjectAddress: '0x1234567890123456789012345678901234567890',
          session: 'alpha',
          actorType: 'telegram',
          actorId: 'telegram:555',
          eventType: 'response_submit_request.pending_approval',
          requestId: 'agent_req_alpha123',
          safeSummary: 'Agent request pending approval for alpha (1 question).',
          createdAt: '2026-05-09T12:00:00.000Z',
        },
      ],
    }));

    render(<AgentInboxPage fetchInbox={fetchInbox} />);

    await waitFor(() => {
      expect(fetchInbox).toHaveBeenCalledWith('/api/agent/inbox?session=alpha');
    });
    expect(screen.getByTestId(E2E_TESTIDS.PAGE_AGENT_INBOX_ROOT)).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.AGENT_INBOX_HISTORY)).toBeInTheDocument();
    const event = await screen.findByTestId(E2E_TESTIDS.AGENT_INBOX_EVENT);
    expect(event).toHaveTextContent('response submit request pending approval');
    expect(event).toHaveTextContent('0x1234...7890');
    expect(event).toHaveTextContent('Agent request pending approval for alpha');
    expect(screen.getByRole('tab', { name: 'Requests 1' })).toHaveAttribute('aria-selected', 'false');
  });

  it('renders an empty history state', async () => {
    const fetchInbox = jest.fn(async () => ({
      activity: [],
      requests: [],
      pendingResponses: [],
      activityCount: 0,
    }));

    render(<AgentInboxPage fetchInbox={fetchInbox} />);

    expect(await screen.findByTestId(E2E_TESTIDS.AGENT_INBOX_EMPTY)).toHaveTextContent('No activity yet.');
  });

  it('builds session-filtered API paths', () => {
    expect(buildAgentInboxApiPath('alpha')).toBe('/api/agent/inbox?session=alpha');
    expect(buildAgentInboxApiPath('')).toBe('/api/agent/inbox');
  });
});
