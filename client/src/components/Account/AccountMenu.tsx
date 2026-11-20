import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

import styles from './Account.module.scss';

/** The account dialog's list: one row per action, an icon at the start of each. */
export const AccountMenu = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <ul className={styles.accountMenu} data-testid="ce-account-menu">
    {children}
  </ul>
);

type AccountMenuRowProps = {
  icon: IconDefinition;
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  /** Red, for the row that signs out. */
  danger?: boolean;
  testId?: string;
};

export const AccountMenuRow = ({
  icon,
  children,
  onClick,
  title,
  danger = false,
  testId,
}: AccountMenuRowProps): React.ReactElement => (
  <li className={styles.accountMenuItem}>
    <button
      type="button"
      className={danger ? `${styles.accountMenuRow} ${styles.accountMenuRowDanger}` : styles.accountMenuRow}
      data-ce-control-appearance="frameless"
      onClick={onClick}
      title={title}
      data-testid={testId}
    >
      <FontAwesomeIcon icon={icon} className={styles.accountMenuIcon} aria-hidden="true" fixedWidth />
      <span>{children}</span>
    </button>
  </li>
);
