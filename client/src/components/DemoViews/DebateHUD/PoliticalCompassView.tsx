import React, { useEffect, useRef, useState } from 'react';

import { debateData, voterProfiles } from '../../../variables/demo/debateData.js';
import { ThemeContext, darkTheme, soften, useTheme } from './debateHudTheme';
import { getDemoAvatarByName } from '../../../utilities/ui/demoAvatars.js';
import { generateBlockieDataUrl } from '../../../utilities/ui/blockieAvatars.js';
import { buildPublicRoute } from '../../../utilities/ui/publicUrl.js';

type CompassPoint = {
  name: string;
  x: number;
  y: number;
  color?: string;
  type?: string;
  comment?: string;
  profileUsername?: string;
  profileUrl?: string;
};

type Compass = {
  xAxis: {
    label?: string;
    left: string;
    right: string;
  };
  yAxis: {
    top: string;
    bottom: string;
  };
  points: CompassPoint[];
};

type VoterProfile = {
  affiliation?: string;
  role?: string;
  keyClaims?: string[];
  policyPositions?: Array<{
    topic: string;
    position: string;
  }>;
  themes?: string[];
};

type CompassQuote = {
  type?: string;
  text: string;
  url?: string;
  source?: string;
};

type TooltipState = {
  name: string;
  comment: string;
  color: string;
  left: number;
  top: number;
};

type PoliticalCompassProps = {
  compass: Compass;
  compact?: boolean;
};

type FullscreenIconProps = {
  expand: boolean;
};

type PoliticalCompassViewProps = {
  selectedDebateId?: number;
};

type StandalonePoliticalCompassProps = PoliticalCompassProps & {
  theme?: typeof darkTheme;
};

const compassQuotes: Record<string, CompassQuote[]> = {};
const voterProfileMap = voterProfiles as Record<string, VoterProfile | undefined>;

const getCompassPointProfileHref = (point?: CompassPoint | null): string => {
  const profileUrl = String(point?.profileUrl || "").trim();
  if (profileUrl) {
    return profileUrl.startsWith("/") ? buildPublicRoute(profileUrl) : profileUrl;
  }

  const profileUsername = String(point?.profileUsername || "").trim();
  if (!profileUsername) return "";
  return buildPublicRoute(`/su/${encodeURIComponent(profileUsername)}`);
};

const PoliticalCompass = ({ compass, compact = true }: PoliticalCompassProps) => {
  const T = useTheme();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tooltipState, setTooltipState] = useState<TooltipState | null>(null);

  useEffect(() => {
    setSelectedPoint(null);
    setHoveredPoint(null);
    setTooltipState(null);
  }, [compass]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setIsFullscreen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const svgW = 800;
  const svgH = 700;
  const padX = 150;
  const padY = 80;
  const cW = svgW - 2 * padX;
  const cH = svgH - 2 * padY;
  const cx = padX + cW / 2;
  const cy = padY + cH / 2;
  const edgeLabelStyle: React.CSSProperties = { fontSize: "14px", fontWeight: 800, fill: "#222" };
  const getPointComment = (point?: CompassPoint | null) => (typeof point?.comment === "string" ? point.comment.trim() : "");
  const getPointSlug = (pointName?: string) => (
    String(pointName || "point")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
  const getPointTestId = (pointName?: string) => (
    `ce-political-compass-point-${getPointSlug(pointName)}`
  );

  const updateTooltipPosition = (
    event: React.MouseEvent<SVGGElement>,
    point: CompassPoint,
    pointComment = getPointComment(point)
  ) => {
    if (!pointComment) {
      setTooltipState(null);
      return;
    }

    const wrapper = wrapperRef.current;
    if (!wrapper || typeof event?.clientX !== "number" || typeof event?.clientY !== "number") {
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const offset = 16;
    const cursorLeft = event.clientX - wrapperRect.left;
    const cursorTop = event.clientY - wrapperRect.top;
    let left = cursorLeft + offset;
    let top = cursorTop + offset;

    if (tooltipEl) {
      const tooltipWidth = tooltipEl.offsetWidth || 250;
      const tooltipHeight = tooltipEl.offsetHeight || 0;
      const preferredTop = cursorTop - tooltipHeight - offset;

      top = preferredTop >= 8 ? preferredTop : cursorTop + offset;

      if (wrapperRect.width > 0) {
        const maxLeft = wrapperRect.width - tooltipWidth - 8;
        left = Math.min(Math.max(left, 8), Math.max(maxLeft, 8));
      } else {
        left = Math.max(left, 8);
      }

      if (wrapperRect.height > 0) {
        const maxTop = wrapperRect.height - tooltipHeight - 8;
        top = Math.min(Math.max(top, 8), Math.max(maxTop, 8));
      } else {
        top = Math.max(top, 8);
      }
    } else {
      left = Math.max(left, 8);
      top = Math.max(top, 8);
    }

    setTooltipState({
      name: point.name,
      comment: pointComment,
      color: point.color || T.accent,
      left,
      top,
    });
  };

  const handlePointMouseEnter = (
    event: React.MouseEvent<SVGGElement>,
    point: CompassPoint,
    pointComment: string
  ) => {
    setHoveredPoint(point.name);

    if (pointComment) {
      updateTooltipPosition(event, point, pointComment);
      return;
    }

    setTooltipState(null);
  };

  const handlePointMouseLeave = () => {
    setHoveredPoint(null);
    setTooltipState(null);
  };

  const splitEdgeLabel = (label: string) => {
    const normalized = String(label || "").trim().replace(/\s+/g, " ");
    if (!normalized.includes(" ")) return [normalized];

    const midpoint = normalized.length / 2;
    const spaces = [...normalized.matchAll(/ /g)].map((match) => match.index).filter((index) => index !== undefined);
    const splitAt = spaces.reduce((closest, index) => (
      Math.abs(index - midpoint) < Math.abs(closest - midpoint) ? index : closest
    ), spaces[0]);

    return [
      normalized.slice(0, splitAt).trim(),
      normalized.slice(splitAt + 1).trim(),
    ].filter(Boolean);
  };

  const renderSideLabel = (label: string, x: number, anchor: 'start' | 'middle' | 'end') => {
    const lines = splitEdgeLabel(label);
    if (lines.length === 1) {
      return (
        <text x={x} y={cy + 4} textAnchor={anchor} style={edgeLabelStyle}>
          <title>{label}</title>
          {lines[0]}
        </text>
      );
    }

    return (
      <text x={x} textAnchor={anchor} style={edgeLabelStyle}>
        <title>{label}</title>
        <tspan x={x} y={cy - 6}>{lines[0]}</tspan>
        <tspan x={x} y={cy + 14}>{lines[1]}</tspan>
      </text>
    );
  };

  const quadColors = {
    topLeft: "rgba(120, 199, 120, 0.35)",
    topRight: "rgba(100, 149, 237, 0.35)",
    bottomLeft: "rgba(230, 80, 80, 0.30)",
    bottomRight: "rgba(230, 210, 80, 0.35)",
  };
  const getAvatarBaseRadius = (point: CompassPoint) => {
    if (point?.type === "historical") return 16;
    if (point?.type === "debater") return 13;
    return 11;
  };

  const pointLayouts = compass.points.map((point) => {
    const px = padX + point.x * cW;
    const py = padY + cH - point.y * cH;
    const pointComment = getPointComment(point);
    const isHovered = hoveredPoint === point.name;
    const isSelected = selectedPoint === point.name;
    const isActive = isHovered || isSelected;
    const showInlineLabel = point.type === "debater" || isSelected || (isHovered && !pointComment);
    const size = point.type === "debater" ? 10 : 7;
    const activeSize = size + 3;
    const avatarInfo = getDemoAvatarByName(point.name);
    const avatarRadius = getAvatarBaseRadius(point) + (isActive ? 3 : 0);

    return {
      point,
      px,
      py,
      pointComment,
      isSelected,
      isActive,
      showInlineLabel,
      size,
      activeSize,
      avatarInfo,
      avatarRadius,
    };
  });

  const avatarPointLayouts = pointLayouts.filter((layout): layout is typeof layout & {
    avatarInfo: NonNullable<typeof layout.avatarInfo>;
  } => Boolean(layout.avatarInfo?.url));

  const getShape = (point: CompassPoint, px: number, py: number, size: number) => {
    if (point.type === "tweeter") {
      const d = size * 0.9;
      return <polygon points={`${px},${py - d} ${px + d},${py} ${px},${py + d} ${px - d},${py}`} />;
    } else if (point.type === "insider" || point.type === "historical") {
      const s = size * 1.4;
      return <rect x={px - s / 2} y={py - s / 2} width={s} height={s} rx={2} />;
    }
    return <circle cx={px} cy={py} r={size} />;
  };

  const FullscreenIcon = ({ expand }: FullscreenIconProps) => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {expand ? (
        <>
          <polyline points="1,5 1,1 5,1" />
          <polyline points="11,1 15,1 15,5" />
          <polyline points="15,11 15,15 11,15" />
          <polyline points="5,15 1,15 1,11" />
        </>
      ) : (
        <>
          <polyline points="5,1 5,5 1,5" />
          <polyline points="11,5 15,5 15,1" />
          <polyline points="11,15 11,11 15,11" />
          <polyline points="1,11 5,11 5,15" />
        </>
      )}
    </svg>
  );

  const compassContent = (
    <>
      <div style={{ textAlign: "center", marginBottom: isFullscreen ? 20 : (compact ? 12 : 6), position: "relative" }}>
        <div style={{
          fontSize: isFullscreen ? 22 : 16,
          fontWeight: 700,
          color: T.text,
          letterSpacing: "-0.01em"}}>
          {compass.xAxis.label || "Political Compass"}
        </div>
      </div>

      {selectedPoint && (() => {
        const profile = voterProfileMap[selectedPoint];
        const quotes = compassQuotes[selectedPoint] || [];
        const sp = compass.points.find((p) => p.name === selectedPoint);
        const pointComment = getPointComment(sp);
        const profileHref = getCompassPointProfileHref(sp);
        const selectedPointTitleStyle: React.CSSProperties = {
          color: (sp && sp.color) || T.accent,
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 15,
        };
        const selectedPointCitationStyle: React.CSSProperties = {
          color: (sp && sp.color) || T.accent,
          textDecoration: 'none',
        };
        const qLabel = sp ? (
          (sp.y > 0.5 ? compass.yAxis.top : compass.yAxis.bottom) + " / " +
          (sp.x > 0.5 ? compass.xAxis.right : compass.xAxis.left)
        ) : "";

        return (
          <div style={{
            background: T.surface,
            padding: isFullscreen ? 20 : 16,
            borderRadius: T.radius,
            border: `1px solid ${T.border}`,
            fontSize: 12,
            color: T.text,
            textAlign: "left",
            marginTop: 8,
            boxShadow: T.shadow}}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                {profileHref ? (
                  <a
                    href={profileHref}
                    style={selectedPointTitleStyle}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {selectedPoint}
                  </a>
                ) : (
                  <span style={selectedPointTitleStyle}>{selectedPoint}</span>
                )}
                {profile && (
                  <span style={{ fontSize: 11, color: T.textMuted, marginLeft: 8 }}>
                    {profile.affiliation}{profile.role ? ` · ${profile.role}` : ""}
                  </span>
                )}
              </div>
              {qLabel && (
                <span style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 10,
                  background: soften((sp && sp.color) || T.accent, 0.1),
                  color: (sp && sp.color) || T.accent, fontWeight: 600}}>
                  {qLabel}
                </span>
              )}
            </div>

            {pointComment ? (
              <div style={{
                fontSize: 13,
                fontStyle: "italic",
                color: T.textLight,
                padding: 12,
                background: soften((sp && sp.color) || T.accent, 0.08),
                borderRadius: T.radiusSm,
                borderLeft: `3px solid ${(sp && sp.color) || T.accent}`,
                lineHeight: 1.6}}>
                <div style={{ marginBottom: 8 }}>
                  &quot;{pointComment}&quot;
                </div>
                <div style={{
                  fontSize: 11,
                  fontStyle: "normal",
                  fontWeight: 700,
                  color: (sp && sp.color) || T.accent}}>
                  {profileHref ? (
                    <a href={profileHref} style={selectedPointCitationStyle} target='_blank' rel='noopener noreferrer'>— {selectedPoint}</a>
                  ) : (
                    <span style={selectedPointCitationStyle}>— {selectedPoint}</span>
                  )}
                </div>
              </div>
            ) : (
              <>
                {profile && profile.keyClaims && profile.keyClaims.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Why this quadrant
                    </div>
                    {profile.keyClaims.slice(0, 3).map((c, i) => (
                      <div key={i} style={{
                        fontSize: 12, color: T.text, padding: "4px 0",
                        borderBottom: i < Math.min(profile.keyClaims?.length || 0, 3) - 1 ? `1px solid ${T.borderLight}` : "none",
                        lineHeight: 1.5}}>
                        <span style={{ color: (sp && sp.color) || T.accent, marginRight: 6, fontWeight: 700 }}>→</span>{c}
                      </div>
                    ))}
                  </div>
                )}

                {quotes.length > 0 && (
                  <div style={{ marginBottom: profile && profile.policyPositions && profile.policyPositions.length ? 12 : 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      {quotes[0].type === "tweet" ? "From their posts" : "From interviews"}
                    </div>
                    {quotes.map((q, i) => (
                      <div key={i} style={{
                        fontSize: 11, color: T.textLight,
                        padding: 10,
                        background: soften(T.accent, 0.03),
                        borderRadius: T.radiusSm,
                        marginBottom: 6,
                        lineHeight: 1.5,
                        borderLeft: `3px solid ${soften((sp && sp.color) || T.accent, 0.4)}`}}>
                        <div style={{ fontStyle: "italic", marginBottom: q.url || q.source ? 4 : 0 }}>
                          &quot;{q.text}{q.text.length >= 158 ? "…" : ""}&quot;
                        </div>
                        {q.url && (
                          <a href={q.url} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: 10, color: T.accent, textDecoration: "none"}}>
                            View original →
                          </a>
                        )}
                        {q.source && !q.url && (
                          <span style={{ fontSize: 10, color: T.textMuted }}>— {q.source}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {profile && profile.policyPositions && profile.policyPositions.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                      Policy positions
                    </div>
                    {profile.policyPositions.slice(0, 2).map((p, i) => (
                      <div key={i} style={{ fontSize: 11, padding: "3px 0", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: (sp && sp.color) || T.accent }}>{p.topic}:</span>{" "}
                        <span style={{ color: T.textLight }}>{p.position}</span>
                      </div>
                    ))}
                  </div>
                )}

                {profile && profile.themes && profile.themes.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>
                    {profile.themes.map((t, i) => (
                      <span key={i} style={{
                        fontSize: 9, padding: "2px 7px", borderRadius: 10,
                        background: T.bg, border: `1px solid ${T.borderLight}`, color: T.textMuted}}>{t}</span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      <div
        ref={wrapperRef}
        data-testid="ce-political-compass-chart-wrapper"
        style={{ position: "relative" }}
      >
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{
          width: "100%",
          maxWidth: isFullscreen ? "min(90vh, 90vw)" : (compact ? 600 : "none"),
          height: "auto",
          display: "block",
          margin: isFullscreen ? "0 auto 24px" : "0 auto 16px",
          background: "#fafafa",
          border: `1px solid ${T.border}`,
          borderRadius: T.radiusSm}}>
          <rect x={padX} y={padY} width={cW / 2} height={cH / 2} fill={quadColors.topLeft} />
          <rect x={cx} y={padY} width={cW / 2} height={cH / 2} fill={quadColors.topRight} />
          <rect x={padX} y={cy} width={cW / 2} height={cH / 2} fill={quadColors.bottomLeft} />
          <rect x={cx} y={cy} width={cW / 2} height={cH / 2} fill={quadColors.bottomRight} />

          <line x1={padX} y1={cy} x2={padX + cW} y2={cy} stroke="#222" strokeWidth="2.5" />
          <line x1={cx} y1={padY} x2={cx} y2={padY + cH} stroke="#222" strokeWidth="2.5" />

          <rect x={padX} y={padY} width={cW} height={cH} fill="none" stroke="#222" strokeWidth="2" />

          <text
            x={cx}
            y={padY - 16}
            textAnchor="middle"
            style={edgeLabelStyle}
          >
            <title>{compass.yAxis.top}</title>
            {compass.yAxis.top}
          </text>
          <text
            x={cx}
            y={padY + cH + 28}
            textAnchor="middle"
            style={edgeLabelStyle}
          >
            <title>{compass.yAxis.bottom}</title>
            {compass.yAxis.bottom}
          </text>
          {renderSideLabel(compass.xAxis.left, padX - 12, "end")}
          {renderSideLabel(compass.xAxis.right, padX + cW + 12, "start")}

          {pointLayouts.map(({
            point,
            px,
            py,
            pointComment,
            isSelected,
            isActive,
            showInlineLabel,
            size,
            activeSize,
            avatarInfo,
            avatarRadius,
          }) => {
            return (
              <g
                key={point.name}
                data-testid={getPointTestId(point.name)}
                onMouseEnter={(event) => handlePointMouseEnter(event, point, pointComment)}
                onMouseMove={(event) => {
                  if (pointComment) {
                    updateTooltipPosition(event, point, pointComment);
                  }
                }}
                onMouseLeave={handlePointMouseLeave}
                onClick={() => setSelectedPoint(isSelected ? null : point.name)}
                style={{ cursor: "pointer" }}
              >
                {isActive && (
                  <circle cx={px} cy={py} r={activeSize + 6} fill={point.color} opacity={0.2} />
                )}

                {/* Always render the original shape as a base layer / broken-image fallback */}
                <g fill={point.color} stroke="#fff" strokeWidth={isActive ? 2.5 : 1.5}>
                  {getShape(point, px, py, isActive ? activeSize : size)}
                </g>

                {showInlineLabel && (
                  <g>
                    <rect
                      x={px - (point.name.length * 3.5) - 4}
                      y={py - size - 22}
                      width={point.name.length * 7 + 8}
                      height={16}
                      rx={3}
                      fill="rgba(255,255,255,0.92)"
                      stroke={point.color}
                      strokeWidth={0.8}
                    />
                    <text
                      x={px}
                      y={py - size - 10}
                      textAnchor="middle"
                      style={{
                        fontSize: point.type === "debater" ? "11px" : "10px",
                        fontWeight: point.type === "debater" ? 700 : 600,
                        fill: "#222",
                        pointerEvents: "none"}}
                    >
                      {point.name}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        {avatarPointLayouts.map(({
          point,
          px,
          py,
          isActive,
          avatarInfo,
          avatarRadius,
        }) => (
          <img
            key={`${point.name}-avatar`}
            data-testid={`${getPointTestId(point.name)}-avatar`}
            src={avatarInfo.url}
            alt=""
            aria-hidden="true"
            onError={(event) => {
              const fallbackSrc = generateBlockieDataUrl(
                avatarInfo?.fallbackSeed || `demo-avatar:${getPointSlug(point.name)}`,
                8,
                4
              );
              if (!fallbackSrc || event.currentTarget.src === fallbackSrc) return;
              event.currentTarget.src = fallbackSrc;
            }}
            style={{
              position: "absolute",
              left: `${(px / svgW) * 100}%`,
              top: `${(py / svgH) * 100}%`,
              width: `${((avatarRadius * 2) / svgW) * 100}%`,
              aspectRatio: "1 / 1",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              objectFit: "cover",
              background: "#fff",
              border: `${isActive ? 2.5 : 1.5}px solid #fff`,
              boxShadow: `0 0 0 ${isActive ? 2 : 1}px ${point.color}`,
              pointerEvents: "none",
            }}
          />
        ))}

        {tooltipState && (
          <div
            ref={tooltipRef}
            data-testid="ce-political-compass-tooltip"
            style={{
              position: "absolute",
              left: `${tooltipState.left}px`,
              top: `${tooltipState.top}px`,
              maxWidth: 250,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(15, 23, 42, 0.96)",
              color: "#f8fafc",
              boxShadow: "0 10px 24px rgba(15, 23, 42, 0.28)",
              border: `1px solid ${soften(tooltipState.color || T.accent, 0.22)}`,
              fontFamily: "var(--ce-font-mono)",
              lineHeight: 1.5,
              pointerEvents: "none",
              zIndex: 4
            }}
          >
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: tooltipState.color || T.accent,
              marginBottom: 6
            }}>
              {tooltipState.name}
            </div>
            <div style={{ fontSize: 12, color: "#f8fafc" }}>
              {tooltipState.comment}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 11, color: T.textMuted, marginBottom: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#666" stroke="#fff" strokeWidth="1" /></svg> Debater
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12"><polygon points="6,1 11,6 6,11 1,6" fill="#666" stroke="#fff" strokeWidth="1" /></svg> Tweeter
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="1.5" fill="#666" stroke="#fff" strokeWidth="1" /></svg> Insider / Historical
        </span>
      </div>
    </>
  );

  return isFullscreen ? (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.97)",
      zIndex: 200,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      overflow: "auto"}}>
      <button
        onClick={() => setIsFullscreen(false)}
        title="Exit fullscreen"
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          border: `1px solid ${T.border}`,
          background: T.surface,
          cursor: "pointer",
          color: T.textMuted,
          opacity: 0.3,
          transition: "opacity 0.15s ease",
          zIndex: 201}}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
      >
        <FullscreenIcon expand={false} />
      </button>
      <div style={{ width: "100%", maxWidth: "min(90vh, 900px)" }}>
        {compassContent}
      </div>
    </div>
  ) : (
    <div style={{
      width: compact ? "auto" : "100%",
      background: compact ? T.surface : "transparent",
      border: compact ? `1px solid ${T.border}` : "none",
      borderRadius: compact ? T.radius : 0,
      padding: compact ? 24 : 8,
      marginBottom: 16,
      boxShadow: compact ? T.shadow : "none",
      position: "relative"}}>
      <button
        onClick={() => setIsFullscreen(true)}
        title="Fullscreen"
        style={{
          position: "absolute",
          top: compact ? 12 : 8,
          right: compact ? 12 : 8,
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: T.textMuted,
          opacity: 0.3,
          transition: "opacity 0.15s ease",
          zIndex: 2}}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.3"; }}
      >
        <FullscreenIcon expand={true} />
      </button>
      {compassContent}
    </div>
  );
};

const PoliticalCompassView = ({ selectedDebateId }: PoliticalCompassViewProps) => {
  useTheme();
  const debate = debateData.find((item) => item.id === selectedDebateId) || debateData[0];

  if (!debate || !debate.compass) return null;

  return (
    <div style={{ maxWidth: 900 }}>
      <PoliticalCompass compass={debate.compass} />
    </div>
  );
};

const StandalonePoliticalCompass = ({ compass, theme = darkTheme, compact = false }: StandalonePoliticalCompassProps) => (
  <ThemeContext.Provider value={theme || darkTheme}>
    <PoliticalCompass compass={compass} compact={compact} />
  </ThemeContext.Provider>
);

export { PoliticalCompass, StandalonePoliticalCompass };
export default PoliticalCompassView;
