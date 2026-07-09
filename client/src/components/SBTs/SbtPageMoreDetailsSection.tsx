import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';

type SbtPageSectionToggleState = {
  isOpen?: boolean;
  shouldRenderClosedIcon?: boolean;
  shouldRenderOpenIcon?: boolean;
};

type SbtPageMoreDetailsSectionProps = {
  onToggle?: React.MouseEventHandler<HTMLHeadingElement>;
  relevantInfo?: React.ReactNode;
  sectionHeaderClassName?: string;
  toggleState?: SbtPageSectionToggleState;
};

const SbtPageMoreDetailsSection = ({
  onToggle,
  relevantInfo = null,
  sectionHeaderClassName,
  toggleState = {},
}: SbtPageMoreDetailsSectionProps): React.ReactElement => (
  <div className={styles.moreDetailsSection}>
    <h2 className={sectionHeaderClassName} onClick={onToggle}>
      MORE {toggleState.shouldRenderOpenIcon && <FontAwesomeIcon icon={faChevronUp} />}
      {toggleState.shouldRenderClosedIcon && <FontAwesomeIcon icon={faChevronDown} />}
    </h2>
    {toggleState.isOpen && relevantInfo}
  </div>
);

export default SbtPageMoreDetailsSection;
