/** @file LazyFallback.tsx */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import React from 'react';

type LazyFallbackProps = {
  label?: React.ReactNode;
  subtext?: React.ReactNode;
  minHeight?: React.CSSProperties['minHeight'];
};

export default function LazyFallback({ label = 'Loading...', subtext = '', minHeight = '40vh' }: LazyFallbackProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 18px',
          borderRadius: '8px',
          background: 'transparent',
          color: 'white',
          textAlign: 'center',
          maxWidth: '560px',
        }}
      >
        {label ? <div style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{label}</div> : null}
        {subtext ? <div style={{ marginTop: '0.5rem', opacity: 0.85 }}>{subtext}</div> : null}
        <FontAwesomeIcon icon={faSpinner} spin style={{ marginTop: '1rem', fontSize: '1.5rem', opacity: 0.7 }} />
      </div>
    </div>
  );
}
