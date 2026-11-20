import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import UserPageSessionSwitch, { buildProfileSessionHref } from './UserPageSessionSwitch';
import { getAllDemoSessionConfigs } from '../../utilities/session/sessionSourceResolver';

jest.mock('../../utilities/session/sessionSourceResolver', () => ({ getAllDemoSessionConfigs: jest.fn(() => []) }));
jest.mock('../../utilities/session/sessionWorkerConfigCache', () => ({
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT: 'ce:session-worker-config-cache-updated',
  readSessionWorkerConfigCache: jest.fn(() => ({ v: 1, bySession: {}, slugIndex: {} })),
}));
jest.mock('../../utilities/web3/chainGateway', () => {
  const names: Record<string, string> = { meadow: 'Meadow Circle', quarry: 'Quarry Talks' };
  const config = (slug: unknown) => ({ slug, sessionName: names[slug as string] || '' });
  return {
    getAllSessionSlugs: jest.fn(() => Object.keys(names)),
    getSessionConfigBySlug: jest.fn(config),
    getAllSessionEntries: jest.fn(() => Object.keys(names).map((slug) => [slug, config(slug)])),
  };
});

const ADDRESS = '0x00000000000000000000000000000000000000aa';
const hiddenWorkerSession = [
  'hidden-grove',
  {
    slug: 'hidden-grove',
    sessionName: 'Hidden Grove',
    corsWorkerUrl: 'https://worker.example',
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  },
];

const renderSwitch = (sessionSlug = 'meadow') => {
  const openProfile = jest.fn();
  render(<UserPageSessionSwitch viewAddress={ADDRESS} sessionSlug={sessionSlug} openProfile={openProfile} />);
  return { openProfile, select: screen.getByRole('combobox', { name: 'Session' }) };
};

describe('UserPageSessionSwitch', () => {
  beforeEach(() => {
    jest.mocked(getAllDemoSessionConfigs).mockReturnValue([]);
  });

  it('names the current session and offers other sessions, but not ALL', () => {
    const { select } = renderSwitch();
    expect(select).toHaveValue('meadow');
    expect(screen.getByRole('option', { name: 'Meadow Circle (meadow)' })).toHaveProperty('selected', true);
    expect(screen.getByRole('option', { name: 'Quarry Talks (quarry)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'ALL' })).not.toBeInTheDocument();
  });

  it('opens the same address in the picked session', () => {
    const { openProfile, select } = renderSwitch();
    fireEvent.change(select, { target: { value: 'quarry' } });
    expect(openProfile).toHaveBeenCalledWith(`/u/${ADDRESS}?session=quarry`);
  });

  it("keeps an unlisted session's ?worker= so the page can find it", () => {
    jest.mocked(getAllDemoSessionConfigs).mockReturnValue([hiddenWorkerSession] as never);
    const { openProfile, select } = renderSwitch();
    fireEvent.change(select, { target: { value: 'hidden-grove' } });
    expect(openProfile).toHaveBeenCalledWith(`/u/${ADDRESS}?session=hidden-grove&worker=https%3A%2F%2Fworker.example`);
  });

  it('shows an unlisted current session and does nothing when it is picked again', () => {
    jest.mocked(getAllDemoSessionConfigs).mockReturnValue([hiddenWorkerSession] as never);
    const { openProfile, select } = renderSwitch('hidden-grove');
    expect(select).toHaveValue('hidden-grove');
    fireEvent.change(select, { target: { value: 'hidden-grove' } });
    expect(openProfile).not.toHaveBeenCalled();
  });
});

describe('buildProfileSessionHref', () => {
  it('keeps the deployed base path and drops anything but the worker from the session link', () => {
    const publicUrl = process.env.PUBLIC_URL;
    process.env.PUBLIC_URL = '/ce';
    try {
      expect(
        buildProfileSessionHref(ADDRESS, 'quarry', '/ce/session/quarry?worker=https%3A%2F%2Fw.example&tab=x'),
      ).toBe(`/ce/u/${ADDRESS}?session=quarry&worker=https%3A%2F%2Fw.example`);
      expect(buildProfileSessionHref(ADDRESS, '', '')).toBe(`/ce/u/${ADDRESS}?session=`);
    } finally {
      process.env.PUBLIC_URL = publicUrl;
    }
  });
});
