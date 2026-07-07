import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faCaretUp, faCheck, faCopy } from '@fortawesome/free-solid-svg-icons';
import { getShortenedAddress } from '../../utilities/ui/displayHelpers.js';
import { notify } from '../../utilities/ui/notify.js';
import {
  CONTRACT_VIEWER_SECTION_TESTID,
  CONTRACT_VIEWER_TOGGLE_TESTID,
  getContractSourcePanelId,
  getContractViewerCardTestId,
  getContractViewerSourceTestId,
  normalizeContractKeyParam,
} from './contractMetadata.js';
import styles from './ContractPage.module.scss';

type ContractAddressEntry = {
  address: string;
  id?: number;
  testnet?: boolean;
  explorerUrl?: string;
};

export type ContractViewerContract = {
  key: string;
  name: string;
  explainer?: React.ReactNode;
  sourceFile?: string;
  source?: string;
  extraAction?: React.ReactNode;
  addresses?: ContractAddressEntry[];
};

type ContractViewerProps = {
  contracts?: ContractViewerContract[];
  variant?: 'full' | 'compact';
  autoOpenContractKey?: string;
  renderSourceHeaderActions?: (contract: ContractViewerContract) => React.ReactNode;
  onClose?: () => void;
};

const ContractViewer = ({
  contracts = [],
  variant = 'full',
  autoOpenContractKey = '',
  renderSourceHeaderActions,
  onClose,
}: ContractViewerProps) => {
  const isCompact = variant === 'compact';
  const [contractsOpen, setContractsOpen] = useState(true);
  const [openContracts, setOpenContracts] = useState<Record<string, boolean>>({});
  const [copiedContractKey, setCopiedContractKey] = useState('');
  const copyResetTimersRef = useRef<Map<string, ReturnType<typeof window.setTimeout>>>(new Map());
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autoScrolledContractRef = useRef('');
  const normalizedAutoOpenContractKey = normalizeContractKeyParam(autoOpenContractKey);

  useEffect(
    () => () => {
      copyResetTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      copyResetTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!isCompact) return;
    const nextOpenContracts: Record<string, boolean> = {};
    contracts.forEach((contract) => {
      nextOpenContracts[contract.key] = true;
    });
    setContractsOpen(true);
    setOpenContracts(nextOpenContracts);
  }, [contracts, isCompact]);

  useEffect(() => {
    autoScrolledContractRef.current = '';
  }, [normalizedAutoOpenContractKey]);

  useEffect(() => {
    if (!normalizedAutoOpenContractKey) return;
    if (!contracts.some((contract) => contract.key === normalizedAutoOpenContractKey)) return;

    setContractsOpen(true);
    setOpenContracts((prev) =>
      prev[normalizedAutoOpenContractKey] ? prev : { ...prev, [normalizedAutoOpenContractKey]: true },
    );
  }, [contracts, normalizedAutoOpenContractKey]);

  useEffect(() => {
    if (isCompact || !normalizedAutoOpenContractKey) return undefined;
    if (!contractsOpen || !openContracts[normalizedAutoOpenContractKey]) return undefined;
    if (autoScrolledContractRef.current === normalizedAutoOpenContractKey) return undefined;

    const targetNode =
      sourceRefs.current[normalizedAutoOpenContractKey] || cardRefs.current[normalizedAutoOpenContractKey];
    if (!targetNode?.scrollIntoView) return undefined;

    autoScrolledContractRef.current = normalizedAutoOpenContractKey;
    const timeoutId = window.setTimeout(() => {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [contractsOpen, isCompact, normalizedAutoOpenContractKey, openContracts]);

  const scheduleCopyReset = useCallback((key: string, resetFn: () => void, delayMs = 1500) => {
    const timers = copyResetTimersRef.current;
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const timeoutId = setTimeout(
      () => {
        timers.delete(key);
        resetFn();
      },
      Math.max(0, Number(delayMs) || 0),
    );
    timers.set(key, timeoutId);
  }, []);

  const handleCopyContract = useCallback(
    (contractKey: string, source?: string) => {
      if (!source || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
      navigator.clipboard
        .writeText(source)
        .then(() => {
          notify.success('Copied to clipboard');
          setCopiedContractKey(contractKey);
          scheduleCopyReset('copiedContractKey', () => setCopiedContractKey(''));
        })
        .catch((error) => {
          void error;
          notify.warn('Copy failed');
        });
    },
    [scheduleCopyReset],
  );

  const handleContractToggle = useCallback(
    (contractKey: string) => {
      if (isCompact) return;
      setOpenContracts((prev) => ({
        ...prev,
        [contractKey]: !prev[contractKey],
      }));
    },
    [isCompact],
  );

  const handleContractKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, contractKey: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleContractToggle(contractKey);
      }
    },
    [handleContractToggle],
  );

  const isContractOpen = useCallback(
    (contractKey: string) => isCompact || !!openContracts[contractKey],
    [isCompact, openContracts],
  );

  const contractList = (
    <div className={`${styles.contractList} ${isCompact ? styles.contractListCompact : ''}`}>
      {contracts.length ? (
        contracts.map((contract) => {
          const isOpen = isContractOpen(contract.key);
          const cardClassName = [
            styles.contractCard,
            isOpen ? styles.contractCardOpen : '',
            isCompact ? styles.contractCardCompact : '',
          ]
            .filter(Boolean)
            .join(' ');
          const interactiveProps: React.HTMLAttributes<HTMLDivElement> = isCompact
            ? {}
            : {
                role: 'button',
                tabIndex: 0,
                onClick: () => handleContractToggle(contract.key),
                onKeyDown: (event) => handleContractKeyDown(event, contract.key),
                'aria-expanded': isOpen,
                'aria-controls': getContractSourcePanelId(contract.key),
              };

          return (
            <div
              key={contract.key}
              ref={(node) => {
                cardRefs.current[contract.key] = node;
              }}
              data-testid={getContractViewerCardTestId(contract.key)}
              className={cardClassName}
              {...interactiveProps}
            >
              <div className={styles.contractTitle}>{contract.name}</div>
              <div className={styles.contractHeader}>
                {(contract.addresses || []).map((addressEntry, index) => (
                  <div
                    key={`${contract.key}-${index}`}
                    className={styles.contractAddress}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {getShortenedAddress(addressEntry.address, true, addressEntry.explorerUrl)}
                    {addressEntry.testnet && <span className={styles.testnetLabel}> (Testnet)</span>}
                  </div>
                ))}
              </div>
              <div className={styles.contractDetails}>
                <ul>
                  <li>{contract.explainer}</li>
                </ul>
                {contract.extraAction && (
                  <div className={styles.sbtButton} onClick={(event) => event.stopPropagation()}>
                    {contract.extraAction}
                  </div>
                )}
              </div>
              {!isCompact && (
                <div className={styles.contractToggleRow}>
                  <span>{isOpen ? 'Hide' : 'View'}</span>
                  <FontAwesomeIcon icon={isOpen ? faCaretUp : faCaretDown} className={styles.contractToggleIcon} />
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className={styles.contractEmptyState}>No smart contract details are available for this session yet.</div>
      )}
    </div>
  );

  const contractSources = (
    <div className={`${styles.contractSources} ${isCompact ? styles.contractSourcesCompact : ''}`}>
      {contracts.map((contract) => {
        if (!contract.source || !isContractOpen(contract.key)) return null;

        return (
          <div
            key={contract.key}
            id={getContractSourcePanelId(contract.key)}
            ref={(node) => {
              sourceRefs.current[contract.key] = node;
            }}
            data-testid={getContractViewerSourceTestId(contract.key)}
            className={`${styles.contractSourceWindow} ${isCompact ? styles.contractSourceWindowCompact : ''}`}
          >
            <div className={`${styles.contractSourceHeader} ${isCompact ? styles.contractSourceHeaderCompact : ''}`}>
              <div className={styles.windowControls}>
                <span className={styles.windowDot} />
                <span className={styles.windowDot} />
                <span className={styles.windowDot} />
              </div>
              <div className={styles.contractSourceTitle}>
                <span>{contract.name}</span>
                {contract.sourceFile && <span className={styles.contractSourceFile}>{contract.sourceFile}</span>}
              </div>
              <div className={styles.contractSourceActions}>
                {renderSourceHeaderActions?.(contract)}
                <button
                  type="button"
                  className={`${styles.copyButton} ${copiedContractKey === contract.key ? styles.copyButtonSuccess : ''}`}
                  onClick={() => handleCopyContract(contract.key, contract.source)}
                  aria-label="Copy contract source"
                  title="Copy contract source"
                >
                  <FontAwesomeIcon icon={copiedContractKey === contract.key ? faCheck : faCopy} />
                </button>
                {isCompact ? (
                  onClose && (
                    <button type="button" className={styles.collapseButton} onClick={onClose}>
                      Close
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={styles.collapseButton}
                    onClick={() => handleContractToggle(contract.key)}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
            <pre className={`${styles.codeBlock} ${isCompact ? styles.codeBlockCompact : ''}`}>
              <code>{contract.source}</code>
            </pre>
          </div>
        );
      })}
    </div>
  );

  if (isCompact) {
    return (
      <div className={styles.compactContractViewer} data-testid={CONTRACT_VIEWER_SECTION_TESTID}>
        {contractList}
        {contractSources}
      </div>
    );
  }

  return (
    <div className={styles.contractsSection} data-testid={CONTRACT_VIEWER_SECTION_TESTID}>
      <button
        type="button"
        className={styles.contractsToggle}
        onClick={() => setContractsOpen((prev) => !prev)}
        aria-expanded={contractsOpen}
        aria-controls="contract-section"
        data-testid={CONTRACT_VIEWER_TOGGLE_TESTID}
      >
        <span className={styles.contractsToggleLabel}>Smart Contracts</span>
        <span className={styles.contractsToggleIcon}>
          <FontAwesomeIcon icon={contractsOpen ? faCaretUp : faCaretDown} />
        </span>
      </button>
      {contractsOpen && (
        <div id="contract-section" className={styles.contractsContent}>
          {contractList}
          {contractSources}
        </div>
      )}
    </div>
  );
};

export default ContractViewer;
