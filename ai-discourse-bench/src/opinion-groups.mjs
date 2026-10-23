const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const similarityFor = (matrix, leftId, rightId) => {
  if (leftId === rightId) return 1;
  const forward = matrix?.[leftId]?.[rightId];
  const reverse = matrix?.[rightId]?.[leftId];
  if (Number.isFinite(forward) && Number.isFinite(reverse)) {
    return clamp((forward + reverse) / 2, 0, 1);
  }
  if (Number.isFinite(forward)) return clamp(forward, 0, 1);
  if (Number.isFinite(reverse)) return clamp(reverse, 0, 1);
  return null;
};

export const hasCompleteSimilarity = (ids, matrix = {}) => ids.every((leftId) => (
  ids.every((rightId) => Number.isFinite(similarityFor(matrix, leftId, rightId)))
));

export const opinionGroupAvailability = (ids = [], matrix = {}) => {
  const eligibleIds = [...new Set(ids)].sort();
  let missingPairCount = 0;
  eligibleIds.forEach((leftId, index) => {
    eligibleIds.slice(index + 1).forEach((rightId) => {
      if (!Number.isFinite(similarityFor(matrix, leftId, rightId))) missingPairCount += 1;
    });
  });
  return {
    status: missingPairCount || eligibleIds.length < 2 ? 'unavailable' : 'available',
    reason: missingPairCount ? 'incomplete-pairwise-similarity' : (eligibleIds.length < 2 ? 'insufficient-eligible-participants' : null),
    interpretation: 'exploratory',
    eligibleParticipantIds: eligibleIds,
    missingPairCount,
  };
};

// Saved reports may still contain groups built from disconnected observations.
// Keep their measured edges, but never export those components as opinion groups.
export const withOpinionGroupAvailability = (report = {}) => {
  const participants = report.participants || [];
  const availability = opinionGroupAvailability(
    participants.filter((participant) => participant.coverage?.eligibleForSimilarity).map((participant) => participant.id),
    report.polisReport?.similarityMatrix,
  );
  const eligibleIds = new Set(availability.eligibleParticipantIds);
  const qualify = (participant) => ({
    ...participant,
    opinionGroup: availability.status === 'available' && eligibleIds.has(participant.id)
      ? participant.opinionGroup ?? null : null,
  });
  return {
    ...report,
    participants: participants.map(qualify),
    participantGraph: {
      ...report.participantGraph,
      opinionGroupAvailability: availability,
      nodes: (report.participantGraph?.nodes || []).map(qualify),
    },
  };
};

const compareIds = (left, right) => {
  const leftId = String(left);
  const rightId = String(right);
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  return 0;
};

export const clusterBySimilarity = ({ participantIds = [], similarityMatrix = {}, count = 1 } = {}) => {
  const ids = Array.from(new Set(participantIds.map(String))).sort(compareIds);
  if (!ids.length) {
    return {
      method: 'deterministic-k-medoids',
      count: 0,
      medoids: [],
      assignments: {},
    };
  }

  // Connected overlap alone is insufficient: K-medoids needs every pair distance.
  // Missing evidence must never become maximal disagreement via Number(null).
  if (!hasCompleteSimilarity(ids, similarityMatrix)) {
    return {
      method: 'deterministic-k-medoids',
      status: 'unavailable',
      reason: 'incomplete-pairwise-similarity',
      count: 0,
      medoids: [],
      assignments: {},
    };
  }

  const clusterCount = clamp(Math.trunc(Number(count) || 1), 1, ids.length);
  const distance = (leftId, rightId) => 1 - similarityFor(similarityMatrix, leftId, rightId);
  const totalDistance = (candidateId, members = ids) => members.reduce(
    (sum, memberId) => sum + distance(candidateId, memberId),
    0,
  );
  const chooseBest = (candidates, score) => [...candidates].sort((left, right) => {
    const difference = score(left) - score(right);
    return Math.abs(difference) > 1e-12 ? difference : compareIds(left, right);
  })[0];

  const medoids = [chooseBest(ids, (candidateId) => totalDistance(candidateId))];
  while (medoids.length < clusterCount) {
    const candidates = ids.filter((id) => !medoids.includes(id));
    const nextMedoid = [...candidates].sort((left, right) => {
      const leftNearest = Math.min(...medoids.map((medoid) => distance(left, medoid)));
      const rightNearest = Math.min(...medoids.map((medoid) => distance(right, medoid)));
      const difference = rightNearest - leftNearest;
      return Math.abs(difference) > 1e-12 ? difference : compareIds(left, right);
    })[0];
    medoids.push(nextMedoid);
  }

  const assign = (activeMedoids) => Object.fromEntries(ids.map((id) => {
    const ownMedoidIndex = activeMedoids.indexOf(id);
    if (ownMedoidIndex >= 0) return [id, ownMedoidIndex];
    let bestIndex = 0;
    let bestDistance = distance(id, activeMedoids[0]);
    for (let index = 1; index < activeMedoids.length; index += 1) {
      const candidateDistance = distance(id, activeMedoids[index]);
      if (candidateDistance < bestDistance - 1e-12) {
        bestIndex = index;
        bestDistance = candidateDistance;
      }
    }
    return [id, bestIndex];
  }));

  let activeMedoids = medoids;
  let assignments = assign(activeMedoids);
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const nextMedoids = activeMedoids.map((currentMedoid, clusterIndex) => {
      const members = ids.filter((id) => assignments[id] === clusterIndex);
      return members.length
        ? chooseBest(members, (candidateId) => totalDistance(candidateId, members))
        : currentMedoid;
    });
    if (nextMedoids.every((id, index) => id === activeMedoids[index])) break;
    activeMedoids = nextMedoids;
    assignments = assign(activeMedoids);
  }

  return {
    method: 'deterministic-k-medoids',
    count: clusterCount,
    medoids: activeMedoids,
    assignments,
  };
};
