import { act, fireEvent, render, screen } from '@testing-library/react';
import WorkerGroupsSessionSelector from './WorkerGroupsSessionSelector';
import { readKnownSessionCatalog } from '../../utilities/session/sessionCatalog';
import { SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT } from '../../utilities/session/sessionWorkerConfigCache';

jest.mock('../../utilities/session/sessionCatalog', () => ({
  ...jest.requireActual<typeof import('../../utilities/session/sessionCatalog')>(
    '../../utilities/session/sessionCatalog',
  ),
  readKnownSessionCatalog: jest.fn(),
}));

const catalogEntry = (slug: string, name: string, worker = '') => ({
  slug,
  name,
  kind: worker ? ('centralized' as const) : ('decentralized' as const),
  href: `/session/${slug}${worker ? `?worker=${encodeURIComponent(worker)}` : ''}`,
  createdAt: null,
  lastActivityAt: null,
  adminAddresses: [],
});
const config = {
  slug: 'alpha',
  sessionName: 'Alpha',
  corsWorkerUrl: 'https://alpha.example',
  sessionModeProfile: { authority: { mode: 'worker_canonical' } },
};
const renderSelector = () =>
  render(<WorkerGroupsSessionSelector sessionSlug="alpha" sessionName="Alpha" sessionConfig={config} />);

beforeEach(() => {
  window.history.replaceState(
    {},
    '',
    '/groups?sessionSlug=alpha&worker=https%3A%2F%2Falpha.example&sessionName=stale&group=old',
  );
  jest
    .mocked(readKnownSessionCatalog)
    .mockReturnValue([
      catalogEntry('alpha', 'Stale Alpha', 'https://stale.example'),
      catalogEntry('beta', 'Beta', 'https://beta.example'),
      catalogEntry('registry', 'Registry'),
    ]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('shows the active session and keeps its exact Worker origin on the session link', () => {
  renderSelector();
  expect(screen.getByRole('combobox', { name: 'Active session' })).toHaveValue('alpha');
  expect(screen.getAllByRole('option')).toHaveLength(3);
  expect(screen.getByRole('option', { name: 'Alpha (alpha)' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open session Alpha' })).toHaveAttribute(
    'href',
    '/session/alpha?worker=https%3A%2F%2Falpha.example',
  );
});

it('switches to the destination Worker without carrying the previous session query', () => {
  renderSelector();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'beta' } });
  expect(window.location.pathname).toBe('/groups');
  expect(window.location.search).toBe('?sessionSlug=beta&worker=https%3A%2F%2Fbeta.example');
});

it('drops the old Worker origin when selecting a registry session', () => {
  renderSelector();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'registry' } });
  expect(window.location.search).toBe('?sessionSlug=registry');
});

it('keeps the current route and history when reselecting the active session', () => {
  renderSelector();
  const push = jest.spyOn(window.history, 'pushState');
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'alpha' } });
  expect(push).not.toHaveBeenCalled();
});

it('discovers newly cached sessions without losing an uncatalogued current session', () => {
  jest.mocked(readKnownSessionCatalog).mockReturnValue([]);
  renderSelector();
  expect(screen.getByRole('option', { name: 'Alpha (alpha)' })).toBeInTheDocument();
  jest.mocked(readKnownSessionCatalog).mockReturnValue([catalogEntry('cached', 'Cached', 'https://cached.example')]);
  act(() => {
    window.dispatchEvent(new Event(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT));
  });
  expect(screen.getByRole('option', { name: 'Cached (cached)' })).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('alpha');
});
