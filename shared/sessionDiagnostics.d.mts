export interface StoredVersionsDiagnostics {
  count: number;
  limit: number;
  overLimit: boolean;
}
export declare const STORED_VERSIONS_FIELD: 'storedVersions';
export declare const isStoredVersionsDiagnostics: (value: unknown) => value is StoredVersionsDiagnostics | null;
