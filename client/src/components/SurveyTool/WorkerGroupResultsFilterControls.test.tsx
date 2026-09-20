import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkerGroupResultsFilterControls from './WorkerGroupResultsFilterControls';
import {
  getWorkerSessionToken,
  loadWorkerGroupMembers,
  loadWorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { cloneSessionModePreset, SESSION_MODE_PRESET_IDS } from '../../utilities/session/sessionModeProfile';
jest.mock('../../domains/worker/workerGroupPorts', () => ({
  getWorkerSessionToken: jest.fn(),
  loadWorkerGroupMembers: jest.fn(),
  loadWorkerGroupOverview: jest.fn(),
}));
const group = {
  groupId: 'eddy-2026',
  label: 'EDDY-2026',
  sessionSlug: 'test',
  joinMode: 'open' as const,
  memberVisibility: 'session' as const,
};
const config = {
  slug: 'test',
  sessionIdHex: '0x' + '1'.repeat(32),
  corsWorkerUrl: 'https://worker.example',
  sessionModeProfile: cloneSessionModePreset(SESSION_MODE_PRESET_IDS.FAST_CHEAP_CLOUDFLARE),
};
const onChange = jest.fn();
function Harness({
  sessionConfig = config,
  account = '0x' + 'a'.repeat(40),
  initialValue = null,
}: {
  sessionConfig?: unknown;
  account?: string;
  initialValue?: unknown;
}) {
  const [value, setValue] = useState<unknown>(initialValue);
  return (
    <WorkerGroupResultsFilterControls
      sessionConfig={sessionConfig}
      sessionSlug="test"
      account={account}
      provider={null}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      expandedSections={{ workerGroups: true }}
      onToggleSection={() => {}}
      discover
    />
  );
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getWorkerSessionToken).mockResolvedValue('test-token');
  jest.mocked(loadWorkerGroupOverview).mockResolvedValue({ groups: [group], memberships: [] });
  jest.mocked(loadWorkerGroupMembers).mockResolvedValue({ group, members: [], memberCount: 0, nextCursor: '' });
});
it('offers separate creator/responder include/exclude selections and supports clearing', async () => {
  render(<Harness />);
  await waitFor(() => expect(screen.getByLabelText('Include responders')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Include responders'), { target: { value: group.groupId } });
  expect(onChange.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({
      sessionId: config.sessionIdHex,
      responderInclude: [{ groupId: group.groupId, label: group.label }],
    }),
  );
  await waitFor(() => expect(screen.getByLabelText('Exclude question creators')).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Exclude question creators'), { target: { value: group.groupId } });
  expect(onChange.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({ creatorExclude: [{ groupId: group.groupId, label: group.label }] }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear Group filters' }));
  expect(onChange.mock.lastCall?.[0]).toBeNull();
});
it('requests sign-in without fetching member lists and stays absent on-chain', async () => {
  const { rerender } = render(<Harness account="" />);
  await screen.findByText('Sign in to filter results by Group.');
  expect(getWorkerSessionToken).not.toHaveBeenCalled();
  rerender(<Harness sessionConfig={{ chainId: 11155420 }} />);
  expect(screen.queryByTestId('ce-results-group-filter')).not.toBeInTheDocument();
  expect(loadWorkerGroupMembers).not.toHaveBeenCalled();
});
it('keeps invalid saved filters recoverable without rebinding another session’s Groups', async () => {
  const selection = {
    sessionId: config.sessionIdHex,
    sessionSlug: 'other-session',
    workerUrl: config.corsWorkerUrl,
    responderInclude: [null, { groupId: group.groupId, label: group.label }, { groupId: 'other', label: 'Other' }],
  };
  render(<Harness initialValue={selection} />);
  await screen.findByText(/belongs to a different session/);
  fireEvent.click(screen.getByRole('button', { name: 'Remove EDDY-2026 from include responders' }));
  expect(onChange.mock.lastCall?.[0]).toEqual(
    expect.objectContaining({ sessionSlug: 'other-session', responderInclude: [{ groupId: 'other', label: 'Other' }] }),
  );
  expect(loadWorkerGroupMembers).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Group filters' }));
  await waitFor(() => expect(screen.queryByText(/belongs to a different session/)).not.toBeInTheDocument());
});
