import { applyAction, listLegalActions } from '@ship/engine';
import type { GameAction, GameState, Team } from '@ship/engine';

export interface AIWeights {
  dpWeight: number;
  ccWeight: number;
  riskAversion: number;
  passPenalty: number;
  leverageWeight: number;
  thresholdRiskWeight: number;
  revenueWeight: number;
  budgetWeight: number;
  chargebackRentWeight: number;
}

export interface AIChooseOptions {
  weights?: Partial<AIWeights>;
  opponentWeights?: Partial<AIWeights>;
  lookaheadDepth?: number;
  topK?: number;
  futureDiscount?: number;
  candidatePreviewCount?: number;
  edgeRentTargetMultiplier?: number;
  chargebackRentCap?: number;
}

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface AIDifficultyPreset {
  id: AIDifficulty;
  label: string;
  description: string;
  options: AIChooseOptions;
}

export interface AICandidateScore {
  action: GameAction;
  score: number;
  localScore: number;
  futureScore: number;
}

export interface AIDecision {
  action: GameAction;
  score: number;
  reasons: {
    dpGain: number;
    ccGain: number;
    backlogDelta: number;
    debtDelta: number;
    chDelta: number;
    revenueGain: number;
    budgetDelta: number;
    dpComponent: number;
    ccComponent: number;
    chComponent: number;
    revenueComponent: number;
    budgetComponent: number;
    backlogPenalty: number;
    debtPenalty: number;
    passPenalty: number;
    leverageBonus: number;
    chargebackRentBonus: number;
    edgeRentMultiplier: number;
    failRiskPenalty: number;
    projectedChAfterSprint: number;
    lookaheadScore: number;
  };
  meta: {
    lookaheadDepth: number;
    consideredActions: number;
    topK: number;
  };
  candidates: AICandidateScore[];
}

export interface AIDecisionTraceEntry {
  sprint: number;
  turn: number;
  team: Team;
  actionKey: string;
  score: number;
  localScore: number;
  lookaheadScore: number;
  reasons: AIDecision['reasons'];
  meta: AIDecision['meta'];
}

interface ResolvedAIOptions {
  weights: AIWeights;
  opponentWeights: AIWeights;
  lookaheadDepth: number;
  topK: number;
  futureDiscount: number;
  candidatePreviewCount: number;
  edgeRentTargetMultiplier: number;
  chargebackRentCap: number;
}

interface LocalEvaluation {
  action: GameAction;
  nextState: GameState;
  score: number;
  reasons: AIDecision['reasons'];
}

interface EvaluationContext {
  nodeLeverage: Map<string, number>;
  edgeLeverage: Map<string, number>;
}

export const DEFAULT_AI_WEIGHTS: AIWeights = {
  dpWeight: 1.45,
  ccWeight: 1.35,
  riskAversion: 1.45,
  passPenalty: 6,
  leverageWeight: 0.35,
  thresholdRiskWeight: 0.8,
  revenueWeight: 1.1,
  budgetWeight: 0.3,
  chargebackRentWeight: 0.25,
};

export const DIFFICULTY_PRESETS: Record<AIDifficulty, AIDifficultyPreset> = {
  easy: {
    id: 'easy',
    label: 'Easy',
    description: 'No lookahead, narrow risk handling.',
    options: {
      weights: {
        dpWeight: 1.55,
        ccWeight: 1.15,
        riskAversion: 0.9,
        leverageWeight: 0.2,
        thresholdRiskWeight: 0.45,
        revenueWeight: 0.8,
        budgetWeight: 0.15,
        chargebackRentWeight: 0.15,
      },
      lookaheadDepth: 0,
      topK: 10,
      futureDiscount: 0.8,
      candidatePreviewCount: 3,
    },
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'One-ply lookahead with balanced evaluation.',
    options: {
      weights: {
        dpWeight: 1.45,
        ccWeight: 1.2,
        riskAversion: 1.4,
        leverageWeight: 0.35,
        thresholdRiskWeight: 0.8,
        revenueWeight: 1.1,
        budgetWeight: 0.3,
        chargebackRentWeight: 0.25,
      },
      opponentWeights: {
        dpWeight: 1.62,
        ccWeight: 1.05,
        riskAversion: 1.05,
        leverageWeight: 0.25,
        thresholdRiskWeight: 0.7,
        revenueWeight: 1,
        budgetWeight: 0.25,
        chargebackRentWeight: 0.2,
      },
      lookaheadDepth: 1,
      topK: 10,
      futureDiscount: 0.9,
      candidatePreviewCount: 4,
    },
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    description: 'Two-ply lookahead with wider branch search.',
    options: {
      weights: {
        dpWeight: 1.45,
        ccWeight: 1.25,
        riskAversion: 1.5,
        leverageWeight: 0.45,
        thresholdRiskWeight: 1.0,
        revenueWeight: 1.25,
        budgetWeight: 0.35,
        chargebackRentWeight: 0.35,
      },
      opponentWeights: {
        dpWeight: 1.62,
        ccWeight: 1.05,
        riskAversion: 1.05,
        leverageWeight: 0.3,
        thresholdRiskWeight: 0.8,
        revenueWeight: 1,
        budgetWeight: 0.25,
        chargebackRentWeight: 0.2,
      },
      lookaheadDepth: 2,
      topK: 8,
      futureDiscount: 0.9,
      candidatePreviewCount: 5,
    },
  },
};

function sumBacklog(state: GameState): number {
  return state.nodes.reduce((sum, node) => sum + node.backlog, 0);
}

function sumDebt(state: GameState): number {
  return state.edges.reduce((sum, edge) => sum + edge.integrationDebt, 0);
}

function actionKey(action: GameAction): string {
  if (action.type === 'pass') {
    return 'pass';
  }
  if (action.type === 'work') {
    return `work:${action.mode}:${action.nodeId}`;
  }
  return `invest:${action.kind}:${action.targetType}:${action.targetId}:${action.assetType ?? ''}`;
}

function otherTeam(team: Team): Team {
  return team === 'player' ? 'ai' : 'player';
}

function clampInt(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return Math.trunc(value);
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

function buildEvaluationContext(state: GameState): EvaluationContext {
  const nodeLeverage = new Map<string, number>();
  for (const node of state.nodes) {
    const baseScore = node.demand * 0.5 + node.risk * 0.4 + node.backlog * 0.2 + node.maturity * 0.2;
    nodeLeverage.set(node.id, baseScore);
  }

  for (const edge of state.edges) {
    const edgeImpact = 1 + edge.coupling * 0.8 + edge.integrationDebt * 0.3;
    nodeLeverage.set(edge.from, (nodeLeverage.get(edge.from) ?? 0) + edgeImpact);
    nodeLeverage.set(edge.to, (nodeLeverage.get(edge.to) ?? 0) + edgeImpact);
  }

  const edgeLeverage = new Map<string, number>();
  for (const edge of state.edges) {
    const edgeScore =
      edge.coupling * 1.1 +
      edge.integrationDebt * 0.5 +
      ((nodeLeverage.get(edge.from) ?? 0) + (nodeLeverage.get(edge.to) ?? 0)) * 0.12;
    edgeLeverage.set(edge.id, edgeScore);
  }

  return { nodeLeverage, edgeLeverage };
}

function leverageScoreForAction(action: GameAction, context: EvaluationContext): number {
  if (action.type !== 'invest') {
    return 0;
  }
  if (action.targetType === 'node') {
    return context.nodeLeverage.get(action.targetId) ?? 0;
  }
  return context.edgeLeverage.get(action.targetId) ?? 0;
}

function estimateProjectedSprintEndCh(state: GameState): number {
  const totalBacklog = sumBacklog(state);
  const totalDebt = sumDebt(state);
  const ownerHotNodes = state.nodes.filter((node) => node.owner !== null && node.backlog > 0).length;
  const baseLoss =
    Math.floor(totalBacklog * state.config.chPenaltyBacklogWeight) +
    Math.floor(totalDebt * state.config.chPenaltyDebtWeight) +
    Math.round(ownerHotNodes * state.config.ownerMaintenancePenalty);

  let expectedAccidentLoss = 0;
  for (const node of state.nodes) {
    const probability = clampProbability(
      state.config.accidentBaseProbability +
        node.risk * state.config.accidentRiskWeight +
        node.backlog * state.config.accidentBacklogWeight,
    );
    expectedAccidentLoss += probability * state.config.accidentChPenalty;
  }

  return state.ch - (baseLoss + expectedAccidentLoss);
}

function isWeightsLike(input: AIChooseOptions | Partial<AIWeights>): input is Partial<AIWeights> {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return true;
  }
  return keys.every((key) =>
    [
      'dpWeight',
      'ccWeight',
      'riskAversion',
      'passPenalty',
      'leverageWeight',
      'thresholdRiskWeight',
      'revenueWeight',
      'budgetWeight',
      'chargebackRentWeight',
    ].includes(key),
  );
}

function mergeWeights(base: AIWeights, partial?: Partial<AIWeights>): AIWeights {
  return {
    dpWeight: partial?.dpWeight ?? base.dpWeight,
    ccWeight: partial?.ccWeight ?? base.ccWeight,
    riskAversion: partial?.riskAversion ?? base.riskAversion,
    passPenalty: partial?.passPenalty ?? base.passPenalty,
    leverageWeight: partial?.leverageWeight ?? base.leverageWeight,
    thresholdRiskWeight: partial?.thresholdRiskWeight ?? base.thresholdRiskWeight,
    revenueWeight: partial?.revenueWeight ?? base.revenueWeight,
    budgetWeight: partial?.budgetWeight ?? base.budgetWeight,
    chargebackRentWeight: partial?.chargebackRentWeight ?? base.chargebackRentWeight,
  };
}

function resolveOptions(input: AIChooseOptions | Partial<AIWeights> = {}): ResolvedAIOptions {
  if (isWeightsLike(input)) {
    return {
      weights: mergeWeights(DEFAULT_AI_WEIGHTS, input),
      opponentWeights: DEFAULT_AI_WEIGHTS,
      lookaheadDepth: 0,
      topK: 12,
      futureDiscount: 0.88,
      candidatePreviewCount: 4,
      edgeRentTargetMultiplier: 3,
      chargebackRentCap: 4,
    };
  }

  return {
    weights: mergeWeights(DEFAULT_AI_WEIGHTS, input.weights),
    opponentWeights: mergeWeights(DEFAULT_AI_WEIGHTS, input.opponentWeights),
    lookaheadDepth: clampInt(input.lookaheadDepth ?? 0, 0, 3),
    topK: clampInt(input.topK ?? 12, 1, 30),
    futureDiscount: Math.max(0, Math.min(1, input.futureDiscount ?? 0.88)),
    candidatePreviewCount: clampInt(input.candidatePreviewCount ?? 4, 1, 8),
    edgeRentTargetMultiplier: clampNumber(input.edgeRentTargetMultiplier ?? 3, 1, 5),
    chargebackRentCap: clampNumber(input.chargebackRentCap ?? 4, 0, 12),
  };
}

function heuristicStateScore(state: GameState, rootTeam: Team, weights: AIWeights): number {
  const opponent = otherTeam(rootTeam);
  const dpDiff = state.score[rootTeam].dp - state.score[opponent].dp;
  const ccDiff = state.score[rootTeam].cc - state.score[opponent].cc;
  const revenueDiff = state.score[rootTeam].revenue - state.score[opponent].revenue;
  const budgetDiff = state.budget[rootTeam] - state.budget[opponent];
  const backlog = sumBacklog(state);
  const debt = sumDebt(state);
  const projectedChAfterSprint = estimateProjectedSprintEndCh(state);
  const failGap = Math.max(0, state.config.companyFailThreshold - projectedChAfterSprint);
  const thresholdPenalty = failGap * weights.thresholdRiskWeight * weights.riskAversion * 0.6;

  const stateScore =
    dpDiff * (weights.dpWeight * 0.3) +
    ccDiff * (weights.ccWeight * 0.25) +
    revenueDiff * (weights.revenueWeight * 0.5) +
    budgetDiff * (weights.budgetWeight * 0.25) +
    state.ch * 0.12 -
    backlog * (0.08 * weights.riskAversion) -
    debt * (0.05 * weights.riskAversion) -
    thresholdPenalty;

  return stateScore;
}

function evaluateLocalAction(
  state: GameState,
  action: GameAction,
  options: ResolvedAIOptions,
  weights: AIWeights,
  context: EvaluationContext,
): LocalEvaluation {
  const team = state.activeTeam;
  const next = applyAction(state, action);

  const dpGain = next.score[team].dp - state.score[team].dp;
  const ccGain = next.score[team].cc - state.score[team].cc;
  const backlogDelta = sumBacklog(next) - sumBacklog(state);
  const debtDelta = sumDebt(next) - sumDebt(state);
  const chDelta = next.ch - state.ch;
  const revenueGain = next.score[team].revenue - state.score[team].revenue;
  const budgetDelta = next.budget[team] - state.budget[team];

  const dpComponent = dpGain * weights.dpWeight;
  const ccComponent = ccGain * weights.ccWeight;
  const chComponent = chDelta * 0.35 * weights.riskAversion;
  const revenueComponent = revenueGain * weights.revenueWeight;
  const budgetComponent = budgetDelta * weights.budgetWeight;
  const backlogPenalty = backlogDelta * 0.8 * weights.riskAversion;
  const debtPenalty = debtDelta * 0.5 * weights.riskAversion;
  const passPenalty = action.type === 'pass' ? weights.passPenalty : 0;
  const leverageScore = leverageScoreForAction(action, context);
  const leverageBonus = leverageScore * weights.leverageWeight * 0.18;
  const edgeRentMultiplier =
    action.type === 'invest' && action.kind === 'asset' && action.targetType === 'edge'
      ? options.edgeRentTargetMultiplier
      : 1;
  const rawRentBonus =
    action.type === 'invest' &&
    action.kind === 'asset' &&
    state.config.chargebackEnabled &&
    state.config.chargebackPerAssetUse > 0
      ? leverageScore *
        edgeRentMultiplier *
        state.config.chargebackPerAssetUse *
        weights.chargebackRentWeight *
        0.12
      : 0;
  const chargebackRentBonus =
    rawRentBonus > 0 ? Math.min(rawRentBonus, options.chargebackRentCap) : 0;
  const projectedChAfterSprint = estimateProjectedSprintEndCh(next);
  const failGap = Math.max(0, state.config.companyFailThreshold - projectedChAfterSprint);
  const failRiskPenalty = failGap * weights.thresholdRiskWeight * weights.riskAversion;
  const localScore =
    dpComponent +
    ccComponent +
    chComponent +
    revenueComponent +
    budgetComponent +
    leverageBonus +
    chargebackRentBonus -
    backlogPenalty -
    debtPenalty -
    passPenalty -
    failRiskPenalty;

  return {
    action,
    nextState: next,
    score: localScore,
    reasons: {
      dpGain,
      ccGain,
      backlogDelta,
      debtDelta,
      chDelta,
      revenueGain,
      budgetDelta,
      dpComponent: round2(dpComponent),
      ccComponent: round2(ccComponent),
      chComponent: round2(chComponent),
      revenueComponent: round2(revenueComponent),
      budgetComponent: round2(budgetComponent),
      backlogPenalty: round2(backlogPenalty),
      debtPenalty: round2(debtPenalty),
      passPenalty: round2(passPenalty),
      leverageBonus: round2(leverageBonus),
      chargebackRentBonus: round2(chargebackRentBonus),
      edgeRentMultiplier: round2(edgeRentMultiplier),
      failRiskPenalty: round2(failRiskPenalty),
      projectedChAfterSprint: round2(projectedChAfterSprint),
      lookaheadScore: 0,
    },
  };
}

function rankCandidates(
  state: GameState,
  options: ResolvedAIOptions,
  weights: AIWeights,
): LocalEvaluation[] {
  const legalActions = listLegalActions(state);
  const context = buildEvaluationContext(state);
  const ranked = legalActions
    .map((action) => evaluateLocalAction(state, action, options, weights, context))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return actionKey(a.action).localeCompare(actionKey(b.action));
    });

  return ranked.slice(0, Math.min(options.topK, ranked.length));
}

function terminalScore(state: GameState, rootTeam: Team): number {
  if (!state.result) {
    return heuristicStateScore(state, rootTeam, DEFAULT_AI_WEIGHTS);
  }

  if (rootTeam === 'player') {
    return state.result.playerFinal - state.result.aiFinal;
  }
  return state.result.aiFinal - state.result.playerFinal;
}

function searchValue(
  state: GameState,
  rootTeam: Team,
  depth: number,
  options: ResolvedAIOptions,
): number {
  if (state.phase === 'finished') {
    return terminalScore(state, rootTeam);
  }

  if (depth <= 0) {
    return heuristicStateScore(state, rootTeam, options.weights);
  }

  const actingTeam = state.activeTeam;
  const actingWeights = actingTeam === rootTeam ? options.weights : options.opponentWeights;
  const candidates = rankCandidates(state, options, actingWeights);
  if (candidates.length === 0) {
    return heuristicStateScore(state, rootTeam, options.weights);
  }

  if (actingTeam === rootTeam) {
    let best = Number.NEGATIVE_INFINITY;
    for (const candidate of candidates) {
      const future = searchValue(candidate.nextState, rootTeam, depth - 1, options);
      const value = candidate.score + future * options.futureDiscount;
      if (value > best) {
        best = value;
      }
    }
    return best;
  }

  let worst = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const future = searchValue(candidate.nextState, rootTeam, depth - 1, options);
    const value = -candidate.score + future * options.futureDiscount;
    if (value < worst) {
      worst = value;
    }
  }
  return worst;
}

function candidateScore(
  state: GameState,
  candidate: LocalEvaluation,
  options: ResolvedAIOptions,
): AICandidateScore {
  const lookaheadScore =
    options.lookaheadDepth > 0
      ? searchValue(candidate.nextState, state.activeTeam, options.lookaheadDepth, options) *
        options.futureDiscount
      : 0;

  return {
    action: candidate.action,
    localScore: round2(candidate.score),
    futureScore: round2(lookaheadScore),
    score: round2(candidate.score + lookaheadScore),
  };
}

export function chooseAction(
  state: GameState,
  input: AIChooseOptions | Partial<AIWeights> = {},
): AIDecision {
  const options = resolveOptions(input);
  const legalActions = listLegalActions(state);
  if (legalActions.length === 0) {
    throw new Error('No legal actions available');
  }

  const rankedLocal = rankCandidates(state, options, options.weights);
  let bestCandidate = candidateScore(state, rankedLocal[0], options);
  let bestReasons = { ...rankedLocal[0].reasons };

  const evaluatedCandidates = rankedLocal.map((candidate) => {
    const scored = candidateScore(state, candidate, options);
    if (scored.score > bestCandidate.score) {
      bestCandidate = scored;
      bestReasons = { ...candidate.reasons, lookaheadScore: scored.futureScore };
    } else if (
      scored.score === bestCandidate.score &&
      actionKey(scored.action).localeCompare(actionKey(bestCandidate.action)) < 0
    ) {
      bestCandidate = scored;
      bestReasons = { ...candidate.reasons, lookaheadScore: scored.futureScore };
    }
    return scored;
  });

  return {
    action: bestCandidate.action,
    score: bestCandidate.score,
    reasons: {
      ...bestReasons,
      lookaheadScore: round2(bestReasons.lookaheadScore),
    },
    meta: {
      lookaheadDepth: options.lookaheadDepth,
      consideredActions: legalActions.length,
      topK: options.topK,
    },
    candidates: evaluatedCandidates.slice(0, options.candidatePreviewCount),
  };
}

export function chooseActionWithDifficulty(state: GameState, difficulty: AIDifficulty): AIDecision {
  return chooseAction(state, DIFFICULTY_PRESETS[difficulty].options);
}

export function formatDecisionReason(decision: AIDecision): string {
  const { reasons, meta } = decision;
  return `score=${decision.score.toFixed(2)} depth=${meta.lookaheadDepth} dp=${reasons.dpComponent.toFixed(2)} cc=${reasons.ccComponent.toFixed(2)} rev=${reasons.revenueComponent.toFixed(2)} bud=${reasons.budgetComponent.toFixed(2)} ch=${reasons.chComponent.toFixed(2)} lev=${reasons.leverageBonus.toFixed(2)} rent=${reasons.chargebackRentBonus.toFixed(2)} rentMul=${reasons.edgeRentMultiplier.toFixed(2)} backlogPen=${reasons.backlogPenalty.toFixed(2)} debtPen=${reasons.debtPenalty.toFixed(2)} failPen=${reasons.failRiskPenalty.toFixed(2)} chProj=${reasons.projectedChAfterSprint.toFixed(2)} passPen=${reasons.passPenalty.toFixed(2)} lookahead=${reasons.lookaheadScore.toFixed(2)}`;
}

export function buildDecisionTraceEntry(state: GameState, decision: AIDecision): AIDecisionTraceEntry {
  return {
    sprint: state.sprint,
    turn: state.turn,
    team: state.activeTeam,
    actionKey: actionKey(decision.action),
    score: round2(decision.score),
    localScore: round2(decision.score - decision.reasons.lookaheadScore),
    lookaheadScore: round2(decision.reasons.lookaheadScore),
    reasons: decision.reasons,
    meta: decision.meta,
  };
}
