import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { clampSliderValue } from './surveyToolUtils.js';
import {
  buildDeferredCommitSliderChangeStatePatch,
  buildDeferredCommitSliderInitialState,
  buildDeferredCommitSliderInteractingPatch,
  buildDeferredCommitSliderLiveValuePatch,
} from './deferredCommitSliderHelpers.js';
import type { DeferredCommitSliderState } from './deferredCommitSliderHelpers.js';

type SliderEventLike =
  | {
      type?: string;
    }
  | null
  | undefined;

export type DeferredCommitSliderRenderProps = {
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  tooltip: boolean;
  className?: string;
  style?: CSSProperties;
  value: number;
  onChangeStart: () => void;
  onChange: (nextValue: unknown, event?: SliderEventLike) => void;
  onChangeComplete: () => void;
};

export type DeferredCommitSliderProps = {
  value: unknown;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  tooltip?: boolean;
  className?: string;
  style?: CSSProperties;
  onCommit?: (value: number) => void;
  children: (args: { value: number; sliderProps: DeferredCommitSliderRenderProps }) => ReactNode;
};

export class DeferredCommitSlider extends React.PureComponent<DeferredCommitSliderProps, DeferredCommitSliderState> {
  constructor(props: DeferredCommitSliderProps) {
    super(props);
    this.state = buildDeferredCommitSliderInitialState(this.normalizeValue(props.value));
  }

  componentDidUpdate(prevProps: DeferredCommitSliderProps) {
    const prevValue = this.normalizeValue(prevProps.value);
    const nextValue = this.normalizeValue(this.props.value);
    if (prevValue === nextValue) return;
    if (this.state.isInteracting) return;
    if (this.state.liveValue === nextValue) return;
    this.setState(buildDeferredCommitSliderLiveValuePatch(nextValue));
  }

  normalizeValue = (value: unknown): number => clampSliderValue(value, this.props.min, this.props.max);

  handleChangeStart = (): void => {
    if (this.state.isInteracting) return;
    this.setState(buildDeferredCommitSliderInteractingPatch(true));
  };

  commitValue = (value = this.state.liveValue): void => {
    const committedValue = this.normalizeValue(value);
    const propValue = this.normalizeValue(this.props.value);
    if (this.state.isInteracting) {
      this.setState(buildDeferredCommitSliderInteractingPatch(false));
    }
    if (committedValue === propValue) return;
    if (typeof this.props.onCommit === 'function') {
      this.props.onCommit(committedValue);
    }
  };

  handleChange = (nextValue: unknown, event?: SliderEventLike): void => {
    const normalizedValue = this.normalizeValue(nextValue);
    const isKeyboardEvent = event?.type === 'keydown';
    const nextState = buildDeferredCommitSliderChangeStatePatch({
      liveValue: this.state.liveValue,
      normalizedValue,
      isKeyboardEvent,
      isInteracting: this.state.isInteracting,
    });

    const hasStateChange = Object.keys(nextState).length > 0;
    if (hasStateChange) {
      this.setState(nextState as DeferredCommitSliderState, () => {
        if (isKeyboardEvent) this.commitValue(normalizedValue);
      });
      return;
    }

    if (isKeyboardEvent) {
      this.commitValue(normalizedValue);
    }
  };

  handleChangeComplete = (): void => {
    this.commitValue(this.state.liveValue);
  };

  render() {
    const { children, min, max, step = 1, disabled = false, tooltip = false, className, style } = this.props;
    const sliderProps: DeferredCommitSliderRenderProps = {
      min,
      max,
      step,
      disabled,
      tooltip,
      className,
      style,
      value: this.state.liveValue,
      onChangeStart: this.handleChangeStart,
      onChange: this.handleChange,
      onChangeComplete: this.handleChangeComplete,
    };

    return children({
      value: this.state.liveValue,
      sliderProps,
    });
  }
}

export default DeferredCommitSlider;
