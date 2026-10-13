import { ethers } from 'ethers';

// Swaps only the slow PBKDF2 step of the group password KDF for a keccak of
// (password bytes, salt). Tests still run the real normalization, scoping,
// key, hash and signing code, without 600,000 iterations per call.
// Undo with jest.restoreAllMocks().
export const useFastGroupPasswordKdf = () => {
  const { subtle } = globalThis.crypto;
  const importKey = jest
    .spyOn(subtle, 'importKey')
    .mockImplementation(async (_format, keyData) => ({ passwordBytes: new Uint8Array(keyData) }));
  const deriveBits = jest
    .spyOn(subtle, 'deriveBits')
    .mockImplementation(
      async (params, key) =>
        ethers.utils.arrayify(ethers.utils.keccak256(ethers.utils.concat([key.passwordBytes, params.salt]))).buffer,
    );
  return { importKey, deriveBits };
};
