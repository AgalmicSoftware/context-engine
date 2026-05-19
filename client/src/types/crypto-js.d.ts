declare module 'crypto-js/sha256' {
  type Sha256Digest = {
    toString: () => string;
  };

  const sha256: (value: unknown) => Sha256Digest;
  export default sha256;
}
