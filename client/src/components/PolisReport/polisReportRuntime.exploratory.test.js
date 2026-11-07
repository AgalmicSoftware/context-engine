import { buildUmapParticipantData, clusterExploratoryPoints, doUMAPTyped } from './polisReportRuntime';
import { computePolisConversationMath } from '../../utilities/survey/consensusReportMath';

// The real math: twenty people answer everything in two camps, then thirty answer only the first question.
const nQuestions = 12;
const fullVoters = 20;
const oneAnswerPeople = 30;
const ratingMatrix = Array.from({ length: nQuestions }, (_, question) => [
  ...Array.from({ length: fullVoters }, (_, person) =>
    person < fullVoters / 2 === question < nQuestions / 2 ? 1 : -1,
  ),
  ...Array.from({ length: oneAnswerPeople }, (_, person) => (question === 0 ? (person % 2 ? 1 : -1) : null)),
]);
const math = computePolisConversationMath(ratingMatrix, {}, [], { randomSeed: 42 });
const umapPoints = doUMAPTyped(buildUmapParticipantData(ratingMatrix), 15, 42).map(([x, y], index) => ({
  x,
  y,
  index,
}));

describe('exploratory groups on the real math', () => {
  it.each([
    ['UMAP', umapPoints],
    ['SVD/PCA', math.participantCoords],
  ])('counts only the people in the analysis in %s', (_, points) => {
    expect(math.inConversationParticipantIndices).toEqual(Array.from({ length: fullVoters }, (_, person) => person));

    const { assignments, analytical } = clusterExploratoryPoints(points, math.inConversationParticipantIndices, 3, 42);

    expect(assignments).toHaveLength(fullVoters + oneAnswerPeople);
    expect(assignments.every((group) => group >= 0)).toBe(true);
    expect(analytical.slice(0, fullVoters).every((group) => group >= 0)).toBe(true);
    expect(analytical.slice(fullVoters).every((group) => group === -1)).toBe(true);
    // Everyone on the map is in a group that has people in the analysis.
    const analysedGroups = new Set(analytical.filter((group) => group >= 0));
    expect(assignments.every((group) => analysedGroups.has(group))).toBe(true);
  });
});
