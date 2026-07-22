#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASELINE_GROWTH_APPROVAL_LABEL = 'baseline-growth-approved';
export const BASELINE_GROWTH_CODEOWNERS = Object.freeze(['AgalmicSoftware']);

const normalizeLogin = (value) => String(value || '').trim().toLowerCase();
const normalizePermission = (value) => String(value || '').trim().toLowerCase();
const hasMaintainerPermission = (permission) => ['maintain', 'admin'].includes(normalizePermission(permission));
const hasReviewPermission = (permission) => ['write', 'maintain', 'admin'].includes(normalizePermission(permission));

export function evaluateBaselineGrowthApproval({
  eventName = '',
  pullRequest = null,
  labelEvents = [],
  reviews = [],
  permissionsByLogin = {},
  codeOwners = BASELINE_GROWTH_CODEOWNERS,
} = {}) {
  if (eventName !== 'pull_request') {
    return { approved: false, reason: 'pull-request-required' };
  }

  const approvalLabel = BASELINE_GROWTH_APPROVAL_LABEL.toLowerCase();
  const currentLabels = new Set((pullRequest?.labels || [])
    .map((label) => String(label?.name || label).trim().toLowerCase())
    .filter(Boolean));
  if (!currentLabels.has(approvalLabel)) {
    return { approved: false, reason: 'approval-label-missing' };
  }

  const relevantLabelEvents = (Array.isArray(labelEvents) ? labelEvents : []).filter((event) => (
    ['labeled', 'unlabeled'].includes(String(event?.event || '').toLowerCase()) &&
    String(event?.label?.name || '').trim().toLowerCase() === approvalLabel
  ));
  const latestLabelEvent = relevantLabelEvents.at(-1);
  if (!latestLabelEvent || String(latestLabelEvent.event).toLowerCase() !== 'labeled') {
    return { approved: false, reason: 'maintainer-label-event-missing' };
  }

  const permissionFor = (login) => permissionsByLogin[login]
    || permissionsByLogin[normalizeLogin(login)]
    || '';
  const labelActor = String(latestLabelEvent?.actor?.login || '').trim();
  if (!labelActor || !hasMaintainerPermission(permissionFor(labelActor))) {
    return { approved: false, reason: 'label-actor-not-maintainer' };
  }

  const latestReviewByLogin = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const login = normalizeLogin(review?.user?.login);
    if (login) latestReviewByLogin.set(login, review);
  }
  const author = normalizeLogin(pullRequest?.user?.login);
  const headCommit = String(pullRequest?.head?.sha || '').trim().toLowerCase();
  const reviewer = (Array.isArray(codeOwners) ? codeOwners : [])
    .map((owner) => String(owner || '').replace(/^@/, '').trim())
    .find((owner) => {
      const login = normalizeLogin(owner);
      const review = latestReviewByLogin.get(login);
      return login && login !== author && String(review?.state || '').toUpperCase() === 'APPROVED' &&
        headCommit && String(review?.commit_id || '').trim().toLowerCase() === headCommit &&
        hasReviewPermission(permissionFor(owner));
    });
  if (!reviewer) {
    return { approved: false, reason: 'codeowner-approval-missing' };
  }

  return {
    approved: true,
    reason: 'maintainer-label-and-codeowner-review',
    labelActor,
    reviewer,
  };
}

const parseArgs = (argv) => {
  const options = {
    eventName: process.env.GITHUB_EVENT_NAME || '',
    repository: process.env.GITHUB_REPOSITORY || '',
    pullRequestNumber: process.env.BASELINE_GROWTH_PR_NUMBER || '',
    token: process.env.GITHUB_TOKEN || '',
    apiBaseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
    githubOutput: process.env.GITHUB_OUTPUT || '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--event-name') options.eventName = argv[++index] || '';
    else if (arg === '--repo') options.repository = argv[++index] || '';
    else if (arg === '--pr') options.pullRequestNumber = argv[++index] || '';
    else if (arg === '--token') options.token = argv[++index] || '';
    else if (arg === '--api-base') options.apiBaseUrl = argv[++index] || '';
    else if (arg === '--github-output') options.githubOutput = argv[++index] || '';
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
};

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

const fetchJson = async (url, token) => {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) throw new Error(`GitHub API ${response.status} for ${new URL(url).pathname}`);
  return response.json();
};

const fetchPages = async (url, token) => {
  const values = [];
  for (let page = 1; page <= 10; page += 1) {
    const separator = url.includes('?') ? '&' : '?';
    const batch = await fetchJson(`${url}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(batch)) throw new Error(`GitHub API did not return an array for ${new URL(url).pathname}`);
    values.push(...batch);
    if (batch.length < 100) return values;
  }
  throw new Error(`GitHub API pagination exceeded the bounded review/event limit for ${new URL(url).pathname}`);
};

const writeResult = (result, githubOutput = '') => {
  const safe = {
    approved: result?.approved === true,
    reason: String(result?.reason || 'approval-evidence-unavailable'),
    labelActor: String(result?.labelActor || ''),
    reviewer: String(result?.reviewer || ''),
  };
  if (githubOutput) {
    fs.appendFileSync(githubOutput, [
      `approved=${safe.approved ? 'approved' : 'denied'}`,
      `reason=${safe.reason}`,
      `label_actor=${safe.labelActor}`,
      `reviewer=${safe.reviewer}`,
      '',
    ].join('\n'));
  } else {
    process.stdout.write(`${JSON.stringify(safe)}\n`);
  }
};

const runCli = async (argv) => {
  const options = parseArgs(argv);
  if (options.eventName !== 'pull_request') {
    writeResult({ approved: false, reason: 'pull-request-required' }, options.githubOutput);
    return 0;
  }
  if (!options.token || !options.repository || !/^\d+$/.test(String(options.pullRequestNumber))) {
    writeResult({ approved: false, reason: 'approval-evidence-unavailable' }, options.githubOutput);
    return 0;
  }

  try {
    const apiBase = String(options.apiBaseUrl).replace(/\/$/, '');
    const pullUrl = `${apiBase}/repos/${options.repository}/pulls/${options.pullRequestNumber}`;
    const [pullRequest, labelEvents, reviews] = await Promise.all([
      fetchJson(pullUrl, options.token),
      fetchPages(`${apiBase}/repos/${options.repository}/issues/${options.pullRequestNumber}/events`, options.token),
      fetchPages(`${pullUrl}/reviews`, options.token),
    ]);
    const relevantLogins = new Set([
      ...labelEvents.map((event) => String(event?.actor?.login || '').trim()),
      ...reviews.map((review) => String(review?.user?.login || '').trim()),
      ...BASELINE_GROWTH_CODEOWNERS,
    ].filter(Boolean));
    const permissionsByLogin = {};
    await Promise.all([...relevantLogins].map(async (login) => {
      const permission = await fetchJson(
        `${apiBase}/repos/${options.repository}/collaborators/${encodeURIComponent(login)}/permission`,
        options.token,
      );
      permissionsByLogin[login] = permission?.permission || '';
    }));
    writeResult(evaluateBaselineGrowthApproval({
      eventName: options.eventName,
      pullRequest,
      labelEvents,
      reviews,
      permissionsByLogin,
    }), options.githubOutput);
  } catch (error) {
    console.error(`Baseline growth approval evidence unavailable: ${error?.message || error}`);
    writeResult({ approved: false, reason: 'approval-evidence-unavailable' }, options.githubOutput);
  }
  return 0;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli(process.argv.slice(2))
    .then((status) => { process.exitCode = status; })
    .catch((error) => {
      console.error(error?.message || error);
      process.exitCode = 2;
    });
}
