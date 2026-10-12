import styles from './CommunityTab.module.scss';
import type { CommunitySessionFilters } from './communitySessionStats';

type RenderCommunitySessionFiltersOptions = {
  filters: CommunitySessionFilters;
  isExpanded: boolean;
  onFilterChange: (key: keyof CommunitySessionFilters, value: string) => void;
  onClear: () => void;
};

export const renderCommunitySessionFilters = ({
  filters,
  isExpanded,
  onFilterChange,
  onClear,
}: RenderCommunitySessionFiltersOptions) => {
  // Stay mounted while collapsed so the toggle's aria-controls always resolves.
  return (
    <div id="ce-community-session-filters" className={styles.sessionFilters} hidden={!isExpanded}>
      <label>
        Session type
        <select value={filters.kind} onChange={(event) => onFilterChange('kind', event.target.value)}>
          <option value="">All types</option>
          <option value="centralized">Centralized</option>
          <option value="decentralized">Decentralized</option>
        </select>
      </label>
      <label>
        Admin address
        <input
          type="search"
          value={filters.adminAddress}
          placeholder="Address or part of an address"
          onChange={(event) => onFilterChange('adminAddress', event.target.value)}
        />
      </label>
      {(
        [
          ['Date created', 'createdFrom', 'createdTo'],
          ['Last activity', 'activityFrom', 'activityTo'],
        ] as const
      ).map(([legend, from, to]) => (
        <fieldset key={from}>
          <legend>{legend}</legend>
          <div className={styles.sessionDateRange}>
            <label>
              From
              <input
                type="date"
                aria-label={`${legend} from`}
                value={filters[from]}
                max={filters[to] || undefined}
                onChange={(event) => onFilterChange(from, event.target.value)}
              />
            </label>
            <label>
              Through
              <input
                type="date"
                aria-label={`${legend} through`}
                value={filters[to]}
                min={filters[from] || undefined}
                onChange={(event) => onFilterChange(to, event.target.value)}
              />
            </label>
          </div>
        </fieldset>
      ))}
      <p className={styles.sessionFilterHint}>
        Activity uses recorded session updates. Sessions without recorded dates, such as centralized sessions, stay
        listed and are marked “date unavailable”.
      </p>
      <button type="button" className={styles.sessionClearFilters} onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
};
