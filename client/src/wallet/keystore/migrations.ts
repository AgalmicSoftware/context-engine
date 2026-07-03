export type UserWalletProvider = 'passkey-eoa' | 'external' | 'legacy-porto';

export type UserWallet = {
  userId: string;
  provider: UserWalletProvider;
  address: `0x${string}`;
  isPrimary: boolean;
  createdAt: string;
};

export const buildPasskeyEoaUserWallet = ({
  userId,
  address,
  createdAt = new Date().toISOString(),
}: {
  userId: string;
  address: `0x${string}`;
  createdAt?: string;
}): UserWallet => ({
  userId,
  provider: 'passkey-eoa',
  address,
  isPrimary: true,
  createdAt,
});
