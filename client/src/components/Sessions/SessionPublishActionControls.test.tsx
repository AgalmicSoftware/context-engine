import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionPublishActionControls from './SessionPublishActionControls';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishActionControls>> = {}
): React.ComponentProps<typeof SessionPublishActionControls> => ({
  canPublishNow: true,
  isNormalMode: false,
  onPublish: jest.fn(),
  onTogglePublishAdvanced: jest.fn(),
  publishAdvancedOpen: false,
  publishBusy: false,
  ...overrides,
});

describe('SessionPublishActionControls', () => {
  it('renders normal-mode deploy controls and dispatches only the publish action', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    render(
      <SessionPublishActionControls
        {...buildProps({
          isNormalMode: true,
          onPublish,
          onTogglePublishAdvanced,
        })}
      />
    );

    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH));

    expect(screen.getByRole('button', { name: /Deploy Session/i })).toBeEnabled();
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(onTogglePublishAdvanced).not.toHaveBeenCalled();
  });

  it('keeps publish disabled while busy or not ready', () => {
    const { rerender } = render(
      <SessionPublishActionControls
        {...buildProps({
          publishBusy: true,
        })}
      />
    );

    expect(screen.getByRole('button', { name: /Publishing/i })).toBeDisabled();

    rerender(
      <SessionPublishActionControls
        {...buildProps({
          canPublishNow: false,
        })}
      />
    );

    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_PUBLISH)).toBeDisabled();
  });

  it('routes advanced settings separately from publish execution', () => {
    const onPublish = jest.fn();
    const onTogglePublishAdvanced = jest.fn();
    render(
      <SessionPublishActionControls
        {...buildProps({
          onPublish,
          onTogglePublishAdvanced,
          publishAdvancedOpen: true,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Advanced publish settings' }));

    expect(onTogglePublishAdvanced).toHaveBeenCalledTimes(1);
    expect(onPublish).not.toHaveBeenCalled();
  });
});
