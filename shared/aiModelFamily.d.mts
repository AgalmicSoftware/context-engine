export function toModelLeaf(model: unknown): string;
export function inferAiProviderFromModel(model: unknown): string;
export function isOpenAiReasoningModel(model: unknown): boolean;
export function usesOpenAiResponsesApi(options?: { provider?: unknown; model?: unknown; endpoint?: unknown }): boolean;
export function interviewMapOutputTokens(model: unknown): number;
export function takesImageInput(model: unknown): boolean;
export function takesReasoningEffort(model: unknown): boolean;
export function fitReasoningEffort(model: unknown, effort: unknown): string;
