import { useEffect, useState } from 'react';

export type CollapsedSectionsState = Record<string, boolean> & {
  worker: boolean;
  encryption: boolean;
  metadata: boolean;
  publish: boolean;
};

export type MetadataObjectCollapsedState = Record<string, boolean> & {
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

const NORMAL_SECTION_ORDER = ['metadata', 'encryption', 'worker', 'publish'];

const useSessionWizardChromeState = ({ wizardMode, hasSponsoredBundleLink }: UseSessionWizardChromeStateOptions) => {
  const [wizardDisplaySettingsOpen, setWizardDisplaySettingsOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [metadataObjectCollapsed, setMetadataObjectCollapsed] = useState<MetadataObjectCollapsedState>({
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
    if (wizardMode === 'advanced') return;
    setCollapsedSections((prev) => {
      const firstOpenSection = NORMAL_SECTION_ORDER.find((key) => prev[key] === false) || 'metadata';
      return {
        metadata: firstOpenSection !== 'metadata',
        encryption: firstOpenSection !== 'encryption',
        worker: firstOpenSection !== 'worker',
        publish: firstOpenSection !== 'publish',
      };
    });
  }, [wizardMode]);

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
