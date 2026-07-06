import * as sponsoredAccess from '../../utilities/web3/sponsoredAccess.js';

export type SponsoredAccessInput = Parameters<typeof sponsoredAccess.checkSponsoredAccess>[0];
export type SponsoredAccessResult = Awaited<ReturnType<typeof sponsoredAccess.checkSponsoredAccess>>;

export const checkSponsoredAccess = (
  input: SponsoredAccessInput = {},
): Promise<SponsoredAccessResult> => (
  sponsoredAccess.checkSponsoredAccess(input)
);
