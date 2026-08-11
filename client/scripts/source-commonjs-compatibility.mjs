export const transformGroupPasswordDerivationCommonJs = (code) => {
  const exportStatement = 'module.exports = { createGroupPasswordDerivation };';
  if (!code.includes(exportStatement)) {
    throw new Error('The group password derivation CommonJS export contract changed.');
  }
  return code.replace(
    exportStatement,
    'export { createGroupPasswordDerivation };\nexport default { createGroupPasswordDerivation };',
  );
};
