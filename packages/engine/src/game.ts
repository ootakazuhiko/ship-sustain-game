import { ASSET_CATALOG, DEFAULT_CONFIG } from './config';
import { nextRandom, seedToState } from './rng';
import type {
  AccidentEntry,
  Capacities,
  EdgeState,
  GameAction,
  GameConfig,
  GameResult,
  GameState,
  NodeState,
  ScenarioData,
  SimulationStrategies,
  Team,
  TeamScore,
} from './types';

function otherTeam(team: Team): Team {
  return team === 'player' ? 'ai' : 'player';
}

function cloneNodes(nodes: NodeState[]): NodeState[] {
  return nodes.map((node) => ({ ...node, assets: [...node.assets] }));
}

function cloneEdges(edges: EdgeState[]): EdgeState[] {
  return edges.map((edge) => ({ ...edge, assets: [...edge.assets] }));
}

function cloneAssetOwners(
  source: Record<string, Record<string, Team | null>>,
): Record<string, Record<string, Team | null>> {
  const cloned: Record<string, Record<string, Team | null>> = {};
  for (const [id, owners] of Object.entries(source)) {
    cloned[id] = { ...owners };
  }
  return cloned;
}

function createInitialAssetOwnersFromNodes(nodes: NodeState[]): Record<string, Record<string, Team | null>> {
  const owners: Record<string, Record<string, Team | null>> = {};
  for (const node of nodes) {
    owners[node.id] = {};
    for (const asset of node.assets) {
      owners[node.id][asset] = null;
    }
  }
  return owners;
}

function createInitialAssetOwnersFromEdges(edges: EdgeState[]): Record<string, Record<string, Team | null>> {
  const owners: Record<string, Record<string, Team | null>> = {};
  for (const edge of edges) {
    owners[edge.id] = {};
    for (const asset of edge.assets) {
      owners[edge.id][asset] = null;
    }
  }
  return owners;
}

function createScore(): Record<Team, TeamScore> {
  return {
    player: { dp: 0, cc: 0, revenue: 0, penalty: 0 },
    ai: { dp: 0, cc: 0, revenue: 0, penalty: 0 },
  };
}

function capAtLeastOne(value: number): number {
  return Math.max(1, value);
}

function connectedEdgeIndices(edges: EdgeState[], nodeId: string): number[] {
  const indices: number[] = [];
  for (let i = 0; i < edges.length; i += 1) {
    if (edges[i].from === nodeId || edges[i].to === nodeId) {
      indices.push(i);
    }
  }
  return indices;
}

function actionToKey(action: GameAction): string {
  if (action.type === 'pass') {
    return 'pass';
  }
  if (action.type === 'work') {
    return `work:${action.mode}:${action.nodeId}`;
  }
  return `invest:${action.kind}:${action.targetType}:${action.targetId}:${action.assetType ?? ''}`;
}

function clampProbability(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 0.95) {
    return 0.95;
  }
  return value;
}

function edgeDebtIncrement(coupling: number, deliverEdgeDebtGain: number): number {
  return Math.max(1, Math.ceil(coupling * deliverEdgeDebtGain));
}

function computeResult(state: GameState): GameResult {
  const totalCC = state.score.player.cc + state.score.ai.cc;
  const divisor = totalCC === 0 ? 1 : totalCC;
  const pool = state.config.sharePoolMultiplier * state.ch;

  const playerRawShare = (pool * state.score.player.cc) / divisor;
  const aiRawShare = (pool * state.score.ai.cc) / divisor;

  const playerShare = Math.min(playerRawShare, state.score.player.dp);
  const aiShare = Math.min(aiRawShare, state.score.ai.dp);

  let playerFinal =
    state.score.player.dp + playerShare + state.score.player.revenue - state.score.player.penalty;
  let aiFinal = state.score.ai.dp + aiShare + state.score.ai.revenue - state.score.ai.penalty;

  const companyFailed = state.ch < state.config.companyFailThreshold;
  if (companyFailed) {
    playerFinal *= state.config.companyFailMultiplier;
    aiFinal *= state.config.companyFailMultiplier;
  }

  const roundedPlayerFinal = Math.round(playerFinal * 100) / 100;
  const roundedAiFinal = Math.round(aiFinal * 100) / 100;

  let winner: Team | 'draw' = 'draw';
  if (roundedPlayerFinal > roundedAiFinal) {
    winner = 'player';
  } else if (roundedAiFinal > roundedPlayerFinal) {
    winner = 'ai';
  }

  return {
    playerFinal: roundedPlayerFinal,
    aiFinal: roundedAiFinal,
    playerShare: Math.round(playerShare * 100) / 100,
    aiShare: Math.round(aiShare * 100) / 100,
    winner,
    companyFailed,
  };
}

function finalizeIfNeeded(state: GameState): GameState {
  if (state.sprint > state.config.maxSprints && state.phase === 'in_progress') {
    const withPhase = { ...state, phase: 'finished' as const };
    return {
      ...withPhase,
      result: computeResult(withPhase),
      logs: [
        ...withPhase.logs,
        {
          sprint: withPhase.config.maxSprints,
          turn: withPhase.turn,
          team: 'player',
          message: 'Game finished',
        },
      ],
    };
  }
  return state;
}

function endSprint(state: GameState): GameState {
  const totalBacklog = state.nodes.reduce((sum, node) => sum + node.backlog, 0);
  const totalIntegrationDebt = state.edges.reduce((sum, edge) => sum + edge.integrationDebt, 0);
  const ownerHotNodes = state.nodes.filter((node) => node.owner !== null && node.backlog > 0).length;
  const chLossOwner = Math.round(ownerHotNodes * state.config.ownerMaintenancePenalty);
  const chLossBacklog = Math.floor(totalBacklog * state.config.chPenaltyBacklogWeight);
  const chLossDebt = Math.floor(totalIntegrationDebt * state.config.chPenaltyDebtWeight);

  let chLossAccident = 0;
  let rngState = state.rngState;
  const accidents: AccidentEntry[] = [];
  const capacityPenalty: Capacities = { player: 0, ai: 0 };

  for (const node of state.nodes) {
    const chance = clampProbability(
      state.config.accidentBaseProbability +
        node.risk * state.config.accidentRiskWeight +
        node.backlog * state.config.accidentBacklogWeight,
    );
    const roll = nextRandom(rngState);
    rngState = roll.nextState;
    if (roll.value >= chance) {
      continue;
    }

    chLossAccident += state.config.accidentChPenalty;
    if (node.owner === null) {
      capacityPenalty.player += 1;
      capacityPenalty.ai += 1;
      accidents.push({
        nodeId: node.id,
        chance: Math.round(chance * 1000) / 1000,
        roll: Math.round(roll.value * 1000) / 1000,
        affectedTeam: 'both',
      });
    } else {
      capacityPenalty[node.owner] += 1;
      accidents.push({
        nodeId: node.id,
        chance: Math.round(chance * 1000) / 1000,
        roll: Math.round(roll.value * 1000) / 1000,
        affectedTeam: node.owner,
      });
    }
  }

  const chLoss = chLossBacklog + chLossDebt + chLossOwner + chLossAccident;
  const nextCH = Math.max(0, state.ch - chLoss);
  const nextSprint = state.sprint + 1;

  const nextState: GameState = {
    ...state,
    sprint: nextSprint,
    turn: state.turn + 1,
    activeTeam: nextSprint % 2 === 1 ? 'player' : 'ai',
    ch: nextCH,
    rngState,
    capacities: {
      player: capAtLeastOne(state.config.baseCapacity - capacityPenalty.player),
      ai: capAtLeastOne(state.config.baseCapacity - capacityPenalty.ai),
    },
    sprintSummaries: [
      ...state.sprintSummaries,
      {
        sprint: state.sprint,
        chLoss,
        chLossBacklog,
        chLossDebt,
        chLossOwner,
        chLossAccident,
        accidentCount: accidents.length,
        accidents,
        totalBacklog,
        totalIntegrationDebt,
      },
    ],
    logs: [
      ...state.logs,
      {
        sprint: state.sprint,
        turn: state.turn,
        team: 'player',
        message: `Sprint ${state.sprint} ended (CH -${chLoss}; backlog:${chLossBacklog}, debt:${chLossDebt}, owner:${chLossOwner}, accident:${chLossAccident}; accidents:${accidents.length})`,
      },
    ],
  };

  return finalizeIfNeeded(nextState);
}

function moveToNextTurn(state: GameState, actingTeam: Team): GameState {
  if (state.capacities.player <= 0 && state.capacities.ai <= 0) {
    return endSprint(state);
  }

  const opposite = otherTeam(actingTeam);
  const oppositeHasCapacity = state.capacities[opposite] > 0;
  const actingHasCapacity = state.capacities[actingTeam] > 0;

  let nextActive: Team = actingTeam;
  if (oppositeHasCapacity) {
    nextActive = opposite;
  } else if (actingHasCapacity) {
    nextActive = actingTeam;
  }

  return {
    ...state,
    activeTeam: nextActive,
    turn: state.turn + 1,
  };
}

function ensureTurnOwner(state: GameState, team: Team): void {
  if (state.phase !== 'in_progress') {
    throw new Error('Game is already finished');
  }
  if (state.activeTeam !== team) {
    throw new Error(`Not ${team} turn`);
  }
}

function ensureHasResources(state: GameState, team: Team, capCost: number, budgetCost = 0): void {
  if (state.capacities[team] < capCost) {
    throw new Error(`Team ${team} has insufficient capacity`);
  }
  if (state.budget[team] < budgetCost) {
    throw new Error(`Team ${team} has insufficient budget`);
  }
}

function nodeIndexById(nodes: NodeState[], nodeId: string): number {
  return nodes.findIndex((node) => node.id === nodeId);
}

function edgeIndexById(edges: EdgeState[], edgeId: string): number {
  return edges.findIndex((edge) => edge.id === edgeId);
}

function withResourceCost(
  state: GameState,
  team: Team,
  capCost: number,
  budgetCost = 0,
): Pick<GameState, 'capacities' | 'budget'> {
  return {
    capacities: {
      ...state.capacities,
      [team]: state.capacities[team] - capCost,
    },
    budget: {
      ...state.budget,
      [team]: state.budget[team] - budgetCost,
    },
  };
}

interface ChargebackResult {
  budget: Capacities;
  score: Record<Team, TeamScore>;
  charged: number;
  details: string[];
  transfers: Array<{ from: Team; to: Team; amount: number }>;
}

interface ChargebackSource {
  label: string;
  ownerMap?: Record<string, Team | null>;
}

function settleChargebackFromSources(
  state: GameState,
  actingTeam: Team,
  sources: ChargebackSource[],
): ChargebackResult {
  if (!state.config.chargebackEnabled || state.config.chargebackPerAssetUse <= 0) {
    return {
      budget: state.budget,
      score: state.score,
      charged: 0,
      details: [],
      transfers: [],
    };
  }

  let payerBudget = state.budget[actingTeam];
  if (payerBudget <= 0) {
    return {
      budget: state.budget,
      score: state.score,
      charged: 0,
      details: [],
      transfers: [],
    };
  }

  const budget: Capacities = { ...state.budget };
  const score: Record<Team, TeamScore> = {
    player: { ...state.score.player },
    ai: { ...state.score.ai },
  };

  const details: string[] = [];
  const transfers: Array<{ from: Team; to: Team; amount: number }> = [];
  let charged = 0;

  for (const source of sources) {
    if (!source.ownerMap) {
      continue;
    }

    for (const recipient of ['player', 'ai'] as const) {
      if (recipient === actingTeam) {
        continue;
      }

      const chargeableAssets = Object.values(source.ownerMap).filter((owner) => owner === recipient).length;
      if (chargeableAssets <= 0) {
        continue;
      }

      const requested = chargeableAssets * state.config.chargebackPerAssetUse;
      const paid = Math.min(requested, payerBudget);
      if (paid <= 0) {
        continue;
      }

      payerBudget -= paid;
      charged += paid;
      budget[actingTeam] -= paid;
      budget[recipient] += paid;
      score[recipient].revenue += paid;
      details.push(`${source.label}:${actingTeam}->${recipient}:${paid}`);
      transfers.push({ from: actingTeam, to: recipient, amount: paid });
    }
  }

  if (charged <= 0) {
    return {
      budget: state.budget,
      score: state.score,
      charged: 0,
      details: [],
      transfers: [],
    };
  }

  return {
    budget,
    score,
    charged,
    details,
    transfers,
  };
}

function countOwnedConnectedEdgeAssets(
  state: GameState,
  team: Team,
  connectedEdgeIndices: number[],
): number {
  let count = 0;
  for (const edgeIndex of connectedEdgeIndices) {
    const edgeId = state.edges[edgeIndex].id;
    const owners = state.edgeAssetOwners[edgeId];
    if (!owners) {
      continue;
    }
    for (const owner of Object.values(owners)) {
      if (owner === team) {
        count += 1;
      }
    }
  }
  return count;
}

function buildWorkChargebackSources(
  state: GameState,
  nodeId: string,
  connectedEdgeIndices: number[],
): ChargebackSource[] {
  const sources: ChargebackSource[] = [
    {
      label: `node:${nodeId}`,
      ownerMap: state.nodeAssetOwners[nodeId],
    },
  ];

  for (const edgeIndex of connectedEdgeIndices) {
    const edgeId = state.edges[edgeIndex].id;
    sources.push({
      label: `edge:${edgeId}`,
      ownerMap: state.edgeAssetOwners[edgeId],
    });
  }

  return sources;
}

export function createInitialState(
  scenario: ScenarioData,
  seed: number,
  overrides?: Partial<GameConfig>,
): GameState {
  const config: GameConfig = { ...DEFAULT_CONFIG, ...overrides };
  const safeSeed = Number.isFinite(seed) ? seed : 1;

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    phase: 'in_progress',
    sprint: 1,
    turn: 1,
    activeTeam: 'player',
    seed: safeSeed,
    rngState: seedToState(safeSeed),
    ch: config.initialCH,
    nodes: cloneNodes(scenario.nodes),
    edges: cloneEdges(scenario.edges),
    capacities: { player: config.baseCapacity, ai: config.baseCapacity },
    budget: { player: config.initialBudget, ai: config.initialBudget },
    nodeAssetOwners: createInitialAssetOwnersFromNodes(scenario.nodes),
    edgeAssetOwners: createInitialAssetOwnersFromEdges(scenario.edges),
    score: createScore(),
    logs: [],
    sprintSummaries: [],
    config,
    result: null,
  };
}

export function listLegalActions(state: GameState, team: Team = state.activeTeam): GameAction[] {
  if (state.phase !== 'in_progress' || state.activeTeam !== team) {
    return [];
  }

  const actions: GameAction[] = [];

  if (state.capacities[team] <= 0) {
    return [{ type: 'pass', reason: 'no_capacity' }];
  }

  for (const node of state.nodes) {
    actions.push({ type: 'work', mode: 'deliver', nodeId: node.id });
    actions.push({ type: 'work', mode: 'sustain', nodeId: node.id });
  }

  if (state.capacities[team] >= 2 && state.budget[team] >= 1) {
    for (const node of state.nodes) {
      if (node.maturity < state.config.maturityMax) {
        actions.push({
          type: 'invest',
          kind: 'maturity',
          targetType: 'node',
          targetId: node.id,
        });
      }

      const availableAsset = ASSET_CATALOG.find((asset) => !node.assets.includes(asset));
      if (availableAsset) {
        actions.push({
          type: 'invest',
          kind: 'asset',
          targetType: 'node',
          targetId: node.id,
          assetType: availableAsset,
        });
      }
    }

    for (const edge of state.edges) {
      const availableAsset = ASSET_CATALOG.find((asset) => !edge.assets.includes(asset));
      if (availableAsset) {
        actions.push({
          type: 'invest',
          kind: 'asset',
          targetType: 'edge',
          targetId: edge.id,
          assetType: availableAsset,
        });
      }
    }
  }

  actions.push({ type: 'pass' });
  return actions;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (state.phase !== 'in_progress') {
    throw new Error('Cannot apply action after game has finished');
  }

  const team = state.activeTeam;
  ensureTurnOwner(state, team);

  const legalActionKeys = new Set(listLegalActions(state, team).map(actionToKey));
  if (!legalActionKeys.has(actionToKey(action))) {
    throw new Error(`Illegal action: ${actionToKey(action)}`);
  }

  if (action.type === 'pass') {
    const passedState: GameState = {
      ...state,
      capacities: {
        ...state.capacities,
        [team]: 0,
      },
      logs: [
        ...state.logs,
        {
          sprint: state.sprint,
          turn: state.turn,
          team,
          message: action.reason ? `Pass (${action.reason})` : 'Pass',
          actionType: 'pass',
          dpDelta: 0,
          ccDelta: 0,
        },
      ],
    };
    return moveToNextTurn(passedState, team);
  }

  const nodes = cloneNodes(state.nodes);
  const edges = cloneEdges(state.edges);
  const nodeAssetOwners = cloneAssetOwners(state.nodeAssetOwners);
  const edgeAssetOwners = cloneAssetOwners(state.edgeAssetOwners);

  if (action.type === 'work') {
    ensureHasResources(state, team, 1);
    const nodeIndex = nodeIndexById(nodes, action.nodeId);
    if (nodeIndex < 0) {
      throw new Error(`Node not found: ${action.nodeId}`);
    }

    const node = { ...nodes[nodeIndex], assets: [...nodes[nodeIndex].assets] };
    nodes[nodeIndex] = node;

    if (action.mode === 'deliver') {
      const connected = connectedEdgeIndices(edges, node.id);
      const ownerBonus = node.owner === team ? state.config.ownerDeliverBonus : 0;
      const ownConnectedEdgeAssets = countOwnedConnectedEdgeAssets(state, team, connected);
      const edgeAssetBonus = ownConnectedEdgeAssets > 0 ? 1 : 0;
      const dpGain = node.demand + node.maturity + ownerBonus + edgeAssetBonus;
      node.backlog += state.config.deliverBacklogGain;
      const chargeback = settleChargebackFromSources(
        state,
        team,
        buildWorkChargebackSources(state, node.id, connected),
      );
      const chargebackText =
        chargeback.charged > 0 ? ` [CB ${chargeback.details.join(',')}]` : '';
      const withChargebackBudget: GameState = {
        ...state,
        budget: chargeback.budget,
      };

      for (const edgeIndex of connected) {
        const edge = { ...edges[edgeIndex], assets: [...edges[edgeIndex].assets] };
        edge.integrationDebt += edgeDebtIncrement(edge.coupling, state.config.deliverEdgeDebtGain);
        edges[edgeIndex] = edge;
      }

      const nextState: GameState = {
        ...state,
        nodes,
        edges,
        ...withResourceCost(withChargebackBudget, team, 1),
        nodeAssetOwners,
        edgeAssetOwners,
        score: {
          ...chargeback.score,
          [team]: {
            ...chargeback.score[team],
            dp: chargeback.score[team].dp + dpGain,
          },
        },
        logs: [
          ...state.logs,
          {
            sprint: state.sprint,
            turn: state.turn,
            team,
            message: `Work Deliver on ${node.name} (+${dpGain} DP${edgeAssetBonus > 0 ? ', edge+1' : ''})${chargebackText}`,
            actionType: 'deliver',
            dpDelta: dpGain,
            ccDelta: 0,
            chargebackPaid: chargeback.charged,
            chargebackTransfers: chargeback.transfers,
          },
        ],
      };

      return moveToNextTurn(nextState, team);
    }

    const beforeBacklog = node.backlog;
    node.backlog = Math.max(0, node.backlog - state.config.sustainBacklogReduction);
    const connected = connectedEdgeIndices(edges, node.id);
    const chargeback = settleChargebackFromSources(
      state,
      team,
      buildWorkChargebackSources(state, node.id, connected),
    );
    const chargebackText = chargeback.charged > 0 ? ` [CB ${chargeback.details.join(',')}]` : '';
    const withChargebackBudget: GameState = {
      ...state,
      budget: chargeback.budget,
    };

    for (const edgeIndex of connected) {
      const edge = { ...edges[edgeIndex], assets: [...edges[edgeIndex].assets] };
      edge.integrationDebt = Math.max(0, edge.integrationDebt - state.config.sustainEdgeDebtReduction);
      edges[edgeIndex] = edge;
    }

    const gainCC = node.risk >= 4 && beforeBacklog > node.backlog && node.backlog <= 2 ? 1 : 0;

    const nextState: GameState = {
      ...state,
      nodes,
      edges,
      ...withResourceCost(withChargebackBudget, team, 1),
      nodeAssetOwners,
      edgeAssetOwners,
      score: {
        ...chargeback.score,
        [team]: {
          ...chargeback.score[team],
          cc: chargeback.score[team].cc + gainCC,
        },
      },
      logs: [
        ...state.logs,
        {
          sprint: state.sprint,
          turn: state.turn,
          team,
          message: `Work Sustain on ${node.name}${gainCC > 0 ? ' (+1 CC)' : ''}${chargebackText}`,
          actionType: 'sustain',
          dpDelta: 0,
          ccDelta: gainCC,
          chargebackPaid: chargeback.charged,
          chargebackTransfers: chargeback.transfers,
        },
        ],
      };

    return moveToNextTurn(nextState, team);
  }

  ensureHasResources(state, team, 2, 1);

  if (action.kind === 'maturity') {
    const nodeIndex = nodeIndexById(nodes, action.targetId);
    if (nodeIndex < 0) {
      throw new Error(`Node not found: ${action.targetId}`);
    }

    const node = { ...nodes[nodeIndex], assets: [...nodes[nodeIndex].assets] };
    if (node.maturity >= state.config.maturityMax) {
      throw new Error(`Node maturity already max: ${node.id}`);
    }
    node.maturity += 1;
    nodes[nodeIndex] = node;

    const nextState: GameState = {
      ...state,
      nodes,
      edges,
      ...withResourceCost(state, team, 2, 1),
      nodeAssetOwners,
      edgeAssetOwners,
      score: {
        ...state.score,
        [team]: {
          ...state.score[team],
          cc: state.score[team].cc + 1,
        },
      },
      logs: [
        ...state.logs,
        {
          sprint: state.sprint,
          turn: state.turn,
          team,
          message: `Invest Maturity on ${node.name} (+1 CC)`,
          actionType: 'invest',
          dpDelta: 0,
          ccDelta: 1,
        },
      ],
    };

    return moveToNextTurn(nextState, team);
  }

  if (!action.assetType) {
    throw new Error('assetType is required for asset investment');
  }

  if (action.targetType === 'node') {
    const nodeIndex = nodeIndexById(nodes, action.targetId);
    if (nodeIndex < 0) {
      throw new Error(`Node not found: ${action.targetId}`);
    }

    const node = { ...nodes[nodeIndex], assets: [...nodes[nodeIndex].assets] };
    if (!node.assets.includes(action.assetType)) {
      node.assets.push(action.assetType);
    }
    nodes[nodeIndex] = node;
    if (!nodeAssetOwners[node.id]) {
      nodeAssetOwners[node.id] = {};
    }
    if (!nodeAssetOwners[node.id][action.assetType]) {
      nodeAssetOwners[node.id][action.assetType] = team;
    }

    const nextState: GameState = {
      ...state,
      nodes,
      edges,
      ...withResourceCost(state, team, 2, 1),
      nodeAssetOwners,
      edgeAssetOwners,
      score: {
        ...state.score,
        [team]: {
          ...state.score[team],
          cc: state.score[team].cc + 1,
        },
      },
      logs: [
        ...state.logs,
        {
          sprint: state.sprint,
          turn: state.turn,
          team,
          message: `Invest Asset(${action.assetType}) on ${node.name} (+1 CC)`,
          actionType: 'invest',
          dpDelta: 0,
          ccDelta: 1,
        },
      ],
    };

    return moveToNextTurn(nextState, team);
  }

  const edgeIndex = edgeIndexById(edges, action.targetId);
  if (edgeIndex < 0) {
    throw new Error(`Edge not found: ${action.targetId}`);
  }

  const edge = { ...edges[edgeIndex], assets: [...edges[edgeIndex].assets] };
  if (!edge.assets.includes(action.assetType)) {
    edge.assets.push(action.assetType);
  }
  edges[edgeIndex] = edge;
  if (!edgeAssetOwners[edge.id]) {
    edgeAssetOwners[edge.id] = {};
  }
  if (!edgeAssetOwners[edge.id][action.assetType]) {
    edgeAssetOwners[edge.id][action.assetType] = team;
  }

  const nextState: GameState = {
    ...state,
    nodes,
    edges,
    ...withResourceCost(state, team, 2, 1),
    nodeAssetOwners,
    edgeAssetOwners,
    score: {
      ...state.score,
      [team]: {
        ...state.score[team],
        cc: state.score[team].cc + 1,
      },
    },
    logs: [
      ...state.logs,
      {
        sprint: state.sprint,
        turn: state.turn,
        team,
        message: `Invest Edge Asset(${action.assetType}) on ${edge.id} (+1 CC)`,
        actionType: 'invest',
        dpDelta: 0,
        ccDelta: 1,
      },
    ],
  };

  return moveToNextTurn(nextState, team);
}

export function simulateGame(initialState: GameState, strategies: SimulationStrategies): GameState {
  let state = initialState;
  let guard = 0;

  while (state.phase === 'in_progress' && guard < 1000) {
    guard += 1;
    const legalActions = listLegalActions(state);
    if (legalActions.length === 0) {
      throw new Error('No legal action available while game is in progress');
    }

    const chooser = state.activeTeam === 'player' ? strategies.player : strategies.ai;
    const requestedAction = chooser(state, legalActions);
    const legalKeys = new Set(legalActions.map(actionToKey));
    const chosenAction = legalKeys.has(actionToKey(requestedAction))
      ? requestedAction
      : legalActions[0];

    state = applyAction(state, chosenAction);
  }

  if (guard >= 1000) {
    throw new Error('Simulation exceeded guard limit');
  }

  return state;
}
