import { RXC_SESSION_SLUGS } from '../../utilities/session/rxcSessionSlugs';

export const REVERSE_ALIGNMENT_SOURCE = 'https://reversealignment.ai/';

// Editorial navigation groups, not an analysis of submitted questions or responses.
export const reverseAlignmentBranches = [
  { label: 'Trust and agency', tone: 'trust' },
  { label: 'Collective decisions', tone: 'collective' },
  { label: 'Learning and work', tone: 'learning' },
] as const;

export const reverseAlignmentTopics = [
  {
    id: 'identity',
    label: 'Identity',
    branch: 0,
    brief: 'Recognize unique people while protecting their identity.',
    tension: 'How could a community establish that someone is human without demanding their legal identity?',
    related: ['privacy', 'democracy'],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    branch: 0,
    brief: 'Make disclosure selective and appropriate to its context.',
    tension: 'What should an assistant forget when it moves from your workplace to your home?',
    related: ['identity', 'agentic-collaboration'],
  },
  {
    id: 'provenance',
    label: 'Provenance',
    branch: 0,
    brief: 'Understand where content comes from to support shared reality.',
    tension: 'What evidence would help you trust a claim without simply trusting the platform that carries it?',
    related: ['communal-sensemaking', 'research'],
  },
  {
    id: 'data-value',
    label: 'Data value',
    branch: 0,
    brief: 'Share value with people whose data supports AI.',
    tension: 'Who should negotiate the terms when many people contribute to one useful model?',
    related: ['labor-transition', 'privacy'],
  },
  {
    id: 'agentic-collaboration',
    label: 'Agentic collaboration',
    branch: 1,
    brief: 'Enable trust between agents from different providers.',
    tension: 'When two assistants negotiate on our behalf, which commitments should still need our approval?',
    related: ['privacy', 'law-and-liberties'],
  },
  {
    id: 'communal-sensemaking',
    label: 'Communal sensemaking',
    branch: 1,
    brief: 'Find common ground while preserving meaningful disagreement.',
    tension: 'How could a shared account of a debate preserve a small group’s important objection?',
    related: ['provenance', 'democracy'],
  },
  {
    id: 'democracy',
    label: 'Democracy',
    branch: 1,
    brief: 'Connect wider participation to meaningful community authority.',
    tension: 'What would make an AI-assisted public consultation change an actual decision?',
    related: ['communal-sensemaking', 'identity'],
  },
  {
    id: 'law-and-liberties',
    label: 'Law and liberties',
    branch: 1,
    brief: 'Preserve oversight and appeals as enforcement becomes automated.',
    tension: 'How should someone challenge a decision when no individual can fully explain its chain of reasoning?',
    related: ['democracy', 'agentic-collaboration'],
  },
  {
    id: 'workplace',
    label: 'Workplace',
    branch: 2,
    brief: 'Redesign organizations around human creativity and agency.',
    tension: 'If a team saves half its time, who decides what the other half becomes?',
    related: ['labor-transition', 'agentic-collaboration'],
  },
  {
    id: 'research',
    label: 'Research',
    branch: 2,
    brief: 'Support original inquiry and the capacity to review it.',
    tension: 'How could researchers reward careful checking when producing new claims becomes much faster?',
    related: ['provenance', 'education'],
  },
  {
    id: 'education',
    label: 'Education',
    branch: 2,
    brief: 'Develop learning capacities and credible ways to assess them.',
    tension: 'What should a learner demonstrate unaided, and what should they demonstrate with an assistant?',
    related: ['research', 'labor-transition'],
  },
  {
    id: 'labor-transition',
    label: 'Labor transition',
    branch: 2,
    brief: 'Help people retrain and carry credentials between roles.',
    tension: 'What support would make changing professions a real choice for someone with dependants?',
    related: ['workplace', 'data-value'],
  },
] as const;

export const hasReverseAlignmentContext = (slug: string) => RXC_SESSION_SLUGS.includes(slug);
