import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDecisionTraceEntry, chooseAction, type AIChooseOptions } from '@ship/ai';
import {
  applyAction,
  buildPostGameReport,
  createInitialState,
  defaultScenario,
  type GameState,
} from '@ship/engine';

interface StrategyPreset {
  id: string;
  options: AIChooseOptions;
}

interface Matchup {
  id: string;
  playerStrategy: string;
  aiStrategy: string;
}

interface RunSummary {
  runId: string;
  seed: number;
  matchup: string;
  playerStrategy: string;
  aiStrategy: string;
  winnerTeam: string;
  winnerStrategy: string;
  companyFailed: boolean;
  playerFinal: number;
  aiFinal: number;
  ch: number;
  style: string;
  chLossBacklog: number;
  chLossDebt: number;
  chLossOwner: number;
  chLossAccident: number;
  playerDecisionCount: number;
  aiDecisionCount: number;
  playerRevenue: number;
  aiRevenue: number;
  chargebackTransfers: number;
  playerDeliverCount: number;
  playerSustainCount: number;
  playerInvestNodeCount: number;
  playerInvestEdgeCount: number;
  playerInvestMaturityCount: number;
  playerPassCount: number;
  aiDeliverCount: number;
  aiSustainCount: number;
  aiInvestNodeCount: number;
  aiInvestEdgeCount: number;
  aiInvestMaturityCount: number;
  aiPassCount: number;
}

interface MatchSimulationResult {
  finalState: GameState;
  decisionTrace: ReturnType<typeof buildDecisionTraceEntry>[];
}

interface ActionMixCounts {
  deliver: number;
  sustain: number;
  investNode: number;
  investEdge: number;
  investMaturity: number;
  pass: number;
  turns: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'playlogs');
const enableChargeback = process.env.EVAL_CHARGEBACK === '1';
const outputPrefix = enableChargeback ? 'v2-chargeback' : 'v1';
const configOverrides = enableChargeback
  ? {
      chargebackEnabled: true,
      chargebackPerAssetUse: 1,
    }
  : undefined;

const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const baseStrategyPresets: StrategyPreset[] = [
  {
    id: 'delivery_push',
    options: {
      weights: {
        dpWeight: 1.62,
        ccWeight: 1.05,
        riskAversion: 1.05,
      },
      lookaheadDepth: 0,
      topK: 12,
      futureDiscount: 0.85,
    },
  },
  {
    id: 'risk_aware',
    options: {
      weights: {
        dpWeight: 1.45,
        ccWeight: 1.2,
        riskAversion: 1.4,
      },
      opponentWeights: {
        dpWeight: 1.62,
        ccWeight: 1.05,
        riskAversion: 1.05,
      },
      lookaheadDepth: 1,
      topK: 10,
      futureDiscount: 0.9,
    },
  },
];

const chargebackStrategyPresets: StrategyPreset[] = [
  {
    id: 'asset_builder',
    options: {
      weights: {
        dpWeight: 1.4,
        ccWeight: 1.15,
        riskAversion: 1.2,
        leverageWeight: 0.5,
        thresholdRiskWeight: 0.85,
        revenueWeight: 1.0,
        budgetWeight: 0.4,
        chargebackRentWeight: 0.6,
      },
      opponentWeights: {
        dpWeight: 1.62,
        ccWeight: 1.05,
        riskAversion: 1.05,
      },
      lookaheadDepth: 1,
      topK: 12,
      futureDiscount: 0.9,
      edgeRentTargetMultiplier: 2.8,
      chargebackRentCap: 3.2,
    },
  },
  {
    id: 'asset_consumer',
    options: {
      weights: {
        dpWeight: 1.45,
        ccWeight: 0.95,
        riskAversion: 1.1,
        leverageWeight: 0.1,
        thresholdRiskWeight: 0.8,
        revenueWeight: 0.6,
        budgetWeight: 0.08,
        chargebackRentWeight: 0.05,
      },
      lookaheadDepth: 0,
      topK: 12,
      futureDiscount: 0.85,
    },
  },
];

const baseMatchups: Matchup[] = [
  {
    id: 'delivery_vs_risk',
    playerStrategy: 'delivery_push',
    aiStrategy: 'risk_aware',
  },
  {
    id: 'risk_vs_delivery',
    playerStrategy: 'risk_aware',
    aiStrategy: 'delivery_push',
  },
];

const chargebackMatchups: Matchup[] = [
  {
    id: 'builder_vs_consumer',
    playerStrategy: 'asset_builder',
    aiStrategy: 'asset_consumer',
  },
  {
    id: 'consumer_vs_builder',
    playerStrategy: 'asset_consumer',
    aiStrategy: 'asset_builder',
  },
];

const strategyPresets = enableChargeback
  ? [...baseStrategyPresets, ...chargebackStrategyPresets]
  : baseStrategyPresets;
const matchups = enableChargeback ? [...baseMatchups, ...chargebackMatchups] : baseMatchups;

function findStrategy(id: string): StrategyPreset {
  const found = strategyPresets.find((strategy) => strategy.id === id);
  if (!found) {
    throw new Error(`Unknown strategy: ${id}`);
  }
  return found;
}

function runMatch(
  seed: number,
  playerStrategy: StrategyPreset,
  aiStrategy: StrategyPreset,
): MatchSimulationResult {
  let state = createInitialState(defaultScenario, seed, configOverrides);
  const decisionTrace: ReturnType<typeof buildDecisionTraceEntry>[] = [];
  let guard = 0;

  while (state.phase === 'in_progress' && guard < 1000) {
    guard += 1;
    const strategy = state.activeTeam === 'player' ? playerStrategy : aiStrategy;
    const decision = chooseAction(state, strategy.options);
    decisionTrace.push(buildDecisionTraceEntry(state, decision));
    state = applyAction(state, decision.action);
  }

  if (guard >= 1000) {
    throw new Error(`Simulation guard exceeded for seed ${seed}`);
  }

  return { finalState: state, decisionTrace };
}

function createEmptyActionMixCounts(): ActionMixCounts {
  return {
    deliver: 0,
    sustain: 0,
    investNode: 0,
    investEdge: 0,
    investMaturity: 0,
    pass: 0,
    turns: 0,
  };
}

function collectActionMix(
  trace: ReturnType<typeof buildDecisionTraceEntry>[],
  team: 'player' | 'ai',
): ActionMixCounts {
  const mix = createEmptyActionMixCounts();
  for (const row of trace) {
    if (row.team !== team) {
      continue;
    }

    mix.turns += 1;
    if (row.actionKey.startsWith('work:deliver:')) {
      mix.deliver += 1;
    } else if (row.actionKey.startsWith('work:sustain:')) {
      mix.sustain += 1;
    } else if (row.actionKey.startsWith('invest:asset:node:')) {
      mix.investNode += 1;
    } else if (row.actionKey.startsWith('invest:asset:edge:')) {
      mix.investEdge += 1;
    } else if (row.actionKey.startsWith('invest:maturity:node:')) {
      mix.investMaturity += 1;
    } else if (row.actionKey === 'pass') {
      mix.pass += 1;
    }
  }
  return mix;
}

function mergeActionMix(target: ActionMixCounts, source: ActionMixCounts): void {
  target.deliver += source.deliver;
  target.sustain += source.sustain;
  target.investNode += source.investNode;
  target.investEdge += source.investEdge;
  target.investMaturity += source.investMaturity;
  target.pass += source.pass;
  target.turns += source.turns;
}

function toMarkdown(runs: RunSummary[]): string {
  const totalRuns = runs.length;
  const playerWins = runs.filter((run) => run.winnerTeam === 'player').length;
  const aiWins = runs.filter((run) => run.winnerTeam === 'ai').length;
  const draws = runs.filter((run) => run.winnerTeam === 'draw').length;
  const companyFails = runs.filter((run) => run.companyFailed).length;
  const failRate = companyFails / totalRuns;

  const avgCH = runs.reduce((sum, run) => sum + run.ch, 0) / totalRuns;
  const avgPlayerFinal = runs.reduce((sum, run) => sum + run.playerFinal, 0) / totalRuns;
  const avgAiFinal = runs.reduce((sum, run) => sum + run.aiFinal, 0) / totalRuns;
  const avgPlayerDecisionCount = runs.reduce((sum, run) => sum + run.playerDecisionCount, 0) / totalRuns;
  const avgAiDecisionCount = runs.reduce((sum, run) => sum + run.aiDecisionCount, 0) / totalRuns;
  const avgPlayerRevenue = runs.reduce((sum, run) => sum + run.playerRevenue, 0) / totalRuns;
  const avgAiRevenue = runs.reduce((sum, run) => sum + run.aiRevenue, 0) / totalRuns;
  const avgChargebackTransfers =
    runs.reduce((sum, run) => sum + run.chargebackTransfers, 0) / totalRuns;

  const strategyWins = runs.reduce(
    (acc, run) => {
      acc[run.winnerStrategy] = (acc[run.winnerStrategy] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const winningStrategies = Object.keys(strategyWins).filter((key) => key !== 'draw');

  const styleCount = runs.reduce(
    (acc, run) => {
      acc[run.style] = (acc[run.style] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const chLossBacklogAvg = runs.reduce((sum, run) => sum + run.chLossBacklog, 0) / totalRuns;
  const chLossDebtAvg = runs.reduce((sum, run) => sum + run.chLossDebt, 0) / totalRuns;
  const chLossOwnerAvg = runs.reduce((sum, run) => sum + run.chLossOwner, 0) / totalRuns;
  const chLossAccidentAvg = runs.reduce((sum, run) => sum + run.chLossAccident, 0) / totalRuns;
  const strategyActionMix = strategyPresets.reduce(
    (acc, strategy) => {
      acc[strategy.id] = createEmptyActionMixCounts();
      return acc;
    },
    {} as Record<string, ActionMixCounts>,
  );

  for (const run of runs) {
    mergeActionMix(strategyActionMix[run.playerStrategy], {
      deliver: run.playerDeliverCount,
      sustain: run.playerSustainCount,
      investNode: run.playerInvestNodeCount,
      investEdge: run.playerInvestEdgeCount,
      investMaturity: run.playerInvestMaturityCount,
      pass: run.playerPassCount,
      turns: run.playerDecisionCount,
    });
    mergeActionMix(strategyActionMix[run.aiStrategy], {
      deliver: run.aiDeliverCount,
      sustain: run.aiSustainCount,
      investNode: run.aiInvestNodeCount,
      investEdge: run.aiInvestEdgeCount,
      investMaturity: run.aiInvestMaturityCount,
      pass: run.aiPassCount,
      turns: run.aiDecisionCount,
    });
  }

  const lines: string[] = [];
  lines.push(`# ${outputPrefix} balance simulation summary`);
  lines.push('');
  lines.push(`- Run date: ${new Date().toISOString()}`);
  lines.push(`- Seeds: ${seeds.join(', ')}`);
  lines.push(`- Matchups: ${matchups.map((matchup) => matchup.id).join(', ')}`);
  lines.push(`- Player wins / AI wins / Draws: ${playerWins} / ${aiWins} / ${draws}`);
  lines.push(`- Company failed count (CH < 40): ${companyFails}/${totalRuns}`);
  lines.push(`- Company failed rate: ${(failRate * 100).toFixed(1)}%`);
  lines.push(`- Average final score: player ${avgPlayerFinal.toFixed(2)}, ai ${avgAiFinal.toFixed(2)}`);
  lines.push(`- Average CH end: ${avgCH.toFixed(2)}`);
  lines.push(`- Average decisions per run: player ${avgPlayerDecisionCount.toFixed(1)}, ai ${avgAiDecisionCount.toFixed(1)}`);
  lines.push(`- Average revenue: player ${avgPlayerRevenue.toFixed(2)}, ai ${avgAiRevenue.toFixed(2)}`);
  lines.push(`- Average chargeback transfers: ${avgChargebackTransfers.toFixed(2)}`);
  lines.push('');
  lines.push('## Acceptance check');
  lines.push('');
  lines.push(
    `- CH gate trigger rate < 50%: ${failRate < 0.5 ? 'PASS' : 'FAIL'} (${(failRate * 100).toFixed(1)}%)`,
  );
  lines.push(
    `- At least two strategies have winning runs: ${winningStrategies.length >= 2 ? 'PASS' : 'FAIL'} (${winningStrategies.join(', ') || 'none'})`,
  );
  lines.push('');
  lines.push('## Strategy win count');
  lines.push('');
  for (const strategy of strategyPresets) {
    lines.push(`- ${strategy.id}: ${strategyWins[strategy.id] ?? 0}`);
  }
  lines.push('');
  lines.push('## Style distribution');
  lines.push('');
  for (const [style, count] of Object.entries(styleCount)) {
    lines.push(`- ${style}: ${count}`);
  }
  lines.push('');
  lines.push('## Average CH loss drivers');
  lines.push('');
  lines.push(`- backlog: ${chLossBacklogAvg.toFixed(2)}`);
  lines.push(`- debt: ${chLossDebtAvg.toFixed(2)}`);
  lines.push(`- owner: ${chLossOwnerAvg.toFixed(2)}`);
  lines.push(`- accident: ${chLossAccidentAvg.toFixed(2)}`);
  lines.push('');
  lines.push('## Strategy action mix');
  lines.push('');
  for (const strategy of strategyPresets) {
    const mix = strategyActionMix[strategy.id];
    const turns = Math.max(1, mix.turns);
    lines.push(
      `- ${strategy.id}: turns=${mix.turns}, deliver=${mix.deliver} (${((mix.deliver / turns) * 100).toFixed(1)}%), sustain=${mix.sustain} (${((mix.sustain / turns) * 100).toFixed(1)}%), invest(node)=${mix.investNode} (${((mix.investNode / turns) * 100).toFixed(1)}%), invest(edge)=${mix.investEdge} (${((mix.investEdge / turns) * 100).toFixed(1)}%), invest(maturity)=${mix.investMaturity} (${((mix.investMaturity / turns) * 100).toFixed(1)}%), pass=${mix.pass} (${((mix.pass / turns) * 100).toFixed(1)}%)`,
    );
  }
  lines.push('');
  lines.push('## Per run');
  lines.push('');
  lines.push(
    '| Run | Seed | Matchup | Winner Team | Winner Strategy | Player Final | AI Final | CH | Failed | Style |',
  );
  lines.push('| --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |');
  for (const run of runs) {
    lines.push(
      `| ${run.runId} | ${run.seed} | ${run.matchup} | ${run.winnerTeam} | ${run.winnerStrategy} | ${run.playerFinal.toFixed(2)} | ${run.aiFinal.toFixed(2)} | ${run.ch} | ${run.companyFailed ? 'yes' : 'no'} | ${run.style} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const runSummaries: RunSummary[] = [];

  for (const seed of seeds) {
    for (const matchup of matchups) {
      const playerStrategy = findStrategy(matchup.playerStrategy);
      const aiStrategy = findStrategy(matchup.aiStrategy);

      const simulation = runMatch(seed, playerStrategy, aiStrategy);
      const finalState = simulation.finalState;
      if (!finalState.result) {
        throw new Error(`Result is null for seed ${seed}`);
      }

      const report = buildPostGameReport(finalState);
      const winnerStrategy =
        finalState.result.winner === 'player'
          ? playerStrategy.id
          : finalState.result.winner === 'ai'
            ? aiStrategy.id
            : 'draw';

      const runId = `${matchup.id}-seed-${seed}`;
      const playerDecisionCount = simulation.decisionTrace.filter((entry) => entry.team === 'player').length;
      const aiDecisionCount = simulation.decisionTrace.filter((entry) => entry.team === 'ai').length;
      const playerMix = collectActionMix(simulation.decisionTrace, 'player');
      const aiMix = collectActionMix(simulation.decisionTrace, 'ai');
      const runSummary: RunSummary = {
        runId,
        seed,
        matchup: matchup.id,
        playerStrategy: playerStrategy.id,
        aiStrategy: aiStrategy.id,
        winnerTeam: finalState.result.winner,
        winnerStrategy,
        companyFailed: finalState.result.companyFailed,
        playerFinal: finalState.result.playerFinal,
        aiFinal: finalState.result.aiFinal,
        ch: finalState.ch,
        style: report.style,
        chLossBacklog: report.chLossBreakdown.backlog,
        chLossDebt: report.chLossBreakdown.debt,
        chLossOwner: report.chLossBreakdown.owner,
        chLossAccident: report.chLossBreakdown.accident,
        playerDecisionCount,
        aiDecisionCount,
        playerRevenue: finalState.score.player.revenue,
        aiRevenue: finalState.score.ai.revenue,
        chargebackTransfers: report.chargebackSummary.transferCount,
        playerDeliverCount: playerMix.deliver,
        playerSustainCount: playerMix.sustain,
        playerInvestNodeCount: playerMix.investNode,
        playerInvestEdgeCount: playerMix.investEdge,
        playerInvestMaturityCount: playerMix.investMaturity,
        playerPassCount: playerMix.pass,
        aiDeliverCount: aiMix.deliver,
        aiSustainCount: aiMix.sustain,
        aiInvestNodeCount: aiMix.investNode,
        aiInvestEdgeCount: aiMix.investEdge,
        aiInvestMaturityCount: aiMix.investMaturity,
        aiPassCount: aiMix.pass,
      };

      runSummaries.push(runSummary);

      const payload = {
        runId,
        seed,
        matchup,
        strategies: {
          player: playerStrategy,
          ai: aiStrategy,
        },
        config: finalState.config,
        result: finalState.result,
        score: finalState.score,
        ch: finalState.ch,
        sprintSummaries: finalState.sprintSummaries,
        report,
        decisionTrace: simulation.decisionTrace,
        logs: finalState.logs,
      };

      await writeFile(
        path.join(outputDir, `${outputPrefix}-${runId}.json`),
        `${JSON.stringify(payload, null, 2)}\n`,
        'utf8',
      );
    }
  }

  const summary = toMarkdown(runSummaries);
  await writeFile(path.join(outputDir, `${outputPrefix}-summary.md`), summary, 'utf8');

  console.log('Saved run files:', runSummaries.length);
  console.log(`Saved summary: docs/playlogs/${outputPrefix}-summary.md`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
