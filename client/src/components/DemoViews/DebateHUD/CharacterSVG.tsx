import React from 'react';

import { darkTheme as T, soften, useTheme } from './debateHudTheme';

type CharacterSVGProps = {
  name: string;
  size?: number;
};

type AvatarProps = CharacterSVGProps & {
  color: string;
};

export const CharacterSVG = ({ name, size = 80 }: CharacterSVGProps) => {
  useTheme();

  const svgs: Record<string, React.ReactElement> = {
    Condorcet: (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="condorcet-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#0066ff', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#0066ff', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#condorcet-bg)" rx="8" />
        <circle cx="40" cy="28" r="14" fill="#0066ff" opacity="0.8" />
        <path d="M 30 42 Q 30 50 40 50 Q 50 50 50 42" stroke="#0066ff" strokeWidth="1.5" fill="none" />
        <rect x="28" y="32" width="4" height="16" fill="#0066ff" opacity="0.6" />
        <rect x="48" y="32" width="4" height="16" fill="#0066ff" opacity="0.6" />
        <circle cx="22" cy="28" r="3" fill="#0066ff" opacity="0.4" />
        <circle cx="58" cy="28" r="3" fill="#0066ff" opacity="0.4" />
        <path d="M 20 48 L 60 48" stroke="#0066ff" strokeWidth="1" opacity="0.3" />
        <path d="M 22 52 L 58 52" stroke="#0066ff" strokeWidth="1" opacity="0.3" />
        <circle cx="35" cy="65" r="2" fill="#0066ff" opacity="0.4" />
        <circle cx="45" cy="65" r="2" fill="#0066ff" opacity="0.4" />
        <path d="M 30 60 L 50 60" stroke="#0066ff" strokeWidth="1.5" opacity="0.5" />
      </svg>
    ),
    'David Hume': (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="hume-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#e03060', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#e03060', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#hume-bg)" rx="8" />
        <circle cx="40" cy="26" r="13" fill="#f5d5d5" />
        <circle cx="30" cy="22" r="4" fill="#e03060" opacity="0.3" />
        <circle cx="50" cy="22" r="4" fill="#e03060" opacity="0.3" />
        <circle cx="26" cy="28" r="3" fill="#e03060" opacity="0.4" />
        <circle cx="54" cy="28" r="3" fill="#e03060" opacity="0.4" />
        <ellipse cx="40" cy="38" rx="10" ry="6" fill="#f5d5d5" />
        <path d="M 35 38 Q 35 42 40 44 Q 45 42 45 38" stroke="#e03060" strokeWidth="1.2" fill="none" opacity="0.7" />
        <circle cx="37" cy="36" r="1.5" fill="#e03060" />
        <circle cx="43" cy="36" r="1.5" fill="#e03060" />
        <path d="M 33 48 Q 40 52 47 48" stroke="#e03060" strokeWidth="1" fill="none" opacity="0.5" />
        <rect x="26" y="50" width="28" height="12" rx="2" fill="#f5d5d5" opacity="0.8" />
        <path d="M 26 60 L 54 60" stroke="#e03060" strokeWidth="1" opacity="0.3" />
      </svg>
    ),
    Machiavelli: (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="machiavelli-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#8b5cf6', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#machiavelli-bg)" rx="8" />
        <circle cx="40" cy="30" r="12" fill="#2a2a2a" />
        <circle cx="40" cy="28" r="11" fill="#3a3a3a" />
        <path d="M 32 30 Q 32 38 40 42 Q 48 38 48 30" fill="#d4a574" />
        <circle cx="36" cy="35" r="2" fill="#1a1a1a" />
        <circle cx="44" cy="35" r="2" fill="#1a1a1a" />
        <path d="M 34 42 Q 40 45 46 42" stroke="#8b5cf6" strokeWidth="1.2" fill="none" opacity="0.7" />
        <rect x="28" y="28" width="24" height="6" fill="#4a2a4a" opacity="0.4" />
        <path d="M 26 48 L 54 48" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.6" />
        <path d="M 28 52 L 52 52" stroke="#8b5cf6" strokeWidth="1" opacity="0.4" />
        <polygon points="40,58 37,64 43,64" fill="#8b5cf6" opacity="0.5" />
        <path d="M 35 64 L 45 64" stroke="#8b5cf6" strokeWidth="1.2" opacity="0.6" />
      </svg>
    ),
    'William of Ockham': (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="ockham-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#00a86b', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#00a86b', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#ockham-bg)" rx="8" />
        <circle cx="40" cy="24" r="10" fill="#e8d4b8" />
        <circle cx="40" cy="24" r="8" fill="#f5e6d3" />
        <path d="M 32 24 L 48 24" stroke="#00a86b" strokeWidth="1.5" />
        <circle cx="30" cy="32" r="9" fill="#d4a574" opacity="0.8" />
        <circle cx="30" cy="32" r="7" fill="#e8d4b8" opacity="0.9" />
        <path d="M 28 28 L 32 36" stroke="#00a86b" strokeWidth="1.2" opacity="0.7" />
        <path d="M 40 38 Q 40 45 40 55" stroke="#00a86b" strokeWidth="1.5" opacity="0.6" />
        <path d="M 35 48 Q 40 52 45 48" stroke="#00a86b" strokeWidth="1.2" fill="none" />
        <path d="M 38 52 L 42 60" stroke="#00a86b" strokeWidth="1" opacity="0.5" />
        <path d="M 42 52 L 38 60" stroke="#00a86b" strokeWidth="1" opacity="0.5" />
        <circle cx="40" cy="35" r="1.5" fill="#1a1a1a" />
        <path d="M 36 40 Q 40 42 44 40" stroke="#00a86b" strokeWidth="0.8" fill="none" opacity="0.4" />
      </svg>
    ),
    'Mary Shelley': (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="shelley-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#e07800', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#e07800', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#shelley-bg)" rx="8" />
        <circle cx="40" cy="26" r="12" fill="#ffc0a0" />
        <path d="M 30 22 Q 25 25 25 32" stroke="#e07800" strokeWidth="1.2" fill="none" opacity="0.6" />
        <path d="M 50 22 Q 55 25 55 32" stroke="#e07800" strokeWidth="1.2" fill="none" opacity="0.6" />
        <circle cx="37" cy="25" r="1.5" fill="#1a1a1a" />
        <circle cx="43" cy="25" r="1.5" fill="#1a1a1a" />
        <path d="M 35 32 Q 40 35 45 32" stroke="#e07800" strokeWidth="1" fill="none" opacity="0.7" />
        <path d="M 32 40 L 48 40" stroke="#e07800" strokeWidth="1.5" opacity="0.5" />
        <path d="M 30 50 Q 35 55 40 58 Q 45 55 50 50" stroke="#e07800" strokeWidth="1.5" fill="none" opacity="0.6" />
        <path d="M 38 45 L 42 45" stroke="#e07800" strokeWidth="1.2" opacity="0.7" />
        <path d="M 38 48 L 42 48" stroke="#e07800" strokeWidth="1" opacity="0.5" />
        <path d="M 40 48 L 40 58" stroke="#e07800" strokeWidth="1" opacity="0.4" />
      </svg>
    ),
    'John Stuart Mill': (
      <svg viewBox="0 0 80 80" style={{ width: size, height: size }}>
        <defs>
          <linearGradient id="mill-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#0066ff', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: '#0066ff', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#mill-bg)" rx="8" />
        <circle cx="40" cy="27" r="11" fill="#ddd8d3" />
        <path d="M 30 28 L 26 36" stroke="#0066ff" strokeWidth="1.2" opacity="0.6" />
        <path d="M 50 28 L 54 36" stroke="#0066ff" strokeWidth="1.2" opacity="0.6" />
        <path d="M 28 32 L 25 40" stroke="#0066ff" strokeWidth="1" opacity="0.5" />
        <path d="M 52 32 L 55 40" stroke="#0066ff" strokeWidth="1" opacity="0.5" />
        <path d="M 35 35 Q 40 37 45 35" fill="#f5e6d3" opacity="0.9" />
        <circle cx="37" cy="33" r="1.5" fill="#1a1a1a" />
        <circle cx="43" cy="33" r="1.5" fill="#1a1a1a" />
        <path d="M 36 40 Q 40 42 44 40" stroke="#0066ff" strokeWidth="1" fill="none" opacity="0.7" />
        <rect x="28" y="44" width="24" height="14" rx="2" fill="#f5e6d3" opacity="0.8" />
        <path d="M 32 50 L 36 50" stroke="#0066ff" strokeWidth="0.8" opacity="0.4" />
        <path d="M 44 50 L 48 50" stroke="#0066ff" strokeWidth="0.8" opacity="0.4" />
        <path d="M 28 60 L 52 60" stroke="#0066ff" strokeWidth="1" opacity="0.3" />
      </svg>
    ),
  };

  return svgs[name] || <div style={{ width: size, height: size, background: T.border, borderRadius: 8 }} />;
};

export const Avatar = ({ name, color, size = 36 }: AvatarProps) => {
  useTheme();

  const hasSVG = [
    'Condorcet',
    'David Hume',
    'Machiavelli',
    'William of Ockham',
    'Mary Shelley',
    'John Stuart Mill',
  ].includes(name);

  if (hasSVG) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CharacterSVG name={name} size={size} />
      </div>
    );
  }

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${soften(color, 0.15)}, ${soften(color, 0.08)})`,
        border: `2px solid ${soften(color, 0.3)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: T.font,
        fontSize: size * 0.38,
        fontWeight: '700',
        color,
        flexShrink: 0,
        letterSpacing: '-0.02em',
      }}
    >
      {initials}
    </div>
  );
};
