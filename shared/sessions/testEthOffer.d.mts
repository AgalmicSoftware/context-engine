export type TestEthOffer = {
  offered: boolean;
  audience: 'participants' | 'gas-gate';
  chainId: number | null;
  network: string | null;
  amountEth: string | null;
  maxBalanceEth: string | null;
  reason?: string;
};
export function describeTestEthOffer(args?: {
  config?: unknown;
  resourcePresence?: unknown;
}): TestEthOffer;
