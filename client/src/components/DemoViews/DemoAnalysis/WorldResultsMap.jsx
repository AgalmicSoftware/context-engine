import React, { memo, useMemo } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
  Sphere,
} from 'react-simple-maps';
import styles from './DemoAnalysisWorkspace.module.scss';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const COUNTRY_NAME_TO_ISO_A3 = Object.freeze({
  China: 'CHN',
  Egypt: 'EGY',
  France: 'FRA',
  Germany: 'DEU',
  Greece: 'GRC',
  India: 'IND',
  Iran: 'IRN',
  Iraq: 'IRQ',
  Italy: 'ITA',
  Poland: 'POL',
  Russia: 'RUS',
  'South Africa': 'ZAF',
  Switzerland: 'CHE',
  Turkey: 'TUR',
  'United Kingdom': 'GBR',
  'United States': 'USA',
  Venezuela: 'VEN',
});

const GEOJSON_NAME_TO_ISO_A3 = Object.freeze({
  ...COUNTRY_NAME_TO_ISO_A3,
  'United States of America': 'USA',
});

const TOP_ANSWER_COLORS = Object.freeze({
  Agree: '#4dffa4',
  Unsure: '#ffd166',
  Disagree: '#ff6b6b',
});

const buildFocusedCountriesSummary = (focusedCountries = []) => {
  if (!Array.isArray(focusedCountries) || focusedCountries.length === 0) {
    return 'Showing all country segments in the demo corpus.';
  }
  if (focusedCountries.length <= 5) {
    return `Country focus: ${focusedCountries.join(', ')}`;
  }
  return `Country focus: ${focusedCountries.slice(0, 5).join(', ')} +${focusedCountries.length - 5} more`;
};

export const mapCountryNamesToIsoCodes = (countryNames = []) => (
  (Array.isArray(countryNames) ? countryNames : [])
    .map((countryName) => COUNTRY_NAME_TO_ISO_A3[String(countryName || '').trim()])
    .filter(Boolean)
);

const WorldResultsMap = ({
  question,
  responses = [],
  focusedCountries = [],
}) => {
  const processedData = useMemo(() => {
    if (!question) return { mapData: {}, hasAnyData: false };
    const mapData = {};

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

  const focusedIsoCodes = useMemo(
    () => new Set(mapCountryNamesToIsoCodes(focusedCountries)),
    [focusedCountries]
  );

  if (!question) {
    return (
      <section className={`${styles.panel} ${styles.mapPanel}`}>
        <h3 className={styles.panelTitle}>World Results Map</h3>
        <p className={styles.emptyHint}>Select a question to view the country map.</p>
      </section>
    );
  }

  if (!processedData.hasAnyData) {
    return (
      <section className={`${styles.panel} ${styles.mapPanel}`}>
        <h3 className={styles.panelTitle}>World Results Map</h3>
        <p className={styles.emptyHint}>No country-segment data is available for this question.</p>
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

      <div className={styles.mapFrame}>
      <ComposableMap
        projectionConfig={{ rotate: [-10, 0, 0], scale: 147 }}
        style={{ width: '100%', height: 'auto' }}
      >
        <Sphere stroke="#E4E5E6" strokeWidth={0.5} />
        <Graticule stroke="#E4E5E6" strokeWidth={0.5} />
        <Geographies geography={GEO_URL}>
          {({ geographies }) => geographies.map((geo) => {
            const isoCode = GEOJSON_NAME_TO_ISO_A3[geo.properties.name];
            const countryData = isoCode ? processedData.mapData[isoCode] : null;
            const isFocusMode = focusedIsoCodes.size > 0;
            const isInFocus = !isFocusMode || focusedIsoCodes.has(isoCode);
            const fill = !isInFocus
              ? 'rgba(255,255,255,0.08)'
              : (countryData ? TOP_ANSWER_COLORS[countryData.topAnswer] || 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.08)');

            const title = !countryData
              ? `${geo.properties.name}: No data`
              : `${countryData.countryName}: ${countryData.topAnswer} (${(Number(countryData.topRate || 0) * 100).toFixed(0)}%)`;

            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                stroke="#FFF"
                strokeWidth={0.7}
                style={{
                  default: { fill, outline: 'none' },
                  hover: { fill: '#F53', outline: 'none' },
                  pressed: { fill: '#E42', outline: 'none' },
                }}
              >
                <title>{title}</title>
              </Geography>
            );
          })}
        </Geographies>
      </ComposableMap>
      </div>
    </section>
  );
};

export default memo(WorldResultsMap);
