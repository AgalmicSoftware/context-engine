import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { SESSION_MODE_PRESET_IDS, cloneSessionModePreset } from '../../../utilities/session/sessionModeProfile';
import SessionSettingsPage from './SessionSettingsPage';

jest.mock('../../../utilities/session/sessionWorkerDiscovery', () => ({
  ...(jest.requireActual('../../../utilities/session/sessionWorkerDiscovery') as object),
  fetchWorkerCanonicalSessionBootstrap: async () => null,
}));
jest.mock('../setup/ContextSourcesPanel', () => ({ __esModule: true, default: () => null }));

const ADMIN_ADDRESS = '0x00000000000000000000000000000000000000aa';

const renderPage = (workerOrigin: string, features: string[], config: Record<string, unknown> = {}) => {
  const fetchImpl = jest.fn(async (url: unknown) =>
    String(url).startsWith(`${workerOrigin}/capabilities`)
      ? new Response(JSON.stringify({ type: 'ce_worker_capabilities', version: 1, apiVersion: 1, features }))
      : new Response('{}', { status: 404 }),
  ) as unknown as typeof fetch;
  render(
    <SessionSettingsPage
      account={ADMIN_ADDRESS}
      loginComplete
      toggleLoginModal={jest.fn()}
      sessionSlug="card-salon"
      sessionConfig={{
        slug: 'card-salon',
        sessionId: `0x${'3d'.repeat(16)}`,
        adminAddress: ADMIN_ADDRESS,
        corsWorkerUrl: workerOrigin,
        sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
        ...config,
      }}
      workerOrigin={workerOrigin}
      fetchImpl={fetchImpl}
    />,
  );
};

// The setting sits with the AI section's other choices, under its More button.
const openAi = async () => {
  expect(await screen.findByTestId('ce-settings-worker-release')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('ce-setup-more-ai'));
};

describe('Session settings Analysis card', () => {
  it('offers the setting, off, where the Worker has the card, with what it does behind its "?"', async () => {
    // A session that never saved the setting, as every session from before the card, has it off.
    renderPage('https://card-new.example.workers.dev', ['analysis_card_v1']);
    await openAi();
    const box = await screen.findByLabelText('Analysis card');
    expect(box).not.toBeChecked();
    expect(document.getElementById(box.getAttribute('aria-describedby') || '')).toHaveTextContent(
      /two-page picture card .* session’s OpenAI key, at most 60 a day\. Turned off, .* turned back on\.$/,
    );
    fireEvent.click(box);
    expect(box).toBeChecked();
  });

  it('shows a session with the card on as on, and one that turned it off as off', async () => {
    renderPage('https://card-on.example.workers.dev', ['analysis_card_v1'], { analysisCardEnabled: true });
    await openAi();
    expect(await screen.findByLabelText('Analysis card')).toBeChecked();
    cleanup();
    renderPage('https://card-off.example.workers.dev', ['analysis_card_v1'], { analysisCardEnabled: false });
    await openAi();
    expect(await screen.findByLabelText('Analysis card')).not.toBeChecked();
  });

  it('takes the Analysis card choice of an imported template', async () => {
    renderPage('https://card-import.example.workers.dev', ['analysis_card_v1']);
    await openAi();
    expect(await screen.findByLabelText('Analysis card')).not.toBeChecked();
    // A template that names the card is followed; one that does not leaves the session's choice alone
    // (SettingsContextCardsField.test.tsx covers both switches).
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: { value: JSON.stringify({ format: 'ce.session-template/v1', analysisCardEnabled: true }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(screen.getByLabelText('Analysis card')).toBeChecked();
  });

  it('offers no such setting for a Worker too old to have the card, which would refuse it', async () => {
    renderPage('https://card-old.example.workers.dev', ['worker_groups']);
    await openAi();
    expect(document.getElementById('ce-setup-questions-prompt')).toBeInTheDocument();
    expect(screen.queryByLabelText('Analysis card')).not.toBeInTheDocument();
  });
});
