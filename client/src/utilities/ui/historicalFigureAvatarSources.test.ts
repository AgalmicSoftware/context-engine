import fs from 'fs';
import path from 'path';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import historicalFiguresMerged from '../../variables/demo/historical_figures_merged.json';
import policyAtlasCouncil from '../../variables/demo/policy_atlas_council.json';
import additionalHistoricalFigures from '../../variables/demo/additional_historical_figures.json';
import historicalFigureLocalPhotoManifest from './historicalFigureLocalPhotoManifest.json';
import historicalFigurePhotoManifest from './historicalFigurePhotoManifest.json';

const LOCAL_AVATAR_PREFIX = '/historical-avatars/';
const APPROVED_REMOTE_PREFIXES = [
  'https://arweave.net/', // intentional: real URL — tests allowlist enforcement
  'https://ar-io.dev/', // intentional: real URL - tests allowlist enforcement
  'https://commons.wikimedia.org/wiki/Special:FilePath/', // intentional: real URL - verifies approved Wikimedia avatar source allowlist
  'https://upload.wikimedia.org/wikipedia/commons/', // intentional: real URL - verifies approved Wikimedia avatar source allowlist
];

const getDuplicateTopLevelManifestKeys = (manifestFilename: string): string[] => {
  const manifestPath = path.resolve(__dirname, manifestFilename);
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const topLevelKeyPattern = /^ {2}"([^"]+)": \{$/gm;
  const counts = new Map();
  let match = null;

  while ((match = topLevelKeyPattern.exec(manifestRaw))) {
    const key = String(match[1] || '').trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
};

const expectApprovedAvatarSource = (value: unknown) => {
  const src = String(value || '').trim();
  expect(src).toBeTruthy();
  expect(src).not.toMatch(/^[A-Z]{4,}_[A-Z]+:/);

  const isLocalAsset = src.startsWith(LOCAL_AVATAR_PREFIX);
  const isApprovedRemote = APPROVED_REMOTE_PREFIXES.some((prefix) => src.startsWith(prefix));
  expect(isLocalAsset || isApprovedRemote).toBe(true);

  if (isLocalAsset) {
    const localAssetPath = path.resolve(__dirname, '../../../public', src.replace(/^\/+/, ''));
    expect(fs.existsSync(localAssetPath)).toBe(true);
  }
};

describe('historical figure avatar sources', () => {
  it('keeps one canonical Buckminster Fuller avatar asset and reference', () => {
    const publicAvatarDir = path.resolve(__dirname, '../../../public/historical-avatars');
    const referencedSources = JSON.stringify([
      historicalFigures,
      historicalFiguresMerged,
      additionalHistoricalFigures,
      historicalFigureLocalPhotoManifest,
      historicalFigurePhotoManifest,
    ]);

    expect(fs.existsSync(path.join(publicAvatarDir, 'buckminsterfuller.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(publicAvatarDir, 'fuller.jpg'))).toBe(false);
    expect(referencedSources).not.toContain(`/historical-avatars/${'fuller'}.jpg`);
  });

  it('keeps avatar manifests free of duplicate top-level keys', () => {
    expect(getDuplicateTopLevelManifestKeys('./historicalFigureLocalPhotoManifest.json')).toEqual([]);
    expect(getDuplicateTopLevelManifestKeys('./historicalFigurePhotoManifest.json')).toEqual([]);
  });

  it('keeps demo-session and political-compass historical avatar data on approved local or hosted asset paths', () => {
    historicalFigures.forEach((entry) => {
      if (entry?.avatar) {
        expectApprovedAvatarSource(entry.avatar);
      }
    });

    (historicalFiguresMerged?.figures || []).forEach((entry) => {
      if (entry?.avatar) {
        expectApprovedAvatarSource(entry.avatar);
      }
    });

    (policyAtlasCouncil || []).forEach((entry) => {
      if (entry?.avatar) {
        expectApprovedAvatarSource(entry.avatar);
      }
    });

    Object.values(additionalHistoricalFigures || {}).forEach((entry) => {
      if (entry?.avatar) {
        expectApprovedAvatarSource(entry.avatar);
      }
    });

    Object.values(historicalFigureLocalPhotoManifest || {}).forEach((entry) => {
      if (entry?.src) {
        expectApprovedAvatarSource(entry.src);
      }
    });

    Object.values(historicalFigurePhotoManifest || {}).forEach((entry) => {
      if (entry?.src) {
        expectApprovedAvatarSource(entry.src);
      }
    });
  });
});
