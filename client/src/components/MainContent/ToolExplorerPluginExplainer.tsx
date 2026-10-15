/** @file ToolExplorerPluginExplainer.tsx */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Popover } from 'reactstrap';

import styles from './ToolExplorer.module.scss';

type ToolExplorerPluginExplainerProps = {
  explainText?: string | null;
  label?: string;
};

const ToolExplorerPluginExplainer = ({ explainText, label = 'About this tool' }: ToolExplorerPluginExplainerProps) => {
  const idRef = React.useRef('explorerAbout-' + Math.random().toString(36).slice(2, 9));
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const helpId = `${idRef.current}-content`;

  React.useEffect(() => {
    if (!isOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !buttonRef.current?.contains(target) &&
        !document.getElementById(helpId)?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissEscape);
    };
  }, [helpId, isOpen]);

  if (!explainText) return null;

  return (
    <>
      <button
        ref={buttonRef}
        id={idRef.current}
        type="button"
        className={styles.explainerTooltipIcon}
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? helpId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
        }}
      >
        <FontAwesomeIcon icon={faQuestionCircle} style={{ opacity: 0.65, fontSize: '1.1em' }} />
      </button>
      {/* Explicit help uses popover chrome so disabling automatic tooltips cannot remove it. */}
      {isOpen && (
        <Popover
          id={helpId}
          placement="top"
          target={idRef.current}
          isOpen={isOpen}
          trigger="manual"
          fade={false}
          hideArrow
          popperClassName={styles.explainerPopover}
          innerClassName={styles.explainerPopoverContent}
        >
          {explainText}
        </Popover>
      )}
    </>
  );
};

export default ToolExplorerPluginExplainer;
