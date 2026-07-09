import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionPublishActionControls from './SessionPublishActionControls';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildDisplayState = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishActionControls>['displayState']> = {},
): React.ComponentProps<typeof SessionPublishActionControls>['displayState'] => ({
  canPublishNow: true,
  displayMode: 'advanced',
  publishAdvancedOpen: false,
  publishBusy: false,
  publishButtonDisabled: false,
  publishButtonLabel: 'Publish',
  settingsButtonActive: false,
  ...overrides,
});

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishActionControls>> = {},
): React.ComponentProps<typeof SessionPublishActionControls> => ({
  displayState: buildDisplayState(),
  onPublish: jest.fn(),
  onTogglePublishAdvanced: jest.fn(),
  ...overrides,
});

describe('SessionPublishActionControls', () => {
  it('renders normal-mode deploy controls and dispatches only the publish action', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    render(
      <SessionPublishActionControls
        {...buildProps({
          displayState: buildDisplayState({
            displayMode: 'normal',
            publishButtonLabel: 'Deploy Session',
          }),
          onPublish,
          onTogglePublishAdvanced,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));

    expect(screen.getByRole('button', { name: /Deploy Session/i })).toBeEnabled();
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onTogglePublishAdvanced).not.toHaveBeenCalled();
  });

  it('keeps publish disabled while busy or not ready', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    const { rerender } = render(
      <SessionPublishActionControls
        {...buildProps({
          displayState: buildDisplayState({
            publishBusy: true,
            publishButtonDisabled: true,
          }),
          onPublish,
          onTogglePublishAdvanced,
        })}
      />,
    );

    const busyPublishButton = screen.getByRole('button', { name: /Publishing/i });
    expect(busyPublishButton).toBeDisabled();
    fireEvent.click(busyPublishButton);
    expect(onPublish).not.toHaveBeenCalled();

    rerender(
      <SessionPublishActionControls
        {...buildProps({
          displayState: buildDisplayState({
            canPublishNow: false,
            publishButtonDisabled: true,
          }),
          onPublish,
          onTogglePublishAdvanced,
        })}
      />,
    );

    const blockedPublishButton = screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH);
    expect(blockedPublishButton).toBeDisabled();
    fireEvent.click(blockedPublishButton);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced publish settings' }));

    expect(onPublish).not.toHaveBeenCalled();
    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
  });

  it('routes advanced settings separately from publish execution', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    render(
      <SessionPublishActionControls
        {...buildProps({
          displayState: buildDisplayState({
            publishAdvancedOpen: true,
            settingsButtonActive: true,
          }),
          onPublish,
          onTogglePublishAdvanced,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Advanced publish settings' }));

    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });
});
