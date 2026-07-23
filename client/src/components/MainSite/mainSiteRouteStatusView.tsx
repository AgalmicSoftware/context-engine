import React from 'react';

const statusViewStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '50vh',
  color: 'white',
};

type MainSiteRouteStatusViewProps = {
  heading: string;
  message?: React.ReactNode;
  showSpinner?: boolean;
  actionLabel?: string;
  onAction?: () => void;
};

export const MainSiteRouteStatusView = ({
  heading,
  message,
  showSpinner = false,
  actionLabel,
  onAction,
}: MainSiteRouteStatusViewProps) => (
  <div style={statusViewStyle}>
    <h3>{heading}</h3>
    {message ? <p>{message}</p> : null}
    {showSpinner ? <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" /> : null}
    {actionLabel && onAction ? (
      <button className="btn btn-outline-light" onClick={onAction}>
        {actionLabel}
      </button>
    ) : null}
  </div>
);
