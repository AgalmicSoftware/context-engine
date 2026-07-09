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
  radius: number;
  radiusSm: number;
  shadow: string;
  shadowHover: string;
  shadowFloat: string;
  accent: string;
  accentLight: string;
};

export const lightTheme: DebateHudTheme = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  surfaceHover: '#fafbff',
  border: '#e2e5ef',
  borderLight: '#eef0f6',
  text: '#1a1d2e',
  textMuted: '#6b7194',
  textLight: '#9da3c0',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
  shadowHover: '0 4px 16px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
  shadowFloat: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
  accent: '#4f6df5',
  accentLight: '#eef1ff',
};

export const darkTheme: DebateHudTheme = {
  bg: '#0f1117',
  surface: '#1a1d2e',
  surfaceHover: '#22263a',
  border: '#2a2f45',
  borderLight: '#232840',
  text: '#e4e6f0',
  textMuted: '#9da3c0',
  textLight: '#6b7194',
  font: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  radius: 12,
  radiusSm: 8,
  shadow: '0 1px 3px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)',
  shadowHover: '0 4px 16px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.2)',
  shadowFloat: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
  accent: '#6b8aff',
  accentLight: '#1e2444',
};

export const ThemeContext = React.createContext<DebateHudTheme>(darkTheme);

export const useTheme = (): DebateHudTheme => React.useContext(ThemeContext) || darkTheme;

export const soften = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
