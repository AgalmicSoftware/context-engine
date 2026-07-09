import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import styles from './JsonControls.module.scss';

type JsonButtonProps = {
  label: string;
  icon?: IconProp;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  className?: string;
  disabled?: boolean;
};

export const JsonIconButton = ({ label, icon, onClick, title, className = '', disabled = false }: JsonButtonProps) => (
  <button
    type="button"
    className={`${styles.jsonIconButton} ${className}`.trim()}
    onClick={onClick}
    title={title}
    aria-label={title || label}
    disabled={disabled}
  >
    <span className={styles.jsonIconLabel}>{label}</span>
    {icon && <FontAwesomeIcon icon={icon} className={styles.jsonIconGlyph} />}
  </button>
);

export const JsonToggleButton = ({
  label,
  active = false,
  onClick,
  title,
  className = '',
  disabled = false,
  icon,
  iconPosition = 'right',
}: JsonButtonProps & {
  active?: boolean;
  iconPosition?: 'left' | 'right';
}) => (
  <button
    type="button"
    className={`${styles.jsonToggleButton} ${active ? styles.jsonToggleButtonActive : ''} ${className}`.trim()}
    onClick={onClick}
    title={title}
    aria-label={label}
    disabled={disabled}
  >
    {icon && iconPosition === 'left' && <FontAwesomeIcon icon={icon} className={styles.jsonToggleIcon} />}
    <span className={styles.jsonToggleLabel}>{label}</span>
    {icon && iconPosition === 'right' && <FontAwesomeIcon icon={icon} className={styles.jsonToggleIcon} />}
  </button>
);

type JsonPanelProps = {
  onCopy?: React.MouseEventHandler<HTMLButtonElement>;
  copied?: boolean;
  copyTitle?: string;
  children: React.ReactNode;
  as?: React.ElementType;
  contentProps?: React.HTMLAttributes<HTMLElement> & Record<string, unknown>;
  className?: string;
};

export const JsonPanel = ({
  onCopy,
  copied = false,
  copyTitle = 'Copy JSON',
  children,
  as: Component = 'div',
  contentProps = {},
  className = '',
}: JsonPanelProps) => {
  const mergedContentClassName = `${styles.jsonContent} ${contentProps.className || ''}`.trim();

  return (
    <div className={`${styles.jsonPanel} ${className}`.trim()}>
      {onCopy && (
        <button
          type="button"
          className={`${styles.jsonCopyButton} ${copied ? styles.jsonCopySuccess : ''}`.trim()}
          onClick={onCopy}
          title={copyTitle}
          aria-label={copyTitle}
        >
          <FontAwesomeIcon icon={copied ? faCheck : faClipboard} />
        </button>
      )}
      <Component {...contentProps} className={mergedContentClassName}>
        {children}
      </Component>
    </div>
  );
};

export const JsonButtonRow = ({
  children,
  align = 'start',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) => {
  const alignmentClass =
    align === 'center' ? styles.jsonButtonRowCenter : align === 'end' ? styles.jsonButtonRowEnd : '';

  return <div className={`${styles.jsonButtonRow} ${alignmentClass} ${className}`.trim()}>{children}</div>;
};
