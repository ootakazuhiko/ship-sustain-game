import type { GameConfig } from './types';

export const DEFAULT_CONFIG: GameConfig = {
  maxSprints: 4,
  baseCapacity: 6,
  initialBudget: 4,
  initialCH: 80,
  maturityMax: 3,
  deliverBacklogGain: 1,
  deliverEdgeDebtGain: 0.5,
  sustainBacklogReduction: 2,
  sustainEdgeDebtReduction: 2,
  ownerDeliverBonus: 1,
  ownerMaintenancePenalty: 0.3,
  chPenaltyBacklogWeight: 0.12,
  chPenaltyDebtWeight: 0.03,
  accidentBaseProbability: 0.005,
  accidentRiskWeight: 0.015,
  accidentBacklogWeight: 0.006,
  accidentChPenalty: 2,
  sharePoolMultiplier: 5,
  companyFailThreshold: 40,
  companyFailMultiplier: 0.5,
  chargebackEnabled: false,
  chargebackPerAssetUse: 1,
};

export const ASSET_CATALOG = ['observability', 'security-scan', 'ci-cd', 'template'] as const;
