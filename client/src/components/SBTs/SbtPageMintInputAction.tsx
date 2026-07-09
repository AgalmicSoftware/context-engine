import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';

export type SbtPageMintInputActionContentState = {
  label?: string;
  shouldRenderLabel?: boolean;
  shouldRenderPendingIcon?: boolean;
};

export type SbtPageMintInputActionProps = {
  buttonClassName: string;
  contentState: SbtPageMintInputActionContentState;
  disabled?: boolean;
  inputType: 'password' | 'text';
  inputValue?: string;
  onAction: React.MouseEventHandler<HTMLButtonElement>;
  onInputChange: React.ChangeEventHandler<HTMLInputElement>;
  placeholder: string;
};

const SbtPageMintInputAction = ({
  buttonClassName,
  contentState,
  disabled = false,
  inputType,
  inputValue = '',
  onAction,
  onInputChange,
  placeholder,
}: SbtPageMintInputActionProps): React.ReactElement => (
  <div id={styles.mintButtonArea}>
    <div className={styles.passwordEntry}>
      <input
        type={inputType}
        className={styles.input}
        value={inputValue}
        onChange={onInputChange}
        placeholder={placeholder}
      />
    </div>
    <button onClick={onAction} disabled={disabled} className={buttonClassName}>
      {contentState.shouldRenderPendingIcon && <FontAwesomeIcon icon={faSpinner} spin />}
      {contentState.shouldRenderLabel && contentState.label}
    </button>
  </div>
);

export default SbtPageMintInputAction;
