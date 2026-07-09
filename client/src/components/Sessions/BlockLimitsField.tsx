/** @file BlockLimitsField.tsx */
import React from 'react';
import { FormGroup, Input, Label } from 'reactstrap';
import styles from './SessionWizard.module.scss';

type BlockNumberValue = number | string | null | undefined;

export type BlockLimitsFieldProps = {
  blockLimits?: {
    start?: BlockNumberValue;
    end?: BlockNumberValue;
  } | null;
  onStartChange: (value: string) => void;
  blockLimitDuration: number | string;
  blockLimitUnit: string;
  onDurationChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  latestChainBlock?: BlockNumberValue;
  latestBlockStatus?: React.ReactNode;
  label: React.ReactNode;
  tooltipControl?: React.ReactNode;
};

const BlockLimitsField = ({
  blockLimits,
  onStartChange,
  blockLimitDuration,
  blockLimitUnit,
  onDurationChange,
  onUnitChange,
  latestChainBlock,
  latestBlockStatus,
  label,
  tooltipControl,
}: BlockLimitsFieldProps) => {
  const startValue = blockLimits?.start ?? '';
  const endValue = blockLimits?.end ?? null;

  return (
    <FormGroup className={styles.fieldGroup}>
      <div className={styles.fieldHeader}>
        <div className={styles.fieldLabelRow}>
          <Label>{label}</Label>
          {tooltipControl}
        </div>
      </div>
      <div className={styles.blockLimitsGrid}>
        <FormGroup>
          <Label>Start block</Label>
          <Input
            type="number"
            value={startValue == null ? '' : startValue}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onStartChange(e.target.value)}
          />
          {latestChainBlock != null && (
            <div className={styles.helperText}>Latest block: {Number(latestChainBlock).toLocaleString()}</div>
          )}
          {latestBlockStatus && <div className={styles.helperText}>{latestBlockStatus}</div>}
        </FormGroup>
        <FormGroup>
          <Label>End after</Label>
          <div className={styles.blockLimitInline}>
            <Input
              type="number"
              value={blockLimitDuration}
              min="0"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onDurationChange(e.target.value)}
              placeholder="0"
            />
            <Input
              type="select"
              value={blockLimitUnit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUnitChange(e.target.value)}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </Input>
          </div>
          <div className={styles.helperText}>
            {endValue ? `Ends at block ${Number(endValue).toLocaleString()}.` : 'No end block set.'}
          </div>
        </FormGroup>
      </div>
    </FormGroup>
  );
};

export default BlockLimitsField;
