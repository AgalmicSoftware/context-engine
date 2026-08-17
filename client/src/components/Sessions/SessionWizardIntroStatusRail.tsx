import React from 'react';

import type { NormalModeCard } from './sessionWizardNormalModeCards';
import SessionWizardNormalModeRail from './SessionWizardNormalModeRail';
import SessionWizardRequirementsBanner from './SessionWizardRequirementsBanner';
import SessionWizardSponsoredStatus from './SessionWizardSponsoredStatus';

type SessionWizardIntroStatusRailProps = {
  activeNormalModeIndex: number;
  cloudflareTokenSlug?: string;
  collapsedSections: Record<string, boolean>;
  fundingRequirementHref?: string;
  fundingRequirementLabel: string;
  isNormalMode: boolean;
  newSessionRequiresLitCredential?: boolean;
  normalModeCards: NormalModeCard[];
  onSponsoredBundleKeyChange?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['onDecryptionKeyChange'];
  onDismissRequirements: () => void;
  onFocusNormalModeSection: (key: string) => void;
  onRetrySponsoredBundle: () => void;
  onSubmitSponsoredBundleKey?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['onSubmitDecryptionKey'];
  requiredAiProviderKeyLabels?: React.ComponentProps<
    typeof SessionWizardRequirementsBanner
  >['requiredAiProviderKeyLabels'];
  requiredRequirementIds?: React.ComponentProps<typeof SessionWizardRequirementsBanner>['requiredRequirementIds'];
  showNewSessionRequirementsBanner: boolean;
  showNormalModeRail?: boolean;
  sponsoredBundleKey?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['decryptionKey'];
  sponsoredBundleStatus?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['status'];
};

const SessionWizardIntroStatusRail = ({
  activeNormalModeIndex,
  cloudflareTokenSlug = '',
  collapsedSections,
  fundingRequirementHref = '',
  fundingRequirementLabel,
  isNormalMode,
  newSessionRequiresLitCredential = true,
  normalModeCards,
  onSponsoredBundleKeyChange,
  onDismissRequirements,
  onFocusNormalModeSection,
  onRetrySponsoredBundle,
  onSubmitSponsoredBundleKey,
  requiredAiProviderKeyLabels,
  requiredRequirementIds,
  showNewSessionRequirementsBanner,
  showNormalModeRail = true,
  sponsoredBundleKey = '',
  sponsoredBundleStatus = null,
}: SessionWizardIntroStatusRailProps): React.ReactElement => (
  <>
    {showNewSessionRequirementsBanner ? (
      <SessionWizardRequirementsBanner
        cloudflareTokenSlug={cloudflareTokenSlug}
        fundingRequirementHref={fundingRequirementHref}
        fundingRequirementLabel={fundingRequirementLabel}
        newSessionRequiresLitCredential={newSessionRequiresLitCredential}
        onDismiss={onDismissRequirements}
        requiredAiProviderKeyLabels={requiredAiProviderKeyLabels}
        requiredRequirementIds={requiredRequirementIds}
      />
    ) : null}

    <SessionWizardSponsoredStatus
      decryptionKey={sponsoredBundleKey}
      onDecryptionKeyChange={onSponsoredBundleKeyChange}
      onRetry={onRetrySponsoredBundle}
      onSubmitDecryptionKey={onSubmitSponsoredBundleKey}
      status={sponsoredBundleStatus}
    />

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
