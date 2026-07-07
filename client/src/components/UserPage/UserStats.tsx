/** @file UserStats.tsx */
import React from 'react';
import { Collapse } from 'reactstrap';
import styles from './UserPage.module.scss'; // Adjust the import path as necessary

type UserStatsProps = {
  userStats: Record<string, React.ReactNode>;
  collapseOpen?: string | null;
  toggleCollapse: (statType: string) => void;
};

const UserStats = ({ userStats, collapseOpen, toggleCollapse }: UserStatsProps) => {
  const renderStatItemCollapse = (statType: string) => {
    switch (statType) {
      case 'mostUniqueIdea':
        return <p>More details about the most unique idea...</p>;
      case 'surveysResponded':
        return <p>Thumbnails for the surveys...</p>;
      default:
        return <p>Details not available</p>;
    }
  };

  return (
    <div className={styles.stats}>
      {Object.entries(userStats).map(([key, value]) => (
        <div key={key} className={styles.statItem} onClick={() => toggleCollapse(key)}>
          {`${key.charAt(0).toUpperCase() + key.slice(1)}: `}
          <span>{value}</span>
          <Collapse isOpen={collapseOpen === key}>{renderStatItemCollapse(key)}</Collapse>
        </div>
      ))}
    </div>
  );
};

export default UserStats;
