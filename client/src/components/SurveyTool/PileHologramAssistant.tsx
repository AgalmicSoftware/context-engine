import React from 'react';
import styles from './SurveyTool.module.scss';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';

const FACE_CENTER_X = 210;
const FACE_CENTER_Y = 156;
const FACE_RADIUS_X = 108;
const FACE_RADIUS_Y = 124;
const FACE_ROW_OFFSETS = Object.freeze(Array.from({ length: 19 }, (_, index) => -108 + index * 12));
const FACE_COLUMN_OFFSETS = Object.freeze(Array.from({ length: 17 }, (_, index) => -80 + index * 10));
const PULSE_DOTS = Object.freeze([
  { cx: 132, cy: 100, r: 2.3 },
  { cx: 286, cy: 120, r: 2.1 },
  { cx: 148, cy: 232, r: 2.0 },
  { cx: 272, cy: 246, r: 2.3 },
  { cx: 166, cy: 74, r: 1.8 },
  { cx: 254, cy: 84, r: 1.8 },
]);
const HEAD_CLIP_ID = 'pile-hologram-head-clip';
const FACE_FILL_ID = 'pile-hologram-face-fill';
const FACE_GLOW_ID = 'pile-hologram-face-glow';
const FACE_DEPTH_ID = 'pile-hologram-face-depth';
const BUST_FILL_ID = 'pile-hologram-bust-fill';
const HEAD_PATH = [
  'M 210 22',
  'C 152 22 110 68 108 138',
  'C 106 194 126 236 157 272',
  'C 172 290 186 303 198 314',
  'C 205 321 215 321 222 314',
  'C 234 303 248 290 263 272',
  'C 294 236 314 194 312 138',
  'C 310 68 268 22 210 22 Z',
].join(' ');
const FACE_DEPTH_PATH = [
  'M 210 40',
  'C 160 40 126 80 126 142',
  'C 126 196 145 236 179 270',
  'C 191 282 201 291 210 298',
  'C 219 291 229 282 241 270',
  'C 275 236 294 196 294 142',
  'C 294 80 260 40 210 40 Z',
].join(' ');
const FACE_CORE_PATH = [
  'M 210 54',
  'C 168 54 138 88 138 142',
  'C 138 188 154 224 181 255',
  'C 189 264 198 273 210 283',
  'C 222 273 231 264 239 255',
  'C 266 224 282 188 282 142',
  'C 282 88 252 54 210 54 Z',
].join(' ');
const BUST_PATH = [
  'M 132 308',
  'C 154 298 180 294 210 294',
  'C 240 294 266 298 288 308',
  'C 312 318 332 336 346 360',
  'L 74 360',
  'C 88 336 108 318 132 308 Z',
].join(' ');

const buildLatitudePath = (offsetY: number) => {
  const normalized = 1 - Math.pow(offsetY / FACE_RADIUS_Y, 2);
  if (normalized <= 0) return '';

  const halfWidth = FACE_RADIUS_X * Math.sqrt(normalized);
  const y = FACE_CENTER_Y + offsetY;
  const baseArc = offsetY < 0 ? -Math.max(3, Math.abs(offsetY) * 0.12) : Math.max(4, Math.abs(offsetY) * 0.15);
  const browLift = offsetY > -58 && offsetY < -18 ? (1 - Math.abs(offsetY + 38) / 20) * 10 : 0;
  const noseLift = offsetY > -8 && offsetY < 52 ? (1 - Math.abs(offsetY - 20) / 30) * 18 : 0;
  const mouthDip = offsetY > 48 && offsetY < 88 ? (1 - Math.abs(offsetY - 68) / 20) * -6 : 0;
  const centerY = y + baseArc + browLift + noseLift + mouthDip;
  const outerY = y + baseArc * 0.56;
  const innerY = y + baseArc * 0.84 + noseLift * 0.28;

  return [
    `M ${FACE_CENTER_X - halfWidth} ${y}`,
    `C ${FACE_CENTER_X - halfWidth * 0.62} ${outerY}, ${FACE_CENTER_X - halfWidth * 0.2} ${innerY}, ${FACE_CENTER_X} ${centerY}`,
    `C ${FACE_CENTER_X + halfWidth * 0.2} ${innerY}, ${FACE_CENTER_X + halfWidth * 0.62} ${outerY}, ${FACE_CENTER_X + halfWidth} ${y}`,
  ].join(' ');
};

const buildLongitudePath = (offsetX: number) => {
  const normalized = 1 - Math.pow(offsetX / FACE_RADIUS_X, 2);
  if (normalized <= 0) return '';

  const halfHeight = FACE_RADIUS_Y * Math.sqrt(normalized);
  const x = FACE_CENTER_X + offsetX;
  const inwardPull = offsetX * 0.18;
  const centerWeight = 1 - Math.abs(offsetX) / FACE_RADIUS_X;
  const browPinch = centerWeight * 10;
  const cheekBulge = centerWeight * 18;
  const jawTuck = centerWeight * 8;
  const topY = FACE_CENTER_Y - halfHeight;
  const lowerMidY = FACE_CENTER_Y + 34;
  const bottomY = FACE_CENTER_Y + halfHeight + 52;

  return [
    `M ${x} ${topY}`,
    `C ${x + inwardPull} ${FACE_CENTER_Y - 56 - browPinch}, ${x + inwardPull} ${FACE_CENTER_Y + 8 - cheekBulge}, ${x} ${lowerMidY}`,
    `C ${x - inwardPull * 0.3} ${FACE_CENTER_Y + 82 + cheekBulge}, ${x - inwardPull * 0.25} ${FACE_CENTER_Y + 126 + jawTuck}, ${x} ${bottomY}`,
  ].join(' ');
};

export const resolvePileHologramMeshLineStyle = (opacity: unknown): React.CSSProperties => ({
  opacity: Number(opacity || 0),
});

function PileHologramAssistant() {
  return (
    <div className={styles.pileHologramPanel} aria-hidden="true" data-testid={E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_PANEL}>
      <div className={styles.pileHologramBackdrop} />
      <div className={styles.pileHologramScanlines} />

      <div className={styles.pileHologramStage}>
        <div className={styles.pileHologramAura} />

        <svg viewBox="0 0 420 360" className={styles.pileHologramSvg} focusable="false">
          <defs>
            <clipPath id={HEAD_CLIP_ID}>
              <path d={HEAD_PATH} />
            </clipPath>
            <radialGradient id={FACE_FILL_ID} cx="50%" cy="36%" r="64%">
              <stop offset="0%" stopColor="#eefcff" stopOpacity="0.34" />
              <stop offset="46%" stopColor="#7de7ff" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#1d7dff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={FACE_GLOW_ID} cx="50%" cy="48%" r="62%">
              <stop offset="0%" stopColor="#b5f8ff" stopOpacity="0.24" />
              <stop offset="42%" stopColor="#59d5ff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#59d5ff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={FACE_DEPTH_ID} cx="50%" cy="56%" r="74%">
              <stop offset="0%" stopColor="#9fe9ff" stopOpacity="0.18" />
              <stop offset="52%" stopColor="#4fbcff" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#112d7a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={BUST_FILL_ID} x1="50%" y1="8%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#b6f4ff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1e7cff" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          <g className={styles.pileHologramFloat}>
            <path d={BUST_PATH} className={styles.pileHologramBustFill} fill={`url(#${BUST_FILL_ID})`} />
            <path d={FACE_DEPTH_PATH} className={styles.pileHologramDepthShell} fill={`url(#${FACE_DEPTH_ID})`} />
            <ellipse
              cx="210"
              cy="174"
              rx="136"
              ry="152"
              className={styles.pileHologramFaceGlow}
              fill={`url(#${FACE_GLOW_ID})`}
            />
            <path d={FACE_CORE_PATH} className={styles.pileHologramFaceCore} fill={`url(#${FACE_FILL_ID})`} />
            <path d={HEAD_PATH} className={styles.pileHologramDepthOutline} transform="translate(0 -4)" />
            <path d={HEAD_PATH} className={styles.pileHologramHeadOutline} />

            <g clipPath={`url(#${HEAD_CLIP_ID})`} className={styles.pileHologramMeshGroup}>
              {FACE_ROW_OFFSETS.map((offsetY) => {
                const opacity = 0.22 + (1 - Math.abs(offsetY) / FACE_RADIUS_Y) * 0.66;
                return (
                  <path
                    key={`row-${offsetY}`}
                    d={buildLatitudePath(offsetY)}
                    className={styles.pileHologramMeshLine}
                    style={resolvePileHologramMeshLineStyle(opacity)}
                  />
                );
              })}
              {FACE_COLUMN_OFFSETS.map((offsetX) => {
                const opacity = 0.18 + (1 - Math.abs(offsetX) / FACE_RADIUS_X) * 0.68;
                return (
                  <path
                    key={`col-${offsetX}`}
                    d={buildLongitudePath(offsetX)}
                    className={styles.pileHologramMeshLine}
                    style={resolvePileHologramMeshLineStyle(opacity)}
                  />
                );
              })}
            </g>

            <path d="M 148 88 Q 210 64 272 88" className={styles.pileHologramContourLine} />
            <path d="M 138 120 Q 210 92 282 120" className={styles.pileHologramContourLine} />
            <path d="M 144 156 C 132 194 136 238 164 272" className={styles.pileHologramContourLine} />
            <path d="M 276 156 C 288 194 284 238 256 272" className={styles.pileHologramContourLine} />
            <path d="M 156 208 Q 182 196 202 212" className={styles.pileHologramFeatureSoftLine} />
            <path d="M 264 208 Q 238 196 218 212" className={styles.pileHologramFeatureSoftLine} />

            <g className={styles.pileHologramEyes}>
              <path d="M 154 164 Q 180 146 206 165" className={styles.pileHologramBrowLine} />
              <path d="M 214 165 Q 240 146 266 164" className={styles.pileHologramBrowLine} />
              <path d="M 158 178 Q 182 160 205 178" className={styles.pileHologramFeatureLine} />
              <path d="M 158 178 Q 182 188 205 178" className={styles.pileHologramFeatureSoftLine} />
              <path d="M 215 178 Q 238 160 262 178" className={styles.pileHologramFeatureLine} />
              <path d="M 215 178 Q 238 188 262 178" className={styles.pileHologramFeatureSoftLine} />
              <ellipse cx="181" cy="176.5" rx="7.8" ry="5.8" className={styles.pileHologramIrisGlow} />
              <ellipse cx="239" cy="176.5" rx="7.8" ry="5.8" className={styles.pileHologramIrisGlow} />
              <circle cx="181" cy="176.5" r="2.2" className={styles.pileHologramPupil} />
              <circle cx="239" cy="176.5" r="2.2" className={styles.pileHologramPupil} />
              <circle cx="178.5" cy="173.8" r="1.1" className={styles.pileHologramEyeHighlight} />
              <circle cx="236.5" cy="173.8" r="1.1" className={styles.pileHologramEyeHighlight} />
            </g>

            <path d="M 210 170 C 205 191 203 210 206 223" className={styles.pileHologramFeatureSoftLine} />
            <path d="M 210 170 C 215 191 217 210 214 223" className={styles.pileHologramFeatureSoftLine} />
            <path d="M 194 226 Q 210 236 226 226" className={styles.pileHologramFeatureLine} />
            <path d="M 166 236 Q 210 250 254 236" className={styles.pileHologramFeatureSoftLine} />
            <path d="M 176 259 Q 210 276 244 259" className={styles.pileHologramFeatureLine} />
            <path d="M 184 266 Q 210 276 236 266" className={styles.pileHologramSmileLine} />
            <path d="M 190 276 Q 210 286 230 276" className={styles.pileHologramFeatureSoftLine} />
            <path d="M 186 292 Q 210 304 234 292" className={styles.pileHologramContourLine} />
            <path d="M 170 286 C 166 312 162 336 158 360" className={styles.pileHologramNeckLine} />
            <path d="M 250 286 C 254 312 258 336 262 360" className={styles.pileHologramNeckLine} />
            <path d="M 194 296 C 194 318 194 340 194 360" className={styles.pileHologramNeckLine} />
            <path d="M 226 296 C 226 318 226 340 226 360" className={styles.pileHologramNeckLine} />
            <path d="M 126 314 C 154 304 266 304 294 314" className={styles.pileHologramContourLine} />

            <g className={styles.pileHologramPulseDots}>
              {PULSE_DOTS.map((dot, index) => (
                <circle
                  key={`pulse-${index}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={dot.r}
                  className={styles.pileHologramPulseDot}
                />
              ))}
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default PileHologramAssistant;
