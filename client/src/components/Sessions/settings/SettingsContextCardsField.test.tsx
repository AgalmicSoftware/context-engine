import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
      sessionSlug="cards-salon"
      sessionConfig={{
        slug: 'cards-salon',
        sessionId: `0x${'3c'.repeat(16)}`,
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

// The setting sits with the context section's other choices, under its More button.
const openContext = async () => {
  expect(await screen.findByTestId('ce-settings-worker-release')).toBeInTheDocument();
  fireEvent.click(screen.getByTestId('ce-setup-more-context'));
};

describe('Session settings Context cards', () => {
  it('offers the setting, off, where the Worker keeps cards, and shows a saved choice', async () => {
    renderPage('https://cards-new.example.workers.dev', ['context_cards_v1']);
    await openContext();
    const box = await screen.findByLabelText('Context cards');
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
  });

  it('shows a session that turned cards on as on', async () => {
    renderPage('https://cards-on.example.workers.dev', ['context_cards_v1'], { contextCardsEnabled: true });
    await openContext();
    expect(await screen.findByLabelText('Context cards')).toBeChecked();
  });

  it('takes the Context cards choice of an imported template, as its list of changes says', async () => {
    renderPage('https://cards-import.example.workers.dev', ['context_cards_v1']);
    await openContext();
    expect(await screen.findByLabelText('Context cards')).not.toBeChecked();
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: { value: JSON.stringify({ format: 'ce.session-template/v1', contextCardsEnabled: true }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(screen.getByLabelText('Context cards')).toBeChecked();
  });

  it('leaves both card switches as saved when an imported template names neither', async () => {
    // As every template made before the switches existed: its missing fields are not a choice.
    renderPage('https://cards-kept.example.workers.dev', ['context_cards_v1', 'analysis_card_v1'], {
      contextCardsEnabled: true,
      analysisCardEnabled: false,
    });
    await openContext();
    expect(await screen.findByLabelText('Context cards')).toBeChecked();
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: { value: JSON.stringify({ format: 'ce.session-template/v1', sessionName: 'An older template' }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    // The list of changes names neither switch, as neither will change.
    expect(screen.getByTestId('ce-template-changes').textContent).toMatch(/sessionName/);
    expect(screen.getByTestId('ce-template-changes').textContent).not.toMatch(/CardsEnabled|CardEnabled/);
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(screen.getByLabelText('Context cards')).toBeChecked();
    expect(screen.getByTestId('ce-settings-content-changes').textContent).not.toMatch(/Context cards|Analysis card/);
    // A template that does name them is followed, off as well as on.
    fireEvent.click(screen.getByTestId('ce-template-import'));
    fireEvent.change(screen.getByTestId('ce-template-paste'), {
      target: {
        value: JSON.stringify({
          format: 'ce.session-template/v1',
          contextCardsEnabled: false,
          analysisCardEnabled: true,
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByTestId('ce-template-changes').textContent).toMatch(/contextCardsEnabled/);
    expect(screen.getByTestId('ce-template-changes').textContent).toMatch(/analysisCardEnabled/);
    fireEvent.click(screen.getByTestId('ce-template-import-apply'));
    expect(screen.getByLabelText('Context cards')).not.toBeChecked();
    expect(screen.getByTestId('ce-settings-content-changes').textContent).toMatch(/Analysis card/);
  });

  it('offers no such setting for a Worker too old to keep cards, which would refuse it', async () => {
    renderPage('https://cards-old.example.workers.dev', ['worker_groups']);
    await openContext();
    expect(screen.getByLabelText('Who can add files')).toBeInTheDocument();
    expect(screen.queryByLabelText('Context cards')).not.toBeInTheDocument();
  });
});
