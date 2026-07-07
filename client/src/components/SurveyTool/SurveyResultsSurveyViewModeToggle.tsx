import React from 'react';
import { Label } from 'reactstrap';

type SurveyResultsSurveyViewModeToggleProps = {
  isAggregate?: boolean;
  knobStyle?: React.CSSProperties;
  onKeyDown: React.KeyboardEventHandler<HTMLElement>;
  onToggle: () => void;
  styleMap: Record<string, string>;
  trailingLabelStyle?: React.CSSProperties;
};

const SurveyResultsSurveyViewModeToggle = ({
  isAggregate = false,
  knobStyle,
  onKeyDown,
  onToggle,
  styleMap,
  trailingLabelStyle,
}: SurveyResultsSurveyViewModeToggleProps): React.ReactElement => (
  <div className={styleMap.surveyViewModeToggle}>
    <Label className={styleMap.toggleLabel}>Individual</Label>
    <div
      className={styleMap.toggleSwitch}
      role="switch"
      aria-label="Toggle between individual and aggregate view"
      aria-checked={isAggregate}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={onKeyDown}
    >
      <div className={styleMap.toggleKnob} style={knobStyle} />
    </div>
    <Label className={styleMap.toggleLabel} style={trailingLabelStyle}>
      Aggregate
    </Label>
  </div>
);

export default SurveyResultsSurveyViewModeToggle;
