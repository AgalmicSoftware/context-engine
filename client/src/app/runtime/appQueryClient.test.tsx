import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryFoundation } from './appQueryClient';
import { wagmiClient } from './appWagmiRuntime';

jest.mock('./appWagmiRuntime', () => ({
  wagmiClient: (() => {
    const { QueryClient } = jest.requireActual('@tanstack/react-query');
    return { queryClient: new QueryClient() };
  })(),
}));

describe('app query client wiring', () => {
  it('exposes the wagmi query client through the default TanStack context', () => {
    let observedClient: ReturnType<typeof useQueryClient> | null = null;

    const Probe = () => {
      observedClient = useQueryClient();
      return null;
    };
    const AppQueryClientProvider = appQueryFoundation.Provider;

    render(
      <AppQueryClientProvider>
        <Probe />
      </AppQueryClientProvider>,
    );

    expect(appQueryFoundation.client).toBe(wagmiClient.queryClient);
    expect(observedClient).toBe(wagmiClient.queryClient);
    expect(appQueryFoundation.keys.domain('app')).toEqual([{ scope: 'ce-app', persist: false }, 'app']);
  });

  it('pins wagmi 0.9 to a private React Query context', () => {
    const installedWagmiSource = fs.readFileSync(path.join(process.cwd(), 'node_modules/wagmi/dist/index.js'), 'utf8');

    expect(installedWagmiSource).toContain('var queryClientContext = React.createContext');
    expect(installedWagmiSource).toMatch(/client:\s*client\.queryClient,\s*context:\s*queryClientContext/);
  });
});
