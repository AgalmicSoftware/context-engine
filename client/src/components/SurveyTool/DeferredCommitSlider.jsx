import React from 'react';
import { clampSliderValue } from './surveyToolUtils.js';

export class DeferredCommitSlider extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      liveValue: this.normalizeValue(props.value),
      isInteracting: false,
    };
  }

  componentDidUpdate(prevProps) {
    const prevValue = this.normalizeValue(prevProps.value);
    const nextValue = this.normalizeValue(this.props.value);
    if (prevValue === nextValue) return;
    if (this.state.isInteracting) return;
    if (this.state.liveValue === nextValue) return;
    this.setState({ liveValue: nextValue });
  }

  normalizeValue = (value) => clampSliderValue(value, this.props.min, this.props.max);

  handleChangeStart = () => {
    if (this.state.isInteracting) return;
    this.setState({ isInteracting: true });
  };

  commitValue = (value = this.state.liveValue) => {
    const committedValue = this.normalizeValue(value);
    const propValue = this.normalizeValue(this.props.value);
    if (this.state.isInteracting) {
      this.setState({ isInteracting: false });
    }
    if (committedValue === propValue) return;
    if (typeof this.props.onCommit === 'function') {
      this.props.onCommit(committedValue);
    }
  };

  handleChange = (nextValue, event) => {
    const normalizedValue = this.normalizeValue(nextValue);
    const isKeyboardEvent = event?.type === 'keydown';
    const nextState = {};

    if (this.state.liveValue !== normalizedValue) {
      nextState.liveValue = normalizedValue;
    }
    if (!isKeyboardEvent && !this.state.isInteracting) {
      nextState.isInteracting = true;
    }

    const hasStateChange = Object.keys(nextState).length > 0;
    if (hasStateChange) {
      this.setState(nextState, () => {
        if (isKeyboardEvent) this.commitValue(normalizedValue);
      });
      return;
    }

    if (isKeyboardEvent) {
      this.commitValue(normalizedValue);
    }
  };

  handleChangeComplete = () => {
    this.commitValue(this.state.liveValue);
  };

  render() {
    const {
      children,
      min,
      max,
      step = 1,
      disabled = false,
      tooltip = false,
      className,
      style,
    } = this.props;
    const sliderProps = {
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
