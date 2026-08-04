import historicalFigureUsersJson from '../../variables/demo/historical_figure_users.json';
import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import { getHistoricalFigureAvatarOrBlockie } from '../../utilities/ui/historicalFigureAvatars.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { buildUsersFromCaches, shortenPlain, type CompareUser } from '../../utilities/survey/compareUsers.js';
import { normalizeCompareSubjects, type CompareSubject, type CompareSubjectKind } from './compareSubjectContract';
import { buildCompareProfileHref } from './compareAddressStyles';

type UnknownRecord = Record<string, unknown>;

type HistoricalQuestion = {
  answer?: { encrypted?: boolean; value?: unknown };
  commentIndex?: number | string;
  question?: string;
  questionType?: string;
};

type HistoricalFigure = {
  avatar?: string;
  name?: string;
  questions?: HistoricalQuestion[];
  username?: string;
};

export type CompareSubjectSource = 'session_cache' | 'shipped_simulation';

export type CompareSubjectProvenance = {
  cacheSubjectId?: string;
  sessionSlug: string;
  source: CompareSubjectSource;
  subjectKind: CompareSubjectKind;
};

export interface NormalizedCompareUser extends CompareUser {
  address: string;
  addressLower: string;
  avatar: string;
  cacheSubjectId?: string;
  label: string;
  profileHref: string;
  provenance: CompareSubjectProvenance;
  questions: NonNullable<CompareUser['questions']>;
  sbts: NonNullable<CompareUser['sbts']>;
  subjectKind: CompareSubjectKind;
  subjectToken: string;
  supportsMembership: boolean;
  surveys: unknown[];
}

export type ResolvedCompareSubject = {
  displayName: string;
  provenance: CompareSubjectProvenance;
  subject: CompareSubject;
  user: NormalizedCompareUser;
};

export type CompareSubjectResolutionError = {
  message: string;
  token: string;
};

export type CompareSubjectResolution = {
  errors: CompareSubjectResolutionError[];
  subjects: ResolvedCompareSubject[];
  users: NormalizedCompareUser[];
};

export type CompareSubjectCompatibility = {
  membershipComparable: boolean;
  notice: string;
  opinionComparable: boolean;
  sharedQuestionIds: string[];
  summaryComparable: boolean;
};

type ResolveCompareSubjectsOptions = {
  questionsCaches?: UnknownRecord[];
  sbtCaches?: UnknownRecord[];
  sessionSlug?: unknown;
  subjects?: unknown[];
  surveysCaches?: UnknownRecord[];
};

const historicalFigures = historicalFigureUsersJson as HistoricalFigure[];

const addressBackedWorkerId = (workerId: unknown): string => {
  const match = String(workerId || '').match(/^(?:evm_address|passkey_eoa|external_wallet):(0x[0-9a-fA-F]{40})$/i);
  return match?.[1]?.toLowerCase() || '';
};

const cacheSubjectIdFor = (subject: CompareSubject): string => {
  if (subject.kind === 'wallet') return subject.id;
  if (subject.kind === 'worker') return addressBackedWorkerId(subject.id) || subject.id;
  return '';
};

const supportsMembershipFor = (subject: CompareSubject): boolean =>
  subject.kind === 'wallet' || (subject.kind === 'worker' && Boolean(addressBackedWorkerId(subject.id)));

const findHistoricalFigure = (id: unknown): HistoricalFigure | null => {
  const normalizedId = String(id || '')
    .trim()
    .toLowerCase();
  if (!normalizedId) return null;
  return (
    historicalFigures.find(
      (figure) =>
        String(figure.username || '')
          .trim()
          .toLowerCase() === normalizedId,
    ) || null
  );
};

const buildSimQuestions = (figure: HistoricalFigure): NonNullable<CompareUser['questions']> => {
  const username = String(figure.username || '').trim();
  return (Array.isArray(figure.questions) ? figure.questions : []).flatMap((question, index) => {
    const value = question?.answer?.value;
    if (question?.answer?.encrypted === true || value == null || value === '*' || value === '') return [];
    const sharedIndex = String(question?.commentIndex ?? '').trim();
    const id = sharedIndex ? `demo-comment:${sharedIndex}` : `sim:${username.toLowerCase()}:question:${index + 1}`;
    return [
      {
        answer: value,
        id,
        prompt: String(question?.question || 'Unknown Question'),
        type: String(question?.questionType || 'unknown').toLowerCase(),
      },
    ];
  });
};

const resolveSimSubject = (subject: CompareSubject, sessionSlug: string): ResolvedCompareSubject | null => {
  const figure = findHistoricalFigure(subject.id);
  if (!figure) return null;
  const username = String(figure.username || subject.id).trim();
  const displayName = String(figure.name || username).trim();
  const provenance: CompareSubjectProvenance = {
    sessionSlug,
    source: 'shipped_simulation',
    subjectKind: 'sim',
  };
  const user: NormalizedCompareUser = {
    address: subject.token,
    addressLower: subject.key,
    avatar: getHistoricalFigureAvatarOrBlockie(username, { fallbackSeed: subject.key }),
    label: displayName,
    profileHref: buildPublicRoute(`/su/${encodeURIComponent(username)}`),
    provenance,
    questions: buildSimQuestions(figure),
    sbts: [],
    subjectKind: 'sim',
    subjectToken: subject.token,
    supportsMembership: false,
    surveys: [],
  };
  return { displayName, provenance, subject, user };
};

export const resolveCompareSubjects = ({
  questionsCaches = [],
  sbtCaches = [],
  sessionSlug: sessionSlugInput = '',
  subjects: subjectInputs = [],
  surveysCaches = [],
}: ResolveCompareSubjectsOptions = {}): CompareSubjectResolution => {
  const subjects = normalizeCompareSubjects(
    subjectInputs.map((subject) =>
      subject && typeof subject === 'object' && 'token' in subject ? (subject as { token?: unknown }).token : subject,
    ),
  );
  const sessionSlug = normalizeSessionSlug(sessionSlugInput);
  const cacheSubjects = subjects.filter((subject) => subject.kind !== 'sim');
  const cacheIds = cacheSubjects.map(cacheSubjectIdFor);
  const builtUsers = buildUsersFromCaches(cacheIds, sbtCaches, questionsCaches, surveysCaches, { sessionSlug });
  const builtByCacheId = new Map(builtUsers.map((user) => [String(user.address || '').toLowerCase(), user]));
  const resolved: ResolvedCompareSubject[] = [];
  const errors: CompareSubjectResolutionError[] = [];

  subjects.forEach((subject) => {
    if (subject.kind === 'sim') {
      const simulated = resolveSimSubject(subject, sessionSlug);
      if (simulated) resolved.push(simulated);
      else errors.push({ message: `Unknown simulated subject: ${subject.id}`, token: subject.token });
      return;
    }

    const cacheSubjectId = cacheSubjectIdFor(subject);
    const built = builtByCacheId.get(cacheSubjectId.toLowerCase());
    if (!built) {
      errors.push({ message: `Unable to resolve subject: ${subject.token}`, token: subject.token });
      return;
    }
    const workerAddress = subject.kind === 'worker' ? addressBackedWorkerId(subject.id) : '';
    const displayName =
      subject.kind === 'wallet'
        ? shortenPlain(subject.id)
        : workerAddress
          ? `Worker ${shortenPlain(workerAddress)}`
          : subject.id;
    const provenance: CompareSubjectProvenance = {
      cacheSubjectId,
      sessionSlug,
      source: 'session_cache',
      subjectKind: subject.kind,
    };
    const addressBackedId = subject.kind === 'wallet' ? subject.id : workerAddress;
    const user: NormalizedCompareUser = {
      ...built,
      address: subject.token,
      addressLower: subject.key,
      avatar: addressBackedId ? getHistoricalFigureAvatarOrBlockie('', { fallbackSeed: addressBackedId }) : '',
      cacheSubjectId,
      label: displayName,
      profileHref: addressBackedId ? buildCompareProfileHref(addressBackedId, sessionSlug) : '',
      provenance,
      subjectKind: subject.kind,
      subjectToken: subject.token,
      supportsMembership: supportsMembershipFor(subject),
    };
    resolved.push({ displayName, provenance, subject, user });
  });

  return { errors, subjects: resolved, users: resolved.map((entry) => entry.user) };
};

export const analyzeCompareSubjectCompatibility = (
  users: NormalizedCompareUser[] = [],
): CompareSubjectCompatibility => {
  const counts = new Map<string, number>();
  users.forEach((user) => {
    const ids = new Set(
      (user.questions || [])
        .map((question) => String(question?.id || question?.questionID || question?.questionId || '').toLowerCase())
        .filter(Boolean),
    );
    ids.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  });
  const sharedQuestionIds = Array.from(counts.entries())
    .filter(([, count]) => users.length >= 2 && count === users.length)
    .map(([id]) => id)
    .sort();
  const opinionComparable = sharedQuestionIds.length > 0;
  const membershipComparable = users.length >= 2 && users.every((user) => user.supportsMembership);
  const summaryComparable = opinionComparable || membershipComparable;
  const notice = summaryComparable
    ? ''
    : 'These subjects do not share a canonical question ID across all participants or comparable session membership evidence.';
  return { membershipComparable, notice, opinionComparable, sharedQuestionIds, summaryComparable };
};
