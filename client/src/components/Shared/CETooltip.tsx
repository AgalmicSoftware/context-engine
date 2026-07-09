import React, { useContext } from 'react';
import { ReactReduxContext, useSelector } from 'react-redux';
import { UncontrolledTooltip } from 'reactstrap';
import type { UncontrolledTooltipProps } from 'reactstrap';

type TooltipPreferenceState = {
  sessionState?: {
    tooltipsEnabled?: boolean;
  };
};

const CETooltipEnabled = (props: UncontrolledTooltipProps) => {
  const enabled = useSelector<TooltipPreferenceState, boolean>(
    (state) => state.sessionState?.tooltipsEnabled !== false,
  );

  React.useEffect(() => {
    if (!enabled && typeof document !== 'undefined') {
      document.querySelectorAll('.tooltip.show, .tooltip.fade').forEach((el) => {
        el.remove();
      });
    }
  }, [enabled]);

  if (!enabled) return null;
  return <UncontrolledTooltip {...props} />;
};

const CETooltip = (props: UncontrolledTooltipProps) => {
  const reduxContext = useContext(ReactReduxContext);
  if (!reduxContext?.store) return <UncontrolledTooltip {...props} />;
  return <CETooltipEnabled {...props} />;
};

CETooltip.displayName = 'UncontrolledTooltip';

export default CETooltip;
