export type AnalysisCardFigure = { figure: string; name: string; years: string };
export type AnalysisCardLook = {
  name: string;
  died: number;
  era: string;
  style: string;
  ground: string;
  accentHex: string;
  objects: string;
};

export const ANALYSIS_CARD_PICTURE_SIZE: string;
export const ANALYSIS_CARD_PICTURE_QUALITY: string;
export const ANALYSIS_CARD_LOOKS_REMEMBERED: number;
export const ANALYSIS_CARD_LOOK_SCHEMA: Record<string, unknown>;
export function parseAnalysisCardFigure(value: unknown): AnalysisCardFigure | null;
export function analysisCardFigureKey(figure: unknown): string;
export function analysisCardFigureSlug(figure: unknown): string;
export function buildAnalysisCardLookPrompt(
  figure: string,
  takenLooks?: ReadonlyArray<Pick<AnalysisCardLook, 'style' | 'ground'>>,
): string;
export function normalizeAnalysisCardLook(
  raw: unknown,
  options?: { nowYear?: number; askedName?: string },
): AnalysisCardLook | null;
export function buildAnalysisCardPicturePrompt(look: AnalysisCardLook, options?: { emblem?: boolean }): string;
