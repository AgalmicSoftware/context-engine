import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { toStr } from '../../utilities/shared/primitives.js';
import { normalizePendingSbtDrafts, type PendingSbtDraft } from './hooks/usePendingSbtDrafts.js';

export type PublishedPendingSbtLink = {
  address: string;
  label: string;
  href: string;
};

export const buildPublishedPendingSbtLinks = ({
  deployedDrafts = [],
  pendingDraftSnapshot = [],
  sessionSlug = '',
}: {
  deployedDrafts?: readonly unknown[];
  pendingDraftSnapshot?: readonly unknown[];
  sessionSlug?: string;
} = {}): PublishedPendingSbtLink[] => {
  const normalizedDeployedDrafts = normalizePendingSbtDrafts(deployedDrafts);
  const newlyDeployedAddressSet = new Set(
    normalizedDeployedDrafts
      .map((entry) =>
        toStr(entry?.predictedAddress || entry?.deployedAddress || entry?.address)
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );
  const finalizedDrafts = normalizePendingSbtDrafts([
    ...normalizedDeployedDrafts,
    ...normalizePendingSbtDrafts(pendingDraftSnapshot).filter(
      (entry) =>
        entry?.deployed === true &&
        !newlyDeployedAddressSet.has(
          toStr(entry?.predictedAddress || entry?.deployedAddress || entry?.address)
            .trim()
            .toLowerCase(),
        ),
    ),
  ]);

  return finalizedDrafts
    .map((entry: PendingSbtDraft) => {
      const address = toStr(entry?.deployedAddress || entry?.predictedAddress || entry?.address).trim();
      if (!address) return null;
      return {
        address,
        label: toStr(entry?.displayName || entry?.name || address).trim() || address,
        href: buildSbtDetailPath(address, sessionSlug),
      };
    })
    .filter((entry): entry is PublishedPendingSbtLink => !!entry && entry.href !== '#');
};
