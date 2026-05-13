// Stage-A compatibility mirrors: worker URL and browser read RPC discovery have not fully
// migrated to Worker KV yet, so new sessions keep explicit registry mirrors while metadata
// stops claiming authority.
export const SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS = Object.freeze({
  corsWorkerUrl: ['corsWorkerUrl'],
  rpcUrl: ['rpc', 'providers', 'path', 'rpcUrl'],
});
