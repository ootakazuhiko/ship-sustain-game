import { describe, expect, it } from 'vitest';
import { defaultScenario } from './data/defaultScenario';
import { applyAction, createInitialState, listLegalActions, simulateGame } from './game';
import type { GameAction } from './types';

function pickFirstNonPass(actions: GameAction[]): GameAction {
  return actions.find((action) => action.type !== 'pass') ?? actions[0];
}

describe('engine', () => {
  it('runs 4 sprints and finishes', () => {
    const state = createInitialState(defaultScenario, 42);
    const finalState = simulateGame(state, {
      player: (_s, actions) => pickFirstNonPass(actions),
      ai: (_s, actions) => pickFirstNonPass(actions),
    });

    expect(finalState.phase).toBe('finished');
    expect(finalState.sprint).toBe(5);
    expect(finalState.result).not.toBeNull();
  });

  it('is deterministic with the same seed and strategy', () => {
    const first = simulateGame(createInitialState(defaultScenario, 123), {
      player: (_s, actions) => pickFirstNonPass(actions),
      ai: (_s, actions) => pickFirstNonPass(actions),
    });

    const second = simulateGame(createInitialState(defaultScenario, 123), {
      player: (_s, actions) => pickFirstNonPass(actions),
      ai: (_s, actions) => pickFirstNonPass(actions),
    });

    expect(second.ch).toBe(first.ch);
    expect(second.result?.playerFinal).toBe(first.result?.playerFinal);
    expect(second.sprintSummaries).toEqual(first.sprintSummaries);
  });

  it('applies player action and decreases player capacity', () => {
    const initial = createInitialState(defaultScenario, 1);
    const action = listLegalActions(initial).find(
      (candidate) => candidate.type === 'work' && candidate.mode === 'deliver',
    );

    if (!action || action.type !== 'work') {
      throw new Error('Expected work action');
    }

    const next = applyAction(initial, action);
    expect(next.score.player.dp).toBeGreaterThan(0);
    expect(next.capacities.player).toBe(initial.capacities.player - 1);
  });

  it('applies chargeback transfer when enabled and cross-team asset is used', () => {
    let state = createInitialState(defaultScenario, 5, {
      chargebackEnabled: true,
      chargebackPerAssetUse: 1,
    });

    state = applyAction(state, { type: 'pass' });
    state = applyAction(state, { type: 'pass' });

    expect(state.sprint).toBe(2);
    expect(state.activeTeam).toBe('ai');

    const aiInvest = listLegalActions(state).find(
      (action) =>
        action.type === 'invest' &&
        action.kind === 'asset' &&
        action.targetType === 'node' &&
        action.targetId === 'api',
    );
    if (!aiInvest || aiInvest.type !== 'invest') {
      throw new Error('Expected AI asset invest action');
    }

    state = applyAction(state, aiInvest);
    expect(state.nodeAssetOwners.api?.observability).toBe('ai');
    expect(state.budget.ai).toBe(3);
    expect(state.activeTeam).toBe('player');

    const playerWork = listLegalActions(state).find(
      (action) => action.type === 'work' && action.mode === 'deliver' && action.nodeId === 'api',
    );
    if (!playerWork || playerWork.type !== 'work') {
      throw new Error('Expected player deliver action');
    }

    state = applyAction(state, playerWork);
    expect(state.budget.player).toBe(3);
    expect(state.budget.ai).toBe(4);
    expect(state.score.ai.revenue).toBe(1);
    expect(state.logs.at(-1)?.message).toContain('node:api:player->ai:1');
  });

  it('lists and applies edge asset investment', () => {
    let state = createInitialState(defaultScenario, 11);
    const edgeInvest = listLegalActions(state).find(
      (action) => action.type === 'invest' && action.kind === 'asset' && action.targetType === 'edge',
    );
    if (!edgeInvest || edgeInvest.type !== 'invest' || !edgeInvest.assetType) {
      throw new Error('Expected edge asset invest action');
    }

    state = applyAction(state, edgeInvest);
    expect(state.edgeAssetOwners[edgeInvest.targetId]?.[edgeInvest.assetType]).toBe('player');
    const targetEdge = state.edges.find((edge) => edge.id === edgeInvest.targetId);
    expect(targetEdge?.assets.includes(edgeInvest.assetType)).toBe(true);
  });

  it('adds deliver dp bonus when player owns connected edge asset', () => {
    let state = createInitialState(defaultScenario, 17);
    const edgeInvest = listLegalActions(state).find(
      (action) =>
        action.type === 'invest' &&
        action.kind === 'asset' &&
        action.targetType === 'edge' &&
        action.targetId === 'e1',
    );
    if (!edgeInvest || edgeInvest.type !== 'invest') {
      throw new Error('Expected player edge asset invest action');
    }
    state = applyAction(state, edgeInvest);
    state = applyAction(state, { type: 'pass' });

    const before = state;
    const deliver = listLegalActions(before).find(
      (action) => action.type === 'work' && action.mode === 'deliver' && action.nodeId === 'fe',
    );
    if (!deliver || deliver.type !== 'work') {
      throw new Error('Expected player deliver action on fe');
    }

    const node = before.nodes.find((candidate) => candidate.id === 'fe');
    if (!node) {
      throw new Error('Node not found: fe');
    }

    const baseDp = node.demand + node.maturity + (node.owner === 'player' ? before.config.ownerDeliverBonus : 0);
    state = applyAction(before, deliver);
    expect(state.score.player.dp - before.score.player.dp).toBe(baseDp + 1);
    expect(state.logs.at(-1)?.message).toContain('edge+1');
  });

  it('applies chargeback transfer for opponent-owned connected edge assets on work', () => {
    let state = createInitialState(defaultScenario, 19, {
      chargebackEnabled: true,
      chargebackPerAssetUse: 1,
    });

    state = applyAction(state, { type: 'pass' });
    state = applyAction(state, { type: 'pass' });

    const aiInvest = listLegalActions(state).find(
      (action) =>
        action.type === 'invest' &&
        action.kind === 'asset' &&
        action.targetType === 'edge' &&
        action.targetId === 'e2',
    );
    if (!aiInvest || aiInvest.type !== 'invest') {
      throw new Error('Expected AI edge asset invest action');
    }

    state = applyAction(state, aiInvest);
    expect(state.edgeAssetOwners.e2?.observability).toBe('ai');

    const playerBeforeWork = state;
    const playerWork = listLegalActions(playerBeforeWork).find(
      (action) => action.type === 'work' && action.mode === 'deliver' && action.nodeId === 'api',
    );
    if (!playerWork || playerWork.type !== 'work') {
      throw new Error('Expected player deliver action on api');
    }

    state = applyAction(playerBeforeWork, playerWork);
    expect(state.budget.player).toBe(playerBeforeWork.budget.player - 1);
    expect(state.budget.ai).toBe(playerBeforeWork.budget.ai + 1);
    expect(state.score.ai.revenue).toBe(playerBeforeWork.score.ai.revenue + 1);
    expect(state.logs.at(-1)?.message).toContain('edge:e2:player->ai:1');
  });

  it('does not apply chargeback transfer when disabled', () => {
    let state = createInitialState(defaultScenario, 5, {
      chargebackEnabled: false,
      chargebackPerAssetUse: 1,
    });

    state = applyAction(state, { type: 'pass' });
    state = applyAction(state, { type: 'pass' });

    const aiInvest = listLegalActions(state).find(
      (action) =>
        action.type === 'invest' &&
        action.kind === 'asset' &&
        action.targetType === 'node' &&
        action.targetId === 'api',
    );
    if (!aiInvest || aiInvest.type !== 'invest') {
      throw new Error('Expected AI asset invest action');
    }
    state = applyAction(state, aiInvest);

    const playerWork = listLegalActions(state).find(
      (action) => action.type === 'work' && action.mode === 'deliver' && action.nodeId === 'api',
    );
    if (!playerWork || playerWork.type !== 'work') {
      throw new Error('Expected player deliver action');
    }
    state = applyAction(state, playerWork);

    expect(state.budget.player).toBe(4);
    expect(state.budget.ai).toBe(3);
    expect(state.score.ai.revenue).toBe(0);
    expect(state.logs.at(-1)?.message).not.toContain('[CB');
  });
});
