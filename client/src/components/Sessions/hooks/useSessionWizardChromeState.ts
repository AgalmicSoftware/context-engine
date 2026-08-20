import { useEffect, useState } from 'react';

export type CollapsedSectionsState = Record<string, boolean> & {
  worker: boolean;
  encryption: boolean;
  metadata: boolean;
  publish: boolean;
};

export type MetadataObjectCollapsedState = Record<string, boolean> & {
  appearance: boolean;
  contracts: boolean;
  faucet: boolean;
  ai: boolean;
  lit: boolean;
  storageProfile: boolean;
};

export interface UseSessionWizardChromeStateOptions {
  wizardMode: string;
  hasSponsoredBundleLink: boolean;
}

const useSessionWizardChromeState = ({ wizardMode, hasSponsoredBundleLink }: UseSessionWizardChromeStateOptions) => {
  const [wizardDisplaySettingsOpen, setWizardDisplaySettingsOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [metadataObjectCollapsed, setMetadataObjectCollapsed] = useState<MetadataObjectCollapsedState>({
    appearance: true,
    contracts: true,
    faucet: true,
    ai: true,
    lit: true,
    storageProfile: true,
  });
  const [collapsedSections, setCollapsedSections] = useState<CollapsedSectionsState>(() => ({
    worker: true,
    encryption: wizardMode !== 'advanced',
    metadata: false,
    publish: true,
  }));

  useEffect(() => {
    if (!hasSponsoredBundleLink) {
      setWizardDisplaySettingsOpen(false);
    }
  }, [hasSponsoredBundleLink]);

  return {
    wizardDisplaySettingsOpen,
    setWizardDisplaySettingsOpen,
    moreOptionsOpen,
    setMoreOptionsOpen,
    showJsonPreview,
    setShowJsonPreview,
    showPromptPreview,
    setShowPromptPreview,
    metadataObjectCollapsed,
    setMetadataObjectCollapsed,
    collapsedSections,
    setCollapsedSections,
  };
};

export default useSessionWizardChromeState;
