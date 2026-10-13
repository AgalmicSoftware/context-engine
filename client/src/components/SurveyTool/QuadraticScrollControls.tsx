import React, { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './QuadraticAllocationInput.module.scss';

type ScrollControlsTarget = {
  target: HTMLDivElement | null;
  setTarget: (target: HTMLDivElement | null) => void;
};

const ScrollControlsContext = createContext<ScrollControlsTarget | null>(null);

export function QuadraticScrollControlsProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);
  return <ScrollControlsContext.Provider value={value}>{children}</ScrollControlsContext.Provider>;
}

export function QuadraticScrollControlsSlot() {
  const context = useContext(ScrollControlsContext);
  return <div ref={context?.setTarget} className={styles.scrollSlot} />;
}

export function QuadraticScrollControls({ children }: { children: React.ReactNode }) {
  const context = useContext(ScrollControlsContext);
  // The input owns its controls; a per-card target keeps concurrent cards isolated.
  // Standalone inputs and temporarily absent footers retain the inline controls.
  return context?.target ? createPortal(children, context.target) : <>{children}</>;
}
