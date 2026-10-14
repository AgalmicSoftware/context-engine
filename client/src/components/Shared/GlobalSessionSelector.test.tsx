import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GlobalSessionSelector from './GlobalSessionSelector';
import { getAllSessionSlugs, getSessionConfigBySlug } from '../../utilities/web3/chainGateway';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT } from '../../utilities/web3/sessionRegistry';
import { getAllDemoSessionConfigs } from '../../utilities/session/sessionSourceResolver';
import {
  readSessionWorkerConfigCache,
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT,
} from '../../utilities/session/sessionWorkerConfigCache';

jest.mock('../../utilities/session/sessionSourceResolver', () => ({ getAllDemoSessionConfigs: jest.fn(() => []) }));
jest.mock('../../utilities/session/sessionWorkerConfigCache', () => ({
  SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT: 'ce:session-worker-config-cache-updated',
  readSessionWorkerConfigCache: jest.fn(() => ({ bySession: {} })),
}));

jest.mock('../../utilities/web3/chainGateway', () => {
  const slugs = jest.fn(() => ['alpha', 'beta']);
  const config = jest.fn((slug: string) => ({ slug, sessionName: `${slug} discussion` }));
  return {
    getAllSessionSlugs: slugs,
    getSessionConfigBySlug: config,
    getAllSessionEntries: jest.fn(() => slugs().map((slug) => [slug, config(slug)])),
  };
});

describe('GlobalSessionSelector', () => {
  const selection = {
    primarySessionSlug: 'alpha',
    primarySessionExplicit: false,
    selectedSessionScope: 'all' as const,
    selectedSessionSlugs: ['alpha', 'beta'],
  };
  afterEach(() => jest.clearAllMocks());

  it('offers ALL, General and named sessions, keeping a partial exact config from masking the catalog name', () => {
    const onChange = jest.fn();
    render(
      <GlobalSessionSelector
        selection={selection}
        sessionConfig={{ slug: 'alpha' }}
        onChange={onChange}
        testId="selector"
      />,
    );
    const control = screen.getByRole('combobox', { name: 'Session' });
    expect(screen.getByRole('option', { name: 'ALL' })).toHaveProperty('selected', true);
    expect(screen.getByRole('option', { name: 'alpha discussion (alpha)' })).toBeInTheDocument();
    fireEvent.change(control, { target: { value: 'beta' } });
    expect(onChange).toHaveBeenLastCalledWith({ primarySessionSlug: 'beta', selectedSessionScope: 'active' });
    fireEvent.change(control, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ primarySessionSlug: '', selectedSessionScope: 'general' });
    fireEvent.change(control, { target: { value: screen.getByRole('option', { name: 'ALL' }).getAttribute('value') } });
    expect(onChange).toHaveBeenLastCalledWith({
      primarySessionSlug: 'alpha',
      primarySessionExplicit: false,
      selectedSessionScope: 'all',
    });
  });

  it('reflects saved multi-session lists and external updates without changing selection', () => {
    const onChange = jest.fn();
    const view = render(
      <GlobalSessionSelector
        selection={{ ...selection, selectedSessionScope: 'list' }}
        onChange={onChange}
        testId="selector"
      />,
    );
    expect(screen.getByRole('option', { name: 'Selected sessions (2)' })).toHaveProperty('selected', true);
    view.rerender(
      <GlobalSessionSelector
        selection={{ ...selection, selectedSessionScope: 'active', primarySessionSlug: 'beta' }}
        onChange={onChange}
        testId="selector"
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Session' })).toHaveValue('beta');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('refreshes the shared catalog and preserves real sessions whose slugs resemble scope sentinels', () => {
    jest.mocked(getAllSessionSlugs).mockReturnValue(['alpha', '__ce_all_sessions__', '__ce_selected_sessions__']);
    jest.mocked(getSessionConfigBySlug).mockImplementation((slug: string) => ({ slug, sessionName: slug }));
    const onChange = jest.fn();
    render(<GlobalSessionSelector selection={selection} onChange={onChange} testId="selector" />);
    const allOption = screen.getByRole('option', { name: 'ALL' });
    expect(allOption).not.toHaveAttribute('value', '__ce_all_sessions__');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '__ce_all_sessions__' } });
    expect(onChange).toHaveBeenLastCalledWith({
      primarySessionSlug: '__ce_all_sessions__',
      selectedSessionScope: 'active',
    });
    jest.mocked(getAllSessionSlugs).mockReturnValue(['alpha', 'later']);
    act(() => window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT)));
    expect(screen.getByRole('option', { name: 'later' })).toBeInTheDocument();
  });

  it('allows registry hydration to notify other mounted views without updating them during render', () => {
    let hydrate = false;
    jest.mocked(getAllSessionSlugs).mockReturnValue(['alpha', 'beta']);
    jest.mocked(getSessionConfigBySlug).mockImplementation((slug: string) => {
      if (hydrate) {
        hydrate = false;
        window.dispatchEvent(new Event(SESSION_REGISTRY_CACHE_UPDATED_EVENT));
      }
      return { slug, sessionName: `${slug} discussion` };
    });
    function RegistryObserver() {
      const [revision, setRevision] = React.useState(0);
      React.useEffect(() => {
        const update = () => setRevision((value) => value + 1);
        window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, update);
        return () => window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, update);
      }, []);
      return <output data-testid="registry-revision">{revision}</output>;
    }
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(
        <>
          <RegistryObserver />
          <GlobalSessionSelector selection={selection} onChange={jest.fn()} testId="selector" />
        </>,
      );
      hydrate = true;
      fireEvent.focus(screen.getByRole('combobox'));
      expect(screen.getByTestId('registry-revision')).toHaveTextContent('1');
      expect(screen.getByRole('option', { name: 'beta discussion (beta)' })).toBeInTheDocument();
      expect(error.mock.calls.map((call) => call.join(' ')).join('\n')).not.toMatch(
        /Cannot update a component.*while rendering/i,
      );
    } finally {
      error.mockRestore();
    }
  });

  it('lists bundled and discovered Worker sessions even when the registry catalog is empty', () => {
    jest.mocked(getAllSessionSlugs).mockReturnValue([]);
    jest.mocked(getSessionConfigBySlug).mockReturnValue(null);
    const worker = {
      slug: 'worker-bundled',
      sessionName: 'Bundled Worker',
      corsWorkerUrl: 'https://worker.example',
      sessionModeProfile: { authority: { mode: 'worker_canonical' } },
    };
    jest.mocked(getAllDemoSessionConfigs).mockReturnValue([[worker.slug, worker]]);
    const view = render(
      <>
        <GlobalSessionSelector
          selection={{ primarySessionSlug: '', selectedSessionScope: 'all' }}
          onChange={jest.fn()}
          testId="selector"
        />
        <GlobalSessionSelector
          selection={{ primarySessionSlug: '', selectedSessionScope: 'all' }}
          onChange={jest.fn()}
          testId="settings-selector"
        />
      </>,
    );
    expect(screen.getAllByRole('option', { name: 'Bundled Worker (worker-bundled)' })).toHaveLength(2);
    expect(screen.queryByRole('option', { name: 'Discovered Worker (worker-discovered)' })).not.toBeInTheDocument();
    jest.mocked(readSessionWorkerConfigCache).mockReturnValue({
      bySession: {
        discovered: {
          authorityMode: 'worker_canonical',
          slug: 'worker-discovered',
          canonicalConfig: { ...worker, slug: 'worker-discovered', sessionName: 'Discovered Worker' },
          workerOrigin: 'https://worker.example',
        },
      },
    } as never);
    act(() => window.dispatchEvent(new Event(SESSION_WORKER_CONFIG_CACHE_UPDATED_EVENT)));
    expect(screen.getAllByRole('option', { name: 'Discovered Worker (worker-discovered)' })).toHaveLength(2);
    view.unmount();
  });
});
