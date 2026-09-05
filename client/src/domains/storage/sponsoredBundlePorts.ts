import * as defaultSponsoredBundles from '../../utilities/arweave/sponsoredBundles.js';

export type SponsoredBundleRecord = Record<string, unknown>;
export type BuildSponsoredBundlePlaintextInput = Parameters<
  typeof defaultSponsoredBundles.buildSponsoredBundlePlaintext
>[0];
export type SponsoredBundlePlaintext = ReturnType<typeof defaultSponsoredBundles.buildSponsoredBundlePlaintext>;
export type UploadSponsoredBundleInput = Parameters<typeof defaultSponsoredBundles.uploadSponsoredBundle>[0];
export type UploadSponsoredBundleResult = Awaited<ReturnType<typeof defaultSponsoredBundles.uploadSponsoredBundle>>;

export type SponsoredBundlePort = {
  buildSponsoredBundlePlaintext: (input?: BuildSponsoredBundlePlaintextInput) => SponsoredBundlePlaintext;
  generateSponsoredBundleSecret: (byteLength?: number) => string;
  hasSponsoredBundleFields: (bundle?: SponsoredBundleRecord) => boolean;
  uploadSponsoredBundle: (input?: UploadSponsoredBundleInput) => Promise<UploadSponsoredBundleResult>;
};

export const sponsoredBundlePort: SponsoredBundlePort = {
  buildSponsoredBundlePlaintext: (input) => defaultSponsoredBundles.buildSponsoredBundlePlaintext(input),
  generateSponsoredBundleSecret: (byteLength) =>
    byteLength === undefined
      ? defaultSponsoredBundles.generateSponsoredBundleSecret()
      : defaultSponsoredBundles.generateSponsoredBundleSecret(byteLength),
  hasSponsoredBundleFields: (bundle) => defaultSponsoredBundles.hasSponsoredBundleFields(bundle),
  uploadSponsoredBundle: (input) => defaultSponsoredBundles.uploadSponsoredBundle(input),
};
