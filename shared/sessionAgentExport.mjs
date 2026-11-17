// The Session Agent's material as one file an admin downloads for the
// session's organisers: what the agent may give a member, as items that each
// say the lowest answer style allowed to hear them, with the agent's rules and
// who is in the groups those rules name. What someone wrote or added carries
// their address unless they asked for it to be left off; nothing else about
// them is in the file. The same session state always gives the same bytes, so
// a copy kept in git changes only where the session did.
import { stableCanonicalSerialize } from './canonicalJson.mjs';
import {
  SESSION_AGENT_LIMITS,
  SESSION_AGENT_RULES,
  countChoices,
  sessionAgentInstructions,
  sessionAgentMinAnswers,
} from './sessionAgent.mjs';
import { SESSION_CONTEXT_TEXT_LIMITS, sessionContextNotes } from './sessionContextText.mjs';

const SESSION_AGENT_EXPORT_FORMAT = 'ce.session-agent-export';
const SESSION_AGENT_EXPORT_VERSION = 1;

/** `<slug>.session-agent.json`: one name per session, so a new export replaces the last in a repository. */
export const sessionAgentExportFilename = (slug) => `${slug}.session-agent.json`;

const L = SESSION_AGENT_LIMITS;
const ID_PREFIX = { question: 'q', context: 'c', results: 'r', counts: 'n', written: 'w', asked: 'a' };
const isRecord = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const clip = (value, max) => (value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`);
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const OPEN_RULE = { match: 'any', conditions: [] };
const ADDRESS = /^0x[0-9a-f]{40}$/;

// Whether what someone wrote or added is exported with their address when
// they have not said otherwise. Their own switch always turns it off.
const ADDRESS_ON_ITEMS = true;

// What marks a written answer as naming someone else: an email, an account
// address, an ENS name, or a phone number (ten or more digits, however they
// are spaced). Such an answer is left out whole, not edited.
const IDENTITY_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /0x[0-9a-f]{40}/i,
  /\b[a-z0-9-]{3,}\.eth\b/i,
  /(?:\d[\s().-]?){9,}\d/,
];
export const namesSomeone = (value) => IDENTITY_PATTERNS.some((pattern) => pattern.test(value));

const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

// What a question asks for, in words: its type, then its options or what its scale's ends mean.
const questionText = ({ type, options, scale }) => {
  const kind = text(type) || 'text';
  const choices = (Array.isArray(options) ? options : []).map(text).filter(Boolean);
  if (text(scale)) return `type: ${kind}, ${clip(text(scale), L.scaleChars)}`;
  return choices.length ? `type: ${kind}; options: ${choices.join(' | ')}` : `type: ${kind}`;
};

// "12 answered. Agree: 7, Disagree: 5": every answer counted, the options most chosen first.
const countsText = (rows) => {
  const counts = Object.entries(countChoices(rows));
  if (!counts.length) return '';
  const listed = counts.sort((a, b) => b[1] - a[1]).map(([choice, count]) => `${choice}: ${count}`);
  return `${rows.length} answered. ${listed.join(', ')}`;
};

/**
 * The export, as a plain object. Everything given must already be only what
 * the Session Agent itself may read, as the Worker gathers it for the agent:
 * - `questions`: every question the session's own analysis reads, `{ prompt, type, options?, scale? }`
 *   with `scale` as words;
 * - `sessionContext`: the session's own notes and links;
 * - `sources`: context files and links, each `{ title, kind, url, text, readByAi, everyone, groupIds, uploader }`,
 *   where `everyone` says whoever the session admits may read it, `groupIds` the groups it is locked to
 *   and `uploader` the address that added it;
 * - `results`: the published results as lines of text, and `resultsForEveryone` whether those who
 *   pass the session's gate may see them;
 * - `answers`: `[{ question, answers: [{ choices, text, from }] }]`, one entry per member's answer, from
 *   members who let the agent use them, `from` being the writer's address;
 * - `asked`: the chats askers chose to store, `[{ day, answers, question, answer, scope?, groups?, by?, name? }]`,
 *   `answers` being the style the answer was given in, `scope: 'admin'` marking one given to an admin or results
 *   admin, `groups` the groups whose locked files it drew on, and `by` the asker's address when they gave it;
 * - `unattributed`: the addresses that asked for their address to be left off;
 * - `groups`: `[{ groupId, members }]` for the groups the rules and the items name, kept under the gate
 *   and apart from every item;
 * - `leftOut`: what the Worker left out before this, by reason, as counts.
 */
export const buildSessionAgentExport = async ({
  slug,
  title,
  gate,
  setting,
  questions = [],
  sessionContext,
  sources = [],
  results = '',
  resultsForEveryone = false,
  answers = [],
  asked = [],
  unattributed = [],
  groups = [],
  leftOut = {},
} = {}) => {
  const found = [];
  let patternMatches = 0;
  let withoutText = 0;
  const add = (kind, tier, fields) => found.push({ kind, tier, ...fields });
  const withoutAddress = new Set([...unattributed].map((address) => text(address).toLowerCase()));
  // The writer's address, when it may be shown; never a name.
  const by = (writer) => {
    const address = text(writer).toLowerCase();
    return ADDRESS_ON_ITEMS && ADDRESS.test(address) && !withoutAddress.has(address) ? { by: address } : {};
  };

  questions.filter(isRecord).forEach((question) => {
    const prompt = text(question.prompt);
    if (prompt) add('question', 'general', { question: prompt, text: questionText(question) });
  });

  const notes = sessionContextNotes(sessionContext);
  notes.notes.forEach((note) => add('context', 'general', { source: 'note', text: clip(note, SESSION_CONTEXT_TEXT_LIMITS.itemChars) }));
  notes.links.forEach((link) =>
    add('context', 'general', { source: 'link', ...(text(link.label) ? { title: text(link.label) } : {}), url: text(link.url), text: text(link.url) }),
  );

  sources.filter(isRecord).forEach((source) => {
    const body = clip(text(source.text), SESSION_CONTEXT_TEXT_LIMITS.itemChars);
    // A link whose page gave no text, or an empty file, has nothing to export.
    if (!body) {
      withoutText += 1;
      return;
    }
    const lockedTo = [...new Set((Array.isArray(source.groupIds) ? source.groupIds : []).map(text).filter(Boolean))].sort(byCodePoint);
    add('context', source.everyone === true ? 'general' : 'detailed', {
      source: source.kind === 'link' ? 'link' : 'file',
      title: clip(text(source.title), 200) || 'Untitled',
      ...(text(source.url) ? { url: text(source.url) } : {}),
      ...(source.readByAi ? { readByAi: true } : {}),
      ...(source.everyone === true || !lockedTo.length ? {} : { groups: lockedTo }),
      text: body,
      ...by(source.uploader),
    });
  });

  // General answers hear the published results only when everyone the session admits may see them.
  if (resultsForEveryone) {
    text(results).split('\n').map(text).filter(Boolean).forEach((line) => add('results', 'general', { text: line }));
  }

  answers.filter(isRecord).forEach((group) => {
    // The question's words in full, as its own item has them, so the two can be matched.
    const question = text(group.question);
    const rows = (Array.isArray(group.answers) ? group.answers : []).filter(isRecord);
    if (!question || !rows.length) return;
    const counts = countsText(rows);
    if (counts) add('counts', 'detailed', { question, text: counts });
    rows.forEach((row) => {
      const written = text(row.text);
      if (!written) return;
      // Checked before it is cut, so an address past the cut still keeps it out.
      if (namesSomeone(written)) patternMatches += 1;
      else add('written', 'detailed', { question, text: clip(written, L.answerItemChars), ...by(row.from) });
    });
  });

  // A stored chat is for the style its answer was given in: a Detailed answer
  // may have drawn on what General askers never hear. One given to an admin
  // or results admin may hold what no member is given, so it stays out, as
  // admins-only context does; one that drew on a group's locked files is for
  // that group, as the files are.
  let adminChats = 0;
  asked.filter(isRecord).forEach((chat) => {
    const question = text(chat.question);
    const answer = text(chat.answer);
    if (!question || !answer || !['general', 'detailed'].includes(chat.answers)) return;
    if (chat.scope !== undefined) {
      adminChats += 1;
      return;
    }
    const lockedTo = [...new Set((Array.isArray(chat.groups) ? chat.groups : []).map(text).filter(Boolean))].sort(byCodePoint);
    add('asked', chat.answers, {
      question,
      text: answer,
      ...(text(chat.day) ? { day: text(chat.day) } : {}),
      ...(lockedTo.length ? { groups: lockedTo } : {}),
      ...(text(chat.name) ? { name: text(chat.name) } : {}),
      ...by(chat.by),
    });
  });

  // An item's id is a hash of the item. Without an address on it, the same
  // words on the same question are one item with a count, so nothing tells two
  // people's identical answers apart or links two answers by one person.
  const merged = new Map();
  for (const item of found) {
    const hash = await sha256Hex(stableCanonicalSerialize(item));
    const id = `${ID_PREFIX[item.kind]}-${hash.slice(0, 16)}`;
    const same = merged.get(id);
    if (same) same.count = (same.count || 1) + 1;
    else merged.set(id, { id, ...item });
  }
  const items = [...merged.values()].sort((a, b) => byCodePoint(a.id, b.id)).map(({ count, ...item }) =>
    ['written', 'asked'].includes(item.kind) && count > 1 ? { ...item, count } : item,
  );

  const byKind = {};
  items.forEach((item) => {
    byKind[item.kind] = (byKind[item.kind] || 0) + 1;
  });
  const groupBlocks = groups
    .filter((group) => isRecord(group) && text(group.groupId))
    .map((group) => ({
      groupId: text(group.groupId),
      members: [...new Set((Array.isArray(group.members) ? group.members : []).map((address) => text(address).toLowerCase()).filter(Boolean))].sort(byCodePoint),
      // Not every member could be listed: a reader must not take the list as whole.
      ...(group.complete === false ? { complete: false } : {}),
    }))
    .sort((a, b) => byCodePoint(a.groupId, b.groupId));
  const rules = isRecord(gate) ? gate : { signIn: OPEN_RULE, read: OPEN_RULE };
  const counted = Object.fromEntries(
    Object.entries({
      ...leftOut,
      patternMatches,
      contextNotRead: (leftOut.contextNotRead || 0) + notes.omitted,
      unreadableContext: (leftOut.unreadableContext || 0) + withoutText,
      // Counted only where the session records chats, so other sessions' manifests are unchanged.
      ...(asked.length ? { adminChats } : {}),
    })
      .filter(([, count]) => Number.isSafeInteger(count) && count >= 0),
  );
  return {
    format: SESSION_AGENT_EXPORT_FORMAT,
    version: SESSION_AGENT_EXPORT_VERSION,
    session: { slug: text(slug), title: text(title), gate: { signIn: rules.signIn, read: rules.read, groups: groupBlocks } },
    agent: {
      instructions: { general: sessionAgentInstructions(setting, 'general'), detailed: sessionAgentInstructions(setting, 'detailed') },
      rules: [...SESSION_AGENT_RULES],
      limits: {
        questionChars: L.questionChars,
        answerWords: L.answerWords,
        contextChars: L.contextChars,
        resultsChars: L.resultsChars,
        answersChars: L.answersChars,
        answerItemChars: L.answerItemChars,
      },
      audiences: Array.isArray(setting?.audiences) ? setting.audiences : [],
      minAnswers: sessionAgentMinAnswers(setting),
    },
    items,
    manifest: {
      itemCount: items.length,
      itemsSha256: await sha256Hex(items.map((item) => stableCanonicalSerialize(item)).join('\n')),
      byKind,
      leftOut: counted,
    },
  };
};

/** The file's bytes: keys in one fixed order at every level, two-space indented, one trailing newline. */
export const serializeSessionAgentExport = (bundle) => `${JSON.stringify(JSON.parse(stableCanonicalSerialize(bundle)), null, 2)}\n`;
