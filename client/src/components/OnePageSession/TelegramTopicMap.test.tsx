/** @file TelegramTopicMap.test.tsx */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TelegramTopicMap from './TelegramTopicMap';

const originalFetch = global.fetch;

describe('TelegramTopicMap', () => {
  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, 'fetch', { writable: true, value: originalFetch });
  });

  const installFetch = (impl: any) => {
    Object.defineProperty(global, 'fetch', { writable: true, value: jest.fn(impl) });
    return global.fetch as jest.Mock;
  };

  it('shows the empty state when no local topic map file exists', async () => {
    installFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));

    render(<TelegramTopicMap sessionSlug="edge" />);

    expect(await screen.findByText(/no local topic map yet/i)).toBeInTheDocument();
    expect(screen.getByTestId('ce-session-telegram-topicmap-reload')).toBeInTheDocument();
    expect(screen.queryAllByTestId('ce-session-telegram-topicmap-topic')).toHaveLength(0);
  });

  it('renders packed topic circles and topic details from the local file', async () => {
    const fetchMock = installFetch(async (url: string) => {
      expect(String(url)).toContain('/telegram-topic-map/edge.json');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          sessionSlug: 'edge',
          generatedAt: '2026-06-10T12:00:00Z',
          topics: [
            { id: 'funding', label: 'Funding', summary: 'Mostly aligned on funding.', size: 5, agreement: 0.8, items: ['Fund the proposal?'] },
            { id: 'roadmap', label: 'Roadmap', summary: 'Split on roadmap pace.', size: 3, agreement: 0.4, items: ['Ship faster?'] },
          ],
        }),
      };
    });

    render(<TelegramTopicMap sessionSlug="edge" />);

    const circles = await screen.findAllByTestId('ce-session-telegram-topicmap-topic');
    expect(circles).toHaveLength(2);
    expect(screen.getByText(/2 topics/i)).toBeInTheDocument();

    fireEvent.click(circles[1]);
    await waitFor(() => {
      expect(screen.getByTestId('ce-session-telegram-topicmap-detail')).toHaveTextContent('Split on roadmap pace.');
    });
    expect(screen.getByText('Ship faster?')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ce-session-telegram-topicmap-reload'));
    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('reports a parse problem for malformed files', async () => {
    installFetch(async () => ({ ok: true, status: 200, json: async () => ({ topics: [] }) }));

    render(<TelegramTopicMap sessionSlug="edge" />);

    expect(await screen.findByText(/could not be parsed/i)).toBeInTheDocument();
  });
});
