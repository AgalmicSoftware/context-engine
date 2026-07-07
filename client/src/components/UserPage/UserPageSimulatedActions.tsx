import React from 'react';

import styles from './UserPage.module.scss';

type UserPageSimulatedActionsProps = {
  isSimulated?: boolean;
  onViewResponses: () => unknown;
};

const UserPageSimulatedActions = ({
  isSimulated = false,
  onViewResponses,
}: UserPageSimulatedActionsProps): React.ReactElement | null => {
  if (!isSimulated) return null;

  return (
    <div className={styles.simulatedUserActions}>
      <button onClick={onViewResponses}>View Simulated Responses</button>
    </div>
  );
};

export default UserPageSimulatedActions;
