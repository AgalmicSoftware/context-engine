import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography';

const owner = new ethers.Wallet(`0x${'71'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'72'.repeat(32)}`);
const surveyId = `0x${'73'.repeat(32)}`;
const questionPool = [{ id: 'q1', type: 'freeform' }];

// The wallet reports the owner's account but signs with `signingWallet`, like a
// passkey tab that silently switched wallets.
const providerSigningAs = (signingWallet: ethers.Wallet) => ({
  request: async ({ method, params }: { method: string; params: string[] }) => {
    if (method === 'eth_chainId') return '0xaa37dc';
    if (method === 'eth_accounts') return [owner.address];
    const { domain, types, message } = JSON.parse(params[1]);
    delete types.EIP712Domain;
    return signingWallet._signTypedData(domain, types, message);
  },
});

const options = (signingWallet: ethers.Wallet) => ({
  provider: providerSigningAs(signingWallet),
  account: owner.address,
  chainId: 11155420,
  surveyId,
  questionPool,
  throwOnError: true,
});

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
});

it('refuses to store an Only me key that another wallet signed for the account', async () => {
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { value: 'private', encrypted: true } } },
      options(otherWallet),
    ),
  ).rejects.toThrow(/Key-wrap signature does not match the account/);
});

it('rejects a key-wrap signature from another wallet before deriving the unwrap key', async () => {
  const encrypt = () =>
    cryptoUtils.encryptMultipleAnswers({ answers: { q1: { value: 'private', encrypted: true } } }, options(owner));

  await expect(cryptoUtils.decryptMultipleAnswers(await encrypt(), questionPool, options(otherWallet))).rejects.toThrow(
    /Key-wrap signature does not match the account/,
  );
  const decrypted = await cryptoUtils.decryptMultipleAnswers(await encrypt(), questionPool, options(owner));
  expect(decrypted.answers.q1.value).toBe('private');
});
