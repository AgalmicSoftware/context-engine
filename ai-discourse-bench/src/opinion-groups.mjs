const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const similarityFor = (matrix, leftId, rightId) => {
  if (leftId === rightId) return 1;
  const forward = Number(matrix?.[leftId]?.[rightId]);
  const reverse = Number(matrix?.[rightId]?.[leftId]);
  if (Number.isFinite(forward) && Number.isFinite(reverse)) {
    return clamp((forward + reverse) / 2, 0, 1);
  }
  if (Number.isFinite(forward)) return clamp(forward, 0, 1);
  if (Number.isFinite(reverse)) return clamp(reverse, 0, 1);
  return 0;
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
