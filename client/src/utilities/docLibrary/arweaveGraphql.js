/** @file arweaveGraphql.js */
import { toStr } from '../shared/primitives.js';

const DEFAULT_FIRST = 25;
const MAX_FIRST = 100;

const buildTagFilters = (filters) => (
  (Array.isArray(filters) ? filters : [])
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      name: toStr(f.name).trim(),
      values: Array.isArray(f.values) ? f.values.map((v) => toStr(v).trim()).filter(Boolean) : [],
    }))
    .filter((f) => f.name && f.values.length)
);

const readTagMap = (tags) => {
  const out = {};
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
  tags,
  first,
  after,
} = {}) => {
  const endpoint = toStr(graphqlUrl).trim();
  if (!endpoint) throw new Error('Missing Arweave GraphQL URL.');

  const limit = Math.max(1, Math.min(MAX_FIRST, Number(first || DEFAULT_FIRST) || DEFAULT_FIRST));
  const filters = buildTagFilters(tags);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: ARWEAVE_TX_QUERY,
      variables: {
        first: limit,
        after: toStr(after).trim() || null,
        tags: filters.length ? filters : null,
      },
    }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = payload?.errors?.[0]?.message || payload?.error || `Arweave GraphQL error (${res.status})`;
    throw new Error(msg);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors[0]?.message || 'Arweave GraphQL error.');
  }

  const edges = Array.isArray(payload?.data?.transactions?.edges)
    ? payload.data.transactions.edges
    : [];

  return edges.map((edge) => {
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
            height: Number(node.block.height || 0) || null,
            timestamp: Number(node.block.timestamp || 0) || null,
          }
        : null,
    };
  }).filter((edge) => edge.txId);
};
