import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

export const TEST_ROUTER_FUTURE_FLAGS: NonNullable<MemoryRouterProps['future']> = {
  v7_relativeSplatPath: true,
  v7_startTransition: true,
};

export function TestMemoryRouter({ future, ...props }: MemoryRouterProps) {
  return <MemoryRouter {...props} future={{ ...TEST_ROUTER_FUTURE_FLAGS, ...future }} />;
}
