import React from 'react';
import { render, screen } from '@testing-library/react';
import LoginSettingsResourceKeysContent from './LoginSettingsResourceKeysContent';

describe('LoginSettingsResourceKeysContent', () => {
  it('describes resource-key overrides as tab-scoped memory state', () => {
    render(
      <LoginSettingsResourceKeysContent
        formatResourceSponsorHint={() => null}
        handleClearResourceKeys={jest.fn()}
        handleResourceToggleLocal={jest.fn()}
        handleSaveResourceKeys={jest.fn()}
        resourceKeys={{
          rpc: { useLocal: true, apiKey: 'memory-only-key' },
          arweave: { useLocal: false, jwk: '' },
        }}
        resourceKeysDirty
        resourceKeysStatus=""
        sponsorSessions={[]}
        sponsoredKeys={{}}
        updateResourceKeyField={jest.fn()}
        useLocalArweave={false}
        useLocalRpc
        visibleResources={['rpc', 'arweave']}
      />,
    );

    expect(screen.getAllByText('Use in-memory override')).toHaveLength(2);
    expect(screen.getByText('Held in memory for this tab; cleared on reload.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use for this tab' })).toBeEnabled();
    expect(screen.queryByText(/stored locally/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save keys/i })).not.toBeInTheDocument();
  });
});
