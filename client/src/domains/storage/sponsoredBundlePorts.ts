import * as defaultSponsoredBundles from '../../utilities/arweave/sponsoredBundles.js';

export type SponsoredBundleRecord = Record<string, unknown>;
export type BuildSponsoredBundlePlaintextInput = Parameters<typeof defaultSponsoredBundles.buildSponsoredBundlePlaintext>[0];
export type SponsoredBundlePlaintext = ReturnType<typeof defaultSponsoredBundles.buildSponsoredBundlePlaintext>;
export type UploadSponsoredBundleInput = Parameters<typeof defaultSponsoredBundles.uploadSponsoredBundle>[0];
export type UploadSponsoredBundleResult = Awaited<ReturnType<typeof defaultSponsoredBundles.uploadSponsoredBundle>>;

export type SponsoredBundleModule = {
  buildSponsoredBundlePlaintext: (
    input?: BuildSponsoredBundlePlaintextInput
  ) => SponsoredBundlePlaintext;
  generateSponsoredBundleSecret: (byteLength?: number) => string;
  hasSponsoredBundleFields: (bundle?: SponsoredBundleRecord) => boolean;
  uploadSponsoredBundle: (
    input?: UploadSponsoredBundleInput
  ) => Promise<UploadSponsoredBundleResult>;
};

export type SponsoredBundlePort = {
  buildSponsoredBundlePlaintext: (
    input?: BuildSponsoredBundlePlaintextInput
  ) => SponsoredBundlePlaintext;
  generateSponsoredBundleSecret: (byteLength?: number) => string;
  hasSponsoredBundleFields: (bundle?: SponsoredBundleRecord) => boolean;
  uploadSponsoredBundle: (
    input?: UploadSponsoredBundleInput
  ) => Promise<UploadSponsoredBundleResult>;
};

export type BindSponsoredBundlePortArgs = {
  sponsoredBundles: () => SponsoredBundleModule;
};

export const bindSponsoredBundlePort = ({
  sponsoredBundles: readSponsoredBundles,
}: BindSponsoredBundlePortArgs): SponsoredBundlePort => ({
  buildSponsoredBundlePlaintext: (input) => (
    readSponsoredBundles().buildSponsoredBundlePlaintext(input)
  ),
  generateSponsoredBundleSecret: (byteLength) => (
    byteLength === undefined
      ? readSponsoredBundles().generateSponsoredBundleSecret()
      : readSponsoredBundles().generateSponsoredBundleSecret(byteLength)
  ),
  hasSponsoredBundleFields: (bundle) => (
    readSponsoredBundles().hasSponsoredBundleFields(bundle)
  ),
  uploadSponsoredBundle: (input) => (
    readSponsoredBundles().uploadSponsoredBundle(input)
  ),
});

export const sponsoredBundlePort = bindSponsoredBundlePort({
  sponsoredBundles: () => defaultSponsoredBundles,
});
