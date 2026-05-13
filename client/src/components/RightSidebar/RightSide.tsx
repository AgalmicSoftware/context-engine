import React from 'react';
import styles from './RightSide.module.scss';

const RightSide = () => {
  return (
    <aside className={styles.rightSideContainer} data-testid="ce-home-right-sidebar">
      <div className={styles.rightSideCard} aria-hidden="true" />
    </aside>
  );
};

export default RightSide;
