export type Team = 'player' | 'ai';

export type NodeOwner = Team | null;

export interface NodeState {
  id: string;
  name: string;
  demand: number;
  risk: number;
  maturity: number;
  backlog: number;
  owner: NodeOwner;
  assets: string[];
}

export interface EdgeState {
  id: string;
  from: string;
  to: string;
  coupling: number;
  integrationDebt: number;
  assets: string[];
}

export interface ScenarioData {
  id: string;
  name: string;
  nodes: NodeState[];
  edges: EdgeState[];
}

export interface TeamScore {
  dp: number;
  cc: number;
  revenue: number;
  penalty: number;
}

export interface Capacities {
  player: number;
  ai: number;
}

export interface GameConfig {
  maxSprints: number;
  baseCapacity: number;
  initialBudget: number;
  initialCH: number;
  maturityMax: number;
  deliverBacklogGain: number;
  deliverEdgeDebtGain: number;
  sustainBacklogReduction: number;
  sustainEdgeDebtReduction: number;
  ownerDeliverBonus: number;
  ownerMaintenancePenalty: number;
  chPenaltyBacklogWeight: number;
  chPenaltyDebtWeight: number;
  accidentBaseProbability: number;
  accidentRiskWeight: number;
  accidentBacklogWeight: number;
  accidentChPenalty: number;
  sharePoolMultiplier: number;
  companyFailThreshold: number;
  companyFailMultiplier: number;
  chargebackEnabled: boolean;
  chargebackPerAssetUse: number;
}

export interface LogEntry {
  sprint: number;
  turn: number;
  team: Team;
  message: string;
  actionType?: 'deliver' | 'sustain' | 'invest' | 'pass';
  dpDelta?: number;
  ccDelta?: number;
  chargebackPaid?: number;
  chargebackTransfers?: Array<{
    from: Team;
    to: Team;
    amount: number;
  }>;
  decisionTrace?: {
    profile?: string;
    lookaheadDepth: number;
    topK: number;
    chosenAction: string;
    score: number;
    localScore: number;
    lookaheadScore: number;
    candidates: Array<{
      action: string;
      score: number;
      localScore: number;
      futureScore: number;
    }>;
  };
}

export interface AccidentEntry {
  nodeId: string;
  chance: number;
  roll: number;
  affectedTeam: Team | 'both';
}

export interface SprintSummary {
  sprint: number;
  chLoss: number;
  chLossBacklog: number;
  chLossDebt: number;
  chLossOwner: number;
  chLossAccident: number;
  accidentCount: number;
  accidents: AccidentEntry[];
  totalBacklog: number;
  totalIntegrationDebt: number;
}

export interface GameResult {
  playerFinal: number;
  aiFinal: number;
  playerShare: number;
  aiShare: number;
  winner: Team | 'draw';
  companyFailed: boolean;
}

export interface GameState {
  scenarioId: string;
  scenarioName: string;
  phase: 'in_progress' | 'finished';
  sprint: number;
  turn: number;
  activeTeam: Team;
  seed: number;
  rngState: number;
  ch: number;
  nodes: NodeState[];
  edges: EdgeState[];
  capacities: Capacities;
  budget: Capacities;
  nodeAssetOwners: Record<string, Record<string, Team | null>>;
  edgeAssetOwners: Record<string, Record<string, Team | null>>;
  score: Record<Team, TeamScore>;
  logs: LogEntry[];
  sprintSummaries: SprintSummary[];
  config: GameConfig;
  result: GameResult | null;
}

export type WorkMode = 'deliver' | 'sustain';
export type InvestKind = 'maturity' | 'asset';

export interface PassAction {
  type: 'pass';
  reason?: string;
}

export interface WorkAction {
  type: 'work';
  mode: WorkMode;
  nodeId: string;
}

export interface InvestAction {
  type: 'invest';
  kind: InvestKind;
  targetType: 'node' | 'edge';
  targetId: string;
  assetType?: string;
}

export type GameAction = PassAction | WorkAction | InvestAction;

export interface SimulationStrategies {
  player: (state: GameState, legalActions: GameAction[]) => GameAction;
  ai: (state: GameState, legalActions: GameAction[]) => GameAction;
}
