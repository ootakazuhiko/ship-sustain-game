import { describe, expect, it } from 'vitest';
import { createInitialState, defaultScenario, listLegalActions } from '@ship/engine';
import { chooseAction, chooseActionWithDifficulty } from './index';

describe('ai', () => {
  it('returns legal action', () => {
    const state = createInitialState(defaultScenario, 77);
    const decision = chooseAction(state);
    const legal = listLegalActions(state);

    const found = legal.some((action) => JSON.stringify(action) === JSON.stringify(decision.action));
    expect(found).toBe(true);
  });

  it('supports lookahead options', () => {
    const state = createInitialState(defaultScenario, 77);
    const decision = chooseAction(state, {
      lookaheadDepth: 1,
      topK: 8,
    });
    expect(decision.meta.lookaheadDepth).toBe(1);
    expect(decision.candidates.length).toBeGreaterThan(0);
  });

  it('selects legal action with preset difficulty', () => {
    const state = createInitialState(defaultScenario, 77);
    const decision = chooseActionWithDifficulty(state, 'hard');
    const legal = listLegalActions(state);
    const found = legal.some((action) => JSON.stringify(action) === JSON.stringify(decision.action));
    expect(found).toBe(true);
  });

  it('adds fail risk penalty when projected CH is below threshold', () => {
    const state = createInitialState(defaultScenario, 77, { initialCH: 25 });
    const decision = chooseAction(state, {
      weights: {
        dpWeight: 0,
        ccWeight: 0,
        passPenalty: 0,
        riskAversion: 1.8,
        leverageWeight: 0,
        thresholdRiskWeight: 1.5,
      },
      lookaheadDepth: 0,
      topK: 20,
    });

    expect(decision.reasons.failRiskPenalty).toBeGreaterThan(0);
    expect(decision.reasons.projectedChAfterSprint).toBeLessThan(state.config.companyFailThreshold);
  });

  it('prioritizes investment with high leverage weight', () => {
    const state = createInitialState(defaultScenario, 77);
    const decision = chooseAction(state, {
      weights: {
        dpWeight: 0,
        ccWeight: 0,
        passPenalty: 0,
        riskAversion: 0,
        leverageWeight: 8,
        thresholdRiskWeight: 0,
      },
      lookaheadDepth: 0,
      topK: 30,
    });

    expect(decision.action.type).toBe('invest');
    expect(decision.reasons.leverageBonus).toBeGreaterThan(0);
  });

  it('prioritizes edge asset investment with high chargeback rent weight', () => {
    const state = createInitialState(defaultScenario, 77, {
      chargebackEnabled: true,
      chargebackPerAssetUse: 2,
    });
    const decision = chooseAction(state, {
      weights: {
        dpWeight: 0,
        ccWeight: 0,
        passPenalty: 3,
        riskAversion: 0,
        leverageWeight: 0,
        thresholdRiskWeight: 0,
        revenueWeight: 0,
        budgetWeight: 0,
        chargebackRentWeight: 8,
      },
      lookaheadDepth: 0,
      topK: 40,
    });

    expect(decision.action.type).toBe('invest');
    if (decision.action.type !== 'invest') {
      throw new Error('Expected invest action');
    }
    expect(decision.action.kind).toBe('asset');
    expect(decision.action.targetType).toBe('edge');
    expect(decision.reasons.chargebackRentBonus).toBeGreaterThan(0);
    expect(decision.reasons.edgeRentMultiplier).toBeGreaterThan(1);
  });
});
