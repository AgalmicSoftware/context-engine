import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { clearDecryptCaches, cryptoUtils } from './cryptography';

const owner = new ethers.Wallet(`0x${'71'.repeat(32)}`);
const otherWallet = new ethers.Wallet(`0x${'72'.repeat(32)}`);
const surveyId = `0x${'73'.repeat(32)}`;
const questionPool = [{ id: 'q1', type: 'freeform' }];

// MetaMask hashes typed data with eth-sig-util, which signs over an empty
// domain when `types` has no EIP712Domain entry; ethers hashes the domain
// fields. Built here with plain ABI encoding, not ethers' typed-data encoder.
type SignStyle = 'ethers' | 'metamask';
type TypedDataPayload = {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, string>;
};

const EMPTY_EIP712_DOMAIN_SEPARATOR = ethers.utils.keccak256(ethers.utils.id('EIP712Domain()'));

const metamaskTypedDataDigest = ({ types, primaryType, message }: TypedDataPayload): string => {
  const fields = types[primaryType];
  const typeHash = ethers.utils.id(`${primaryType}(${fields.map(({ name, type }) => `${type} ${name}`).join(',')})`);
  const structHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', ...fields.map(({ type }) => (type === 'string' ? 'bytes32' : type))],
      [
        typeHash,
        ...fields.map(({ name, type }) => (type === 'string' ? ethers.utils.id(message[name]) : message[name])),
      ],
    ),
  );
  return ethers.utils.keccak256(ethers.utils.concat(['0x1901', EMPTY_EIP712_DOMAIN_SEPARATOR, structHash]));
};

// The wallet reports the owner's account but signs with `signingWallet`, like a
// passkey tab that silently switched wallets.
const providerSigningAs = (signingWallet: ethers.Wallet, style: SignStyle = 'ethers') => ({
  request: async ({ method, params }: { method: string; params: string[] }) => {
    if (method === 'eth_chainId') return '0xaa37dc';
    if (method === 'eth_accounts') return [owner.address];
    const data = JSON.parse(params[1]);
    if (style === 'metamask') {
      const digest = metamaskTypedDataDigest(data);
      return ethers.utils.joinSignature(new ethers.utils.SigningKey(signingWallet.privateKey).signDigest(digest));
    }
    delete data.types.EIP712Domain;
    return signingWallet._signTypedData(data.domain, data.types, data.message);
  },
});

const options = (signingWallet: ethers.Wallet, style: SignStyle = 'ethers') => ({
  provider: providerSigningAs(signingWallet, style),
  account: owner.address,
  chainId: 11155420,
  surveyId,
  questionPool,
  throwOnError: true,
});

// An "Only me" answer ('private') that the 0.6.7 writer stored for `owner`
// while MetaMask signed its key wrap.
const METAMASK_067_ENVELOPE = JSON.stringify({
  v: 1,
  cipher: 'aes-gcm-256',
  iv: 'UvDZZz7dLKm1JEHv',
  aad: {
    context: '0xc177057a5ba4e273540908b811d9409c42fa69218990aa9b4ac1b196786b4b86',
    chainId: 11155420,
    surveyId: '0x7373737373737373737373737373737373737373737373737373737373737373',
    qId: 'q1',
    fieldKey: 'answer',
  },
  ciphertext:
    'i/Ilvjfwgy3TQe9WJjx56mrvH1BDGVdC/zxHXgiOLE0YmRkbNLyLZzxLNu4rY6y3/BDayQLML5NW6sUowjNNc12lYko4lPG7IDtfVHbdQkBWh1wyto8wZ7s/0kUyHTDJA3/2WUPfvbrSAS4LJ3CNB3GEJqcnzSbm7/s1YMxkZqGMVPJMf9pQATP+su6K140D',
  recipients: [
    {
      type: 'self-eip712-v1',
      context: '0xc177057a5ba4e273540908b811d9409c42fa69218990aa9b4ac1b196786b4b86',
      wrap_iv: 'tidcNhqNZibQ1+OE',
      wrapped_cek: 'e0R32a+UiSp9+0KkWKLDqI67FKT3fTRV99fHFqxngPqrW7sVMq9yHCt1RKqz3t/k',
      nonce: '292640312725736283038335815762583325687036763709081756733515787570827205151',
    },
  ],
  commitments: {
    keccak256: '0x89feb9a5e92a5b22e284106598b06d735cd2fca7517fe6b7176cd628b9430559',
  },
  meta: {
    kind: 'freeform',
  },
});
const metamask067Slice = {
  answers: { q1: { value: '*', encrypted: true, encryptedPortion: METAMASK_067_ENVELOPE } },
};

beforeAll(() => {
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
});

afterEach(() => clearDecryptCaches());

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

it('wraps and unwraps Only me keys that MetaMask signs over an empty domain', async () => {
  const encrypted = await cryptoUtils.encryptMultipleAnswers(
    { answers: { q1: { value: 'private', encrypted: true } } },
    options(owner, 'metamask'),
  );

  const decrypted = await cryptoUtils.decryptMultipleAnswers(encrypted, questionPool, options(owner, 'metamask'));
  expect(decrypted.answers.q1.value).toBe('private');
});

it('decrypts an Only me answer that MetaMask wrapped with 0.6.7', async () => {
  const decrypted = await cryptoUtils.decryptMultipleAnswers(
    metamask067Slice,
    questionPool,
    options(owner, 'metamask'),
  );
  expect(decrypted.answers.q1.value).toBe('private');
});

it('still rejects a MetaMask-style key-wrap signature from another wallet', async () => {
  await expect(
    cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { value: 'private', encrypted: true } } },
      options(otherWallet, 'metamask'),
    ),
  ).rejects.toThrow(/Key-wrap signature does not match the account/);
  await expect(
    cryptoUtils.decryptMultipleAnswers(metamask067Slice, questionPool, options(otherWallet, 'metamask')),
  ).rejects.toThrow(/Key-wrap signature does not match the account/);
});
