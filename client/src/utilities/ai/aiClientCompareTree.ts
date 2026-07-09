type CompareTreeParticipant = {
  address: string;
  stance?: string;
};

type CompareTreeNode = {
  label: string;
  evidence: string[];
  participants?: CompareTreeParticipant[];
  children: CompareTreeNode[];
};

type CompareTree = {
  title: string;
  nodes: CompareTreeNode[];
};

const isCompareTreeNode = (node: CompareTreeNode | null): node is CompareTreeNode => Boolean(node);

const isCompareTreeParticipant = (participant: CompareTreeParticipant | null): participant is CompareTreeParticipant =>
  Boolean(participant);

const normalizeParticipant = (participant: unknown): CompareTreeParticipant | null => {
  if (typeof participant === 'string') {
    const address = participant.toLowerCase();
    return address ? { address } : null;
  }
  if (participant && typeof participant === 'object') {
    const value = participant as { address?: unknown; stance?: unknown };
    const address = String(value.address || '').toLowerCase();
    const stance = value.stance != null ? String(value.stance).slice(0, 32) : undefined;
    return address ? { address, ...(stance ? { stance } : {}) } : null;
  }
  return null;
};

export const sanitizeCompareTreeNode = (node: unknown, depth = 0): CompareTreeNode | null => {
  if (!node || typeof node !== 'object') return null;
  const value = node as {
    label?: unknown;
    evidence?: unknown;
    participants?: unknown;
    children?: unknown;
  };
  const label = String(value.label || '').slice(0, 240);
  const evidence = Array.isArray(value.evidence)
    ? value.evidence.slice(0, 4).map((item) => String(item || '').slice(0, 280))
    : [];

  let participants: CompareTreeParticipant[] | undefined;
  if (Array.isArray(value.participants)) {
    participants = value.participants.slice(0, 10).map(normalizeParticipant).filter(isCompareTreeParticipant);
    if (participants.length === 0) participants = undefined;
  }

  const baseNode = {
    label,
    evidence,
    ...(participants ? { participants } : {}),
  };
  const childrenIn = Array.isArray(value.children) ? value.children : [];
  if (depth >= 3) return { ...baseNode, children: [] };
  const children = childrenIn
    .slice(0, 6)
    .map((child) => sanitizeCompareTreeNode(child, depth + 1))
    .filter(isCompareTreeNode);
  return { ...baseNode, children };
};

export const sanitizeCompareTreePayload = (parsed: unknown, fallbackTitle: string): CompareTree | null => {
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as { title?: unknown; nodes?: unknown };
  if (typeof value.title !== 'string' || !Array.isArray(value.nodes)) return null;
  return {
    title: String(value.title || fallbackTitle).slice(0, 120),
    nodes: value.nodes
      .slice(0, 6)
      .map((node) => sanitizeCompareTreeNode(node, 0))
      .filter(isCompareTreeNode),
  };
};

export const buildCompareFallbackTree = (title: string, evidenceText: unknown): CompareTree => ({
  title,
  nodes: [{ label: 'Summary', evidence: [String(evidenceText || '')], children: [] }],
});
