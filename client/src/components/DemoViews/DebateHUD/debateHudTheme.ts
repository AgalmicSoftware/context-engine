import React from 'react';

export type DebateHudTheme = {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderLight: string;
  text: string;
  textMuted: string;
  textLight: string;
  font: string;
  mono: string;
  radius: number | string;
  radiusSm: number | string;
  shadow: string;
  shadowHover: string;
  shadowFloat: string;
  accent: string;
  accentLight: string;
};

export const lightTheme: DebateHudTheme = {
  bg: 'var(--ce-document-canvas)',
  surface: 'var(--ce-document-surface)',
  surfaceHover: 'var(--ce-surface-light)',
  border: 'var(--ce-document-border)',
  borderLight: 'var(--ce-border-light)',
  text: 'var(--ce-document-text)',
  textMuted: 'var(--ce-document-text-muted)',
  textLight: 'var(--ce-text-muted)',
  font: 'var(--ce-font-ui)',
  mono: 'var(--ce-font-mono)',
  radius: 'var(--ce-radius-12)',
  radiusSm: 'var(--ce-radius-8)',
  shadow: 'var(--ce-shadow-raised)',
  shadowHover: 'var(--ce-shadow-raised)',
  shadowFloat: 'var(--ce-card-shadow)',
  accent: 'var(--ce-action-primary)',
  accentLight: 'var(--ce-status-info-soft)',
};

export const darkTheme: DebateHudTheme = {
  bg: 'var(--ce-canvas)',
  surface: 'var(--ce-surface-raised)',
  surfaceHover: 'var(--ce-surface-alt)',
  border: 'var(--ce-border)',
  borderLight: 'var(--ce-border-light)',
  text: 'var(--ce-panel-text)',
  textMuted: 'var(--ce-panel-text-muted)',
  textLight: 'var(--ce-control-disabled-text)',
  font: 'var(--ce-font-ui)',
  mono: 'var(--ce-font-mono)',
  radius: 'var(--ce-radius-12)',
  radiusSm: 'var(--ce-radius-8)',
  shadow: 'var(--ce-shadow-raised)',
  shadowHover: 'var(--ce-shadow-raised)',
  shadowFloat: 'var(--ce-card-shadow)',
  accent: 'var(--ce-action-primary)',
  accentLight: 'var(--ce-status-info-soft)',
};

export const ThemeContext = React.createContext<DebateHudTheme>(darkTheme);

export const useTheme = (): DebateHudTheme => React.useContext(ThemeContext) || darkTheme;

export const soften = (color: string, alpha: number): string =>
  `color-mix(in srgb, ${color} ${Math.max(0, Math.min(100, alpha * 100))}%, transparent)`;
