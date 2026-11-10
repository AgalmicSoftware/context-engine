import fs from 'node:fs';
import path from 'node:path';

import { getSessionSlugValidationError } from '../../components/Sessions/sessionWizardSlugValidation';
import { KNOWN_SESSION_CONFIGS, KNOWN_SESSIONS } from './knownSessionsFile';
import { parseSessionWorkerDiscoveryOrigin } from './sessionWorkerDiscovery';

const FILE = path.resolve(__dirname, '../../../../known-sessions.json');
const FIELDS = new Set(['worker', 'sessionId', 'name']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// Every problem in a known-sessions.json text, one line each.
const knownSessionsProblems = (raw: string): string[] => {
  const problems: string[] = [];
  // JSON.parse keeps only the last of two equal keys, so look for repeats in the text.
  const slugs = [...raw.matchAll(/^ {2}"([^"]*)":/gm)].map((match) => match[1]);
  for (const slug of new Set(slugs.filter((slug, index) => slugs.indexOf(slug) !== index))) {
    problems.push(`${slug}: listed twice`);
  }
  const sessions: unknown = JSON.parse(raw);
  if (!isRecord(sessions)) return [...problems, 'file: not an object of sessions'];
  if (raw !== `${JSON.stringify(sessions, null, 2)}\n`) problems.push('file: not 2-space JSON with a final newline');
  for (const [slug, entry] of Object.entries(sessions)) {
    if (slug !== slug.trim() || getSessionSlugValidationError(slug)) problems.push(`${slug}: not a valid session slug`);
    if (!isRecord(entry)) {
      problems.push(`${slug}: not an object`);
      continue;
    }
    const extra = Object.keys(entry).filter((key) => !FIELDS.has(key));
    if (extra.length) problems.push(`${slug}: unexpected ${extra.join(', ')}`);
    let origin = '';
    try {
      origin = parseSessionWorkerDiscoveryOrigin(entry.worker, { environment: 'production' });
    } catch {
      origin = '';
    }
    if (!origin || origin !== entry.worker) problems.push(`${slug}: worker is not an HTTPS Worker origin`);
    if (typeof entry.sessionId !== 'string' || !/^0x(?!0{32})[0-9a-f]{32}$/.test(entry.sessionId)) {
      problems.push(`${slug}: sessionId is not 0x and 32 hex digits`);
    }
    if ('name' in entry && (typeof entry.name !== 'string' || !entry.name.trim())) {
      problems.push(`${slug}: name is not a name`);
    }
  }
  return problems;
};

const WORKER = 'https://ce-fixture.example.workers.dev';
const SESSION_ID = '0x0123456789abcdef0123456789abcdef';
const fileText = (sessions: Record<string, unknown>) => `${JSON.stringify(sessions, null, 2)}\n`;
const entry = (fields: Record<string, unknown> = {}) => ({ worker: WORKER, sessionId: SESSION_ID, ...fields });

describe('known-sessions.json', () => {
  it('is valid', () => {
    expect(knownSessionsProblems(fs.readFileSync(FILE, 'utf8'))).toEqual([]);
  });

  it('accepts an entry with only a Worker and a session ID', () => {
    expect(knownSessionsProblems(fileText({ fixture: entry() }))).toEqual([]);
  });

  it.each([
    [
      'a slug listed twice',
      `{\n  "fixture": ${JSON.stringify(entry())},\n  "fixture": ${JSON.stringify(entry())}\n}\n`,
      'fixture: listed twice',
    ],
    ['a slug outside the wizard rules', fileText({ Fixture: entry() }), 'Fixture: not a valid session slug'],
    ['a reserved slug', fileText({ debate: entry() }), 'debate: not a valid session slug'],
    ['the default-session alias', fileText({ general: entry() }), 'general: not a valid session slug'],
    [
      'a Worker over HTTP',
      fileText({ fixture: entry({ worker: 'http://ce-fixture.example.workers.dev' }) }),
      'fixture: worker is not an HTTPS Worker origin',
    ],
    [
      'a Worker with a path',
      fileText({ fixture: entry({ worker: `${WORKER}/session` }) }),
      'fixture: worker is not an HTTPS Worker origin',
    ],
    [
      'a Worker with a trailing slash',
      fileText({ fixture: entry({ worker: `${WORKER}/` }) }),
      'fixture: worker is not an HTTPS Worker origin',
    ],
    [
      'a Worker on a local host',
      fileText({ fixture: entry({ worker: 'https://127.0.0.1' }) }),
      'fixture: worker is not an HTTPS Worker origin',
    ],
    [
      'a missing Worker',
      fileText({ fixture: { sessionId: SESSION_ID } }),
      'fixture: worker is not an HTTPS Worker origin',
    ],
    [
      'a short session ID',
      fileText({ fixture: entry({ sessionId: '0x0123' }) }),
      'fixture: sessionId is not 0x and 32 hex digits',
    ],
    [
      'a session ID without 0x',
      fileText({ fixture: entry({ sessionId: SESSION_ID.slice(2) }) }),
      'fixture: sessionId is not 0x and 32 hex digits',
    ],
    [
      'an uppercase session ID',
      fileText({ fixture: entry({ sessionId: SESSION_ID.toUpperCase().replace('0X', '0x') }) }),
      'fixture: sessionId is not 0x and 32 hex digits',
    ],
    [
      'an all-zero session ID',
      fileText({ fixture: entry({ sessionId: `0x${'0'.repeat(32)}` }) }),
      'fixture: sessionId is not 0x and 32 hex digits',
    ],
    [
      'a missing session ID',
      fileText({ fixture: { worker: WORKER } }),
      'fixture: sessionId is not 0x and 32 hex digits',
    ],
    ['another field', fileText({ fixture: entry({ admin: '0xabc' }) }), 'fixture: unexpected admin'],
    ['an empty name', fileText({ fixture: entry({ name: ' ' }) }), 'fixture: name is not a name'],
    ['an entry that is not an object', fileText({ fixture: WORKER }), 'fixture: not an object'],
    [
      'a file that is not formatted',
      JSON.stringify({ fixture: entry() }),
      'file: not 2-space JSON with a final newline',
    ],
  ])('rejects %s', (_label, raw, problem) => {
    expect(knownSessionsProblems(raw)).toContain(problem);
  });

  it('turns each entry into the bundled clean-route config', () => {
    for (const [slug, { worker, sessionId, name }] of Object.entries(KNOWN_SESSIONS)) {
      expect(KNOWN_SESSION_CONFIGS[slug]).toEqual({
        slug,
        sessionId,
        ...(name ? { sessionName: name } : {}),
        corsWorkerUrl: worker,
        workerCanonicalCleanRoute: true,
        sessionModeProfile: {
          profileVersion: 1,
          preset: 'custom',
          authority: { mode: 'worker_canonical' },
          evm: { registryChainId: null },
        },
      });
    }
  });
});
