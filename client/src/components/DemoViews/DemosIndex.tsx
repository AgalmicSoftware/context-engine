import React from 'react';
import { Link } from 'react-router-dom';

import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import demoSessions from '../../variables/demo/demo_sessions.json';

type DemoSessionEntry = {
  sessionName?: string;
  sessionInfo?: string;
  slug?: string;
};

const demoSessionEntries = demoSessions as Record<string, DemoSessionEntry>;

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: 24,
  marginBottom: 16,
};

const linkStyle: React.CSSProperties = {
  color: '#4dffa4',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '10px 14px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.12)',
  opacity: 0.85,
};

const DemosIndex = () => {
  const basePath = readPublicUrlBasePath();
  const demoEntries = Object.entries(demoSessionEntries);

  return (
    <div style={{ padding: '40px 20px', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ color: '#f4f7ff', marginBottom: 24 }}>Demos</h1>
      <p style={{ color: 'rgba(244,247,255,0.65)', marginBottom: 32 }}>
        Explore previous Context Engine trials and demo sessions.
      </p>
      {demoEntries.map(([key, session]) => (
        <div key={key} style={cardStyle}>
          <h3 style={{ color: '#f4f7ff', margin: 0 }}>{session.sessionName}</h3>
          <p style={{ color: 'rgba(244,247,255,0.65)', margin: '8px 0 16px' }}>{session.sessionInfo}</p>
          <Link to={`${basePath}/session${session.slug ? `/${session.slug}` : ''}`} style={linkStyle}>
            Try Demo →
          </Link>
        </div>
      ))}
    </div>
  );
};

export default DemosIndex;
