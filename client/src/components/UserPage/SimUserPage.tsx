/** @file SimUserPage.tsx */
import React, { Component } from 'react';
import styles from './SimUserPage.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faQuoteLeft, faArrowUp, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { UncontrolledTooltip, Modal, ModalHeader, ModalBody } from 'reactstrap';
import historicalFigures from '../../variables/demo/historical_figure_users.json';
import atlasData from '../../variables/demo/historical_figures_tree_qs_and_votes.json';
import treeData from '../../variables/demo/debate_map_demo_data.json';
import {
  getHistoricalFigureAvatarOrBlockie,
  getHistoricalFigureBlockie,
} from '../../utilities/ui/historicalFigureAvatars.js';
import { buildAtlasNodeRoute, readWindowLocationPath } from '../../utilities/ui/publicUrl.js';
import SingleQuestionResponse from '../SurveyTool/SingleQuestionResponse';
import SimRelatedFigure from './SimRelatedFigure';
import {
  buildSimFullProfileModalStatePatch,
  buildSimUserInfoStatePatch,
  buildSimUserPageRootClassName,
  buildSimUserVoteIndicatorClassName,
  resolveSimUserStanceMarkerStyle,
} from './simUserPageHelpers';

type SimUserPageProps = {
  simUsername?: string;
  minimized?: boolean;
};

type UnknownRecord = Record<string, unknown>;

type SimQuestion = {
  question?: string;
  questionType?: string;
  answer?: {
    encrypted?: boolean;
    value?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type SimUserInfo = {
  name: string;
  username: string;
  questions: SimQuestion[];
  avatar?: string;
  Karma?: number;
  biggestHope?: string;
  biggestFear?: string;
  highlightedAdvice?: string;
  bio?: string;
  era?: string;
  featuredQuote?: string;
  [key: string]: unknown;
};

type AtlasVoteMap = Record<string, unknown>;

type AtlasUserData = {
  votes?: AtlasVoteMap;
  questions?: UnknownRecord[];
  comments?: UnknownRecord[];
  [key: string]: unknown;
};

type TreeNode = {
  id?: string;
  name?: string;
  children?: TreeNode[];
  [key: string]: unknown;
};

type RelatedFigureScore = {
  username: string;
  agree: number;
  disagree: number;
  shared: number;
};

type SimQuestionCardData = {
  question: {
    prompt: string;
    type: string;
  };
  response: {
    answer: {
      value: unknown;
      encrypted: boolean;
    };
    additional: UnknownRecord;
  };
};

type SingleQuestionResponseProps = SimQuestionCardData & {
  isOwnResponse: boolean;
  mode: string;
  showImportance: boolean;
  showMiniExpand: boolean;
  onDecryptQuestion: () => void;
};

type SimUserPageState = {
  userInfo: SimUserInfo | null;
  showFullProfileModal: boolean;
};

const historicalFiguresData = historicalFigures as SimUserInfo[];
const atlasDataByUser = atlasData as Record<string, AtlasUserData>;
const treeDataNodes = treeData as TreeNode[];
const SingleQuestionResponseComponent = SingleQuestionResponse as React.ComponentType<SingleQuestionResponseProps>;

// Build node name lookup from tree
const nodeNames: Record<string, string> = {};
const buildNodeNames = (nodes: TreeNode[]) => {
  nodes.forEach((n) => {
    const id = String(n?.id || '');
    const name = String(n?.name || '');
    if (id && name) nodeNames[id] = name.replace(/^\d+\.\s*/, '');
    if (Array.isArray(n.children)) buildNodeNames(n.children);
  });
};
buildNodeNames(treeDataNodes);

// Compute vote correlations between all figures
const computeRelatedFigures = (username: string): { allies: RelatedFigureScore[]; opponents: RelatedFigureScore[] } => {
  const myData = atlasDataByUser[username];
  if (!myData || !myData.votes) return { allies: [], opponents: [] };

  const myVotes = myData.votes;
  const scores: RelatedFigureScore[] = [];

  Object.entries(atlasDataByUser).forEach(([other, data]) => {
    const otherVotes = data.votes;
    if (other === username || !otherVotes) return;
    let agree = 0;
    let disagree = 0;
    let shared = 0;

    Object.keys(myVotes).forEach((nodeId) => {
      if (otherVotes[nodeId] !== undefined) {
        shared++;
        const myVal = parseInt(String(myVotes[nodeId]), 10);
        const theirVal = parseInt(String(otherVotes[nodeId]), 10);
        if ((myVal > 0 && theirVal > 0) || (myVal < 0 && theirVal < 0)) {
          agree++;
        } else if ((myVal > 0 && theirVal < 0) || (myVal < 0 && theirVal > 0)) {
          disagree++;
        }
      }
    });

    if (shared >= 2) {
      scores.push({ username: other, agree, disagree, shared });
    }
  });

  scores.sort((a, b) => b.agree - a.agree);
  const allies = scores.filter((s) => s.agree > s.disagree).slice(0, 4);

  scores.sort((a, b) => b.disagree - a.disagree);
  const opponents = scores.filter((s) => s.disagree > s.agree).slice(0, 4);

  return { allies, opponents };
};

// Compute stance summary from vote patterns
const computeStance = (username: string) => {
  const data = atlasDataByUser[username];
  if (!data || !data.votes) return [];

  const dimensions = [
    {
      label: 'Safety vs Speed',
      positive: ['0x20', '0x21', '0x22', '0x23'],
      negative: ['0x10', '0x11', '0x12', '0x13'],
      leftLabel: 'Cautious',
      rightLabel: 'Accelerate',
    },
    {
      label: 'Control vs Openness',
      positive: ['0x32'],
      negative: ['0x31', '0x33'],
      leftLabel: 'Tight control',
      rightLabel: 'Open access',
    },
    {
      label: 'Regulation vs Freedom',
      positive: ['0x32', '0x33'],
      negative: ['0x30', '0x31'],
      leftLabel: 'Regulate',
      rightLabel: 'Self-govern',
    },
    {
      label: 'Protection vs Automation',
      positive: ['0x20', '0x22'],
      negative: ['0x41'],
      leftLabel: 'Protect workers',
      rightLabel: 'Embrace automation',
    },
  ];

  return dimensions.map((dim) => {
    let score = 0;
    let count = 0;
    Object.entries(data.votes || {}).forEach(([nodeId, val]) => {
      const prefix = nodeId.substring(0, 4);
      const v = parseInt(String(val), 10);
      if (dim.positive.includes(prefix)) {
        score += v;
        count++;
      }
      if (dim.negative.includes(prefix)) {
        score -= v;
        count++;
      }
    });
    const avg = count > 0 ? score / count : 0;
    const normalized = Math.max(-1, Math.min(1, avg / 6)); // -1 to 1
    return { ...dim, value: normalized };
  });
};

class SimUserPage extends Component<SimUserPageProps, SimUserPageState> {
  state: SimUserPageState = {
    userInfo: null,
    showFullProfileModal: false,
  };

  componentDidMount() {
    const { simUsername } = this.props;
    this.setState(
      buildSimUserInfoStatePatch({
        figures: historicalFiguresData,
        simUsername,
      }),
    );
  }

  closeFullProfileModal = () => {
    this.setState(buildSimFullProfileModalStatePatch());
  };

  buildQuestionCardData = (question: SimQuestion): SimQuestionCardData => ({
    question: {
      prompt: String(question?.question || '').trim() || 'Untitled question',
      type:
        String(question?.questionType || 'freeform')
          .trim()
          .toLowerCase() || 'freeform',
    },
    response: {
      answer: {
        value: question?.answer?.value ?? '',
        encrypted: Boolean(question?.answer?.encrypted),
      },
      additional: {},
    },
  });

  renderQuestionResponse = (question: SimQuestion, index: number, mode = 'mini') => {
    const cardData = this.buildQuestionCardData(question);
    return (
      <SingleQuestionResponseComponent
        key={`simulated-question-${index}`}
        question={cardData.question}
        response={cardData.response}
        isOwnResponse={false}
        mode={mode}
        showImportance={false}
        showMiniExpand={false}
        onDecryptQuestion={() => {}}
      />
    );
  };

  handleHistoricalAvatarError = (
    event: React.SyntheticEvent<HTMLImageElement>,
    username: string,
    fallbackSeed = '',
  ) => {
    const target = event?.currentTarget;
    if (!target) return;
    const fallbackSrc = getHistoricalFigureBlockie(username, { fallbackSeed });
    if (!fallbackSrc || target.src === fallbackSrc) return;
    target.src = fallbackSrc;
  };

  render() {
    const { userInfo } = this.state;
    const { minimized } = this.props;

    if (!userInfo) {
      return <div className={styles.loadingState}>Loading...</div>;
    }

    const resolvedAvatar = getHistoricalFigureAvatarOrBlockie(userInfo.username, {
      preferBlockie: false,
      fallbackSeed: userInfo.name || userInfo.username,
    });

    const figureAtlasData = atlasDataByUser[userInfo.username];
    const atlasPositions = figureAtlasData
      ? Object.entries(figureAtlasData.votes || {})
          .map(([nodeId, val]) => ({
            nodeId,
            nodeName: nodeNames[nodeId] || nodeId.substring(0, 10),
            vote: parseInt(String(val), 10),
          }))
          .sort((a, b) => Math.abs(b.vote) - Math.abs(a.vote))
          .slice(0, 8)
      : [];

    const stance = computeStance(userInfo.username);
    const { allies, opponents } = computeRelatedFigures(userInfo.username);

    return (
      <div
        className={buildSimUserPageRootClassName({
          baseClassName: styles.simUserPage,
          minimized,
          minimizedClassName: styles.minimized,
        })}
      >
        {/* === HERO SECTION === */}
        <div className={styles.heroQuoteRow}>
          <div className={styles.heroSection}>
            <div className={styles.heroLeft}>
              <img
                src={resolvedAvatar}
                alt={userInfo.name}
                className={styles.heroAvatar}
                onError={(event) => this.handleHistoricalAvatarError(event, userInfo.username, userInfo.name)}
              />
              <div className={styles.heroInfo}>
                <div className={styles.heroMeta}>
                  {userInfo.era && <span className={styles.eraBadge}>{userInfo.era}</span>}
                  <span className={styles.simulatedBadge} id="simulatedUserTooltip">
                    <FontAwesomeIcon icon={faExclamationTriangle} /> Simulated
                  </span>
                  <UncontrolledTooltip placement="right" target="simulatedUserTooltip">
                    AI-generated historical perspective — not a real user account.
                  </UncontrolledTooltip>
                </div>
                <h1 className={styles.heroName}>{userInfo.name}</h1>
                {userInfo.bio && <p className={styles.heroBio}>{userInfo.bio}</p>}
              </div>
            </div>
          </div>

          {!minimized && userInfo.featuredQuote && (
            <div className={styles.quoteSection}>
              <FontAwesomeIcon icon={faQuoteLeft} className={styles.quoteIcon} />
              <blockquote className={styles.featuredQuote}>{userInfo.featuredQuote}</blockquote>
              <cite className={styles.quoteAttribution}>— {userInfo.name}, on AI policy</cite>
            </div>
          )}
        </div>

        {!minimized && (
          <>
            {/* === STANCE SUMMARY === */}
            {stance.length > 0 && (
              <div className={styles.stanceSection}>
                <span className={styles.sectionEyebrow}>Ideological Profile</span>
                <div className={styles.stanceGrid}>
                  {stance.map((dim, i) => (
                    <div key={i} className={styles.stanceRow}>
                      <span className={styles.stanceLabel}>{dim.label}</span>
                      <div className={styles.stanceBar}>
                        <span className={styles.stanceEndpoint}>{dim.leftLabel}</span>
                        <div className={styles.stanceTrack}>
                          <div
                            className={styles.stanceMarker}
                            style={resolveSimUserStanceMarkerStyle({ value: dim.value })}
                          />
                        </div>
                        <span className={styles.stanceEndpoint}>{dim.rightLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.content}>
              {/* === LEFT COLUMN === */}
              <div className={styles.leftColumn}>
                {/* Atlas Positions */}
                {atlasPositions.length > 0 && (
                  <div className={styles.atlasSection}>
                    <span className={styles.sectionEyebrow}>Atlas Positions</span>
                    <h2>Where They Stand</h2>
                    <p className={styles.sectionDescription}>
                      Strongest convictions across AI policy topics. Positive = agrees with the topic&apos;s framing,
                      negative = challenges it.
                    </p>
                    <div className={styles.positionList}>
                      {atlasPositions.map((pos) => {
                        const atlasHref = buildAtlasNodeRoute(pos.nodeId, {
                          demo: true,
                          returnTo: readWindowLocationPath(),
                        });
                        const voteDisplay = pos.vote > 0 ? `+${pos.vote}` : pos.vote;
                        const voteMeaning =
                          pos.vote > 0 ? 'Agrees with the topic framing' : 'Challenges the topic framing';

                        return (
                          <a
                            key={pos.nodeId}
                            href={atlasHref}
                            className={styles.positionItem}
                            title={`Open ${pos.nodeName} in the atlas`}
                            aria-label={`Open ${pos.nodeName} in the atlas`}
                          >
                            <span
                              className={buildSimUserVoteIndicatorClassName({
                                baseClassName: styles.voteIndicator,
                                negativeClassName: styles.negative,
                                positiveClassName: styles.positive,
                                vote: pos.vote,
                              })}
                              title={`${voteMeaning}: ${voteDisplay}`}
                            >
                              <FontAwesomeIcon icon={pos.vote > 0 ? faArrowUp : faArrowDown} />
                              {voteDisplay}
                            </span>
                            <span className={styles.nodeName}>{pos.nodeName}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Survey Responses */}
                <div className={styles.surveySection}>
                  <h2 className={styles.screenReaderOnly}>Question Responses</h2>
                  <div className={styles.questionDeck}>
                    {userInfo.questions.map((question, index) => this.renderQuestionResponse(question, index))}
                  </div>
                </div>
              </div>

              {/* === RIGHT COLUMN === */}
              <div className={styles.rightColumn}>
                {/* Related Figures */}
                {(allies.length > 0 || opponents.length > 0) && (
                  <div className={styles.relatedSection}>
                    <span className={styles.sectionEyebrow}>Related Figures</span>
                    {allies.length > 0 && (
                      <div className={styles.relatedGroup}>
                        <h3 className={styles.relatedLabel}>Most Agreement</h3>
                        {allies.map((a) => {
                          const allyInfo = historicalFiguresData.find((f) => f.username === a.username);
                          return (
                            <SimRelatedFigure
                              key={a.username}
                              currentDisplayName={userInfo.name}
                              currentUsername={userInfo.username}
                              displayName={allyInfo?.name || a.username}
                              score={`+${a.agree}`}
                              username={a.username}
                            />
                          );
                        })}
                      </div>
                    )}
                    {opponents.length > 0 && (
                      <div className={styles.relatedGroup}>
                        <h3 className={styles.relatedLabel}>Most Disagreement</h3>
                        {opponents.map((o) => {
                          const oppInfo = historicalFiguresData.find((f) => f.username === o.username);
                          return (
                            <SimRelatedFigure
                              key={o.username}
                              currentDisplayName={userInfo.name}
                              currentUsername={userInfo.username}
                              displayName={oppInfo?.name || o.username}
                              score={String(o.disagree)}
                              tone="disagree"
                              username={o.username}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.adviceSection}>
                  <h2 className={styles.screenReaderOnly}>Summarized Advice</h2>
                  <div className={styles.adviceDeck}>
                    <div className={styles.adviceItem}>
                      <div className={styles.adviceLabel}>Biggest Hope</div>
                      <p className={styles.highlightedText}>{userInfo.biggestHope}</p>
                    </div>
                    <div className={styles.adviceItem}>
                      <div className={styles.adviceLabel}>Biggest Fear</div>
                      <p className={styles.highlightedText}>{userInfo.biggestFear}</p>
                    </div>
                    <div className={styles.adviceItem}>
                      <div className={styles.adviceLabel}>Highlighted Advice</div>
                      <p className={styles.highlightedText}>{userInfo.highlightedAdvice}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <Modal
          isOpen={this.state.showFullProfileModal}
          toggle={this.closeFullProfileModal}
          size="lg"
          className={styles.modalContent}
        >
          <ModalHeader toggle={this.closeFullProfileModal} className={styles.modalHeader}>
            Full User Profile
          </ModalHeader>
          <ModalBody className={styles.modalBody}>
            <div className={styles.modalSummary}>
              <h3>User Summary</h3>
              <p className={styles.modalText}>{userInfo.highlightedAdvice}</p>
            </div>
            <div className={styles.modalQuestions}>
              <h3>Question Responses</h3>
              <div className={styles.modalQuestionDeck}>
                {userInfo.questions.map((question, index) =>
                  this.renderQuestionResponse(question, index, 'fullscreen'),
                )}
              </div>
            </div>
          </ModalBody>
        </Modal>
      </div>
    );
  }
}

export default SimUserPage;
