export type AnalysisCardChosenAnswers = {
  yesNo: { prompt: string; text: string } | null;
  ownWords: { prompt: string; text: string; stance: string; trimmed: boolean } | null;
  vote: { prompt: string; kind: 'chose' | 'votes'; items: string[] } | null;
};
export function chooseAnalysisCardAnswers(questions: unknown, chosen: unknown): AnalysisCardChosenAnswers;
