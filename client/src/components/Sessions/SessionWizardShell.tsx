/** @file SessionWizardShell.tsx: the one-page setup layout. */
import React, { useState } from 'react';

import styles from './SessionWizard.module.scss';
import setupStyles from './setup/SessionSetup.module.scss';
import EncryptionPanel, { type EncryptionPanelProps } from './EncryptionPanel';
import SessionWizardModals from './SessionWizardModals';
import SessionWizardSponsoredStatus from './SessionWizardSponsoredStatus';
import WorkerPanel, { type WorkerPanelProps } from './WorkerPanel';
import SetupCreatePanel from './setup/SetupCreatePanel';
import { SetupAiSection } from './setup/SetupAiSection';
import {
  SetupBasicsSection,
  SetupContextSection,
  SetupParticipationSection,
  SetupQuestionsSection,
} from './setup/SetupContentSections';
import { SetupAccessSection, SetupHostingSection, SetupResultsSection } from './setup/SetupPolicySections';
import type { SetupSectionKey } from './setup/SetupPrimitives';
import type { SetupProfileEditor } from './setup/setupSectionTypes';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';
import type { SessionSetupConflict } from '../../utilities/session/sessionModeRuleMessages';

type CreatePanelProps = React.ComponentProps<typeof SetupCreatePanel>;
type ModalsProps = React.ComponentProps<typeof SessionWizardModals>;
type SponsoredStatusProps = React.ComponentProps<typeof SessionWizardSponsoredStatus>;

export type SessionWizardShellProps = {
  recoveryKeyDialog?: React.ReactNode;
  /** Export, Import and share-link actions. */
  templateActions?: React.ReactNode;
  /** "This draft came from a link", with its differences. */
  templateNotice?: React.ReactNode;
  /** "Set up with your AI": a prompt whose answer fills in this page. */
  aiSetup?: React.ReactNode;
  draft: Record<string, unknown>;
  updateDraftValue: (path: string[], value: unknown) => void;
  editProfile: SetupProfileEditor;
  conflicts: SessionSetupConflict[];
  registryChainId: number | null;
  onRegistryChainIdChange: (chainId: number) => void;
  isWorkerCanonical: boolean;
  renderField: SessionWizardRenderField;
  slugPreview: React.ReactNode;
  questionsPublisher?: React.ReactNode;
  /** The Context section's files (before Create) and what adds them after it. */
  contextSources?: React.ReactNode;
  contextPublisher?: React.ReactNode;
  encryptionPanelProps: EncryptionPanelProps;
  /** On-chain SBT defaults (tags, featured SBTs) shown under the gates. */
  sbtFieldKeys: string[];
  hostingQuick: React.ReactNode;
  hostingStatus: string;
  workerPanelProps: WorkerPanelProps;
  aiKeys: React.ReactNode;
  sponsoredStatusProps: SponsoredStatusProps;
  createPanelProps: CreatePanelProps;
  modalsProps: ModalsProps;
};

const CLOSED_SECTIONS: Record<SetupSectionKey, boolean> = {
  basics: true,
  context: false,
  questions: false,
  participation: false,
  results: false,
  access: false,
  hosting: false,
  ai: false,
};

const SessionWizardShell = ({
  recoveryKeyDialog = null,
  templateActions = null,
  templateNotice = null,
  aiSetup = null,
  draft,
  updateDraftValue,
  editProfile,
  conflicts,
  registryChainId,
  onRegistryChainIdChange,
  isWorkerCanonical,
  renderField,
  slugPreview,
  questionsPublisher = null,
  contextSources = null,
  contextPublisher = null,
  encryptionPanelProps,
  sbtFieldKeys,
  hostingQuick,
  hostingStatus,
  workerPanelProps,
  aiKeys,
  sponsoredStatusProps,
  createPanelProps,
  modalsProps,
}: SessionWizardShellProps) => {
  const [openSections, setOpenSections] = useState(CLOSED_SECTIONS);
  const section = (key: SetupSectionKey) => ({
    draft,
    onChange: updateDraftValue,
    mode: 'create' as const,
    open: openSections[key],
    onToggle: () => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })),
    conflicts,
  });
  const policy = { editProfile, registryChainId };

  return (
    <div className={styles.groupWizard}>
      <div className={setupStyles.page}>
        {recoveryKeyDialog}
        <header className={setupStyles.pageHeader}>
          <h1 className={setupStyles.pageTitle}>New session</h1>
          {templateActions}
        </header>
        {templateNotice}
        {aiSetup}
        <SessionWizardSponsoredStatus {...sponsoredStatusProps} />
        <SetupBasicsSection
          draft={draft}
          onChange={updateDraftValue}
          link={slugPreview}
          headerImage={renderField('sessionHeader', draft.sessionHeader, [])}
        />
        <SetupContextSection {...section('context')} sources={contextSources} publisher={contextPublisher} />
        <SetupQuestionsSection {...section('questions')} publisher={questionsPublisher} />
        <SetupParticipationSection {...section('participation')} workerHosted={isWorkerCanonical} />
        <SetupResultsSection {...section('results')} {...policy} />
        <SetupAccessSection
          {...section('access')}
          {...policy}
          gates={
            <>
              <EncryptionPanel {...encryptionPanelProps} />
              {sbtFieldKeys.map((key) => (
                <React.Fragment key={key}>{renderField(key, draft[key], [])}</React.Fragment>
              ))}
            </>
          }
        />
        <SetupHostingSection
          {...section('hosting')}
          {...policy}
          status={hostingStatus}
          quick={hostingQuick}
          onRegistryChainChange={onRegistryChainIdChange}
          deployment={<WorkerPanel {...workerPanelProps} />}
        />
        <SetupAiSection {...section('ai')} keys={aiKeys} />
        <SetupCreatePanel {...createPanelProps} />
        <SessionWizardModals {...modalsProps} />
      </div>
    </div>
  );
};

export default SessionWizardShell;
