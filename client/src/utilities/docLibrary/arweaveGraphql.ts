/** @file arweaveGraphql.ts */
import { toStr } from '../shared/primitives.js';
import { DEFAULT_ARWEAVE_GRAPHQL_URLS } from './config.js';

const DEFAULT_FIRST = 25;
const MAX_FIRST = 100;

type GraphqlTagFilterInput =
  | {
      name?: unknown;
      values?: unknown;
    }
  | null
  | undefined;

type GraphqlRequestTagFilter = {
  name: string;
  values: string[];
};

type GraphqlTag = {
  name?: unknown;
  value?: unknown;
};

type GraphqlNode = {
  id?: unknown;
  owner?: {
    address?: unknown;
  } | null;
  tags?: GraphqlTag[] | null;
  data?: {
    size?: unknown;
    type?: unknown;
  } | null;
  block?: {
    height?: unknown;
    timestamp?: unknown;
  } | null;
};

type GraphqlEdge = {
  cursor?: unknown;
  node?: GraphqlNode | null;
};

type GraphqlPayload = {
  data?: {
    transactions?: {
      edges?: GraphqlEdge[];
    } | null;
  } | null;
  errors?: Array<{
    message?: string;
  }>;
  error?: string;
} | null;

type ListArweaveTransactionsByTagsArgs = {
  graphqlUrl?: unknown;
  graphqlUrls?: unknown;
  tags?: unknown;
  first?: unknown;
  after?: unknown;
};

type ListedArweaveTransaction = {
  cursor: string | null;
  txId: string;
  owner: string | null;
  tags: GraphqlTag[];
  tagMap: Record<string, string>;
  data: {
    size: number | null;
    type: string | null;
  };
  block: {
    height: number | null;
    timestamp: number | null;
  } | null;
};

const buildTagFilters = (filters: unknown): GraphqlRequestTagFilter[] =>
  (Array.isArray(filters) ? filters : [])
    .filter((f): f is Exclude<GraphqlTagFilterInput, null | undefined> => Boolean(f) && typeof f === 'object')
    .map((f) => ({
      name: toStr(f.name).trim(),
      values: Array.isArray(f.values) ? f.values.map((v) => toStr(v).trim()).filter(Boolean) : [],
    }))
    .filter((f) => f.name && f.values.length);

const readTagMap = (tags: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  (Array.isArray(tags) ? tags : []).forEach((t) => {
    const name = toStr(t?.name).trim();
    const value = toStr(t?.value).trim();
    if (!name) return;
    out[name] = value;
  });
  return out;
};

const ARWEAVE_TX_QUERY = `
  query($first: Int!, $after: String, $tags: [TagFilter!]) {
    transactions(first: $first, after: $after, sort: HEIGHT_DESC, tags: $tags) {
      edges {
        cursor
        node {
          id
          owner { address }
          tags { name value }
          data { size type }
          block { height timestamp }
        }
      }
    }
  }
`;

export const listArweaveTransactionsByTags = async ({
  graphqlUrl,
  graphqlUrls,
  tags,
  first,
  after,
}: ListArweaveTransactionsByTagsArgs = {}): Promise<ListedArweaveTransaction[]> => {
  const configuredEndpoints: unknown[] = [
    ...(Array.isArray(graphqlUrls) ? graphqlUrls : []),
    ...(graphqlUrl ? [graphqlUrl] : []),
    ...DEFAULT_ARWEAVE_GRAPHQL_URLS,
  ];
  const endpoints: string[] = [];
  const seen = new Set<string>();
  configuredEndpoints.forEach((value) => {
    const endpoint = toStr(value).trim();
    if (!endpoint || seen.has(endpoint)) return;
    seen.add(endpoint);
    endpoints.push(endpoint);
  });
  if (!endpoints.length) throw new Error('Missing Arweave GraphQL URL.');

  const limit = Math.max(1, Math.min(MAX_FIRST, Number(first || DEFAULT_FIRST) || DEFAULT_FIRST));
  const filters = buildTagFilters(tags);
  const requestBody = JSON.stringify({
    query: ARWEAVE_TX_QUERY,
    variables: {
      first: limit,
      after: toStr(after).trim() || null,
      tags: filters.length ? filters : null,
    },
  });

  let edges: GraphqlEdge[] = [];
  let lastErr: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });

      const payload = (await res.json().catch(() => null)) as GraphqlPayload;
      if (!res.ok) {
        throw new Error(payload?.errors?.[0]?.message || payload?.error || `Arweave GraphQL error (${res.status})`);
      }
      if (payload?.errors?.length) {
        throw new Error(payload.errors[0]?.message || 'Arweave GraphQL error.');
      }

      edges = Array.isArray(payload?.data?.transactions?.edges) ? payload.data.transactions.edges : [];
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;

  return edges
    .map((edge) => {
      const node = edge?.node || {};
      const txId = toStr(node?.id).trim();
      return {
        cursor: toStr(edge?.cursor).trim() || null,
        txId,
        owner: toStr(node?.owner?.address).trim() || null,
        tags: Array.isArray(node?.tags) ? node.tags : [],
        tagMap: readTagMap(node?.tags),
        data: {
          size: Number(node?.data?.size || 0) || null,
          type: toStr(node?.data?.type).trim() || null,
        },
        block: node?.block
          ? {
              height: Number(node.block?.height || 0) || null,
              timestamp: Number(node.block?.timestamp || 0) || null,
            }
          : null,
      };
    })
    .filter((edge) => edge.txId);
};
