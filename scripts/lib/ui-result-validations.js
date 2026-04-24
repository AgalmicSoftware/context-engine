'use strict';

const HOLDER_DECRYPT_CHECKS = Object.freeze([
  ['holderNameDecrypted', 'holder name decrypted'],
  ['holderDescriptionDecrypted', 'holder description decrypted'],
  ['holderDocUrlDecrypted', 'holder document URL decrypted'],
  ['holderImageDecrypted', 'holder image decrypted'],
]);
const DOC_LIBRARY_SBT_ANTI_SPAM_ERROR = 'Uploader is not authorized to associate this SBT group.';

const evaluateSbtMetadataLocksUiResult = (uiJson = {}) => {
  const got = {};
  const missing = [];

  HOLDER_DECRYPT_CHECKS.forEach(([key, label]) => {
    const passed = uiJson?.[key] === true;
    got[key] = passed;
    if (!passed) missing.push(label);
  });

  return {
    ok: missing.length === 0,
    missing,
    got,
  };
};

const evaluateDocLibrarySbtUiReport = (report = {}) => {
  const assertions = Array.isArray(report?.ui?.assertions) ? report.ui.assertions : [];
  const antiSpamEntry = assertions.find(
    (entry) => /wallet B upload rejected \(anti-spam\)/i.test(String(entry?.name || '')),
  ) || null;
  const antiSpamStatus = Number(antiSpamEntry?.status || 0) || 0;
  const antiSpamMessage = String(antiSpamEntry?.message || '').trim();
  const walletBUploadRejected = (
    antiSpamStatus === 403 &&
    antiSpamMessage.toLowerCase() === DOC_LIBRARY_SBT_ANTI_SPAM_ERROR.toLowerCase()
  );
  const walletBUploadAllowed = assertions.some(
    (entry) => entry?.ok && /wallet B upload allowed by worker/i.test(String(entry?.name || '')),
  );

  return {
    ok: walletBUploadRejected,
    missing: walletBUploadRejected ? [] : ['wallet B upload rejected (anti-spam)'],
    checks: {
      walletBUploadRejected,
      walletBUploadAllowed,
      antiSpamStatus,
      antiSpamMessage,
    },
    assertions,
  };
};

module.exports = {
  evaluateDocLibrarySbtUiReport,
  evaluateSbtMetadataLocksUiResult,
};
