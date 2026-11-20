/** @file CompareSubjectNameSearch.tsx: a Compare box that takes an address or finds an account by its name. */
import { generateBlockieDataUrl } from '../../utilities/ui/blockieAvatars.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { findSessionNameMatches, normalizeSessionName, type SessionNames } from '../../utilities/session/sessionNames';
import { parseCompareSubject } from './compareSubjectContract';
import styles from './UserPage.module.scss';

/**
 * Typed names swapped for their accounts when Compare is pressed: the one account with exactly that name
 * (ignoring case), or else the one account the typed text finds. Text that fits several accounts, or none, is
 * left as typed and reported, so the person picks from the list instead of the site guessing or dropping it.
 */
export const resolveTypedCompareNames = (
  values: string[],
  names: SessionNames,
): { values: string[]; problem: string } => {
  let problem = '';
  const resolved = values.map((value) => {
    const typed = normalizeSessionName(value);
    if (!typed || parseCompareSubject(value)) return value;
    const exact = Object.keys(names).filter(
      (address) => names[address].toLocaleLowerCase() === typed.toLocaleLowerCase(),
    );
    const found = exact.length ? exact : findSessionNameMatches(names, typed, 2).map((match) => match.address);
    if (found.length === 1) return `wallet:${found[0]}`;
    problem ||= found.length
      ? `More than one person here is named “${typed}”. Pick one from the list under the box.`
      : `“${typed}” isn’t an address, or a name you can see in this session.`;
    return value;
  });
  return { values: resolved, problem };
};

type CompareSubjectNameSearchProps = {
  index: number;
  /** The names this viewer may see in the session; empty where there are none. */
  names: SessionNames;
  onChange: (value: string) => void;
  /** Accounts already in the comparison, lowercased; they aren't offered again. */
  taken: string[];
  value: string;
};

const CompareSubjectNameSearch = ({ index, names, onChange, taken, value }: CompareSubjectNameSearchProps) => {
  const hasNames = Object.keys(names).length > 0;
  const matches = parseCompareSubject(value)
    ? []
    : findSessionNameMatches(names, value, 6 + taken.length)
        .filter((match) => !taken.includes(match.address))
        .slice(0, 6);
  const pick = (address: string) => onChange(`wallet:${address}`);
  return (
    <div className={styles.nameSearch}>
      <input
        type="text"
        data-testid={
          index === 0 ? E2E_TESTIDS.COMPARE_ADDRESS_A : index === 1 ? E2E_TESTIDS.COMPARE_ADDRESS_B : undefined
        }
        placeholder={hasNames ? 'Username, wallet:0x…, worker:…, or sim:…' : 'wallet:0x…, worker:…, or sim:…'}
        aria-label={`Comparison subject ${index + 1}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing && matches.length === 1) pick(matches[0].address);
        }}
      />
      {matches.length > 0 && (
        <ul className={styles.nameMatches} aria-label={`People named like “${value.trim()}”`}>
          {matches.map((match) => (
            <li key={match.address}>
              <button
                type="button"
                className={styles.nameMatch}
                title={match.address}
                onClick={() => pick(match.address)}
              >
                <img src={generateBlockieDataUrl(match.address, 8, 4)} alt="" width={18} height={18} />
                <span>{match.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CompareSubjectNameSearch;
