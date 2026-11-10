// Shared with Worker authentication so logout invalidates every in-flight login.
let generation = 0;
export const getClientAuthGeneration = (): number => generation;
export const invalidateClientAuthGeneration = (): number => ++generation;
