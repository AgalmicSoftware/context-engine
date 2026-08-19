import { useCallback, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';

import type { SessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import type { UnknownRecord } from '../../../utilities/session/sessionTypes';
import SessionModeProfileSections from '../SessionModeProfileSections';
import SessionWizardSessionModeProfileControl from '../SessionWizardSessionModeProfileControl';
import type { SessionWizardTooltipRenderOptions } from '../SessionWizardInfoTooltip';
import { applySessionModeProfileSelectionToDraft } from '../sessionWizardModeProfileDraftController';

type SessionModeDraft = UnknownRecord & {
  sessionModeProfile?: unknown;
};

type SessionWizardModeProfileControlsProps<Draft extends SessionModeDraft, Sections extends { encryption: boolean }> = {
  draft: Draft;
  draftRef: MutableRefObject<Draft>;
  entryOnly: boolean;
  onContinue: () => void;
  onEnterAdvancedMode: () => void;
  onEnterNormalMode: () => void;
  customizing: boolean;
  registryChainId: number | null;
  renderInfoTooltip?: (options: SessionWizardTooltipRenderOptions) => ReactNode;
  setCollapsedSections: Dispatch<SetStateAction<Sections>>;
  setDraft: Dispatch<SetStateAction<Draft>>;
  showContinue: boolean;
};

export type SessionWizardModeProfileControls = {
  header: ReactNode;
  privacy: ReactNode;
  publish: ReactNode;
  worker: ReactNode;
};

const focusSessionModeProfilePrivacy = <Sections extends { encryption: boolean }>(
  setCollapsedSections: Dispatch<SetStateAction<Sections>>,
) => {
  setCollapsedSections((prev) => ({ ...prev, encryption: false }));
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame?.(() => {
    const section = document.getElementById('session-wizard-section-encryption');
    if (section && typeof section.scrollIntoView === 'function') {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
};

const useSessionWizardModeProfileControls = <Draft extends SessionModeDraft, Sections extends { encryption: boolean }>({
  draft,
  draftRef,
  entryOnly,
  onContinue,
  onEnterAdvancedMode,
  onEnterNormalMode,
  customizing,
  registryChainId,
  renderInfoTooltip,
  setCollapsedSections,
  setDraft,
  showContinue,
}: SessionWizardModeProfileControlsProps<Draft, Sections>): SessionWizardModeProfileControls => {
  const handleChange = useCallback(
    (profile: SessionModeProfile, compiled: { storageProfile: UnknownRecord }) => {
      setDraft((prev) => {
        const next = applySessionModeProfileSelectionToDraft(prev, profile, compiled);
        draftRef.current = next;
        return next;
      });
    },
    [draftRef, setDraft],
  );

  const sharedSectionProps = {
    registryChainId,
    renderInfoTooltip,
    value: draft.sessionModeProfile,
    onChange: handleChange,
  };

  return {
    header: (
      <SessionWizardSessionModeProfileControl
        {...sharedSectionProps}
        onContinue={onContinue}
        onCustomize={() => {
          if (customizing) {
            onEnterNormalMode();
            return;
          }
          onEnterAdvancedMode();
          focusSessionModeProfilePrivacy(setCollapsedSections);
        }}
        onSelectPreset={onEnterNormalMode}
        customizing={customizing}
        entryOnly={entryOnly}
        showContinue={showContinue}
      />
    ),
    privacy: <SessionModeProfileSections {...sharedSectionProps} section="privacy" />,
    worker: <SessionModeProfileSections {...sharedSectionProps} section="worker" />,
    publish: <SessionModeProfileSections {...sharedSectionProps} section="publish" />,
  };
};

export default useSessionWizardModeProfileControls;
