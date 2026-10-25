import { normalizeHttpOrigin } from './config.mjs';
import { normalizeRecruitmentSource } from './records.mjs';

// Parses the session links the web app shares, for example
// https://contextengine.sh/session/<slug>?worker=<origin>&joinGroup=<id>
// with optional SBT claim pairs: sbt/gp/inv/auto and numbered sbtN/gpN/invN/autoN.

const SLUG_RE = /^[a-z0-9_-]{1,128}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const GROUP_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

const trim = (value) => String(value ?? '').trim();

export const normalizeSessionSlug = (value) => {
  const slug = trim(value).toLowerCase();
  if (!SLUG_RE.test(slug)) throw new Error('Session slug must be 1-128 lowercase letters, digits, dashes, or underscores.');
  return slug;
};

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const RESERVED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp', '.private', '.invalid'];

/**
 * Accepts only an https Worker on a public DNS name (Workers never live on IP
 * addresses). http://localhost is allowed only when explicitly enabled.
 */
export const normalizeWorkerOrigin = (value, { allowLocalWorkers = false } = {}) => {
  const { protocol, hostname, port } = new URL(normalizeHttpOrigin(value, 'Worker URL'));
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  const origin = `${protocol}//${host}${port ? `:${port}` : ''}`;
  if (allowLocalWorkers && LOCAL_HOSTNAMES.has(host)) return origin;
  if (protocol !== 'https:') throw new Error('Worker URL must use HTTPS.');
  const isIpLiteral = host.startsWith('[') || /^[\d.]+$/.test(host);
  if (isIpLiteral || !host.includes('.') || LOCAL_HOSTNAMES.has(host) || RESERVED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error('Worker URL must be a public host name, not a local, private, or reserved address.');
  }
  return origin;
};

const readClaimPairs = (params) => {
  const globalAuto = params.get('auto') === '1';
  const pairs = [];
  const seen = new Set();
  const add = (sbt, gp, inv, auto) => {
    const address = trim(sbt);
    if (!ADDRESS_RE.test(address)) return;
    const pair = { sbt: address, groupPassword: trim(gp), inviteCode: trim(inv), auto };
    const key = `${address.toLowerCase()}|${pair.groupPassword}|${pair.inviteCode}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push(pair);
  };
  if (params.has('sbt')) add(params.get('sbt'), params.get('gp'), params.get('inv'), globalAuto);
  for (const key of params.keys()) {
    const match = key.match(/^sbt(\d+)$/);
    if (!match) continue;
    const index = match[1];
    add(params.get(key), params.get(`gp${index}`), params.get(`inv${index}`), globalAuto || params.get(`auto${index}`) === '1');
  }
  return pairs;
};

/**
 * Parses a session link into the Worker, slug, and any invite parameters.
 * A link without worker= resolves through the OP Sepolia registry.
 */
export const parseSessionLink = (link, { allowLocalWorkers = false } = {}) => {
  let url;
  try {
    url = new URL(trim(link));
  } catch {
    throw new Error('Session link must be a full URL, such as https://contextengine.sh/session/<slug>?worker=<origin>.');
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const sessionIndex = segments.findIndex((segment) => segment === 'session' || segment === 's');
  const slugSegment = sessionIndex >= 0 ? segments[sessionIndex + 1] : '';
  if (!slugSegment) throw new Error('Session link must contain /session/<slug>.');
  const params = url.searchParams;
  const workers = params.getAll('worker');
  if (workers.length > 1) {
    throw new Error('Session link must name exactly one hosted Worker when using ?worker=.');
  }
  const joinGroup = trim(params.get('joinGroup'));
  if (joinGroup && !GROUP_ID_RE.test(joinGroup)) throw new Error('Session link has an invalid group id.');
  return {
    appOrigin: normalizeHttpOrigin(url.origin, 'Session link'),
    slug: normalizeSessionSlug(decodeURIComponent(slugSegment)),
    workerOrigin: workers.length ? normalizeWorkerOrigin(workers[0], { allowLocalWorkers }) : '',
    ...(workers.length ? {} : { kind: 'registry', chainId: 11155420 }),
    joinGroupId: joinGroup,
    sbtClaims: readClaimPairs(params),
    recruitmentSource: normalizeRecruitmentSource(params.get('src')),
  };
};

export const buildSessionWebUrl = ({ appOrigin, slug, workerOrigin, kind }) =>
  `${appOrigin}/session/${encodeURIComponent(slug)}${kind === 'registry' ? '' : `?worker=${encodeURIComponent(workerOrigin)}`}`;
