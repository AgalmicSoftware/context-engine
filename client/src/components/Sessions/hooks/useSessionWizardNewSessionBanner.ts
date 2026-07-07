import { useCallback, useState } from 'react';
import {
  readSessionWizardNewSessionBannerDismissed,
  writeSessionWizardNewSessionBannerDismissed,
} from '../sessionWizardRouteState';

export interface UseSessionWizardNewSessionBannerOptions {
  hasSponsoredBundleLink: boolean;
  newSessionBannerDismissalContextKey: string;
}

const useSessionWizardNewSessionBanner = ({
  hasSponsoredBundleLink,
  newSessionBannerDismissalContextKey,
}: UseSessionWizardNewSessionBannerOptions) => {
  const [persistedNewSessionBannerDismissed, setPersistedNewSessionBannerDismissed] = useState(() =>
    readSessionWizardNewSessionBannerDismissed(),
  );
  const [newSessionBannerDismissedContext, setNewSessionBannerDismissedContext] = useState('');

  const handleDismissNewSessionRequirementsBanner = useCallback(() => {
    if (newSessionBannerDismissalContextKey) {
      setNewSessionBannerDismissedContext(newSessionBannerDismissalContextKey);
    }
    if (!hasSponsoredBundleLink) {
      setPersistedNewSessionBannerDismissed(true);
      writeSessionWizardNewSessionBannerDismissed();
    }
  }, [hasSponsoredBundleLink, newSessionBannerDismissalContextKey]);

  return {
    persistedNewSessionBannerDismissed,
    newSessionBannerDismissedContext,
    handleDismissNewSessionRequirementsBanner,
  };
};

export default useSessionWizardNewSessionBanner;
