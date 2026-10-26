import { render, screen } from '@testing-library/react';
import AdminWorkerCapabilities from './AdminWorkerCapabilities';
import { readWorkerCapabilities } from '../../utilities/worker/workerCapabilities';
jest.mock('../../utilities/worker/workerCapabilities', () => ({
  ...jest.requireActual<typeof import('../../utilities/worker/workerCapabilities')>(
    '../../utilities/worker/workerCapabilities',
  ),
  readWorkerCapabilities: jest.fn(),
}));
test('shows reported bundle, API and upgrade guidance', async () => {
  jest
    .mocked(readWorkerCapabilities)
    .mockResolvedValue({ legacy: false, features: [], bundle: 'fixture-sha', apiVersion: 1 });
  render(<AdminWorkerCapabilities workerUrl="https://admin-worker.test" sessionSlug="sample" />);
  expect(await screen.findByText('API version: 1')).toBeInTheDocument();
  expect(screen.getByText('Bundle: fixture-sha')).toBeInTheDocument();
  expect(screen.getByText(/Upgrade recommended/)).toBeInTheDocument();
});
