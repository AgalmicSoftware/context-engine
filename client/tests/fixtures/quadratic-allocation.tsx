// Development-only fixture for the shared respondent control used by full, pile, and Telegram views.
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/assets/css/contextEngine.scss';
import { renderPileActiveQuestionCard } from '../../src/components/SurveyTool/surveyPileActiveQuestionCard';
import pileStyles from '../../src/components/SurveyTool/SurveyTool.module.scss';
import QuadraticAllocationInput from '../../src/components/SurveyTool/QuadraticAllocationInput';
import QuadraticAllocationResults from '../../src/components/SurveyTool/QuadraticAllocationResults';
import SingleQuestionResponse from '../../src/components/SurveyTool/SingleQuestionResponse';
import { validateQuadraticAllocation } from '../../../shared/questions/quadraticAllocation.mjs';

const question = { id: 'quadratic-smoke', type: 'quadratic', options: ['Parks', 'Transit', 'Housing'], voiceCredits: 99 };
function Fixture() {
  const [value, setValue] = useState<number[]>([0, 0, 0]);
  const [theme, setTheme] = useState('context-engine');
  const [deferDragUpdates, setDeferDragUpdates] = useState(false);
  const [answerUpdates, setAnswerUpdates] = useState(0);
  useEffect(() => { document.documentElement.dataset.ceTheme = theme; }, [theme]);
  const [saved, setSaved] = useState('');
  const [responses, setResponses] = useState<{ answer: { value: number[] } }[]>([]);
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'var(--ce-font-body)', lineHeight: 1.5, color: 'var(--ce-panel-text)' }}>
      <style>{'body { background: var(--ce-color-canvas); }'}</style>
      <label>Theme <select value={theme} onChange={event => setTheme(event.target.value)}><option value="context-engine">Context Engine</option><option value="classic-95">Classic 95</option></select></label>
      <label style={{ display: 'block' }}><input type="checkbox" checked={deferDragUpdates} onChange={event => setDeferDragUpdates(event.target.checked)} /> Standalone question drag behavior</label>
      <h1 style={{ color: 'inherit' }}>Survey questions pile</h1>
      <p>Question 3 of 12</p>
      <div className={pileStyles.pileCardContainer} data-testid="ce-quadratic-pile-card"><div className={`${pileStyles.pileCard} ${pileStyles.pileCardActive}`}>
        {renderPileActiveQuestionCard({
          question, promptMasked: false, renderQuestionMaskedPromptCard: () => null,
          promptHeader: <h2 style={{ fontSize: '1.3rem', margin: 0, color: 'inherit' }}>Where should we invest in our neighbourhood?</h2>,
          questionContainerClass: pileStyles.quadraticQuestionContainer,
          questionComponent: <QuadraticAllocationInput questionId={question.id} {...question} value={value} deferDragUpdates={deferDragUpdates} onChange={next => { setValue(next); setAnswerUpdates(count => count + 1); }} />,
        })}
      </div></div>
      <p data-testid="ce-quadratic-answer-updates">Answer updates: {answerUpdates} · Committed: {JSON.stringify(value)}</p>
      <button onClick={() => setValue([7, 3, -4])}>Show example allocation</button>
      <button onClick={() => setSaved(JSON.stringify(value))}>Save draft</button>
      <button disabled={!saved} onClick={() => setValue(JSON.parse(saved))}>
        Restore draft
      </button>
      <button
        onClick={() => {
          if (!validateQuadraticAllocation(value, question)) setResponses([...responses, { answer: { value } }]);
        }}
      >
        Submit locally
      </button>
      <output data-testid="ce-quadratic-saved">{saved}</output>
      <QuadraticAllocationResults question={question} responses={responses} />
      <details>
        <summary>Read-only question preview</summary>
        <SingleQuestionResponse mode="fullscreen" questionOnly question={{ ...question, prompt: 'Where should we invest?' }} />
      </details>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
