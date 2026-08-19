import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';

import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY,
  GROUP_CREATION_POLICIES,
  normalizeGroupCreationPolicy,
  type GroupCreationPolicy,
} from '../../utilities/session/groupCreationPolicy';
import styles from './SessionWizard.module.scss';

export interface SessionGroupCreationPolicyFieldProps {
  isWorkerCanonical: boolean;
  value?: unknown;
  onChange: (value: GroupCreationPolicy) => void;
}

const SessionGroupCreationPolicyField = ({
  isWorkerCanonical,
  value,
  onChange,
}: SessionGroupCreationPolicyFieldProps): React.ReactElement => {
  const policy = normalizeGroupCreationPolicy(value, DEFAULT_NEW_SESSION_GROUP_CREATION_POLICY);
  const helpId = 'ce-wizard-group-creation-policy-help';

  return (
    <FormGroup className={styles.fieldGroup}>
      <Label for={E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY}>Who can create groups?</Label>
      <Input
        id={E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY}
        type="select"
        value={policy}
        data-testid={E2E_TESTIDS.WIZARD_GROUP_CREATION_POLICY}
        aria-describedby={helpId}
        onChange={(event) => onChange(event.target.value as GroupCreationPolicy)}
      >
        <option value={GROUP_CREATION_POLICIES.PARTICIPANTS}>All participants</option>
        <option value={GROUP_CREATION_POLICIES.ADMIN_ONLY}>Admins only</option>
      </Input>
      <p id={helpId} className={styles.helperText}>
        {isWorkerCanonical
          ? 'Participant-created groups are open to session participants. Updating groups and managing membership remain admin-only.'
          : 'This controls group creation in Context Engine. Public SBT factories remain callable directly on-chain, so “Admins only” cannot block independent contract deployments.'}
      </p>
    </FormGroup>
  );
};

export default SessionGroupCreationPolicyField;
