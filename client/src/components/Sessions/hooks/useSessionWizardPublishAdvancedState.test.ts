import { act, renderHook } from '@testing-library/react';
import useSessionWizardPublishAdvancedState from './useSessionWizardPublishAdvancedState.js';

describe('useSessionWizardPublishAdvancedState', () => {
  it('uses default blank metadata and gas values without cache', () => {
    const { result } = renderHook(() => useSessionWizardPublishAdvancedState());

    expect(result.current.metadataUrl).toBe('');
    expect(result.current.metadataTxId).toBe('');
    expect(result.current.manualMetadataUrl).toBe('');
    expect(result.current.manualGasLimit).toBe('1200000');
    expect(result.current.manualGasPriceGwei).toBe('');
    expect(result.current.manualMaxFeePerGasGwei).toBe('');
    expect(result.current.manualMaxPriorityFeePerGasGwei).toBe('');
    expect(result.current.publishAdvancedOpen).toBe(false);
  });

  it('hydrates manual gas values from cached wizard state', () => {
    const { result } = renderHook(() =>
      useSessionWizardPublishAdvancedState({
        cachedWizard: {
          manualGasLimit: ' 900000 ',
          manualGasPriceGwei: ' 1.5 ',
          manualMaxFeePerGasGwei: ' 2.25 ',
          manualMaxPriorityFeePerGasGwei: ' 0.25 ',
        },
      }),
    );

    expect(result.current.manualGasLimit).toBe('900000');
    expect(result.current.manualGasPriceGwei).toBe('1.5');
    expect(result.current.manualMaxFeePerGasGwei).toBe('2.25');
    expect(result.current.manualMaxPriorityFeePerGasGwei).toBe('0.25');
  });

  it('falls back to the default gas limit when cached value trims empty', () => {
    const { result } = renderHook(() =>
      useSessionWizardPublishAdvancedState({
        cachedWizard: {
          manualGasLimit: '   ',
        },
      }),
    );

    expect(result.current.manualGasLimit).toBe('1200000');
  });

  it('exposes setters for publish advanced form fields', () => {
    const { result } = renderHook(() => useSessionWizardPublishAdvancedState());

    act(() => {
      result.current.setMetadataUrl('ar://metadata');
      result.current.setMetadataTxId('metadata-tx');
      result.current.setManualMetadataUrl('ar://manual');
      result.current.setManualGasLimit('850000');
      result.current.setManualGasPriceGwei('1');
      result.current.setManualMaxFeePerGasGwei('2');
      result.current.setManualMaxPriorityFeePerGasGwei('0.1');
      result.current.setPublishAdvancedOpen(true);
    });

    expect(result.current.metadataUrl).toBe('ar://metadata');
    expect(result.current.metadataTxId).toBe('metadata-tx');
    expect(result.current.manualMetadataUrl).toBe('ar://manual');
    expect(result.current.manualGasLimit).toBe('850000');
    expect(result.current.manualGasPriceGwei).toBe('1');
    expect(result.current.manualMaxFeePerGasGwei).toBe('2');
    expect(result.current.manualMaxPriorityFeePerGasGwei).toBe('0.1');
    expect(result.current.publishAdvancedOpen).toBe(true);
  });
});
