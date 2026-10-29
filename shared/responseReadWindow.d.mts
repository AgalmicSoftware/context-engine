export type ResponseReadWindow = { blockTag: number; laterPairs?: Set<string> } | null;
export declare const responsePairKey: (responder: unknown, id: unknown) => string;
export declare const responseReadWindowOptions: (
  window: ResponseReadWindow, responder: unknown, id: unknown,
) => { _responseReadWindow?: ResponseReadWindow; blockTag?: number };
export declare const historicalResponseReadError: (error: unknown, blockTag: unknown) => Error;
