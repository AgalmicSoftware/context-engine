import React from 'react';

import { debateData } from '../../../variables/demo/debateData.js';
import { darkTheme as T, soften, useTheme } from './debateHudTheme';

type DebateSelectorProps = {
  selectedDebateId?: string | number;
  onSelect?: (debateId: string | number) => void;
};

const DebateSelector = ({ selectedDebateId, onSelect }: DebateSelectorProps) => {
  useTheme();

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        padding: '4px 0 8px',
        scrollbarWidth: 'thin',
      }}
    >
      {debateData.map((debate) => {
        const selected = debate.id === selectedDebateId;
        const category = 'category' in debate && debate.category ? String(debate.category) : 'Debate';

        return (
          <button
            key={debate.id}
            onClick={() => onSelect && onSelect(debate.id)}
            style={{
              minWidth: 280,
              padding: 16,
              borderRadius: 12,
              border: `1px solid ${selected ? soften(T.accent, 0.45) : 'rgba(255,255,255,0.1)'}`,
              background: selected ? soften(T.accent, 0.12) : 'rgba(255,255,255,0.06)',
              color: '#f4f7ff',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: T.font,
              boxShadow: selected ? `0 0 0 1px ${soften(T.accent, 0.18)}` : 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(244,247,255,0.62)',
                marginBottom: 8,
              }}
            >
              {category}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.35,
                color: '#f4f7ff',
                marginBottom: 12,
              }}
            >
              {debate.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: soften(debate.sideA.color, 0.15),
                  color: debate.sideA.color,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {debate.sideA.label}
              </span>
              <span style={{ fontSize: 11, color: 'rgba(244,247,255,0.55)' }}>vs</span>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: soften(debate.sideB.color, 0.15),
                  color: debate.sideB.color,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {debate.sideB.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default DebateSelector;
