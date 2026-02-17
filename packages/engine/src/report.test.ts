import { describe, expect, it } from 'vitest';
import { defaultScenario } from './data/defaultScenario';
import { createInitialState, simulateGame } from './game';
import { buildPostGameReport } from './report';
import type { GameAction } from './types';

function pickFirstNonPass(actions: GameAction[]): GameAction {
  return actions.find((action) => action.type !== 'pass') ?? actions[0];
}

describe('post game report', () => {
  it('builds report from completed game', () => {
    const final = simulateGame(createInitialState(defaultScenario, 42), {
      player: (_state, actions) => pickFirstNonPass(actions),
      ai: (_state, actions) => pickFirstNonPass(actions),
    });

    const report = buildPostGameReport(final);

    expect(report.chLossBreakdown.total).toBeGreaterThan(0);
    expect(report.timeline.length).toBeGreaterThan(0);
    expect(report.sprintMetrics.length).toBe(report.timeline.length);
    expect(report.bottlenecks.length).toBeGreaterThan(0);
    expect(['backlog', 'debt', 'owner', 'accident', 'none']).toContain(report.primaryDriver);
    expect(['dp_focused', 'sustain_focused', 'balanced']).toContain(report.style);
    const totalPlayerActions =
      report.actionMix.deliver + report.actionMix.sustain + report.actionMix.invest + report.actionMix.pass;
    const sprintPlayerActions = report.sprintMetrics.reduce(
      (sum, row) => sum + row.player.deliver + row.player.sustain + row.player.invest + row.player.pass,
      0,
    );
    expect(sprintPlayerActions).toBe(totalPlayerActions);
    expect(report.sprintMetrics.at(-1)?.chAfter).toBe(final.ch);
    const playerDpFromMetrics = report.sprintMetrics.reduce((sum, row) => sum + row.player.dpGain, 0);
    const aiDpFromMetrics = report.sprintMetrics.reduce((sum, row) => sum + row.ai.dpGain, 0);
    const playerCcFromMetrics = report.sprintMetrics.reduce((sum, row) => sum + row.player.ccGain, 0);
    const aiCcFromMetrics = report.sprintMetrics.reduce((sum, row) => sum + row.ai.ccGain, 0);
    expect(playerDpFromMetrics).toBe(final.score.player.dp);
    expect(aiDpFromMetrics).toBe(final.score.ai.dp);
    expect(playerCcFromMetrics).toBe(final.score.player.cc);
    expect(aiCcFromMetrics).toBe(final.score.ai.cc);
    expect(report.chargebackSummary.transferCount).toBeGreaterThanOrEqual(0);
    expect(report.chargebackSummary.playerPaid).toBeGreaterThanOrEqual(0);
    expect(report.chargebackSummary.aiPaid).toBeGreaterThanOrEqual(0);
  });
});
