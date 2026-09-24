import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/assets/css/contextEngine.scss';
import ComparisonReport from '../../src/components/DemoViews/DemoAnalysis/ComparisonReport';
const groups = Array.from({ length: 12 }, (_, i) => ({ segmentKey: `group-${i}`, name: `Community research group ${i + 1}` }));
const responses = groups.flatMap((group, index) => ['Agree', 'Unsure', 'Disagree'].map((responseText, choice) => ({ questionId: 'q1', responseText, segmentKey: group.segmentKey, rate: choice === index % 3 ? 0.8 : 0.1 })));
createRoot(document.getElementById('root')!).render(<main style={{ maxWidth: 900, margin: '20px auto', padding: 12 }}>
  <ComparisonReport flatResponses={responses} comparisonGroups={groups} questions={[{ id: 'q1', text: 'How should communities balance transport, housing, public spaces, and environmental priorities?' }]} />
</main>);
