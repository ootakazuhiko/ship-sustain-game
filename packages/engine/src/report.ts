import type { GameState, LogEntry, Team } from './types';

export type PlayerStyle = 'dp_focused' | 'sustain_focused' | 'balanced';

export interface ActionMix {
  deliver: number;
  sustain: number;
  invest: number;
  pass: number;
}

export interface TeamSprintMetrics {
  deliver: number;
  sustain: number;
  invest: number;
  pass: number;
  dpGain: number;
  ccGain: number;
}

export interface SprintMetrics {
  sprint: number;
  chLoss: number;
  chAfter: number;
  player: TeamSprintMetrics;
  ai: TeamSprintMetrics;
}

export interface ChargebackSummary {
  playerPaid: number;
  aiPaid: number;
  playerReceived: number;
  aiReceived: number;
  transferCount: number;
}

export interface ChLossBreakdown {
  backlog: number;
  debt: number;
  owner: number;
  accident: number;
  total: number;
}

export interface BottleneckNode {
  nodeId: string;
  name: string;
  backlog: number;
  risk: number;
  relatedDebt: number;
  score: number;
}

export interface AccidentHotspot {
  nodeId: string;
  name: string;
  count: number;
}

export interface SprintCause {
  sprint: number;
  chLoss: number;
  backlog: number;
  debt: number;
  owner: number;
  accident: number;
  accidentNodes: string[];
}

export type ChPrimaryDriver = 'backlog' | 'debt' | 'owner' | 'accident' | 'none';

export interface PostGameReport {
  style: PlayerStyle;
  styleReason: string;
  actionMix: ActionMix;
  chLossBreakdown: ChLossBreakdown;
  primaryDriver: ChPrimaryDriver;
  bottlenecks: BottleneckNode[];
  accidentHotspots: AccidentHotspot[];
  timeline: SprintCause[];
  sprintMetrics: SprintMetrics[];
  chargebackSummary: ChargebackSummary;
}

function createEmptyActionMix(): ActionMix {
  return {
    deliver: 0,
    sustain: 0,
    invest: 0,
    pass: 0,
  };
}

function createEmptyTeamSprintMetrics(): TeamSprintMetrics {
  return {
    deliver: 0,
    sustain: 0,
    invest: 0,
    pass: 0,
    dpGain: 0,
    ccGain: 0,
  };
}

type CountedAction = keyof ActionMix;

function parseLegacyAction(entry: LogEntry): CountedAction | null {
  if (entry.message.startsWith('Work Deliver')) {
    return 'deliver';
  }
  if (entry.message.startsWith('Work Sustain')) {
    return 'sustain';
  }
  if (entry.message.startsWith('Invest ')) {
    return 'invest';
  }
  if (entry.message.startsWith('Pass')) {
    return 'pass';
  }
  return null;
}

function getCountedAction(entry: LogEntry): CountedAction | null {
  if (entry.actionType === 'deliver') {
    return 'deliver';
  }
  if (entry.actionType === 'sustain') {
    return 'sustain';
  }
  if (entry.actionType === 'invest') {
    return 'invest';
  }
  if (entry.actionType === 'pass') {
    return 'pass';
  }
  return parseLegacyAction(entry);
}

function incrementActionMix(mix: ActionMix, action: CountedAction): void {
  mix[action] += 1;
}

function incrementTeamMetrics(teamMetrics: TeamSprintMetrics, entry: LogEntry, action: CountedAction): void {
  teamMetrics[action] += 1;
  teamMetrics.dpGain += entry.dpDelta ?? 0;
  teamMetrics.ccGain += entry.ccDelta ?? 0;
}

function collectPlayerActionMix(state: GameState): ActionMix {
  const mix = createEmptyActionMix();

  for (const entry of state.logs) {
    if (entry.team !== 'player') {
      continue;
    }

    const action = getCountedAction(entry);
    if (action) {
      incrementActionMix(mix, action);
    }
  }

  return mix;
}

function classifyStyle(mix: ActionMix): { style: PlayerStyle; styleReason: string } {
  const nonPassActions = mix.deliver + mix.sustain + mix.invest;
  if (nonPassActions === 0) {
    return {
      style: 'balanced',
      styleReason: 'No non-pass action was recorded for player.',
    };
  }

  const deliverShare = mix.deliver / nonPassActions;
  const sustainShare = (mix.sustain + mix.invest) / nonPassActions;
  const workSustainShare = mix.sustain / nonPassActions;
  const investShare = mix.invest / nonPassActions;

  if (deliverShare >= 0.7) {
    return {
      style: 'dp_focused',
      styleReason: `Deliver share ${(deliverShare * 100).toFixed(1)}% (Sustain ${(
        workSustainShare * 100
      ).toFixed(1)}%, Invest ${(investShare * 100).toFixed(1)}%).`,
    };
  }

  if (sustainShare >= 0.7 && mix.deliver <= mix.sustain + mix.invest) {
    return {
      style: 'sustain_focused',
      styleReason: `Sustain+Invest share ${(sustainShare * 100).toFixed(1)}% (Deliver ${(
        deliverShare * 100
      ).toFixed(1)}%).`,
    };
  }

  return {
    style: 'balanced',
    styleReason: `Deliver share ${(deliverShare * 100).toFixed(1)}%, Sustain+Invest share ${(sustainShare * 100).toFixed(1)}%.`,
  };
}

function collectChLossBreakdown(state: GameState): ChLossBreakdown {
  let backlog = 0;
  let debt = 0;
  let owner = 0;
  let accident = 0;

  for (const summary of state.sprintSummaries) {
    backlog += summary.chLossBacklog;
    debt += summary.chLossDebt;
    owner += summary.chLossOwner;
    accident += summary.chLossAccident;
  }

  return {
    backlog,
    debt,
    owner,
    accident,
    total: backlog + debt + owner + accident,
  };
}

function collectBottlenecks(state: GameState): BottleneckNode[] {
  const relatedDebt = new Map<string, number>();

  for (const edge of state.edges) {
    relatedDebt.set(edge.from, (relatedDebt.get(edge.from) ?? 0) + edge.integrationDebt);
    relatedDebt.set(edge.to, (relatedDebt.get(edge.to) ?? 0) + edge.integrationDebt);
  }

  const scored = state.nodes
    .map((node) => {
      const debt = relatedDebt.get(node.id) ?? 0;
      const score = Math.round((node.backlog * 2 + node.risk + debt * 0.3) * 100) / 100;
      return {
        nodeId: node.id,
        name: node.name,
        backlog: node.backlog,
        risk: node.risk,
        relatedDebt: Math.round(debt * 100) / 100,
        score,
      };
    })
    .filter((row) => row.backlog > 0 || row.relatedDebt > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored;
}

function collectAccidentHotspots(state: GameState): AccidentHotspot[] {
  const counts = new Map<string, number>();

  for (const summary of state.sprintSummaries) {
    for (const accident of summary.accidents) {
      counts.set(accident.nodeId, (counts.get(accident.nodeId) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([nodeId, count]) => {
      const node = state.nodes.find((candidate) => candidate.id === nodeId);
      return {
        nodeId,
        name: node?.name ?? nodeId,
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function collectTimeline(state: GameState): SprintCause[] {
  return state.sprintSummaries.map((summary) => ({
    sprint: summary.sprint,
    chLoss: summary.chLoss,
    backlog: summary.chLossBacklog,
    debt: summary.chLossDebt,
    owner: summary.chLossOwner,
    accident: summary.chLossAccident,
    accidentNodes: [...new Set(summary.accidents.map((accident) => accident.nodeId))],
  }));
}

function createEmptySprintMetricsByTeam() {
  return {
    player: createEmptyTeamSprintMetrics(),
    ai: createEmptyTeamSprintMetrics(),
  };
}

function collectSprintMetrics(state: GameState): SprintMetrics[] {
  const sprintMap = new Map<number, ReturnType<typeof createEmptySprintMetricsByTeam>>();
  for (const summary of state.sprintSummaries) {
    sprintMap.set(summary.sprint, createEmptySprintMetricsByTeam());
  }

  for (const entry of state.logs) {
    const action = getCountedAction(entry);
    if (!action) {
      continue;
    }

    const row = sprintMap.get(entry.sprint);
    if (!row) {
      continue;
    }

    const team = entry.team as Team;
    incrementTeamMetrics(row[team], entry, action);
  }

  let currentCh = state.config.initialCH;
  return state.sprintSummaries.map((summary) => {
    currentCh = Math.max(0, currentCh - summary.chLoss);
    const metrics = sprintMap.get(summary.sprint) ?? createEmptySprintMetricsByTeam();
    return {
      sprint: summary.sprint,
      chLoss: summary.chLoss,
      chAfter: currentCh,
      player: metrics.player,
      ai: metrics.ai,
    };
  });
}

function collectChargebackSummary(state: GameState): ChargebackSummary {
  let playerPaid = 0;
  let aiPaid = 0;
  let playerReceived = 0;
  let aiReceived = 0;
  let transferCount = 0;

  for (const entry of state.logs) {
    if (!entry.chargebackTransfers || entry.chargebackTransfers.length === 0) {
      continue;
    }

    for (const transfer of entry.chargebackTransfers) {
      transferCount += 1;
      if (transfer.from === 'player') {
        playerPaid += transfer.amount;
      } else {
        aiPaid += transfer.amount;
      }

      if (transfer.to === 'player') {
        playerReceived += transfer.amount;
      } else {
        aiReceived += transfer.amount;
      }
    }
  }

  return {
    playerPaid,
    aiPaid,
    playerReceived,
    aiReceived,
    transferCount,
  };
}

function detectPrimaryDriver(breakdown: ChLossBreakdown): ChPrimaryDriver {
  const entries: Array<{ key: ChPrimaryDriver; value: number }> = [
    { key: 'backlog', value: breakdown.backlog },
    { key: 'debt', value: breakdown.debt },
    { key: 'owner', value: breakdown.owner },
    { key: 'accident', value: breakdown.accident },
  ];

  entries.sort((a, b) => b.value - a.value);
  if (entries[0].value <= 0) {
    return 'none';
  }
  return entries[0].key;
}

export function buildPostGameReport(state: GameState): PostGameReport {
  const actionMix = collectPlayerActionMix(state);
  const style = classifyStyle(actionMix);
  const chLossBreakdown = collectChLossBreakdown(state);
  const timeline = collectTimeline(state);
  const sprintMetrics = collectSprintMetrics(state);
  const chargebackSummary = collectChargebackSummary(state);

  return {
    style: style.style,
    styleReason: style.styleReason,
    actionMix,
    chLossBreakdown,
    primaryDriver: detectPrimaryDriver(chLossBreakdown),
    bottlenecks: collectBottlenecks(state),
    accidentHotspots: collectAccidentHotspots(state),
    timeline,
    sprintMetrics,
    chargebackSummary,
  };
}
