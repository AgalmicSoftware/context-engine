import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SbtListSessionUniversePanel from './SbtListSessionUniversePanel';
import type { SbtListSessionSelectorOption } from './sbtListSessionSelectorDisplayHelpers';

const createOption = (
  slug: string,
  overrides: Partial<SbtListSessionSelectorOption> = {},
): SbtListSessionSelectorOption => ({
  active: false,
  checkTestId: `session-chip-check-${slug || 'general'}`,
  chipTestId: `session-chip-${slug || 'general'}`,
  general: slug === '',
  href: slug ? `/session/${slug}` : '/session',
  indeterminate: false,
  key: slug || 'general',
  label: slug || 'General',
  loaded: true,
  openTestId: `session-chip-open-${slug || 'general'}`,
  openTitle: `Open session ${slug || 'General'} in new tab`,
  progressFillTestId: `session-chip-progress-fill-${slug || 'general'}`,
  progressText: '',
  progressTextTestId: `session-chip-progress-text-${slug || 'general'}`,
  progressTrackTestId: `session-chip-progress-track-${slug || 'general'}`,
  progressWrapTestId: `session-chip-progress-wrap-${slug || 'general'}`,
  rowTestId: `session-chip-row-${slug || 'general'}`,
  selected: false,
  showOpen: true,
  showProgress: false,
  slug,
  ...overrides,
});

const createProps = (
  overrides: Partial<React.ComponentProps<typeof SbtListSessionUniversePanel>> = {},
): React.ComponentProps<typeof SbtListSessionUniversePanel> => ({
  buildSessionRouteHref: (slug) => (slug ? `/session/${slug}` : '/session'),
  canShowMoreSessions: false,
  chipLoadingStatusBySlug: {},
  chipProgressVisibilityBySlug: {},
  hideSessionUniverseSummary: false,
  isOpen: true,
  isUniverseCollapsed: false,
  labelForSessionSlug: (slug) => slug || 'General',
  onOpenSessionChip: jest.fn(),
  onShowMoreSessions: jest.fn(),
  onToggleSessionChip: jest.fn(),
  onToggleSessionSettings: jest.fn(),
  onToggleUniverseCollapsed: jest.fn(),
  remainingHiddenSessionCount: 0,
  selectedSummarySlugs: ['alpha'],
  selectorPanelId: 'session-selector-panel',
  sessionSelectorOptions: [createOption('alpha', { selected: true }), createOption('beta')],
  showMoreSessionsLoading: false,
  showUniverseSpinner: false,
  usesFallbackSessionSettingsToggle: true,
  ...overrides,
});

describe('SbtListSessionUniversePanel', () => {
  it('renders a closed summary and preserves the settings toggle callback', () => {
    const onToggleSessionSettings = jest.fn();
    render(
      <SbtListSessionUniversePanel
        {...createProps({
          isOpen: false,
          onToggleSessionSettings,
          showUniverseSpinner: true,
        })}
      />,
    );

    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByTestId('session-universe-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('session-selector-summary')).toHaveTextContent('Selected (1)');

    fireEvent.click(screen.getByTestId('session-selector-toggle'));

    expect(onToggleSessionSettings).toHaveBeenCalledTimes(1);
  });

  it('renders expanded selector chips and routes chip/open callbacks through the parent', () => {
    const onOpenSessionChip = jest.fn();
    const onToggleSessionChip = jest.fn();
    render(
      <SbtListSessionUniversePanel
        {...createProps({
          onOpenSessionChip,
          onToggleSessionChip,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('session-chip-beta'));
    fireEvent.click(screen.getByTestId('session-chip-open-alpha'));

    expect(onToggleSessionChip).toHaveBeenCalledWith('beta', expect.objectContaining({ slug: 'beta' }));
    expect(onOpenSessionChip).toHaveBeenCalledWith(
      'alpha',
      expect.objectContaining({ slug: 'alpha' }),
      expect.any(Object),
    );
  });

  it('renders collapsed open-state summary and show-more controls without owning execution', () => {
    const onShowMoreSessions = jest.fn();
    const onToggleUniverseCollapsed = jest.fn();
    const { rerender } = render(
      <SbtListSessionUniversePanel
        {...createProps({
          isUniverseCollapsed: true,
          onToggleUniverseCollapsed,
          selectedSummarySlugs: ['alpha', 'beta'],
        })}
      />,
    );

    expect(screen.getByTestId('session-universe-collapsed-summary')).toHaveTextContent('Selected (2)');
    fireEvent.click(screen.getByRole('button', { name: 'Expand session universe' }));
    expect(onToggleUniverseCollapsed).toHaveBeenCalledTimes(1);

    rerender(
      <SbtListSessionUniversePanel
        {...createProps({
          canShowMoreSessions: true,
          onShowMoreSessions,
          remainingHiddenSessionCount: 3,
          showMoreSessionsLoading: true,
        })}
      />,
    );

    const showMoreButton = screen.getByRole('button', { name: /Show More Sessions \(3\)/ });
    expect(showMoreButton).toBeDisabled();
    fireEvent.click(showMoreButton);
    expect(onShowMoreSessions).not.toHaveBeenCalled();
  });
});
