import { findPromptPlaceholders, splitPromptByVariables, type PromptVariable } from './aiPromptPieces';

/** Marks each stand-in drawn, for the box that asks whether a selection holds one. */
export const STAND_IN_ATTRIBUTE = 'data-prompt-stand-in';
const MARK = { [STAND_IN_ATTRIBUTE]: '' };

type Props = {
  prompt: string;
  /** The values to stand in for. Left out: the template's own `<Name>` and `{{name}}` placeholders. */
  variables?: PromptVariable[];
  /** The class each stand-in is drawn with. */
  className: string;
};

/** The stand-ins a prompt uses, in its order: what follows "Variables:". */
export function PromptStandInList({ prompt, variables = findPromptPlaceholders(prompt), className }: Props) {
  const pieces = splitPromptByVariables(prompt, variables);
  const standIns = [...new Set(pieces.flatMap(({ text, variable }) => (variable ? [text] : [])))];
  return (
    <>
      {standIns.map((standIn, index) => (
        <span key={standIn}>
          {index ? ', ' : ''}
          <span className={className} {...MARK}>
            {standIn}
          </span>
        </span>
      ))}
    </>
  );
}

/** The prompt's text, with a stand-in where each value or placeholder is. */
export function PromptText({ prompt, variables = findPromptPlaceholders(prompt), className }: Props) {
  return (
    <>
      {splitPromptByVariables(prompt, variables).map((piece, index) =>
        piece.variable ? (
          <span key={index} className={className} {...MARK}>
            {piece.text}
          </span>
        ) : (
          piece.text
        ),
      )}
    </>
  );
}
