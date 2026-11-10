/** A decoding failure, worded for the person who opened the link. */
export type LinkPayloadFailure = { ok: false; error: string };
export type LinkPayloadOptions = { maxLength?: number };

/** The value of `key` in a fragment such as `location.hash`; null when absent. */
export function readLinkParam(hash: unknown, key: string): string | null;

export function encodeBase64Url(bytes: Uint8Array): string;
export function deflateLinkBytes(bytes: Uint8Array): Promise<Uint8Array>;
/** The bytes, or null past maxBytes. Damaged data rejects. */
export function inflateLinkBytes(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array | null>;
/** Base64url of the JSON's UTF-8 bytes, without padding. */
export function encodeLinkJson(value: unknown): string;

/**
 * Base64url text to bytes; whitespace and up to two `=` of padding are
 * tolerated. A value over twice `maxLength` is refused before it is read.
 */
export function decodeLinkBytes(
  value: unknown,
  options?: LinkPayloadOptions,
): { ok: true; bytes: Uint8Array } | LinkPayloadFailure;
/** Strict UTF-8: invalid bytes are damage; a character split at the end means the link was cut off. */
export function decodeLinkUtf8(bytes: Uint8Array): { ok: true; text: string } | LinkPayloadFailure;
export function decodeLinkText(
  value: unknown,
  options?: LinkPayloadOptions,
): { ok: true; text: string } | LinkPayloadFailure;
/** JSON.parse that says whether broken JSON was cut off or damaged. */
export function parseLinkJson(text: string): { ok: true; value: unknown } | LinkPayloadFailure;
/** Base64url UTF-8 JSON, as #setup= and #prefill= carry it. */
export function decodeLinkJson(
  value: unknown,
  options?: LinkPayloadOptions,
): { ok: true; value: unknown } | LinkPayloadFailure;
