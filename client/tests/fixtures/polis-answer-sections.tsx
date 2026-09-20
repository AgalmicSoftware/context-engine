import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/assets/css/contextEngine.scss';
import PolisReport from '../../src/components/PolisReport/PolisReport';
import LoginThemeQuickControl from '../../src/components/Account/LoginThemeQuickControl';
import BinaryChoiceInput from '../../src/components/SurveyTool/BinaryChoiceInput';
import { initializeThemeRuntime } from '../../src/utilities/ui/themeRuntime';
import { initializeColorVisionRuntime } from '../../src/utilities/ui/colorVisionRuntime';

initializeThemeRuntime();
initializeColorVisionRuntime();

const questions = [
  { id: 'binary', type: 'binary', prompt: 'Should we improve local transport?', tags: ['mobility'], answers: ['Agree', 'Agree', 'Unsure', 'Disagree'] },
  { id: 'text', type: 'freeform', prompt: 'What should we improve first?', tags: ['mobility'], answers: ['Safer crossings near schools.', 'Later buses would make evening travel easier.', 'Clearer signs at stops.', 'Covered waiting areas.'] },
  { id: 'text2', type: 'freeform', prompt: 'What would make public spaces easier to use?', tags: ['housing'], answers: ['More benches along walking routes.'] },
  { id: 'rating', type: 'rating', prompt: 'How well does local transport work?', tags: ['mobility'], answers: [0, 6, 7, 7, 8, 8, 9, 10] },
  { id: 'rating2', type: 'rating', prompt: 'How safe do you feel walking after dark?', tags: ['mobility'], answers: [4, 6, 7, 8] },
  { id: 'rating3', type: 'rating', prompt: 'How welcoming are our shared spaces?', tags: ['housing'], answers: [8, 9] },
  { id: 'multi', type: 'multichoice', prompt: 'Which project should come first?', tags: ['mobility'], options: ['Parks', 'Transit', 'Street lighting'], answers: ['Parks', 'Parks', 'Transit', 'Street lighting'] },
  { id: 'multi2', type: 'multichoice', prompt: 'How do you usually get around?', tags: ['mobility'], options: ['Walking', 'Bus', 'Cycling'], answers: ['Walking', 'Bus'] },
  { id: 'quadratic', type: 'quadratic', prompt: 'Which projects would you support or oppose?', tags: ['mobility'], options: ['Parks', 'Transit', 'Housing'], answers: [[4, -5, 0], [3, 5, -2], [0, 0, 0]] },
  { id: 'quadratic2', type: 'quadratic', prompt: 'How should we shape our community space?', tags: ['housing'], options: ['Garden', 'Sports', 'Parking'], answers: [[6, 3, -5]] },
];
const responses = Object.fromEntries(questions.map(({ answers, ...question }) => [question.id, answers.map((value, index) => ({ responder: `participant-${index}`, response: JSON.stringify({ ...question, answer: { value } }) }))]));
function Fixture() {
  const [tag, setTag] = useState('');
  const [choice, setChoice] = useState('');
  return <main style={{ maxWidth: 1024, margin: '20px auto' }}>
    <style>{'body { background: #eee; }'}</style>
    <aside style={{ padding: 16, background: 'var(--ce-panel-bg)', color: 'var(--ce-panel-text)' }}>
      <LoginThemeQuickControl />
      <BinaryChoiceInput questionId="palette-preview" value={choice} onChange={setChoice} />
    </aside>
    <label style={{ color: '#222' }}>Question tag <select value={tag} onChange={(e) => setTag(e.target.value)}><option value="">All tags</option><option value="mobility">Mobility</option><option value="housing">Housing</option><option value="empty">No matches</option></select></label>
    <PolisReport sessionName="Report fixture" slug="report-fixture" questionResponses={responses} isQuestionCacheReady isResponsesCacheReady filterState={{ selectedTags: tag ? [tag] : [] }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
