import { useCallback, type Dispatch, type MutableRefObject, type ReactNode, type SetStateAction } from 'react';

import { E2E_TESTIDS } from '../../../utilities/e2eTestIds.js';
import type { SessionModeProfile } from '../../../utilities/session/sessionModeProfile';
import type { UnknownRecord } from '../../../utilities/session/sessionTypes';
import styles from '../SessionWizard.module.scss';
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
  showPresetToggle?: boolean;
};

export type SessionWizardModeProfileControls = {
  header: ReactNode;
  privacy: ReactNode;
  publish: ReactNode;
  resume: ReactNode;
  worker: ReactNode;
};

const isSessionModeProfile = (value: unknown): value is SessionModeProfile =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (value as { profileVersion?: unknown }).profileVersion === 1;

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
  showPresetToggle = true,
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
  const showResume = entryOnly && isSessionModeProfile(draft.sessionModeProfile);

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
        showPresetToggle={showPresetToggle}
      />
    ),
    resume: showResume ? (
      <button
        type="button"
        className={styles.modeSavedProfileResumeButton}
        onClick={onContinue}
        data-testid={E2E_TESTIDS.WIZARD_MODE_RESUME}
      >
        Resume existing setup
      </button>
    ) : null,
    privacy: <SessionModeProfileSections {...sharedSectionProps} section="privacy" />,
    worker: <SessionModeProfileSections {...sharedSectionProps} section="worker" />,
    publish: <SessionModeProfileSections {...sharedSectionProps} section="publish" />,
  };
};

export default useSessionWizardModeProfileControls;
