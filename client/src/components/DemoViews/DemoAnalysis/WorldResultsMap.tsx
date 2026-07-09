import React, { memo, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Graticule, Sphere } from 'react-simple-maps';
import styles from './DemoAnalysisWorkspace.module.scss';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_NAME_TO_ISO_A3 = Object.freeze({
  Australia: 'AUS',
  Austria: 'AUT',
  Belgium: 'BEL',
  Brazil: 'BRA',
  Canada: 'CAN',
  China: 'CHN',
  Czechia: 'CZE',
  Denmark: 'DNK',
  Egypt: 'EGY',
  Ethiopia: 'ETH',
  Finland: 'FIN',
  France: 'FRA',
  Germany: 'DEU',
  Greece: 'GRC',
  Hungary: 'HUN',
  India: 'IND',
  Indonesia: 'IDN',
  Iran: 'IRN',
  Iraq: 'IRQ',
  Ireland: 'IRL',
  Italy: 'ITA',
  Japan: 'JPN',
  Kenya: 'KEN',
  Malaysia: 'MYS',
  Netherlands: 'NLD',
  Nigeria: 'NGA',
  Philippines: 'PHL',
  Poland: 'POL',
  Portugal: 'PRT',
  Romania: 'ROU',
  Russia: 'RUS',
  Singapore: 'SGP',
  'South Africa': 'ZAF',
  'South Korea': 'KOR',
  Spain: 'ESP',
  Switzerland: 'CHE',
  Thailand: 'THA',
  Turkey: 'TUR',
  'United Kingdom': 'GBR',
  'United States': 'USA',
  Venezuela: 'VEN',
  Vietnam: 'VNM',
} as Record<string, string>);

const GEOJSON_NAME_TO_ISO_A3 = Object.freeze({
  ...COUNTRY_NAME_TO_ISO_A3,
  'United States of America': 'USA',
} as Record<string, string>);

const TOP_ANSWER_COLORS = Object.freeze({
  Agree: '#4dffa4',
  Unsure: '#ffd166',
  Disagree: '#ff6b6b',
} as Record<string, string>);

const DEFAULT_COUNTRY_FILL = 'rgba(226, 232, 255, 0.08)';

type Question = {
  id: string | number;
};

type ResponseRow = {
  questionId: string | number;
  segmentKey: string;
  responseText: string;
  rate?: number;
};

type CountryMapDatum = {
  countryName: string;
  topAnswer: string;
  topRate?: number;
  breakdown: ResponseRow[];
};

type GeographyDatum = {
  rsmKey: string;
  properties: {
    name: string;
  };
};

type LightweightData = Record<string, unknown>;

type WorldResultsMapProps = {
  question?: Question | null;
  responses?: ResponseRow[];
  focusedCountries?: string[];
  data?: LightweightData | null;
  colorScale?: ((value: unknown, isoCode: string | undefined, geo: GeographyDatum) => string) | null;
  compact?: boolean;
};

const buildFocusedCountriesSummary = (focusedCountries: string[] = []) => {
  if (!Array.isArray(focusedCountries) || focusedCountries.length === 0) {
    return 'Showing all country segments in the demo corpus.';
  }
  if (focusedCountries.length <= 5) {
    return `Country focus: ${focusedCountries.join(', ')}`;
  }
  return `Country focus: ${focusedCountries.slice(0, 5).join(', ')} +${focusedCountries.length - 5} more`;
};

export const mapCountryNamesToIsoCodes = (countryNames: string[] = []) =>
  (Array.isArray(countryNames) ? countryNames : [])
    .map((countryName) => COUNTRY_NAME_TO_ISO_A3[String(countryName || '').trim()])
    .filter(Boolean);

const WorldResultsMap = ({
  question,
  responses = [],
  focusedCountries = [],
  data = null,
  colorScale = null,
  compact = false,
}: WorldResultsMapProps) => {
  const isLightweightMode = !question && typeof colorScale === 'function';
  const processedData = useMemo(() => {
    if (!question) return { mapData: {}, hasAnyData: false };
    const mapData: Record<string, CountryMapDatum> = {};

    Object.keys(COUNTRY_NAME_TO_ISO_A3).forEach((countryName) => {
      const segmentKey = `Country:${countryName}`;
      const countryRows = (Array.isArray(responses) ? responses : [])
        .filter((row) => row.questionId === question.id && row.segmentKey === segmentKey)
        .sort((left, right) => Number(right.rate || 0) - Number(left.rate || 0));
      if (countryRows.length === 0) return;

      const topAnswer = countryRows[0];
      mapData[COUNTRY_NAME_TO_ISO_A3[countryName]] = {
        countryName,
        topAnswer: topAnswer.responseText,
        topRate: topAnswer.rate,
        breakdown: countryRows,
      };
    });

    return {
      mapData,
      hasAnyData: Object.keys(mapData).length > 0,
    };
  }, [question, responses]);

  const focusedIsoCodes = useMemo(() => new Set(mapCountryNamesToIsoCodes(focusedCountries)), [focusedCountries]);

  const renderMap = () => (
    <ComposableMap
      projectionConfig={{ rotate: [-10, 0, 0], scale: compact ? 147 : 147 }}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      {compact ? null : <Sphere stroke="#E4E5E6" strokeWidth={0.5} />}
      {compact ? null : <Graticule stroke="#E4E5E6" strokeWidth={0.5} />}
      <Geographies geography={GEO_URL}>
        {({ geographies }: { geographies: GeographyDatum[] }) =>
          geographies.map((geo) => {
            const isoCode = GEOJSON_NAME_TO_ISO_A3[geo.properties.name];
            const countryData = isoCode ? processedData.mapData[isoCode] : null;
            const isFocusMode = focusedIsoCodes.size > 0;
            const isInFocus = !isFocusMode || focusedIsoCodes.has(isoCode);
            const lightweightFill =
              colorScale?.(
                (data && isoCode && data[isoCode]) || (data && data[geo.properties.name]) || null,
                isoCode,
                geo,
              ) || 'rgba(77,255,164,0.35)';
            const fill = isLightweightMode
              ? lightweightFill
              : !isInFocus
                ? DEFAULT_COUNTRY_FILL
                : countryData
                  ? TOP_ANSWER_COLORS[countryData.topAnswer] || DEFAULT_COUNTRY_FILL
                  : DEFAULT_COUNTRY_FILL;
            const hoverFill = compact ? fill : '#F53';
            const pressedFill = compact ? fill : '#E42';

            const title = isLightweightMode
              ? geo.properties.name
              : !countryData
                ? `${geo.properties.name}: No data`
                : `${countryData.countryName}: ${countryData.topAnswer} (${(Number(countryData.topRate || 0) * 100).toFixed(0)}%)`;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                stroke={compact ? 'rgba(226, 232, 255, 0.32)' : '#FFF'}
                strokeWidth={compact ? 0.45 : 0.7}
                style={{
                  default: { fill, outline: 'none' },
                  hover: { fill: hoverFill, outline: 'none' },
                  pressed: { fill: pressedFill, outline: 'none' },
                }}
              >
                <title>{title}</title>
              </Geography>
            );
          })
        }
      </Geographies>
    </ComposableMap>
  );

  if (isLightweightMode) {
    return (
      <div
        className={`${styles.mapFrame} ${compact ? styles.mapFrameCompact : ''}`.trim()}
        data-testid="demo-analysis-world-map"
        aria-label="World results map"
      >
        {renderMap()}
      </div>
    );
  }

  if (!question) {
    return (
      <section className={`${styles.panel} ${styles.mapPanel}`} data-testid="demo-analysis-world-map">
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>World Results Map</h3>
        </div>
        <div className={styles.mapFrameShell}>
          <div className={`${styles.mapFrameViewport} ${styles.mapFrameViewportEmpty}`}>
            <p className={styles.mapViewportHint}>
              Choose a comparison suggestion or inspect a question below to load the country map.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!processedData.hasAnyData) {
    return (
      <section className={`${styles.panel} ${styles.mapPanel}`} data-testid="demo-analysis-world-map">
        <div className={styles.panelHeader}>
          <div>
            <h3 className={styles.panelTitle}>World Results Map</h3>
            <p className={styles.panelMeta}>{buildFocusedCountriesSummary(focusedCountries)}</p>
          </div>
        </div>
        <div className={styles.mapFrameShell}>
          <div className={`${styles.mapFrameViewport} ${styles.mapFrameViewportEmpty}`}>
            <p className={styles.mapViewportHint}>No country-segment data is available for this question.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={`${styles.panel} ${styles.mapPanel}`} data-testid="demo-analysis-world-map">
      <div className={styles.panelHeader}>
        <div>
          <h3 className={styles.panelTitle}>World Results Map</h3>
          <p className={styles.panelMeta}>{buildFocusedCountriesSummary(focusedCountries)}</p>
        </div>
      </div>

      <div className={styles.mapLegend}>
        {Object.entries(TOP_ANSWER_COLORS).map(([label, color]) => (
          <span key={label} className={styles.legendPill}>
            <span className={styles.legendSwatch} style={{ backgroundColor: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className={styles.mapFrameShell}>
        <div className={styles.mapFrameViewport}>
          <div className={styles.mapFrame}>{renderMap()}</div>
        </div>
      </div>
    </section>
  );
};

export default memo(WorldResultsMap);
