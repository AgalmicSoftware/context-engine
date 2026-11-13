import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdminDraftTextPanel from './AdminDraftTextPanel';
import { readWorkerKeepsDraftText } from '../../domains/worker/workerRelease';

jest.mock('../../domains/worker/workerRelease', () => ({ readWorkerKeepsDraftText: jest.fn() }));
jest.mock('../SurveyTool/sessionInterviewDraftText', () => ({ exportDraftText: jest.fn() }));

const keeps = jest.mocked(readWorkerKeepsDraftText);
const renderPanel = (canAdminWorker: boolean) =>
  render(
    <AdminDraftTextPanel
      workerUrl="https://worker.test"
      sessionSlug="demo"
      sessionConfig={{ sessionId: '0x1' }}
      canAdminWorker={canAdminWorker}
    />,
  );

beforeEach(() => {
  keeps.mockReset();
});

it('offers the download to config admins on a Worker that keeps draft text', async () => {
  keeps.mockResolvedValue(true);
  renderPanel(true);
  expect(await screen.findByRole('button', { name: 'Download AI draft text' })).toBeInTheDocument();
  expect(screen.getByText('Download it before deleting or restoring this session.')).toBeInTheDocument();
});

it('offers nothing to anyone who cannot change the session config', async () => {
  keeps.mockResolvedValue(true);
  renderPanel(false);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Download AI draft text' })).toBeNull());
  expect(keeps).not.toHaveBeenCalled();
});

it('offers nothing on an older Worker', async () => {
  keeps.mockResolvedValue(false);
  renderPanel(true);
  await waitFor(() => expect(keeps).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: 'Download AI draft text' })).toBeNull();
});
