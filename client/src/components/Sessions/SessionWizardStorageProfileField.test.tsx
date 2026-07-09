import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { SESSION_STORAGE_BACKENDS, SESSION_STORAGE_PAYLOAD_ACCESS_MODES } from './sessionWizardStorageProfile';
import SessionWizardStorageProfileField from './SessionWizardStorageProfileField';

describe('SessionWizardStorageProfileField', () => {
  const renderField = (props = {}) => {
    const onStorageProfileChange = jest.fn();
    const onToggleCollapsed = jest.fn();
    render(
      <SessionWizardStorageProfileField
        title="Session Storage"
        value={{ backend: SESSION_STORAGE_BACKENDS.ARWEAVE }}
        isCollapsed={false}
        onStorageProfileChange={onStorageProfileChange}
        onToggleCollapsed={onToggleCollapsed}
        {...props}
      />,
    );
    return { onStorageProfileChange, onToggleCollapsed };
  };

  it('renders backend choices and keeps Arweave payload controls hidden', () => {
    renderField();

    expect(screen.getByRole('radio', { name: 'Arweave' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cloudflare' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('radio', { name: 'Worker SBT gate' })).not.toBeInTheDocument();
  });

  it('routes backend selection through a normalized parent patch', () => {
    const { onStorageProfileChange } = renderField();

    fireEvent.click(screen.getByRole('radio', { name: 'Cloudflare' }));

    expect(onStorageProfileChange).toHaveBeenCalledTimes(1);
    expect(onStorageProfileChange.mock.calls[0][0]).toMatchObject({
      backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE,
      payloadAccessControl: {
        mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE,
      },
    });
  });

  it('routes Cloudflare payload mode selection without applying parent state', () => {
    const { onStorageProfileChange } = renderField({
      value: {
        backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE,
        payloadAccessControl: { mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.WORKER_SBT_GATE },
      },
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Public read' }));

    expect(onStorageProfileChange).toHaveBeenCalledTimes(1);
    expect(onStorageProfileChange.mock.calls[0][0]).toMatchObject({
      backend: SESSION_STORAGE_BACKENDS.CLOUDFLARE,
      payloadAccessControl: {
        mode: SESSION_STORAGE_PAYLOAD_ACCESS_MODES.PUBLIC_READ,
      },
    });
  });

  it('keeps collapse ownership in the parent callback', () => {
    const { onToggleCollapsed } = renderField({ isCollapsed: true });

    fireEvent.click(screen.getByRole('button', { name: 'Session Storage expand' }));

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('radio', { name: 'Arweave' })).not.toBeInTheDocument();
  });
});
