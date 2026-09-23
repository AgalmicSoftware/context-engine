// Local-only synthetic data and AI mocks: no Worker or paid provider requests.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import '../../src/assets/css/contextEngine.scss';
import CompareAddress from '../../src/components/UserPage/CompareAddresses';
import UserPageAnalysisModal from '../../src/components/UserPage/UserPageAnalysisModal';
import { writeCache } from '../../src/utilities/cache/cacheScripts';
const walletA = `0x${'1'.repeat(40)}`;
const walletB = `0x${'2'.repeat(40)}`;
localStorage.setItem('ce-e2e-ai-mock', '1');
await writeCache('questionsCache', 'comparison-fixture', {
  worker: {
    questions: { shared: { prompt: 'Should local parks be expanded?', type: 'binary' } },
    questionResponses: {
      shared: {
        [walletA]: JSON.stringify({ answer: { value: 'Agree' } }),
        [walletB]: JSON.stringify({ answer: { value: 'Disagree' } }),
      },
    },
  },
});
function Fixture() {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  return (
    <main style={{ maxWidth: 1100, margin: '20px auto', padding: 12 }}>
      <MemoryRouter
        initialEntries={[`/compare?session=comparison-fixture&subject=wallet:${walletA}&subject=wallet:${walletB}`]}
      >
        <CompareAddress activeSessionSlug="unrelated-global-session" sessionCachesReady />
      </MemoryRouter>
      <button onClick={() => setAnalysisOpen(true)}>Show fixture analysis</button>
      <UserPageAnalysisModal
        isOpen={analysisOpen}
        onToggle={() => setAnalysisOpen(false)}
        onRefreshAnalysis={() => {}}
        analysisCacheStatusState={{}}
        analysisModalDisplayState={{ shouldRenderAnalysisBody: true, shouldRenderDetails: true }}
        analysisName="Community participant"
        aiAnalysis="Supports civic participation."
        analysisDetails="Favors community input with privacy safeguards."
        analysisGeneration={{ provider: 'fixture', model: 'synthetic-model', source: 'reported' }}
      />
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
