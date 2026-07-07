/** @file ToolExplorerPluginExplainer.tsx */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';

import styles from './ToolExplorer.module.scss';
import CETooltip from '../Shared/CETooltip';

type ToolExplorerPluginExplainerProps = {
  explainText?: string | null;
};

const ToolExplorerPluginExplainer = ({ explainText }: ToolExplorerPluginExplainerProps) => {
  const idRef = React.useRef('explorerAbout-' + Math.random().toString(36).slice(2, 9));

  if (!explainText) return null;

  return (
    <span className={styles.explainerTooltipIcon}>
      <FontAwesomeIcon
        icon={faQuestionCircle}
        id={idRef.current}
        style={{ cursor: 'pointer', opacity: 0.65, fontSize: '1.1em' }}
      />
      <CETooltip placement="top" target={idRef.current} delay={{ show: 100, hide: 300 }}>
        {explainText}
      </CETooltip>
    </span>
  );
};

export default ToolExplorerPluginExplainer;
