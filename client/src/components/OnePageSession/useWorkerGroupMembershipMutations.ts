import { useCallback, useEffect, useRef, useState } from 'react';

export type WorkerGroupMembershipAction = 'join' | 'leave';

type WorkerGroupMembershipActionState = {
  targetKey: string;
  actions: Map<string, WorkerGroupMembershipAction>;
};

type WorkerGroupMembershipMutation = {
  targetKey: string;
  groupId: string;
  mutationId: number;
};

const noMembershipActions = new Map<string, WorkerGroupMembershipAction>();

const emptyMembershipActionState = (targetKey: string): WorkerGroupMembershipActionState => ({
  targetKey,
  actions: new Map(),
});

export const useWorkerGroupMembershipMutations = (targetKey: string) => {
  const targetKeyRef = useRef(targetKey);
  targetKeyRef.current = targetKey;
  const mutationSequenceRef = useRef(0);
  const mutationIdsByGroupRef = useRef(new Map<string, number>());
  const [membershipActionState, setMembershipActionState] = useState<WorkerGroupMembershipActionState>(() =>
    emptyMembershipActionState(targetKey),
  );

  useEffect(() => {
    const mutationIdsForTarget = mutationIdsByGroupRef.current;
    setMembershipActionState(emptyMembershipActionState(targetKey));
    return () => {
      mutationIdsForTarget.clear();
    };
  }, [targetKey]);

  const beginMembershipMutation = useCallback(
    (groupId: string, action: WorkerGroupMembershipAction): WorkerGroupMembershipMutation => {
      const mutationId = mutationSequenceRef.current + 1;
      mutationSequenceRef.current = mutationId;
      mutationIdsByGroupRef.current.set(groupId, mutationId);
      setMembershipActionState((current) => {
        const actions = new Map(current.targetKey === targetKey ? current.actions : []);
        actions.set(groupId, action);
        return { targetKey, actions };
      });
      return { targetKey, groupId, mutationId };
    },
    [targetKey],
  );

  const isMembershipMutationCurrent = useCallback(
    (mutation: WorkerGroupMembershipMutation): boolean =>
      targetKeyRef.current === mutation.targetKey &&
      mutationIdsByGroupRef.current.get(mutation.groupId) === mutation.mutationId,
    [],
  );

  const finishMembershipMutation = useCallback(
    (mutation: WorkerGroupMembershipMutation) => {
      if (!isMembershipMutationCurrent(mutation)) return;
      mutationIdsByGroupRef.current.delete(mutation.groupId);
      setMembershipActionState((current) => {
        if (current.targetKey !== mutation.targetKey) return current;
        const actions = new Map(current.actions);
        actions.delete(mutation.groupId);
        return { targetKey: mutation.targetKey, actions };
      });
    },
    [isMembershipMutationCurrent],
  );

  return {
    membershipActions:
      membershipActionState.targetKey === targetKey ? membershipActionState.actions : noMembershipActions,
    beginMembershipMutation,
    finishMembershipMutation,
    isMembershipMutationCurrent,
  };
};
