import type CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import { callAI } from '../../utilities/ai/aiClient.js';
import { generateSingleQuestionTagsPrompt } from './createQuestionsAndSurveysHelpers';

type Question = CreateQuestionsAndSurveys['state']['questions'][number];
const requestKey = (question: Question): string => String(question.uiKey || question.id || '');
const requestsByPage = new WeakMap<CreateQuestionsAndSurveys, Map<string, number>>();
let requestGeneration = 0;

export const invalidateQuestionTagRequest = (page: CreateQuestionsAndSurveys, index: number): void => {
  const question = page.state.questions[index];
  if (question) requestsByPage.get(page)?.delete(requestKey(question));
};

export async function suggestTagsForQuestion(this: CreateQuestionsAndSurveys, index: number): Promise<void> {
  const question = this.state.questions[index];
  if (!question?.id || question.isGeneratingTags) return;
  const owner = {
    id: question.id,
    key: requestKey(question),
    prompt: String(question.prompt || ''),
    generation: ++requestGeneration,
  };
  const requests = requestsByPage.get(this) || new Map<string, number>();
  requestsByPage.set(this, requests);
  requests.set(owner.key, owner.generation);
  const isCurrent = () => this._isMounted && requests.get(owner.key) === owner.generation;
  const findQuestion = (questions: Question[]) =>
    questions.findIndex((row) => row.id === owner.id && requestKey(row) === owner.key);
  this.setState((previous) => {
    if (!isCurrent()) return null;
    const rowIndex = findQuestion(previous.questions);
    if (rowIndex < 0) return null;
    const questions = [...previous.questions];
    questions[rowIndex] = { ...questions[rowIndex], isGeneratingTags: true };
    return { questions };
  });
  const finish = (tags?: string[]) =>
    this.setState(
      (previous) => {
        if (!isCurrent()) return null;
        const rowIndex = findQuestion(previous.questions);
        if (rowIndex < 0) return null;
        const row = previous.questions[rowIndex];
        const questions = [...previous.questions];
        questions[rowIndex] = {
          ...row,
          ...(tags && String(row.prompt || '') === owner.prompt
            ? { aiGeneratedTagsFromSource: tags, tags: [...tags] }
            : {}),
          isGeneratingTags: false,
        };
        return { questions };
      },
      () => {
        if (requests.get(owner.key) === owner.generation) requests.delete(owner.key);
        this.saveToLocalStorage();
      },
    );

  try {
    const defaults = this.props.defaultTags;
    const defaultTags = (Array.isArray(defaults) ? defaults : typeof defaults === 'string' ? defaults.split(',') : [])
      .filter(Boolean)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const prompt = generateSingleQuestionTagsPrompt(
      owner.prompt,
      String(question.type || ''),
      question.options || [],
      defaultTags,
    );
    const rawResponse = await callAI(prompt, { ...this.buildAiRequestOptions(), taskType: 'categorize' });
    const match = rawResponse.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in AI response for tags.');
    const parsedResponse = JSON.parse(match[0]);
    const tags = (parsedResponse.tags || []).map((tag: unknown) => String(tag || '').trim()).filter(Boolean);
    finish(tags);
  } catch (_) {
    const currentQuestion = this.state.questions[findQuestion(this.state.questions)];
    if (isCurrent() && currentQuestion?.prompt === owner.prompt) {
      alert(`Failed to generate tags for question "${owner.prompt.substring(0, 30)}...". Please try again.`);
    }
    finish();
  }
}
