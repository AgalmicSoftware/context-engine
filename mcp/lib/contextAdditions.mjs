import fs from 'node:fs/promises';
import path from 'node:path';
import { looksSecret } from '../../shared/secretText.mjs';
import {
  ADMINS_ONLY_ACCESS,
  CONTEXT_FILE_TYPES,
  CONTEXT_ROLE,
  CONTEXT_SOURCE_LIMITS,
  CONTEXT_TAGS,
  agentAdderTags,
  contextFileByteLimit,
  resolveContextFileType,
} from '../../shared/sessionContextSources.mjs';

// What an agent adds to a session's context: a local file, a note it writes,
// or a link the Session Worker reads. Files and notes are stored as the web
// app stores a participant's file, marked as an agent's; no text that looks
// like a key, token or password is sent.

const MIB = 1024 * 1024;
const PDF = CONTEXT_FILE_TYPES.pdf;
// The web app's cap on a file's stored name.
const MAX_FILE_NAME = 180;

const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const word = (value) => String(value ?? '').trim().toLowerCase();
const plain = (value) => String(value ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
const megabytes = (bytes) => `${bytes / MIB} MB`;

/** True when the session's Worker keeps context in its own storage and can read it: not Arweave, not Lit-encrypted. */
export const workerReadsContext = (config) => {
  // The public session config shows a session's storage only in its storage profile.
  const profile = isRecord(config?.storageProfile) ? config.storageProfile : {};
  const access = isRecord(profile.payloadAccessControl) ? profile.payloadAccessControl : {};
  return ['cloudflare', 'cf', 'r2'].includes(word(profile.backend)) &&
    word(access.encryption) !== 'lit' && word(access.mode) !== 'lit_encrypted';
};

/** The invitation join_session and get_session show, with the limits; links only where the Worker takes them. */
export const contextInvitation = ({ links }) => ({
  invitation: `You’re invited to add context to this session: ${links ? 'a file, a link or text' : 'a file or text'}. Everyone in the session will see it.`,
  how: `Call add_context with exactly one of file (a local path)${links ? ', url' : ''} or text (with an optional title). Pass adminsOnly to show it to the session’s admins alone.`,
  limits: {
    file: `PDF up to ${megabytes(CONTEXT_SOURCE_LIMITS.pdfBytes)}; Markdown, plain text, CSV or JSON up to ${megabytes(CONTEXT_SOURCE_LIMITS.textFileBytes)}.`,
    ...(links
      ? { url: `A public https:// page of up to ${megabytes(CONTEXT_SOURCE_LIMITS.pageBytes)}, which the Session Worker reads once; the link up to ${CONTEXT_SOURCE_LIMITS.urlChars} characters.` }
      : {}),
    text: `Up to ${megabytes(CONTEXT_SOURCE_LIMITS.textFileBytes)}, stored as a Markdown file; a title up to ${CONTEXT_SOURCE_LIMITS.titleChars} characters.`,
  },
});

// Beyond the shared check: a JSON Web Token, and a credential in a JSON file, such as a cloud CLI's.
const MORE_SECRETS = [
  /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/,
  /"(?:client_?secret|(?:refresh|access|id|auth|session)_?token|private_?key|api_?key|secret_?(?:access_?)?key|password|passwd)"\s*:\s*"[^"\s]{8,}"/i,
];

const refuseSecret = (value, what) => {
  if (looksSecret(value) || MORE_SECRETS.some((pattern) => pattern.test(value))) {
    throw new Error(`${what} looks like it holds a key, token or password, so nothing was added.`);
  }
};

/** A link to add, checked as far as the agent can: the Worker applies its strict link policy. */
export const checkContextLink = ({ url, title }) => {
  const link = String(url ?? '').trim();
  if (!/^https:\/\/\S+$/i.test(link)) throw new Error('Pass an https:// link to a public page.');
  if (link.length > CONTEXT_SOURCE_LIMITS.urlChars) throw new Error(`The link must be ${CONTEXT_SOURCE_LIMITS.urlChars} characters or fewer.`);
  const name = plain(title);
  if (name.length > CONTEXT_SOURCE_LIMITS.titleChars) throw new Error(`The title must be ${CONTEXT_SOURCE_LIMITS.titleChars} characters or fewer.`);
  refuseSecret(link, 'The link');
  refuseSecret(name, 'The title');
  return { url: link, title: name };
};

/**
 * A local file as a context upload. The MCP's state folder, which holds the
 * agent's key, is never read, nor are hidden files and folders, where keys and
 * settings live.
 */
export const readContextFile = async (filePath, { stateDir }) => {
  const given = path.resolve(String(filePath ?? '').trim());
  let real;
  try {
    real = await fs.realpath(given);
  } catch {
    throw new Error(`There is no file at ${given}.`);
  }
  const state = await fs.realpath(stateDir).catch(() => path.resolve(stateDir));
  if (real === state || real.startsWith(`${state}${path.sep}`)) {
    throw new Error('Files in the MCP’s state folder, which holds this agent’s key, are never added.');
  }
  if (real.split(path.sep).some((part) => part.startsWith('.'))) {
    throw new Error('Hidden files, and files in hidden folders, often hold keys and settings, so they are never added. Copy the file to an ordinary folder to add it.');
  }
  const stat = await fs.stat(real);
  if (!stat.isFile()) throw new Error(`${given} is not a file.`);
  // The type comes from the file itself, not a link's name for it.
  const name = path.basename(real);
  const contentType = resolveContextFileType({ name });
  if (!contentType) throw new Error('Add a PDF, Markdown, plain text, CSV or JSON file.');
  const limit = contextFileByteLimit(contentType);
  const tooLarge = () => new Error(`${name} is larger than ${megabytes(limit)}, the most for a ${contentType === PDF ? 'PDF' : 'text file'}.`);
  if (stat.size > limit) throw tooLarge();
  const bytes = await fs.readFile(real);
  if (bytes.length > limit) throw tooLarge();
  if (contentType === PDF) {
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`${name} is not a PDF.`);
  } else {
    let content;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`${name} is not UTF-8 text.`);
    }
    refuseSecret(content, name);
  }
  return { name: name.slice(0, MAX_FILE_NAME), contentType, bytes };
};

/** A note the agent writes, as a Markdown file named by its title, or else its first line. */
export const buildNote = ({ text, title }) => {
  const content = typeof text === 'string' ? text.trim() : '';
  if (!content) throw new Error('Pass the text to add.');
  const bytes = Buffer.from(content, 'utf8');
  if (bytes.length > CONTEXT_SOURCE_LIMITS.textFileBytes) {
    throw new Error(`The text is larger than ${megabytes(CONTEXT_SOURCE_LIMITS.textFileBytes)}, the most for a text file.`);
  }
  const named = plain(title);
  if (named.length > CONTEXT_SOURCE_LIMITS.titleChars) throw new Error(`The title must be ${CONTEXT_SOURCE_LIMITS.titleChars} characters or fewer.`);
  refuseSecret(content, 'The text');
  refuseSecret(named, 'The title');
  const firstLine = plain(content.split('\n')[0].replace(/^#+\s*/, '')).slice(0, CONTEXT_SOURCE_LIMITS.titleChars);
  const base = (named || firstLine || 'Note').replace(/\.(?:md|markdown)$/i, '') || 'Note';
  return { name: `${base}.md`, contentType: CONTEXT_FILE_TYPES.md, bytes };
};

/** The multipart upload the web app sends for a participant's context file, with the agent's mark. */
export const contextUploadForm = ({ name, contentType, bytes }, { adminsOnly = false, adderName = '' } = {}) => {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: contentType }), name);
  form.append('backend', 'cloudflare');
  form.append('resource', 'docsContext');
  form.append('contentType', contentType);
  form.append('payloadEncrypted', 'false');
  form.append('tags', JSON.stringify([
    { name: 'CE-DocLibrary', value: '1' },
    { name: CONTEXT_TAGS.kind, value: 'file' },
    { name: 'CE-DocStorage', value: 'cloudflare' },
    { name: CONTEXT_TAGS.role, value: CONTEXT_ROLE },
    { name: CONTEXT_TAGS.name, value: name },
    { name: CONTEXT_TAGS.mime, value: contentType },
    ...agentAdderTags(adderName),
  ]));
  if (adminsOnly) form.append('accessConditions', JSON.stringify(ADMINS_ONLY_ACCESS));
  return form;
};
