// Stage-A compatibility mirror: worker URL reads have not fully migrated to Worker KV yet,
// so new sessions keep an explicit registry mirror while metadata stops claiming authority.
export const SESSION_WIZARD_ONCHAIN_COMPAT_FIELD_PATHS = Object.freeze({
  corsWorkerUrl: ['corsWorkerUrl'],
});
