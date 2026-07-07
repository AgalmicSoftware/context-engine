export const PUBLIC_GITHUB_ORG = 'AgalmicSoftware';
export const PUBLIC_GITHUB_REPO = 'context-engine';
export const PUBLIC_GITHUB_BRANCH = 'main';
export const PUBLIC_SECURITY_EMAIL = 'contextengine@protonmail.com';

export const PUBLIC_REPO_URL = `https://github.com/${PUBLIC_GITHUB_ORG}/${PUBLIC_GITHUB_REPO}`;
export const PUBLIC_REPO_SOURCE_URL = `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}`;
export const PUBLIC_REPO_ISSUES_URL = `${PUBLIC_REPO_URL}/issues`;
export const PUBLIC_REPO_NEW_ISSUE_URL = `${PUBLIC_REPO_ISSUES_URL}/new`;
export const PUBLIC_DISCOVERABILITY_URL = 'https://contextengine.xyz/discoverability.html';
export const PUBLIC_LLMS_URL = 'https://contextengine.xyz/llms.txt';
export const PUBLIC_DISCOVERABILITY_PATH = '/discoverability.html';
export const PUBLIC_LLMS_PATH = '/llms.txt';
export const buildPublicRepoLatestReleaseAssetUrl = (filename = ''): string =>
  filename ? `${PUBLIC_REPO_URL}/releases/latest/download/${String(filename).replace(/^\/+/, '')}` : '';
export const buildPublicRepoBlobUrl = (pathname = ''): string =>
  pathname ? `${PUBLIC_REPO_URL}/blob/${PUBLIC_GITHUB_BRANCH}/${String(pathname).replace(/^\/+/, '')}` : '';
export const buildPublicRepoTreeUrl = (pathname = ''): string =>
  pathname ? `${PUBLIC_REPO_URL}/tree/${PUBLIC_GITHUB_BRANCH}/${String(pathname).replace(/^\/+/, '')}` : '';
export const buildPublicRepoRawUrl = (pathname = ''): string =>
  pathname
    ? `https://raw.githubusercontent.com/${PUBLIC_GITHUB_ORG}/${PUBLIC_GITHUB_REPO}/${PUBLIC_GITHUB_BRANCH}/${String(pathname).replace(/^\/+/, '')}`
    : '';
export const PUBLIC_README_URL = buildPublicRepoRawUrl('README.md');
export const PUBLIC_ARCHITECTURE_URL = buildPublicRepoRawUrl('ARCHITECTURE.md');
export const PUBLIC_CONTRIBUTING_URL = buildPublicRepoBlobUrl('CONTRIBUTING.md');
export const PUBLIC_LICENSE_URL = buildPublicRepoBlobUrl('LICENSE');
export const PUBLIC_WHITEPAPER_URL = buildPublicRepoBlobUrl('whitepaper/whitepaper.md');
export const PUBLIC_WHITEPAPER_RAW_URL = buildPublicRepoRawUrl('whitepaper/whitepaper.md');
export const PUBLIC_CONTRACTS_SOURCE_BASE_URL = buildPublicRepoBlobUrl('contracts');
export const PUBLIC_AI_DISCOURSE_CORPUS_URL = buildPublicRepoTreeUrl('ai-discourse-corpus');

export const buildPublicContractSourceUrl = (filename = ''): string =>
  filename ? `${PUBLIC_CONTRACTS_SOURCE_BASE_URL}/${filename}` : '';
