import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

import styles from './SBTPage.module.scss';

type SbtPageActionButtonClassName = string | (typeof styles)[keyof typeof styles];

export type SbtPageStatusActionButtonContentState = {
  failureLabel: React.ReactNode;
  idleLabel: React.ReactNode;
  shouldRenderFailure: boolean;
  shouldRenderIdleLabel: boolean;
  shouldRenderPendingIcon: boolean;
  shouldRenderSuccess: boolean;
  successLabel: React.ReactNode;
};

export type SbtPageStatusActionButtonProps = {
  className: SbtPageActionButtonClassName;
  contentState: SbtPageStatusActionButtonContentState;
  disabled?: boolean;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
};

const SbtPageStatusActionButton = ({
  className,
  contentState,
  disabled = false,
  onClick,
  title,
}: SbtPageStatusActionButtonProps): React.ReactElement => {
  const titleProps = title === undefined ? {} : { title };

  return (
    <div>
      <button onClick={onClick} disabled={disabled} className={className} {...titleProps}>
        {contentState.shouldRenderIdleLabel && contentState.idleLabel}
        {contentState.shouldRenderPendingIcon && <FontAwesomeIcon icon={faSpinner} spin />}
        {contentState.shouldRenderSuccess && (
          <>
            {contentState.successLabel} <FontAwesomeIcon icon={faCheck} />
          </>
        )}
        {contentState.shouldRenderFailure && (
          <>
            {contentState.failureLabel} <FontAwesomeIcon icon={faTimes} />
          </>
        )}
      </button>
    </div>
  );
};

export default SbtPageStatusActionButton;
