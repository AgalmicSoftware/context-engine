export type QuestionIdContent = {
  type?: unknown;
  prompt?: unknown;
  options?: unknown;
  singleSelect?: unknown;
  voiceCredits?: unknown;
};
export function createQuestionIdDerivation(ethers: { utils: { id(text: string): string } }): Readonly<{
  generateQuestionId(
    type: unknown,
    prompt: unknown,
    options?: unknown,
    singleSelect?: unknown,
    voiceCredits?: unknown,
  ): string;
  questionIdMatchesContent(id: unknown, content?: QuestionIdContent): boolean;
}>;
