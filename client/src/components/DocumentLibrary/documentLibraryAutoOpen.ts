import { toStr } from '../../utilities/shared/primitives.js';
import {
  STORAGE_BACKENDS,
  isArweaveTxId,
  normalizeStorageBackend,
  normalizeStorageRef,
  type StorageRef,
} from '../../utilities/storage/storageRefs.js';

export type DocumentLibraryAutoOpenDoc = {
  txId: string;
  tagMap: Record<string, string>;
  storageRef: StorageRef;
};

export const resolveDocumentLibraryAutoOpenDoc = ({
  locationSearch,
  usesWorkerCanonicalDocumentStorage,
}: {
  locationSearch: unknown;
  usesWorkerCanonicalDocumentStorage: boolean;
}): DocumentLibraryAutoOpenDoc | null => {
  try {
    const query = new URLSearchParams(toStr(locationSearch));
    const storage = normalizeStorageBackend(query.get('__ceDocStorage') || '', STORAGE_BACKENDS.LIT_ARWEAVE);
    const refId = toStr(query.get('__ceDocRef') || query.get('__ceDocTx')).trim();
    const storageRef = normalizeStorageRef({ backend: storage, id: refId }, { fallbackBackend: storage });
    if (
      !storageRef?.id ||
      (storageRef.backend !== STORAGE_BACKENDS.CLOUDFLARE && !isArweaveTxId(storageRef.id)) ||
      (usesWorkerCanonicalDocumentStorage && storageRef.backend !== STORAGE_BACKENDS.CLOUDFLARE)
    ) {
      return null;
    }

    const kind = toStr(query.get('__ceDocKind')).trim() || 'file';
    const name = toStr(query.get('__ceDocName')).trim();
    return {
      txId: storageRef.id,
      storageRef,
      tagMap: {
        'CE-DocStorage': storageRef.backend,
        'CE-DocKind': kind,
        ...(name ? { 'CE-DocName': name } : {}),
      },
    };
  } catch (_) {
    return null;
  }
};
