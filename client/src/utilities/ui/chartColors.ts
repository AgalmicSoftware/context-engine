// CSS variables update SVGs, DOM legends, and PDF exports without rerunning
// clustering or other analysis when a visual preference changes.
export const CHART_SERIES_COLORS = Array.from({ length: 10 }, (_, index) => `var(--ce-chart-series-${index + 1})`);
