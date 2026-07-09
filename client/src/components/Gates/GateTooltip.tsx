import React, { useRef } from 'react';
import { resolveSbtDisplayLabel } from '../../utilities/sbt/sbtDisplayNames.js';
import { t } from '../../utilities/ui/terminology.js';
import CETooltip from '../Shared/CETooltip';

const resolveGateSbtDisplayLabel = resolveSbtDisplayLabel as (args: {
  address: string;
  chainId?: unknown;
  fallback?: string;
}) => string;

type GateConfig = {
  label?: unknown;
  name?: unknown;
  mode?: unknown;
  operator?: unknown;
  gateMode?: unknown;
  requireAll?: boolean;
  sbtAddresses?: unknown;
  sbtAddress?: unknown;
  chainId?: unknown;
};

type HeldSbt =
  | string
  | {
      address?: unknown;
      sbtAddress?: unknown;
      contractAddress?: unknown;
    };

export type GateTooltipProps = {
  gateId?: unknown;
  gateConfig?: GateConfig | null;
  mode?: unknown;
  sbtAddresses?: unknown[] | null;
  userHeldSBTs?: HeldSbt[] | null;
  children?: React.ReactNode;
  placement?: React.ComponentProps<typeof CETooltip>['placement'];
};

const shortAddr = (addr: unknown) => {
  const text = String(addr || '').trim();
  return text.length > 12 ? `${text.slice(0, 6)}...${text.slice(-4)}` : text;
};

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeGateMode = (gateConfig: GateConfig | null = null, fallbackMode: unknown = '') => {
  const raw = normalizeText(
    fallbackMode || gateConfig?.mode || gateConfig?.operator || gateConfig?.gateMode,
  ).toLowerCase();
  if (gateConfig?.requireAll === true || raw === 'all' || raw === 'and') return 'all';
  return 'any';
};

const normalizeHeldAddress = (value: HeldSbt) => {
  if (!value) return '';
  if (typeof value === 'string') return normalizeText(value).toLowerCase();
  return normalizeText(value?.address || value?.sbtAddress || value?.contractAddress).toLowerCase();
};

const collectSbtAddresses = (gateConfig: GateConfig | null = null, sbtAddresses: unknown[] | null = []) => {
  const out: string[] = [];
  const seen = new Set();
  const push = (value: unknown) => {
    const address = normalizeText(value);
    if (!address) return;
    const key = address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(address);
  };

  (Array.isArray(sbtAddresses) ? sbtAddresses : []).forEach(push);
  (Array.isArray(gateConfig?.sbtAddresses) ? gateConfig.sbtAddresses : []).forEach(push);
  push(gateConfig?.sbtAddress);

  return out;
};

const GateTooltip = ({
  gateId,
  gateConfig,
  mode,
  sbtAddresses = [],
  userHeldSBTs = [],
  children,
  placement = 'top',
}: GateTooltipProps) => {
  const tooltipIdRef = useRef(`gate-tooltip-${Math.random().toString(36).slice(2, 10)}`);

  if (children == null) return null;

  const resolvedSbtAddresses = collectSbtAddresses(gateConfig, sbtAddresses);
  if (!gateConfig && !resolvedSbtAddresses.length) return children || null;

  const gateName = normalizeText(gateConfig?.label || gateConfig?.name || gateId) || t('gate');
  const gateMode = normalizeGateMode(gateConfig, mode);
  const heldSet = new Set(
    (Array.isArray(userHeldSBTs) ? userHeldSBTs : []).map((entry) => normalizeHeldAddress(entry)).filter(Boolean),
  );

  return (
    <>
      <span id={tooltipIdRef.current} style={{ cursor: 'help' }}>
        {children}
      </span>
      <CETooltip target={tooltipIdRef.current} placement={placement} fade={false}>
        <div style={{ textAlign: 'left', fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {`${gateName} (${gateMode === 'all' ? 'All required' : 'Any one'})`}
          </div>
          {resolvedSbtAddresses.length > 0 ? (
            resolvedSbtAddresses.map((addr, index) => {
              const name =
                resolveGateSbtDisplayLabel({
                  address: addr,
                  chainId: gateConfig?.chainId || null,
                  fallback: 'short',
                }) || shortAddr(addr);
              const held = heldSet.has(String(addr || '').toLowerCase());

              return (
                <div key={`${addr}-${index}`} style={{ marginLeft: 8 }}>
                  {`${held ? '[held]' : '-'} ${name}`}
                </div>
              );
            })
          ) : (
            <div style={{ opacity: 0.7 }}>{`No ${t('sbt')} requirements found`}</div>
          )}
        </div>
      </CETooltip>
    </>
  );
};

export default GateTooltip;
