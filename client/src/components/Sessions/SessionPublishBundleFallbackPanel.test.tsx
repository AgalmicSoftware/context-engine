import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import SessionPublishBundleFallbackPanel from './SessionPublishBundleFallbackPanel';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof SessionPublishBundleFallbackPanel>> = {},
): React.ComponentProps<typeof SessionPublishBundleFallbackPanel> => ({
  bundleFile: null,
  bundleFileInputRef: createRef<HTMLInputElement>(),
  localWorkerBundleFallbackFilePath: '/dist/sessionCorsWorker.bundle.js',
  manualBundleUrlOverrideHelp: 'Use an https:// bundle URL when the hosted asset is unavailable.',
  normalModeBundleUrlOverride: '',
  normalModeBundleUrlOverrideValidationError: '',
  onBundleFileChange: jest.fn(),
  onClearBundleFile: jest.fn(),
  onNormalModeBundleUrlOverrideChange: jest.fn(),
  sponsoredManualBundleRetryMessage: 'Upload a local bundle only for this retry.',
  ...overrides,
});

describe('SessionPublishBundleFallbackPanel', () => {
  it('routes bundle URL overrides through the named callback', () => {
    const onNormalModeBundleUrlOverrideChange = jest.fn();
    render(
      <SessionPublishBundleFallbackPanel
        {...buildProps({
          normalModeBundleUrlOverride: 'https://assets.example.test/sessionCorsWorker.bundle.js',
          onNormalModeBundleUrlOverrideChange,
        })}
      />,
    );

    const overrideInput = screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_URL_OVERRIDE);
    expect(overrideInput).toHaveValue('https://assets.example.test/sessionCorsWorker.bundle.js');
    expect(screen.getByText('Use an https:// bundle URL when the hosted asset is unavailable.')).toBeInTheDocument();

    fireEvent.change(overrideInput, {
      target: { value: 'https://cdn.example.test/sessionCorsWorker.bundle.js' },
    });

    expect(onNormalModeBundleUrlOverrideChange).toHaveBeenCalledWith(
      'https://cdn.example.test/sessionCorsWorker.bundle.js',
    );
  });

  it('renders validation errors and keeps the file clear action disabled without a file', () => {
    const onClearBundleFile = jest.fn();
    render(
      <SessionPublishBundleFallbackPanel
        {...buildProps({
          normalModeBundleUrlOverrideValidationError: 'Manual bundle URL override must use an https:// URL.',
          onClearBundleFile,
        })}
      />,
    );

    expect(screen.getByText('Manual bundle URL override must use an https:// URL.')).toBeInTheDocument();
    expect(screen.getByText('Upload a local bundle only for this retry.')).toBeInTheDocument();
    expect(screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH)).toBeDisabled();
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH));
    expect(onClearBundleFile).not.toHaveBeenCalled();
  });

  it('routes selected bundle files and clear actions through explicit callbacks', () => {
    const onBundleFileChange = jest.fn();
    const onClearBundleFile = jest.fn();
    const bundleFile = new File(['export default {}'], 'sessionCorsWorker.bundle.js', {
      type: 'text/javascript',
    });

    render(
      <SessionPublishBundleFallbackPanel
        {...buildProps({
          bundleFile,
          onBundleFileChange,
          onClearBundleFile,
        })}
      />,
    );

    fireEvent.change(screen.getByTestId(E2E_TESTIDS.WIZARD_BUNDLE_FILE_INPUT), {
      target: { files: [bundleFile] },
    });
    fireEvent.click(screen.getByTestId(E2E_TESTIDS.WIZARD_CLEAR_BUNDLE_FILE_PUBLISH));

    expect(screen.getByText('Using sessionCorsWorker.bundle.js for this publish.')).toBeInTheDocument();
    expect(onBundleFileChange).toHaveBeenCalledWith(bundleFile);
    expect(onClearBundleFile).toHaveBeenCalledTimes(1);
  });
});
