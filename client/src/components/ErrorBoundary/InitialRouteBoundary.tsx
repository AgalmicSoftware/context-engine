import React, { Suspense, useEffect } from 'react';
import { clearStaleChunkReloadMarker } from '../../bootRecovery.js';
import RouteErrorBoundary from './RouteErrorBoundary';

type InitialRouteBoundaryProps = {
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  resetKey?: string | number | null;
};

export const BootRecoveryReady = () => {
  useEffect(() => {
    clearStaleChunkReloadMarker();
  }, []);

  return null;
};

const InitialRouteBoundary = ({ children, fallback = null, resetKey }: InitialRouteBoundaryProps) => (
  <Suspense fallback={fallback}>
    <RouteErrorBoundary resetKey={resetKey}>
      {children}
      <BootRecoveryReady />
    </RouteErrorBoundary>
  </Suspense>
);

export default InitialRouteBoundary;
