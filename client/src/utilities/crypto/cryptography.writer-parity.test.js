import { webcrypto } from 'crypto';
import { ethers } from 'ethers';
import { cryptoUtils } from './cryptography';
import { envelopeWriterFixtures } from '../../../../shared/encryption/envelopeWriterFixtures.mjs';

const wallet = new ethers.Wallet(`0x${'31'.repeat(32)}`);
const surveyId = `0x${'34'.repeat(32)}`;
const provider = {
  request: async ({ method, params }) => {
    if (method === 'eth_chainId') return '0xaa37dc';
    if (method === 'eth_accounts') return [wallet.address];
    if (method === 'eth_signTypedData_v4') {
      const { domain, types, message } = JSON.parse(params[1]);
      delete types.EIP712Domain;
      return wallet._signTypedData(domain, types, message);
    }
    throw new Error(`Unexpected request: ${method}`);
  },
};
beforeAll(() => Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true }));

const ccLengths = process.env.CE_CC_WRITER_LENGTHS ? JSON.parse(process.env.CE_CC_WRITER_LENGTHS) : null;

it.each(envelopeWriterFixtures)('pads every allowed $type choice to the same question bucket', async (question) => {
  const lengths = [];
  for (const [index, value] of question.values.entries()) {
    const pool = [{ ...question, id: 'q1' }];
    const encrypted = await cryptoUtils.encryptMultipleAnswers(
      { answers: { q1: { encrypted: true, value } } },
      { provider, account: wallet.address, chainId: 11155420, surveyId, questionPool: pool },
    );
    const browserEnvelope = JSON.parse(encrypted.answers.q1.encryptedPortion);
    const length = Buffer.from(browserEnvelope.ciphertext, 'base64').length;
    if (ccLengths) expect(length).toBe(ccLengths[question.type][index]);
    expect((length - 16) % 128).toBe(0);
    lengths.push(length);
    const clear = await cryptoUtils.decryptMultipleAnswers(encrypted, pool, {
      provider,
      account: wallet.address,
      chainId: 11155420,
      surveyId,
    });
    expect(clear.answers.q1.value).toEqual(value);
  }
  expect(new Set(lengths).size).toBe(1);
});
