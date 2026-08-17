import fs from 'fs';
import path from 'path';

describe('surveyQuestionsRuntimeMethods bookmark wiring', () => {
  it('creates the bookmark progress handler before wiring question-card controls', () => {
    const source = fs.readFileSync(path.join(__dirname, 'surveyQuestionsRuntimeMethods.tsx'), 'utf8');
    const progressRuntimeIndex = source.indexOf('} = createSurveyQuestionsProgressRuntime({');
    const questionDisplayRuntimeIndex = source.indexOf('} = createSurveyQuestionsQuestionDisplayRuntime({');
    const questionDisplayRuntimeEnd = source.indexOf('\n  });', questionDisplayRuntimeIndex);
    const questionDisplayRuntimeCall = source.slice(questionDisplayRuntimeIndex, questionDisplayRuntimeEnd);

    expect(progressRuntimeIndex).toBeGreaterThan(-1);
    expect(questionDisplayRuntimeIndex).toBeGreaterThan(-1);
    expect(progressRuntimeIndex).toBeLessThan(questionDisplayRuntimeIndex);
    expect(questionDisplayRuntimeCall).toContain('handleBookmarkToggle,');
  });
});
