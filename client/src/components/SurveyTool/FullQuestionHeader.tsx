import React from 'react';
import type { ReactNode } from 'react';
import styles from './SurveyTool.module.scss';

type FullQuestionHeaderProps = {
  children?: ReactNode;
};

const FullQuestionHeader = ({ children = null }: FullQuestionHeaderProps) => (
  <div className={styles.fullQuestionHeader}>{children}</div>
);

export default FullQuestionHeader;
