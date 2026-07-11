import React, { type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { wagmiClient } from './appWagmiRuntime';
import { queryKeys } from '../../utilities/query/queryKeys';

// wagmi 0.9 mounts this client through its own private React Query context.
// App code uses TanStack's default context, so expose the same instance there
// rather than creating a second QueryClient.
const appQueryClient: QueryClient = wagmiClient.queryClient;

const AppQueryClientProvider = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={appQueryClient}>{children}</QueryClientProvider>
);

export const appQueryFoundation = Object.freeze({
  client: appQueryClient,
  keys: queryKeys,
  Provider: AppQueryClientProvider,
});
