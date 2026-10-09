// Local-only guide navigation fixture; no session, wallet, or Worker requests.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/assets/css/contextEngine.scss';
import ReverseAlignmentAtlas from '../../src/components/OnePageSession/ReverseAlignmentAtlas';

function Fixture() {
  const [theme, setTheme] = useState('context-engine');
  useEffect(() => { document.documentElement.dataset.ceTheme = theme; }, [theme]);
  return (
    <main style={{ margin: 16, fontFamily: 'var(--ce-font-body)', color: 'var(--ce-panel-text)' }}>
      <label>Theme <select value={theme} onChange={event => setTheme(event.target.value)}><option value="context-engine">Context Engine</option><option value="classic-95">Classic 95</option></select></label>
      <ReverseAlignmentAtlas />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
