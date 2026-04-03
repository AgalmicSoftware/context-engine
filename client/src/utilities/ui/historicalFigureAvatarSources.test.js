import historicalFigures from '../../variables/demo/historical_figure_users.json';
import historicalFiguresMerged from '../../variables/demo/historical_figures_merged.json';
import policyAtlasCouncil from '../../variables/demo/policy_atlas_council.json';
import additionalHistoricalFigures from '../../variables/demo/additional_historical_figures.json';
import historicalFigurePhotoManifest from './historicalFigurePhotoManifest.json';

const expectTodoArweave = (value) => {
  expect(String(value || '')).toMatch(/^TODO_ARWEAVE:/);
  expect(String(value || '')).not.toMatch(/^https?:\/\//i);
};

describe('historical figure avatar sources', () => {
  it('keeps demo-session and political-compass historical avatar data free of external hotlinks', () => {
    historicalFigures.forEach((entry) => {
      if (entry?.avatar) {
        expectTodoArweave(entry.avatar);
      }
    });

    (historicalFiguresMerged?.figures || []).forEach((entry) => {
      if (entry?.avatar) {
        expectTodoArweave(entry.avatar);
      }
    });

    (policyAtlasCouncil || []).forEach((entry) => {
      if (entry?.avatar) {
        expectTodoArweave(entry.avatar);
      }
    });

    Object.values(additionalHistoricalFigures || {}).forEach((entry) => {
      if (entry?.avatar) {
        expectTodoArweave(entry.avatar);
      }
    });

    Object.values(historicalFigurePhotoManifest || {}).forEach((entry) => {
      if (entry?.src) {
        expectTodoArweave(entry.src);
      }
    });
  });
});
