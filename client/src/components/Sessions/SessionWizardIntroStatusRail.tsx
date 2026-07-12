import React from 'react';

import type { NormalModeCard } from './sessionWizardNormalModeCards';
import SessionWizardNormalModeRail from './SessionWizardNormalModeRail';
import SessionWizardRequirementsBanner from './SessionWizardRequirementsBanner';
import SessionWizardSponsoredStatus from './SessionWizardSponsoredStatus';

type SessionWizardIntroStatusRailProps = {
  activeNormalModeIndex: number;
  collapsedSections: Record<string, boolean>;
  fundingRequirementHref?: string;
  fundingRequirementLabel: string;
  isNormalMode: boolean;
  newSessionRequiresLitCredential?: boolean;
  normalModeCards: NormalModeCard[];
  onDismissRequirements: () => void;
  onFocusNormalModeSection: (key: string) => void;
  onRetrySponsoredBundle: () => void;
  requiredRequirementIds?: React.ComponentProps<typeof SessionWizardRequirementsBanner>['requiredRequirementIds'];
  showNewSessionRequirementsBanner: boolean;
  showNormalModeRail?: boolean;
  sponsoredBundleStatus?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['status'];
};

const SessionWizardIntroStatusRail = ({
  activeNormalModeIndex,
  collapsedSections,
  fundingRequirementHref = '',
  fundingRequirementLabel,
  isNormalMode,
  newSessionRequiresLitCredential = true,
  normalModeCards,
  onDismissRequirements,
  onFocusNormalModeSection,
  onRetrySponsoredBundle,
  requiredRequirementIds,
  showNewSessionRequirementsBanner,
  showNormalModeRail = true,
  sponsoredBundleStatus = null,
}: SessionWizardIntroStatusRailProps): React.ReactElement => (
  <>
    {showNewSessionRequirementsBanner ? (
      <SessionWizardRequirementsBanner
        fundingRequirementHref={fundingRequirementHref}
        fundingRequirementLabel={fundingRequirementLabel}
        newSessionRequiresLitCredential={newSessionRequiresLitCredential}
        onDismiss={onDismissRequirements}
        requiredRequirementIds={requiredRequirementIds}
      />
    ) : null}

    <SessionWizardSponsoredStatus onRetry={onRetrySponsoredBundle} status={sponsoredBundleStatus} />

    {isNormalMode && showNormalModeRail ? (
      <SessionWizardNormalModeRail
        activeNormalModeIndex={activeNormalModeIndex}
        collapsedSections={collapsedSections}
        normalModeCards={normalModeCards}
        onFocusSection={onFocusNormalModeSection}
      />
    ) : null}
  </>
);

export default SessionWizardIntroStatusRail;
