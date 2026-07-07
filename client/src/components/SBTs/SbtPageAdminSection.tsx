import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';

type SbtPageSectionToggleState = {
  isOpen?: boolean;
  shouldRenderClosedIcon?: boolean;
  shouldRenderOpenIcon?: boolean;
};

type SbtPageAdminSectionProps = {
  adminActions?: React.ReactNode;
  isAdmin?: boolean;
  onToggle?: React.MouseEventHandler<HTMLHeadingElement>;
  sectionHeaderClassName?: string;
  toggleState?: SbtPageSectionToggleState;
};

const SbtPageAdminSection = ({
  adminActions = null,
  isAdmin = false,
  onToggle,
  sectionHeaderClassName,
  toggleState = {},
}: SbtPageAdminSectionProps): React.ReactElement | null => {
  if (!isAdmin) return null;

  return (
    <div className={styles.adminSection}>
      <h2 className={sectionHeaderClassName} onClick={onToggle}>
        ADMIN {toggleState.shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
        {toggleState.shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
      </h2>
      {toggleState.isOpen && <div className={styles.adminContainer}>{adminActions}</div>}
    </div>
  );
};

export default SbtPageAdminSection;
