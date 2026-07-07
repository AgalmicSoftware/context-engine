import { useState } from 'react';
import { toStr } from '../../../utilities/shared/primitives.js';

type CachedPublishAdvancedState =
  | {
      manualGasLimit?: unknown;
      manualGasPriceGwei?: unknown;
      manualMaxFeePerGasGwei?: unknown;
      manualMaxPriorityFeePerGasGwei?: unknown;
    }
  | null
  | undefined;

export interface UseSessionWizardPublishAdvancedStateOptions {
  cachedWizard?: CachedPublishAdvancedState;
}

const useSessionWizardPublishAdvancedState = ({ cachedWizard }: UseSessionWizardPublishAdvancedStateOptions = {}) => {
  const [metadataUrl, setMetadataUrl] = useState('');
  const [metadataTxId, setMetadataTxId] = useState('');
  const [manualMetadataUrl, setManualMetadataUrl] = useState('');
  const [manualGasLimit, setManualGasLimit] = useState(
    () => toStr(cachedWizard?.manualGasLimit || '1200000').trim() || '1200000',
  );
  const [manualGasPriceGwei, setManualGasPriceGwei] = useState(() =>
    toStr(cachedWizard?.manualGasPriceGwei || '').trim(),
  );
  const [manualMaxFeePerGasGwei, setManualMaxFeePerGasGwei] = useState(() =>
    toStr(cachedWizard?.manualMaxFeePerGasGwei || '').trim(),
  );
  const [manualMaxPriorityFeePerGasGwei, setManualMaxPriorityFeePerGasGwei] = useState(() =>
    toStr(cachedWizard?.manualMaxPriorityFeePerGasGwei || '').trim(),
  );
  const [publishAdvancedOpen, setPublishAdvancedOpen] = useState(false);

  return {
    metadataUrl,
    setMetadataUrl,
    metadataTxId,
    setMetadataTxId,
    manualMetadataUrl,
    setManualMetadataUrl,
    manualGasLimit,
    setManualGasLimit,
    manualGasPriceGwei,
    setManualGasPriceGwei,
    manualMaxFeePerGasGwei,
    setManualMaxFeePerGasGwei,
    manualMaxPriorityFeePerGasGwei,
    setManualMaxPriorityFeePerGasGwei,
    publishAdvancedOpen,
    setPublishAdvancedOpen,
  };
};

export default useSessionWizardPublishAdvancedState;
