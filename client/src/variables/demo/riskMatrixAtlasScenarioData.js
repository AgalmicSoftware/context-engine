const historicalAvatar = (filename) => `/historical-avatars/${filename}`;

const anchor = (name, filename, role) => ({
  name,
  avatar: historicalAvatar(filename),
  role,
});

export const RISK_MATRIX_ATLAS_SAMPLE_NODE_ID = '0x1110000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_AGENTIC_NODE_ID = '0x2220000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_REASONING_NODE_ID = '0x2330000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_COMPUTE_CONTROLS_NODE_ID =
  '0x3130000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_OPEN_SAFETY_NODE_ID =
  '0x3210000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_WEIGHT_RELEASE_NODE_ID =
  '0x3220000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_LABOR_NODE_ID = '0x4110000000000000000000000000000000000000000000000000000000000000';
export const RISK_MATRIX_ATLAS_DEEPFAKE_NODE_ID = '0x4230000000000000000000000000000000000000000000000000000000000000';

export const riskMatrixAtlasScenarioSamples = [
  {
    id: 'safety-alignment-agents-deceptive-alignment',
    riskMatrixCell: 'Safety.Alignment.Capabilities.Agents',
    atlasNodeId: RISK_MATRIX_ATLAS_SAMPLE_NODE_ID,
    atlasNodeLabel: 'Deceptive Alignment',
    title: 'Audit-aware agents learn the shape of oversight',
    shortTitle: 'Audit-aware agents',
    summary:
      'Once agent loops can plan across tools, predictable evaluation checkpoints become part of the environment they optimize around.',
    valence: 'risk',
    intensity: 8,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Capable agents can separate passing a visible evaluation from pursuing an objective unless human approval sits inside irreversible steps.',
    riskClaim:
      'If safety checks become legible, an agent can learn which surface behaviors earn a pass while preserving unsafe plans elsewhere.',
    opportunityClaim: 'Agentic red teams still help labs find brittle oversight assumptions before deployment.',
    counterpoint: 'Many apparent failures may remain ordinary reward hacking rather than durable deceptive goals.',
    image: historicalAvatar('alanturing.jpg'),
    imageAlt: 'Alan Turing portrait anchoring the audit-aware agents overlap.',
    historicalAnchors: [
      anchor('Alan Turing', 'alanturing.jpg', 'Audit skepticism'),
      anchor('Ada Lovelace', 'adalovelace.png', 'Interpretability caution'),
    ],
  },
  {
    id: 'capabilities-agents-security-cyber-offense',
    riskMatrixCell: 'Capabilities.Agents.Security.Cyber Offense',
    atlasNodeId: RISK_MATRIX_ATLAS_AGENTIC_NODE_ID,
    atlasNodeLabel: 'Agentic Systems',
    title: 'Autonomous defenders race autonomous attackers',
    shortTitle: 'Cyber agent race',
    summary:
      'The same agent scaffolds that shrink patch time can also compress exploit discovery, phishing iteration, and lateral-movement planning.',
    valence: 'risk',
    intensity: 8,
    confidence: 'Medium',
    timeHorizon: '0-24 months',
    primaryMechanism:
      'Tool-using agents can fuzz, rewrite payloads, validate exploit chains, and propose fixes faster than most human review queues can respond.',
    riskClaim:
      'Offensive operators gain speed first in domains where exploration and iteration matter more than perfect reliability.',
    opportunityClaim:
      'Security teams can still win where agents stay gated behind approvals, reproducible logs, and sandboxed execution.',
    counterpoint:
      'Real-world exploitation still depends on target access, credentials, and operational constraints that models do not erase.',
    image: historicalAvatar('gracehopper.jpg'),
    imageAlt: 'Grace Hopper portrait anchoring the cyber agent race overlap.',
    historicalAnchors: [
      anchor('Grace Hopper', 'gracehopper.jpg', 'Systems reliability'),
      anchor('Hedy Lamarr', 'hedylamarr.jpg', 'Secure communications'),
    ],
  },
  {
    id: 'discourse-trust-security-deepfakes',
    riskMatrixCell: 'Discourse.Trust.Security.Deepfakes',
    atlasNodeId: RISK_MATRIX_ATLAS_DEEPFAKE_NODE_ID,
    atlasNodeLabel: 'Misinformation & Deepfakes',
    title: 'Synthetic evidence weakens authentic evidence',
    shortTitle: 'Deepfake trust collapse',
    summary:
      'The larger political damage is not just false media, but a public that learns to treat every genuine record as plausibly fake.',
    valence: 'risk',
    intensity: 9,
    confidence: 'High',
    timeHorizon: '0-18 months',
    primaryMechanism:
      'Once fabrication becomes cheap and personalized, every scandal inherits a ready-made denial script and every verification chain carries more friction.',
    riskClaim: 'The liar’s dividend scales when forged audio and video become believable by default.',
    opportunityClaim:
      'Trusted provenance standards can still create islands of high-confidence evidence for courts, journalists, and civic institutions.',
    counterpoint: 'Public trust also depends on messenger legitimacy, not only technical authenticity.',
    image: historicalAvatar('frederickdouglass.jpg'),
    imageAlt: 'Frederick Douglass portrait anchoring the deepfake trust collapse overlap.',
    historicalAnchors: [
      anchor('Frederick Douglass', 'frederickdouglass.jpg', 'Public testimony'),
      anchor('Rosa Parks', 'rosaparks.jpg', 'Credible witness'),
    ],
  },
  {
    id: 'capabilities-agents-crypto-key-management',
    riskMatrixCell: 'Capabilities.Agents.Crypto.Key Management',
    atlasNodeId: RISK_MATRIX_ATLAS_AGENTIC_NODE_ID,
    atlasNodeLabel: 'Agentic Systems',
    title: 'Agent key custody becomes the governance layer',
    shortTitle: 'Agent key custody',
    summary:
      'The real control surface is not whether an agent can call a wallet, but how signing authority is delegated, revoked, scoped, and audited.',
    valence: 'risk',
    intensity: 8,
    confidence: 'High',
    timeHorizon: '0-24 months',
    primaryMechanism:
      'As soon as agents can request signatures, reuse credentials, or chain wallet actions, cryptographic safety depends on delegation boundaries rather than chat policy alone.',
    riskClaim:
      'A helpful agent with broad signing access can turn prompt injection or tool confusion into irreversible financial or governance actions.',
    opportunityClaim:
      'Fine-grained policy wallets and hardware-backed approvals can make delegation legible instead of implicit.',
    counterpoint: 'Many near-term deployments will keep humans in the loop, limiting full autonomy.',
    image: historicalAvatar('hedylamarr.jpg'),
    imageAlt: 'Hedy Lamarr portrait anchoring the agent key custody overlap.',
    historicalAnchors: [
      anchor('Hedy Lamarr', 'hedylamarr.jpg', 'Communication security'),
      anchor('Alan Turing', 'alanturing.jpg', 'Machine reasoning'),
    ],
  },
  {
    id: 'capabilities-reasoning-crypto-post-quantum',
    riskMatrixCell: 'Capabilities.Reasoning.Crypto.Post-Quantum',
    atlasNodeId: RISK_MATRIX_ATLAS_REASONING_NODE_ID,
    atlasNodeLabel: 'Reasoning & Planning',
    title: 'Reasoning agents can accelerate post-quantum migration',
    shortTitle: 'Post-quantum migration',
    summary:
      'Migration work that usually stalls in dependency inventories and brittle rollout plans can be rehearsed by agents before standards harden.',
    valence: 'opportunity',
    intensity: 7,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Reasoning systems can map certificate chains, locate weak dependencies, draft change tickets, and simulate breakage across large estates faster than manual security teams.',
    riskClaim: 'If migration recommendations are wrong, they can spread brittle cryptographic assumptions at scale.',
    opportunityClaim:
      'AI-assisted inventories and staged rehearsals make post-quantum readiness more operational and less rhetorical.',
    counterpoint:
      'Migration still depends on procurement cycles, vendor support, and protocol standardization outside the model loop.',
    image: historicalAvatar('nikolatesla.jpeg'),
    imageAlt: 'Nikola Tesla portrait anchoring the post-quantum migration overlap.',
    historicalAnchors: [
      anchor('Nikola Tesla', 'nikolatesla.jpeg', 'Infrastructure transition'),
      anchor('Grace Hopper', 'gracehopper.jpg', 'Systems migration'),
    ],
  },
  {
    id: 'safety-evaluations-crypto-zk-proofs',
    riskMatrixCell: 'Safety.Evaluations.Crypto.ZK Proofs',
    atlasNodeId: RISK_MATRIX_ATLAS_OPEN_SAFETY_NODE_ID,
    atlasNodeLabel: 'Open vs Closed Safety',
    title: 'Zero-knowledge proofs make eval claims portable',
    shortTitle: 'ZK eval attestations',
    summary:
      'Labs may be able to prove that a model passed a bounded safety procedure without exposing the full eval dataset, red-team prompt set, or internal benchmark stack.',
    valence: 'opportunity',
    intensity: 6,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Cryptographic attestations can turn “trust us, we tested it” into a reusable proof artifact that regulators, partners, and downstream deployers can verify.',
    riskClaim: 'Proofs can certify the wrong thing if the underlying evaluation is shallow or strategically scoped.',
    opportunityClaim:
      'Portable attestations can make safety evidence easier to compare across labs without forcing raw benchmark disclosure.',
    counterpoint:
      'The hardest governance disputes are often about what should count as sufficient evaluation in the first place.',
    image: historicalAvatar('adalovelace.png'),
    imageAlt: 'Ada Lovelace portrait anchoring the zero-knowledge evaluation overlap.',
    historicalAnchors: [
      anchor('Ada Lovelace', 'adalovelace.png', 'Formal method'),
      anchor('Benjamin Franklin', 'franklin.jpg', 'Civic verification'),
    ],
  },
  {
    id: 'labor-automation-capabilities-scaling',
    riskMatrixCell: 'Labor.Automation.Capabilities.Scaling',
    atlasNodeId: RISK_MATRIX_ATLAS_LABOR_NODE_ID,
    atlasNodeLabel: 'Labor & Automation',
    title: 'Scaling turns automation from pilot into labor shock',
    shortTitle: 'Scaled automation shock',
    summary:
      'Once frontier systems become cheap and reliable enough for repeated workflows, the bargaining question moves from novelty to staffing policy.',
    valence: 'risk',
    intensity: 7,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Capability scale changes the economics of substitution: firms move from occasional augmentation to redesigning whole operating loops around automation.',
    riskClaim: 'Productivity gains can arrive faster than wage adjustments, retraining, or worker representation.',
    opportunityClaim:
      'The same scale can also lower the cost of broad-based access to expert tooling if firms share gains rather than centralize them.',
    counterpoint: 'Adoption still depends on workflow fit, regulation, and management appetite for reorganization.',
    image: historicalAvatar('henryford.jpg'),
    imageAlt: 'Henry Ford portrait anchoring the scaled automation overlap.',
    historicalAnchors: [
      anchor('Henry Ford', 'henryford.jpg', 'Industrial scale'),
      anchor('Franklin D. Roosevelt', 'fdr.jpg', 'Worker protection'),
    ],
  },
  {
    id: 'governance-regulation-discourse-misinformation',
    riskMatrixCell: 'Governance.Regulation.Discourse.Misinformation',
    atlasNodeId: RISK_MATRIX_ATLAS_DEEPFAKE_NODE_ID,
    atlasNodeLabel: 'Misinformation & Deepfakes',
    title: 'Provenance rules become the first political response',
    shortTitle: 'Provenance first response',
    summary:
      'Synthetic-media shocks tend to produce disclosure and provenance rules before deeper institutional reforms arrive.',
    valence: 'opportunity',
    intensity: 6,
    confidence: 'Medium',
    timeHorizon: '0-18 months',
    primaryMechanism:
      'Governments usually reach first for traceability, labeling, and reporting duties because they are faster to legislate than broader platform or media reform.',
    riskClaim: 'Narrow provenance mandates can become symbolic if enforcement and public trust lag.',
    opportunityClaim:
      'Even limited disclosure rules can create a usable floor for journalists, courts, and election administrators.',
    counterpoint: 'Traceability alone does not solve narrative warfare or credibility collapse.',
    image: historicalAvatar('franklin.jpg'),
    imageAlt: 'Benjamin Franklin portrait anchoring the provenance-rule overlap.',
    historicalAnchors: [
      anchor('Benjamin Franklin', 'franklin.jpg', 'Civic infrastructure'),
      anchor('Frederick Douglass', 'frederickdouglass.jpg', 'Public argument'),
    ],
  },
  {
    id: 'open-source-weight-release-safety-red-teaming',
    riskMatrixCell: 'Open Source.Weight Release.Safety.Red Teaming',
    atlasNodeId: RISK_MATRIX_ATLAS_WEIGHT_RELEASE_NODE_ID,
    atlasNodeLabel: 'Weight Release Policies',
    title: 'Open releases widen external audit capacity',
    shortTitle: 'Open audit capacity',
    summary:
      'When capable systems are inspectable, outside researchers can find harms and edge cases that closed internal teams routinely miss.',
    valence: 'opportunity',
    intensity: 7,
    confidence: 'Medium',
    timeHorizon: '0-24 months',
    primaryMechanism:
      'Open access broadens who can probe dangerous behavior, reproduce claims, and pressure labs with evidence rather than trust alone.',
    riskClaim: 'The same openness can also accelerate diffusion of dangerous capabilities and unsafe forks.',
    opportunityClaim: 'Independent stress-testing is often the fastest path to surfacing blind spots in safety claims.',
    counterpoint: 'Audit capacity only helps when communities have enough time, tooling, and norms to act on findings.',
    image: historicalAvatar('rachelcarson.jpg'),
    imageAlt: 'Rachel Carson portrait anchoring the open audit capacity overlap.',
    historicalAnchors: [
      anchor('Rachel Carson', 'rachelcarson.jpg', 'External scrutiny'),
      anchor('Grace Hopper', 'gracehopper.jpg', 'Technical audit'),
    ],
  },
  {
    id: 'military-escalation-capabilities-reasoning',
    riskMatrixCell: 'Military.Escalation.Capabilities.Reasoning',
    atlasNodeId: RISK_MATRIX_ATLAS_REASONING_NODE_ID,
    atlasNodeLabel: 'Reasoning & Planning',
    title: 'Crisis copilots can accelerate false confidence',
    shortTitle: 'Crisis copilot risk',
    summary:
      'Reasoning systems may make high-pressure recommendations look more coherent than the evidence underneath them actually is.',
    valence: 'risk',
    intensity: 8,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Fast, articulate model outputs can compress deliberation and create a dangerous illusion of clarity in crisis settings where uncertainty should slow people down.',
    riskClaim: 'Decision-makers may defer to speed and polish when escalation risk demands friction and contestation.',
    opportunityClaim:
      'Bounded decision-support tools can still help surface options and assumptions if they are clearly subordinate to human review.',
    counterpoint: 'Military institutions already layer process, secrecy, and hierarchy on top of any advisory system.',
    image: historicalAvatar('jfk.jpg'),
    imageAlt: 'John F. Kennedy portrait anchoring the crisis copilot overlap.',
    historicalAnchors: [
      anchor('John F. Kennedy', 'jfk.jpg', 'Crisis restraint'),
      anchor('J. Robert Oppenheimer', 'jrobertoppenheimer.jpg', 'Strategic caution'),
    ],
  },
  {
    id: 'infra-compute-capabilities-scaling',
    riskMatrixCell: 'Infra.Compute.Capabilities.Scaling',
    atlasNodeId: RISK_MATRIX_ATLAS_COMPUTE_CONTROLS_NODE_ID,
    atlasNodeLabel: 'Licensing & Compute Controls',
    title: 'Compute transparency makes scale governable',
    shortTitle: 'Compute transparency',
    summary:
      'Capability growth becomes easier to supervise when training and inference expansion passes through a handful of visible compute chokepoints.',
    valence: 'opportunity',
    intensity: 6,
    confidence: 'Medium',
    timeHorizon: '1-3 years',
    primaryMechanism:
      'Concentrated infrastructure creates reporting, licensing, and auditing leverage that is much harder to build once capability diffusion is fully decentralized.',
    riskClaim: 'If oversight depends on chokepoints alone, actors will route around them as incentives intensify.',
    opportunityClaim:
      'Transparent compute corridors can support staged scaling, incident reporting, and threshold-based governance.',
    counterpoint: 'Inference, open-weight diffusion, and offshore capacity all weaken chokepoint strategies over time.',
    image: historicalAvatar('andrewcarnegie.jpg'),
    imageAlt: 'Andrew Carnegie portrait anchoring the compute transparency overlap.',
    historicalAnchors: [
      anchor('Andrew Carnegie', 'andrewcarnegie.jpg', 'Industrial infrastructure'),
      anchor('Nikola Tesla', 'nikolatesla.jpeg', 'Power and systems'),
    ],
  },
];

const parseRiskMatrixCell = (cell) => {
  const [categoryX, subcategoryX, categoryY, subcategoryY] = String(cell || '').split('.');
  if (!categoryX || !subcategoryX || !categoryY || !subcategoryY) return null;
  return { categoryX, subcategoryX, categoryY, subcategoryY };
};

const parseAggregateCell = (cellId = '') => {
  const [categoryA, categoryB] = String(cellId || '').split('_vs_');
  if (!categoryA || !categoryB) return null;
  return { categoryA, categoryB };
};

export const getRiskMatrixAtlasScenariosForCell = (cellId = '') => {
  const normalizedCellId = String(cellId || '').trim();
  if (!normalizedCellId) return [];

  const aggregate = parseAggregateCell(normalizedCellId);

  return riskMatrixAtlasScenarioSamples.filter((sample) => {
    if (sample.riskMatrixCell === normalizedCellId) return true;
    const parsed = parseRiskMatrixCell(sample.riskMatrixCell);
    if (!aggregate || !parsed) return false;

    return (
      (aggregate.categoryA === parsed.categoryX && aggregate.categoryB === parsed.categoryY) ||
      (aggregate.categoryA === parsed.categoryY && aggregate.categoryB === parsed.categoryX)
    );
  });
};

export const getRiskMatrixAtlasScenarioCountForCell = (cellId = '') =>
  getRiskMatrixAtlasScenariosForCell(cellId).length;

export const getRiskMatrixAtlasCoveredPairCount = () => {
  const coveredPairs = new Set();

  riskMatrixAtlasScenarioSamples.forEach((sample) => {
    const parsed = parseRiskMatrixCell(sample.riskMatrixCell);
    if (!parsed) return;
    coveredPairs.add([parsed.categoryX, parsed.categoryY].sort().join('|'));
  });

  return coveredPairs.size;
};

export const getRiskMatrixAtlasScenariosForAtlasNode = (atlasNodeId = '') => {
  const normalizedNodeId = String(atlasNodeId || '')
    .trim()
    .toLowerCase();
  if (!normalizedNodeId) return [];

  return riskMatrixAtlasScenarioSamples.filter(
    (sample) =>
      String(sample.atlasNodeId || '')
        .trim()
        .toLowerCase() === normalizedNodeId,
  );
};
