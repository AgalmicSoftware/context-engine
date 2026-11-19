export type SavedAnalysisCardTaste = 'book' | 'game' | 'film' | 'song';
export type SavedAnalysisCard = {
  title: string;
  matchNote: string;
  figure: string;
  tastes: Record<SavedAnalysisCardTaste, { title: string; by: string } | null>;
  answers: {
    yesNo: { prompt: string; text: string } | null;
    ownWords: { prompt: string; text: string; stance: string; trimmed: boolean } | null;
    vote: { prompt: string; kind: 'chose' | 'votes'; items: string[] } | null;
  };
};

export const ANALYSIS_CARD_SAVED_MAX_BYTES: number;
export function normalizeSavedAnalysisCard(value: unknown): SavedAnalysisCard | null;
export const ANALYSIS_CARD_FEATURE: 'analysis_card_v1';
export function analysisCardOn(config: unknown): boolean;
/** Whether the session keeps each person's answers to that person and its admins, so no card is saved on a page. */
export function analysisCardAnswersArePrivate(config: unknown): boolean;
