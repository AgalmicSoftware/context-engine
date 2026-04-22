/** @file FeaturedSbtField.jsx */
import React from 'react';
import { FormGroup, Label } from 'reactstrap';
import SBTSelector from '../SBTs/SBTSelector.jsx';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import styles from './SessionWizard.module.scss';

const FeaturedSbtField = ({
  label,
  tooltipControl,
  createButtonLabel,
  onCreateSbt,
  selectedSBTs,
  onSelectionsChange,
  onRemove,
  selectorLabel,
  network,
  additionalSBTOptions,
  chainId,
  sessionSlug,
  sessionConfig,
  sbtCacheRevision,
  ensureLightSbtUniverse,
}) => {
  const selections = Array.isArray(selectedSBTs) ? selectedSBTs : [];

  return (
    <FormGroup className={styles.fieldGroup}>
      <div className={styles.fieldHeader}>
        <div className={styles.fieldLabelRow}>
          <Label>{label}</Label>
          {tooltipControl}
          <button
            type="button"
            className={styles.inlineLinkButton}
            onClick={onCreateSbt}
            data-testid={E2E_TESTIDS.WIZARD_CREATE_SBT}
            data-ce-sbt-target="defaultFeaturedSBTs"
          >
            {createButtonLabel}
          </button>
        </div>
      </div>
      <SBTSelector
        id="default-featured-sbts"
        label={selectorLabel}
        selectedSBTs={selections}
        onAddSBT={(sbt) => {
          onSelectionsChange([...selections, sbt]);
        }}
        onRemoveSBT={(address) => onRemove(address)}
        network={network}
        additionalSBTOptions={additionalSBTOptions}
        chainId={chainId}
        sessionSlug={sessionSlug}
        sessionConfig={sessionConfig}
        sbtCacheRevision={sbtCacheRevision}
        ensureLightSbtUniverse={ensureLightSbtUniverse}
        variant="admin"
        defaultFeaturedSBTs={selections.map((entry) => entry.address)}
      />
    </FormGroup>
  );
};

export default FeaturedSbtField;
