/**
 * @module chainIdResolution
 * @description Shared chain-id extraction helpers for session and contract config objects.
 */

import { DEFAULT_CHAIN_ID } from '../../variables/appConfig.js';

export { DEFAULT_CHAIN_ID };

export function extractChainId(cfg, options = null) {
  const contractKey = String(options?.contractKey || '').trim();
  const strict = options?.strict === true;
  const preferredCandidates = contractKey === 'sbtFactory'
    ? [
        cfg?.contracts?.sbtFactory?.chainId,
        cfg?.networkChainId,
        cfg?.contracts?.surveys?.chainId,
      ]
    : contractKey === 'surveys'
      ? [
          cfg?.contracts?.surveys?.chainId,
          cfg?.networkChainId,
          cfg?.contracts?.sbtFactory?.chainId,
        ]
      : [
          cfg?.networkChainId,
          cfg?.contracts?.surveys?.chainId,
        cfg?.contracts?.sbtFactory?.chainId,
      ];

  const orderedCandidates = strict
    ? preferredCandidates.concat([0])
    : preferredCandidates.concat([
        cfg?.__registry?.chainId,
        DEFAULT_CHAIN_ID,
        0,
      ]);
  for (const candidate of orderedCandidates) {
    const id = Number(candidate || 0);
    if (Number.isFinite(id) && id > 0) return Math.floor(id);
  }
  return 0;
}

export function extractChainIdOrUndefined(cfg, options = null) {
  const contractKey = String(options?.contractKey || '').trim();
  const preferredCandidates = contractKey === 'sbtFactory'
    ? [
        cfg?.contracts?.sbtFactory?.chainId,
        cfg?.networkChainId,
        cfg?.contracts?.surveys?.chainId,
      ]
    : contractKey === 'surveys'
      ? [
          cfg?.contracts?.surveys?.chainId,
          cfg?.networkChainId,
          cfg?.contracts?.sbtFactory?.chainId,
        ]
      : [
          cfg?.networkChainId,
          cfg?.contracts?.surveys?.chainId,
          cfg?.contracts?.sbtFactory?.chainId,
        ];

  const orderedCandidates = preferredCandidates.concat([
    cfg?.__registry?.chainId,
  ]);
  for (const candidate of orderedCandidates) {
    const id = Number(candidate || 0);
    if (Number.isFinite(id) && id > 0) return Math.floor(id);
  }
  return undefined;
}
