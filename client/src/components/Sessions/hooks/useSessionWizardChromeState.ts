import { useState } from 'react';

export type MetadataObjectCollapsedState = Record<string, boolean> & {
  appearance: boolean;
  contracts: boolean;
  faucet: boolean;
  ai: boolean;
  lit: boolean;
  storageProfile: boolean;
};

// Display state the draft field renderer keeps between renders.
const useSessionWizardChromeState = () => {
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [metadataObjectCollapsed, setMetadataObjectCollapsed] = useState<MetadataObjectCollapsedState>({
    appearance: true,
    contracts: true,
    faucet: true,
    ai: true,
    lit: true,
    storageProfile: true,
  });

  return {
    showPromptPreview,
    setShowPromptPreview,
    metadataObjectCollapsed,
    setMetadataObjectCollapsed,
  };
};

export default useSessionWizardChromeState;
