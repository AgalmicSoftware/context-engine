type PoseidonInput = bigint | number | string;
type PoseidonFunction = (inputs: PoseidonInput[]) => bigint;
type PoseidonModule = Record<string, unknown>;

export type PoseidonHasher = (inputs: bigint[]) => bigint;

type PoseidonLoaders = {
  loadPoseidon2?: () => Promise<PoseidonModule>;
  loadPoseidon3?: () => Promise<PoseidonModule>;
};

export const createPoseidonHasher = ({
  poseidon2,
  poseidon3,
}: {
  poseidon2: PoseidonFunction;
  poseidon3: PoseidonFunction;
}): PoseidonHasher => {
  if (typeof poseidon2 !== 'function' || typeof poseidon3 !== 'function') {
    throw new Error('Poseidon arity modules did not expose callable hashers');
  }

  return (inputs) => {
    if (inputs.length === 2) return poseidon2(inputs);
    if (inputs.length === 3) return poseidon3(inputs);
    throw new Error(`Unsupported Poseidon arity: ${inputs.length}`);
  };
};

export const loadPoseidonHasher = async ({
  loadPoseidon2 = () => import('poseidon-lite/poseidon2'),
  loadPoseidon3 = () => import('poseidon-lite/poseidon3'),
}: PoseidonLoaders = {}): Promise<PoseidonHasher> => {
  const [poseidon2Module, poseidon3Module] = await Promise.all([loadPoseidon2(), loadPoseidon3()]);

  return createPoseidonHasher({
    poseidon2: poseidon2Module.poseidon2 as PoseidonFunction,
    poseidon3: poseidon3Module.poseidon3 as PoseidonFunction,
  });
};
