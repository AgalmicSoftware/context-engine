import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SessionWizard.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { JsonButtonRow, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import type { SessionWizardRenderField } from './sessionWizardFieldDescriptors';

type SessionMetadataEditorProps = {
  isNormalMode: boolean;
  wizardMode: string;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  headerAccessory?: React.ReactNode;
  primaryEntries: Array<[string, unknown]>;
  moreOptionsEntries: Array<[string, unknown]>;
  moreOptionsOpen: boolean;
  onToggleMoreOptions: () => void;
  renderField: SessionWizardRenderField;
  draft: Record<string, unknown>;
  showJsonPreview: boolean;
  onToggleJsonPreview: () => void;
  onCopyDraftJson: () => void;
  jsonCopied: boolean;
};

const SessionMetadataEditor = ({
  isNormalMode,
  wizardMode,
  isCollapsed,
  onToggleCollapsed,
  headerAccessory = null,
  primaryEntries,
  moreOptionsEntries,
  moreOptionsOpen,
  onToggleMoreOptions,
  renderField,
  draft,
  showJsonPreview,
  onToggleJsonPreview,
  onCopyDraftJson,
  jsonCopied,
}: SessionMetadataEditorProps) => {
  const renderMoreOptionsSection = () => {
    if (!moreOptionsEntries.length) return null;
    const toggleLabel = wizardMode === 'advanced' ? 'More options' : 'Optional details';
    return (
      <div className={styles.moreOptionsSection}>
        <button type="button" className={styles.moreOptionsToggle} onClick={onToggleMoreOptions}>
          {toggleLabel} <FontAwesomeIcon icon={moreOptionsOpen ? faCaretUp : faCaretDown} style={{ marginLeft: 6 }} />
        </button>
        {moreOptionsOpen ? (
          <div className={styles.moreOptionsBody}>
            {moreOptionsEntries.map(([key, value]) =>
              renderField(key, value, [], isNormalMode && key === 'blockLimits' ? { forceShow: true } : undefined),
            )}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section id="session-wizard-section-metadata" className={styles.panel}>
      {wizardMode === 'advanced' ? (
        <div className={styles.panelHeaderRow}>
          <button
            type="button"
            className={styles.panelHeader}
            onClick={onToggleCollapsed}
            data-testid={E2E_TESTIDS.WIZARD_METADATA_PANEL_TOGGLE}
          >
            <span className={styles.panelTitle}>Session Information</span>
            <FontAwesomeIcon icon={isCollapsed ? faCaretDown : faCaretUp} />
          </button>
          {headerAccessory}
        </div>
      ) : null}
      {isNormalMode || !isCollapsed ? (
        <div className={styles.panelBody}>
          <div className={styles.objectBody}>
            {primaryEntries.map(([key, value]) => {
              if (key === 'blockLimits') return null;
              if (isNormalMode && key === 'sessionName') {
                return (
                  <div key={`${key}-row`} className={styles.sessionIdentityRow}>
                    <div className={styles.sessionIdentityPrimary}>{renderField(key, value, [])}</div>
                    <div className={styles.sessionIdentitySecondary}>
                      {renderField('sessionHeader', draft?.sessionHeader ?? '', [])}
                    </div>
                  </div>
                );
              }
              if (isNormalMode && key === 'sessionHeader') {
                return <React.Fragment key={`${key}-options`}>{renderMoreOptionsSection()}</React.Fragment>;
              }
              if (key === 'sessionHeader') {
                const blockLimitsValue = draft?.blockLimits;
                return (
                  <React.Fragment key={`${key}-block`}>
                    {renderField(key, value, [])}
                    {blockLimitsValue !== undefined ? renderField('blockLimits', blockLimitsValue, []) : null}
                    {renderMoreOptionsSection()}
                  </React.Fragment>
                );
              }
              return renderField(key, value, []);
            })}
          </div>
          {wizardMode === 'advanced' ? (
            <>
              <JsonButtonRow>
                <JsonToggleButton
                  label="view .json"
                  active={showJsonPreview}
                  onClick={onToggleJsonPreview}
                  title="Preview session metadata JSON"
                />
              </JsonButtonRow>
              {showJsonPreview ? (
                <JsonPanel onCopy={onCopyDraftJson} copied={jsonCopied} as="pre">
                  {JSON.stringify(draft, null, 2)}
                </JsonPanel>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
};

export default SessionMetadataEditor;
