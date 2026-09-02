import { ethers } from 'ethers';

export const sha256Utf8 = (value: string): string => ethers.utils.sha256(ethers.utils.toUtf8Bytes(value)).slice(2);
