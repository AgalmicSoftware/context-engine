import React, { useRef, useState } from 'react';

import { audienceRoster, audienceVotes, debateData } from '../../../variables/demo/debateData.js';
import { darkTheme as T, soften, useTheme } from './debateHudTheme';

type VoteSide = 'A' | 'B';

type DebateFigure = {
  name: string;
  voice: string;
};

type DebateSide = {
  label: string;
  color: string;
  figure: DebateFigure;
};

type CompassPoint = {
  name: string;
  x: number;
  y: number;
};

type Debate = {
  id: number;
  title: string;
  sideA: DebateSide;
  sideB: DebateSide;
  compass?: {
    points?: CompassPoint[];
  };
};

type AudienceMember = {
  name: string;
  icon: string;
  votes: number[];
};

type AudienceTally = {
  a: number;
  b: number;
  total: number;
};

type UserVotes = Record<number, VoteSide>;

type CastYourVoteProps = {
  debate: Debate;
  userVotes: UserVotes;
  setUserVotes: React.Dispatch<React.SetStateAction<UserVotes>>;
};

type VotesOnArgumentsViewProps = {
  selectedDebateId?: number;
};

const CastYourVote = ({ debate, userVotes, setUserVotes }: CastYourVoteProps) => {
  useTheme();

  const userVote = userVotes[debate.id];
  const tally = audienceVotes[debate.id - 1] as AudienceTally;

  const castVote = (side: VoteSide) => {
    setUserVotes((prev) => ({ ...prev, [debate.id]: side }));
  };

  const compassOffsetRef = useRef({
    debateId: debate?.id,
    x: Math.random() * 0.1 - 0.05,
    y: Math.random() * 0.1 - 0.05,
  });

  if (compassOffsetRef.current.debateId !== debate?.id) {
    compassOffsetRef.current = {
      debateId: debate?.id,
      x: Math.random() * 0.1 - 0.05,
      y: Math.random() * 0.1 - 0.05,
    };
  }

  const userCompassPos = userVote
    ? (() => {
        // Use side debater positions directly instead of name-matching audienceRoster
        const sideLabel = userVote === 'A' ? debate.sideA?.label : debate.sideB?.label;
        const sidePoint = debate.compass?.points?.find((p) => p.name === sideLabel);
        if (!sidePoint) return { x: 0.5 + compassOffsetRef.current.x, y: 0.5 + compassOffsetRef.current.y };
        return {
          x: Math.max(0.05, Math.min(0.95, sidePoint.x + compassOffsetRef.current.x)),
          y: Math.max(0.05, Math.min(0.95, sidePoint.y + compassOffsetRef.current.y)),
        };
      })()
    : null;

  const totalUserVotes = Object.keys(userVotes).length;

  return (
    <div style={{ maxWidth: 900 }}>
      <div
        style={{
          padding: '24px',
          background: T.surface,
          borderRadius: T.radius,
          border: `1px solid ${T.border}`,
          marginBottom: 16,
          boxShadow: T.shadow,
          textAlign: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 22 }}>🗳️</span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Cast Your Vote</h3>
          {totalUserVotes > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 10,
                background: soften(T.accent, 0.1),
                color: T.accent,
                fontWeight: 600,
              }}
            >
              {totalUserVotes}/{debateData.length} voted
            </span>
          )}
        </div>
        <p style={{ fontSize: 14, color: T.textMuted, margin: '0 0 20px' }}>Who makes the stronger case?</p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24 }}>
          {(
            [
              { side: 'A', data: debate.sideA },
              { side: 'B', data: debate.sideB },
            ] as Array<{ side: VoteSide; data: DebateSide }>
          ).map(({ side, data }) => {
            const selected = userVote === side;
            return (
              <button
                key={side}
                onClick={() => castVote(side)}
                style={{
                  flex: 1,
                  maxWidth: 300,
                  padding: '20px',
                  borderRadius: T.radius,
                  cursor: 'pointer',
                  fontFamily: T.font,
                  border: selected ? `3px solid ${data.color}` : `2px solid ${T.border}`,
                  background: selected ? soften(data.color, 0.1) : T.surface,
                  transition: 'all 0.2s ease',
                  transform: selected ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: selected ? `0 4px 20px ${soften(data.color, 0.25)}` : T.shadow,
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.borderColor = data.color;
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.borderColor = T.border;
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>
                  {data.figure.name === debate.sideA.figure.name ? '🟦' : '🟥'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: data.color, marginBottom: 4 }}>
                  {data.figure.name}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{data.figure.voice}</div>
                {selected && (
                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: data.color }}>✓ Your vote</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {userVote && (
        <div
          style={{
            padding: '20px 24px',
            background: T.surface,
            borderRadius: T.radius,
            border: `1px solid ${T.border}`,
            marginBottom: 16,
            boxShadow: T.shadow,
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>How You Compare</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 4 }}>Panel voted:</div>
              <div
                style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', background: T.borderLight }}
              >
                <div
                  style={{ width: `${Math.round((tally.a / tally.total) * 100)}%`, background: debate.sideA.color }}
                />
                <div
                  style={{ width: `${Math.round((tally.b / tally.total) * 100)}%`, background: debate.sideB.color }}
                />
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: T.text, margin: 0 }}>
            You voted for{' '}
            <strong style={{ color: userVote === 'A' ? debate.sideA.color : debate.sideB.color }}>
              {userVote === 'A' ? debate.sideA.figure.name : debate.sideB.figure.name}
            </strong>
            .{' '}
            {userVote === 'A'
              ? `${Math.round((tally.a / tally.total) * 100)}% of the panel agrees with you.`
              : `${Math.round((tally.b / tally.total) * 100)}% of the panel agrees with you.`}
          </p>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Notable voices on your side:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {audienceRoster
                .filter((m: AudienceMember) => m.votes[debate.id - 1] === (userVote === 'A' ? 1 : 2))
                .slice(0, 8)
                .map((m: AudienceMember) => (
                  <span
                    key={m.name}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 10,
                      fontSize: 11,
                      background: soften(userVote === 'A' ? debate.sideA.color : debate.sideB.color, 0.1),
                      color: userVote === 'A' ? debate.sideA.color : debate.sideB.color,
                    }}
                  >
                    {m.icon} {m.name}
                  </span>
                ))}
            </div>
          </div>

          {userCompassPos && debate.compass && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Your position on the compass:</div>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 300,
                  aspectRatio: '1',
                  background: T.bg,
                  borderRadius: T.radiusSm,
                  border: `1px solid ${T.border}`,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '50%',
                    height: '50%',
                    background: soften('#e53935', 0.08),
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '50%',
                    height: '50%',
                    background: soften('#1e88e5', 0.08),
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '50%',
                    height: '50%',
                    background: soften('#43a047', 0.08),
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '50%',
                    height: '50%',
                    background: soften('#ff9800', 0.08),
                  }}
                />
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: T.border }} />
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: T.border }} />
                {debate.compass.points?.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: `${p.x * 100}%`,
                      top: `${(1 - p.y) * 100}%`,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: T.textLight,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                ))}
                <div
                  style={{
                    position: 'absolute',
                    left: `${userCompassPos.x * 100}%`,
                    top: `${(1 - userCompassPos.y) * 100}%`,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: userVote === 'A' ? debate.sideA.color : debate.sideB.color,
                    border: '2px solid #fff',
                    boxShadow: '0 0 8px rgba(0,0,0,0.3)',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 5,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${userCompassPos.x * 100}%`,
                    top: `${(1 - userCompassPos.y) * 100 + 5}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    fontWeight: 700,
                    color: userVote === 'A' ? debate.sideA.color : debate.sideB.color,
                    textShadow: `0 0 4px ${T.surface}`,
                    zIndex: 5,
                  }}
                >
                  YOU
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {totalUserVotes > 0 && (
        <div
          style={{
            padding: '20px 24px',
            background: T.surface,
            borderRadius: T.radius,
            border: `1px solid ${T.border}`,
            boxShadow: T.shadow,
          }}
        >
          <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Your Voting Record</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {debateData.map((d: Debate) => {
              const v = userVotes[d.id];
              return (
                <div
                  key={d.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}
                >
                  <span style={{ width: 20, textAlign: 'center', fontWeight: 600, color: T.textMuted }}>{d.id}</span>
                  <span style={{ flex: 1, color: T.text, fontSize: 11 }}>{d.title}</span>
                  {v ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 8,
                        fontSize: 10,
                        fontWeight: 600,
                        background: soften(v === 'A' ? d.sideA.color : d.sideB.color, 0.15),
                        color: v === 'A' ? d.sideA.color : d.sideB.color,
                      }}
                    >
                      {v === 'A' ? d.sideA.figure.name : d.sideB.figure.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: T.textLight }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const VotesOnArgumentsView = ({ selectedDebateId }: VotesOnArgumentsViewProps) => {
  useTheme();

  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const debate =
    (debateData as Debate[]).find((item) => item.id === selectedDebateId) || (debateData[0] as Debate | undefined);

  if (!debate) return null;

  return <CastYourVote debate={debate} userVotes={userVotes} setUserVotes={setUserVotes} />;
};

export default VotesOnArgumentsView;
