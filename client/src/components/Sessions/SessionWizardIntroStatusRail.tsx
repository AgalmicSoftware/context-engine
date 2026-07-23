import React from 'react';

import type { NormalModeCard } from './sessionWizardNormalModeCards';
import SessionWizardNormalModeRail from './SessionWizardNormalModeRail';
import SessionWizardRequirementsBanner from './SessionWizardRequirementsBanner';
import SessionWizardSponsoredStatus from './SessionWizardSponsoredStatus';

type SessionWizardIntroStatusRailProps = {
  activeNormalModeIndex: number;
  cloudflareTokenAccountId?: string;
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
  requiredRequirementIds?: React.ComponentProps<typeof SessionWizardRequirementsBanner>['requiredRequirementIds'];
  showNewSessionRequirementsBanner: boolean;
  showNormalModeRail?: boolean;
  sponsoredBundleKey?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['decryptionKey'];
  sponsoredBundleStatus?: React.ComponentProps<typeof SessionWizardSponsoredStatus>['status'];
};

const SessionWizardIntroStatusRail = ({
  activeNormalModeIndex,
  cloudflareTokenAccountId = '',
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
  requiredRequirementIds,
  showNewSessionRequirementsBanner,
  showNormalModeRail = true,
  sponsoredBundleKey = '',
  sponsoredBundleStatus = null,
}: SessionWizardIntroStatusRailProps): React.ReactElement => (
  <>
    {showNewSessionRequirementsBanner ? (
      <SessionWizardRequirementsBanner
        cloudflareTokenAccountId={cloudflareTokenAccountId}
        cloudflareTokenSlug={cloudflareTokenSlug}
        fundingRequirementHref={fundingRequirementHref}
        fundingRequirementLabel={fundingRequirementLabel}
        newSessionRequiresLitCredential={newSessionRequiresLitCredential}
        onDismiss={onDismissRequirements}
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
