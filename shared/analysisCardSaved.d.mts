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
