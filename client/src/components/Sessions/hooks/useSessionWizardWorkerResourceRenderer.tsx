import { useCallback } from 'react';
import WorkerResourceCard from '../WorkerResourceCard';
import WorkerResourceInputs from '../WorkerResourceInputs';
import { getSessionWizardSecretFieldTestId } from '../sessionWizardUiSupport';
import { RESOURCE_LABELS, RESOURCE_SECTION_TOOLTIPS } from '../sessionWizardResourceConfig';
import {
  resolveSessionWizardResourceGateSelectionState,
  resolveSessionWizardResourceGateSelectionUpdate,
  type SessionWizardResourceGateSelectionState,
} from '../sessionWizardResourceGateSupport';
import type { WorkerSecretsLike } from '../../shellTypes';
import type { WorkerResourceCardProps } from '../WorkerResourceCard';
import type { WorkerResourceInputsProps } from '../WorkerResourceInputs';

type StateUpdater<T> = (nextValueOrUpdater: T | ((prev: T) => T)) => void;

type ResourceGateSelectionOption = Record<string, unknown> & {
  id?: unknown;
  value?: unknown;
};

type UseSessionWizardWorkerResourceRendererOptions = {
  defaultGateId?: string;
  effectiveDefaultWorkerRpcUrl?: string;
  gateOptions: WorkerResourceCardProps['gateOptions'];
  isNormalMode: boolean;
  openResourceGateKey: string;
  resourceGateMap: Record<string, SessionWizardResourceGateSelectionState>;
  resourceGateOptions: ResourceGateSelectionOption[];
  showSponsoredFaucetNotice: boolean;
  workerSecrets: WorkerSecretsLike;
  workerSecretsEnabled: boolean;
  applyWorkerSecretsUpdate: StateUpdater<WorkerSecretsLike>;
  getResourceSecretFields: (resourceKey: string) => NonNullable<WorkerResourceInputsProps['fields']>;
  renderInfoTooltip: WorkerResourceCardProps['renderInfoTooltip'];
  setOpenResourceGateKey: StateUpdater<string>;
  setResourceGateMap: StateUpdater<Record<string, SessionWizardResourceGateSelectionState>>;
};

const useSessionWizardWorkerResourceRenderer = ({
  defaultGateId = '',
  effectiveDefaultWorkerRpcUrl = '',
  gateOptions,
  isNormalMode,
  openResourceGateKey,
  resourceGateMap,
  resourceGateOptions,
  showSponsoredFaucetNotice,
  workerSecrets,
  workerSecretsEnabled,
  applyWorkerSecretsUpdate,
  getResourceSecretFields,
  renderInfoTooltip,
  setOpenResourceGateKey,
  setResourceGateMap,
}: UseSessionWizardWorkerResourceRendererOptions) => {
  const updateResourceGate = useCallback(
    (resourceKey: string, gateId: SessionWizardResourceGateSelectionState) => {
      setResourceGateMap((prev) => ({
        ...prev,
        [resourceKey]: gateId,
      }));
    },
    [setResourceGateMap],
  );

  const renderResourceInputs = useCallback(
    (resourceKey: string) => {
      const fields = getResourceSecretFields(resourceKey);
      return (
        <WorkerResourceInputs
          resourceKey={resourceKey}
          fields={fields}
          workerSecrets={workerSecrets}
          workerSecretsEnabled={workerSecretsEnabled}
          isNormalMode={isNormalMode}
          showSponsoredFaucetNotice={showSponsoredFaucetNotice}
          effectiveDefaultWorkerRpcUrl={effectiveDefaultWorkerRpcUrl}
          getSecretFieldTestId={getSessionWizardSecretFieldTestId}
          onUpdateSecret={(fieldKey: string, nextValue: string) => {
            applyWorkerSecretsUpdate((prev: WorkerSecretsLike) => ({ ...prev, [fieldKey]: nextValue }));
          }}
        />
      );
    },
    [
      applyWorkerSecretsUpdate,
      effectiveDefaultWorkerRpcUrl,
      getResourceSecretFields,
      isNormalMode,
      showSponsoredFaucetNotice,
      workerSecrets,
      workerSecretsEnabled,
    ],
  );

  const renderResourceCard = useCallback(
    (resourceKey: string) => {
      const resourceGateSelectionState = resolveSessionWizardResourceGateSelectionState({
        value: resourceGateMap[resourceKey],
        fallbackGateId: defaultGateId || resourceGateOptions[0]?.value || '',
        gateOptions: resourceGateOptions,
      });
      return (
        <WorkerResourceCard
          key={resourceKey}
          resourceKey={resourceKey}
          label={RESOURCE_LABELS[resourceKey] || resourceKey}
          tooltipText={RESOURCE_SECTION_TOOLTIPS[resourceKey] || ''}
          renderInfoTooltip={renderInfoTooltip}
          gateOptions={gateOptions}
          selectedGateIds={resourceGateSelectionState.selectedGateIds}
          onChangeSelectedGateIds={(nextIds: unknown) => {
            updateResourceGate(
              resourceKey,
              resolveSessionWizardResourceGateSelectionUpdate({
                nextIds,
                availableGateIds: resourceGateSelectionState.availableGateIds,
                fallbackGateId: resourceGateSelectionState.fallbackGateId,
              }),
            );
          }}
          open={openResourceGateKey === resourceKey}
          onToggleOpen={(nextOpen) => setOpenResourceGateKey(nextOpen ? resourceKey : '')}
          disabled={resourceGateSelectionState.disabled}
        >
          {renderResourceInputs(resourceKey)}
        </WorkerResourceCard>
      );
    },
    [
      defaultGateId,
      gateOptions,
      openResourceGateKey,
      renderInfoTooltip,
      renderResourceInputs,
      resourceGateMap,
      resourceGateOptions,
      setOpenResourceGateKey,
      updateResourceGate,
    ],
  );

  return {
    renderResourceCard,
  };
};

export default useSessionWizardWorkerResourceRenderer;
