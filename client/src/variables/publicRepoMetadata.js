export const PUBLIC_GITHUB_ORG = 'AgalmicSoftware';
export const PUBLIC_GITHUB_REPO = 'context-engine';
export const PUBLIC_GITHUB_BRANCH = 'main';
export const PUBLIC_SECURITY_EMAIL = 'agalmicsoftware@protonmail.com';

export const PUBLIC_REPO_URL = `https://github.com/${PUBLIC_GITHUB_ORG}/${PUBLIC_GITHUB_REPO}`;
export const PUBLIC_REPO_ISSUES_URL = `${PUBLIC_REPO_URL}/issues`;
export const PUBLIC_REPO_NEW_ISSUE_URL = `${PUBLIC_REPO_ISSUES_URL}/new`;
export const PUBLIC_CONTRIBUTING_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/CONTRIBUTING.md`;
export const PUBLIC_LICENSE_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/LICENSE`;
export const PUBLIC_WHITEPAPER_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/Whitepaper/whitepaper.md`;
export const PUBLIC_CONTRACTS_SOURCE_BASE_URL = `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/contracts`;

export const buildPublicContractSourceUrl = (filename = '') => (
  filename ? `${PUBLIC_CONTRACTS_SOURCE_BASE_URL}/${filename}` : ''
);
