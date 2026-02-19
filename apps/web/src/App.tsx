import {
  DIFFICULTY_PRESETS,
  buildDecisionTraceEntry,
  chooseAction,
  formatDecisionReason,
  type AIChooseOptions,
  type AIDifficulty,
} from '@ship/ai';
import {
  applyAction,
  buildPostGameReport,
  createInitialState,
  defaultScenario,
  listLegalActions,
  type GameAction,
  type GameState,
  type PlayerStyle,
} from '@ship/engine';
import { useEffect, useMemo, useState } from 'react';
import { type IconMode, resolveNodeIcon } from './config/node-icons';
import { GraphBoard } from './components/GraphBoard';

interface RunHistoryEntry {
  key: string;
  seed: number;
  winner: string;
  playerFinal: number;
  aiFinal: number;
  ch: number;
  style: PlayerStyle;
  difficulty: AIDifficulty;
  lookaheadDepth: number;
  topK: number;
  aiDecisionCount: number;
  aiAvgScore: number;
  aiAvgLookahead: number;
}

type OverrideValue = 'preset' | '0' | '1' | '2' | '3' | '6' | '8' | '10' | '12' | '16';
const ICON_MODE_STORAGE_KEY = 'ship.icon_mode';

function isIconMode(value: string | null): value is IconMode {
  return value === 'abstract' || value === 'concrete';
}

function readInitialIconMode(): IconMode {
  if (typeof window === 'undefined') {
    return 'abstract';
  }

  try {
    const saved = window.localStorage.getItem(ICON_MODE_STORAGE_KEY);
    return isIconMode(saved) ? saved : 'abstract';
  } catch {
    return 'abstract';
  }
}

function formatAction(action: GameAction): string {
  if (action.type === 'pass') {
    return 'Pass';
  }

  if (action.type === 'work') {
    return `${action.mode === 'deliver' ? 'Deliver' : 'Sustain'}:${action.nodeId}`;
  }

  return `Invest:${action.kind}:${action.targetId}`;
}

function findNodeAction(
  actions: GameAction[],
  nodeId: string,
  predicate: (action: GameAction) => boolean,
): GameAction | null {
  const match = actions.find((action) => {
    if (action.type === 'work') {
      return action.nodeId === nodeId && predicate(action);
    }

    if (action.type === 'invest' && action.targetType === 'node') {
      return action.targetId === nodeId && predicate(action);
    }

    return false;
  });

  return match ?? null;
}

function parseSeed(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 1;
  }
  return parsed;
}

function styleLabel(style: PlayerStyle): string {
  if (style === 'dp_focused') {
    return 'DP偏重';
  }
  if (style === 'sustain_focused') {
    return '全体偏重';
  }
  return 'バランス型';
}

function driverLabel(driver: 'backlog' | 'debt' | 'owner' | 'accident' | 'none'): string {
  if (driver === 'backlog') {
    return 'backlog';
  }
  if (driver === 'debt') {
    return 'debt';
  }
  if (driver === 'owner') {
    return 'owner';
  }
  if (driver === 'accident') {
    return 'accident';
  }
  return 'none';
}

function resolvePresetOption(
  presetOptions: AIChooseOptions,
  lookaheadOverride: OverrideValue,
  topKOverride: OverrideValue,
): AIChooseOptions {
  const lookaheadDepth =
    lookaheadOverride === 'preset' ? presetOptions.lookaheadDepth : Number.parseInt(lookaheadOverride, 10);
  const topK = topKOverride === 'preset' ? presetOptions.topK : Number.parseInt(topKOverride, 10);
  return {
    ...presetOptions,
    lookaheadDepth,
    topK,
  };
}

function format2(value: number): string {
  return value.toFixed(2);
}

export function App() {
  const [seedInput, setSeedInput] = useState('42');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('normal');
  const [iconMode, setIconMode] = useState<IconMode>(readInitialIconMode);
  const [lookaheadOverride, setLookaheadOverride] = useState<OverrideValue>('preset');
  const [topKOverride, setTopKOverride] = useState<OverrideValue>('preset');
  const [state, setState] = useState<GameState>(() => createInitialState(defaultScenario, 42));
  const [selectedNodeId, setSelectedNodeId] = useState(defaultScenario.nodes[0]?.id ?? '');
  const [selectedEdgeId, setSelectedEdgeId] = useState(defaultScenario.edges[0]?.id ?? '');
  const [history, setHistory] = useState<RunHistoryEntry[]>([]);

  const aiOptions = useMemo(
    () => resolvePresetOption(DIFFICULTY_PRESETS[aiDifficulty].options, lookaheadOverride, topKOverride),
    [aiDifficulty, lookaheadOverride, topKOverride],
  );
  const activeLookaheadDepth = aiOptions.lookaheadDepth ?? 0;
  const activeTopK = aiOptions.topK ?? 12;

  const legalActions = useMemo(() => listLegalActions(state), [state]);

  const selectedNode = useMemo(
    () => state.nodes.find((node) => node.id === selectedNodeId) ?? state.nodes[0],
    [state.nodes, selectedNodeId],
  );
  const selectedEdge = useMemo(
    () => state.edges.find((edge) => edge.id === selectedEdgeId) ?? state.edges[0],
    [state.edges, selectedEdgeId],
  );
  const selectedNodeAssetOwners = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    return selectedNode.assets.map((asset) => {
      const owner = state.nodeAssetOwners[selectedNode.id]?.[asset] ?? 'none';
      return `${asset}:${owner}`;
    });
  }, [selectedNode, state.nodeAssetOwners]);
  const selectedEdgeAssetOwners = useMemo(() => {
    if (!selectedEdge) {
      return [];
    }
    return selectedEdge.assets.map((asset) => {
      const owner = state.edgeAssetOwners[selectedEdge.id]?.[asset] ?? 'none';
      return `${asset}:${owner}`;
    });
  }, [selectedEdge, state.edgeAssetOwners]);
  const iconLegendRows = useMemo(
    () =>
      state.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        icon: resolveNodeIcon(node.id, iconMode),
      })),
    [iconMode, state.nodes],
  );

  const postGameReport = useMemo(() => {
    if (state.phase !== 'finished') {
      return null;
    }
    return buildPostGameReport(state);
  }, [state]);

  const chBreakdownTotals = useMemo(() => {
    return state.sprintSummaries.reduce(
      (acc, summary) => {
        acc.backlog += summary.chLossBacklog;
        acc.debt += summary.chLossDebt;
        acc.owner += summary.chLossOwner;
        acc.accident += summary.chLossAccident;
        acc.total += summary.chLoss;
        return acc;
      },
      { backlog: 0, debt: 0, owner: 0, accident: 0, total: 0 },
    );
  }, [state.sprintSummaries]);

  const difficultySummary = useMemo(() => {
    const grouped = new Map<
      string,
      {
        key: string;
        difficulty: AIDifficulty;
        lookaheadDepth: number;
        topK: number;
        runs: number;
        playerWins: number;
        totalPlayerFinal: number;
        totalAiFinal: number;
        totalCh: number;
      }
    >();

    for (const entry of history) {
      const key = `${entry.difficulty}-d${entry.lookaheadDepth}-k${entry.topK}`;
      const row =
        grouped.get(key) ??
        {
          key,
          difficulty: entry.difficulty,
          lookaheadDepth: entry.lookaheadDepth,
          topK: entry.topK,
          runs: 0,
          playerWins: 0,
          totalPlayerFinal: 0,
          totalAiFinal: 0,
          totalCh: 0,
        };

      row.runs += 1;
      row.playerWins += entry.winner === 'player' ? 1 : 0;
      row.totalPlayerFinal += entry.playerFinal;
      row.totalAiFinal += entry.aiFinal;
      row.totalCh += entry.ch;
      grouped.set(key, row);
    }

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        winRate: row.runs === 0 ? 0 : row.playerWins / row.runs,
        avgPlayerFinal: row.runs === 0 ? 0 : row.totalPlayerFinal / row.runs,
        avgAiFinal: row.runs === 0 ? 0 : row.totalAiFinal / row.runs,
        avgCh: row.runs === 0 ? 0 : row.totalCh / row.runs,
      }))
      .sort((a, b) => b.runs - a.runs);
  }, [history]);

  const aiDecisionTraceRows = useMemo(
    () => state.logs.filter((entry) => entry.team === 'ai' && entry.decisionTrace).slice(-24).reverse(),
    [state.logs],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(ICON_MODE_STORAGE_KEY, iconMode);
    } catch {
      // Ignore storage failures (private browsing / storage restrictions).
    }
  }, [iconMode]);

  useEffect(() => {
    if (state.phase !== 'in_progress' || state.activeTeam !== 'ai') {
      return;
    }

    const timer = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== 'in_progress' || current.activeTeam !== 'ai') {
          return current;
        }

        const decision = chooseAction(current, aiOptions);
        const trace = buildDecisionTraceEntry(current, decision);
        const next = applyAction(current, decision.action);
        const candidateRows = decision.candidates.map((candidate) => ({
          action: formatAction(candidate.action),
          score: candidate.score,
          localScore: candidate.localScore,
          futureScore: candidate.futureScore,
        }));
        const candidatePreview = candidateRows
          .slice(0, 3)
          .map(
            (row, index) =>
              `#${index + 1} ${row.action}(${row.score.toFixed(2)}|l${row.localScore.toFixed(2)}|f${row.futureScore.toFixed(2)})`,
          )
          .join(' / ');
        const candidateText = candidatePreview.length > 0 ? ` cands:${candidatePreview}` : '';

        return {
          ...next,
          logs: [
            ...next.logs,
            {
              sprint: current.sprint,
              turn: current.turn,
              team: 'ai',
              message: `AI[${aiDifficulty} d${activeLookaheadDepth} k${activeTopK}] ${formatAction(decision.action)} ${formatDecisionReason(decision)}${candidateText}`,
              decisionTrace: {
                profile: aiDifficulty,
                lookaheadDepth: trace.meta.lookaheadDepth,
                topK: trace.meta.topK,
                chosenAction: formatAction(decision.action),
                score: trace.score,
                localScore: trace.localScore,
                lookaheadScore: trace.lookaheadScore,
                candidates: candidateRows,
              },
            },
          ],
        };
      });
    }, 280);

    return () => window.clearTimeout(timer);
  }, [activeLookaheadDepth, activeTopK, aiDifficulty, aiOptions, state.phase, state.activeTeam, state.turn]);

  useEffect(() => {
    if (state.phase !== 'finished' || !state.result || !postGameReport) {
      return;
    }

    const result = state.result;
    const style = postGameReport.style;
    const aiTraces = state.logs
      .filter((entry) => entry.team === 'ai' && entry.decisionTrace)
      .map((entry) => entry.decisionTrace)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    const aiDecisionCount = aiTraces.length;
    const aiAvgScore =
      aiDecisionCount === 0 ? 0 : aiTraces.reduce((sum, entry) => sum + entry.score, 0) / aiDecisionCount;
    const aiAvgLookahead =
      aiDecisionCount === 0
        ? 0
        : aiTraces.reduce((sum, entry) => sum + entry.lookaheadScore, 0) / aiDecisionCount;
    const key = `${state.seed}-${aiDifficulty}-${activeLookaheadDepth}-${activeTopK}-${result.playerFinal}-${result.aiFinal}-${state.ch}`;
    setHistory((current) => {
      if (current.some((entry) => entry.key === key)) {
        return current;
      }

      return [
        {
          key,
          seed: state.seed,
          winner: result.winner,
          playerFinal: result.playerFinal,
          aiFinal: result.aiFinal,
          ch: state.ch,
          style,
          difficulty: aiDifficulty,
          lookaheadDepth: activeLookaheadDepth,
          topK: activeTopK,
          aiDecisionCount,
          aiAvgScore,
          aiAvgLookahead,
        },
        ...current,
      ].slice(0, 10);
    });
  }, [activeLookaheadDepth, activeTopK, aiDifficulty, postGameReport, state]);

  const executeAction = (action: GameAction | null): void => {
    if (!action) {
      return;
    }

    setState((current) => {
      if (current.phase !== 'in_progress') {
        return current;
      }
      return applyAction(current, action);
    });
  };

  const restart = (): void => {
    const nextSeed = parseSeed(seedInput);
    setState(createInitialState(defaultScenario, nextSeed));
    setSelectedNodeId(defaultScenario.nodes[0]?.id ?? '');
    setSelectedEdgeId(defaultScenario.edges[0]?.id ?? '');
  };

  const passAction = legalActions.find((action) => action.type === 'pass') ?? null;

  const deliverAction = selectedNode
    ? findNodeAction(
        legalActions,
        selectedNode.id,
        (action) => action.type === 'work' && action.mode === 'deliver',
      )
    : null;

  const sustainAction = selectedNode
    ? findNodeAction(
        legalActions,
        selectedNode.id,
        (action) => action.type === 'work' && action.mode === 'sustain',
      )
    : null;

  const maturityAction = selectedNode
    ? findNodeAction(
        legalActions,
        selectedNode.id,
        (action) => action.type === 'invest' && action.kind === 'maturity',
      )
    : null;

  const assetAction = selectedNode
    ? findNodeAction(
        legalActions,
        selectedNode.id,
        (action) => action.type === 'invest' && action.kind === 'asset',
      )
    : null;

  const edgeAssetAction = selectedEdge
    ? legalActions.find(
        (action) =>
          action.type === 'invest' &&
          action.kind === 'asset' &&
          action.targetType === 'edge' &&
          action.targetId === selectedEdge.id,
      ) ?? null
    : null;

  return (
    <div className="page">
      <header className="top-bar">
        <div>
          <h1>Ship & Sustain</h1>
          <p>Playable MVP v1 tuning</p>
        </div>

        <div className="seed-panel">
          <label htmlFor="seed">Seed</label>
          <input
            id="seed"
            type="number"
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
          />
          <label htmlFor="difficulty">AI</label>
          <select
            id="difficulty"
            value={aiDifficulty}
            onChange={(event) => setAiDifficulty(event.target.value as AIDifficulty)}
          >
            {Object.values(DIFFICULTY_PRESETS).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
          <label htmlFor="lookahead">Depth</label>
          <select
            id="lookahead"
            value={lookaheadOverride}
            onChange={(event) => setLookaheadOverride(event.target.value as OverrideValue)}
          >
            <option value="preset">Preset</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
          <label htmlFor="topk">TopK</label>
          <select
            id="topk"
            value={topKOverride}
            onChange={(event) => setTopKOverride(event.target.value as OverrideValue)}
          >
            <option value="preset">Preset</option>
            <option value="6">6</option>
            <option value="8">8</option>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="16">16</option>
          </select>
          <label htmlFor="icon-mode">Icon</label>
          <select
            id="icon-mode"
            value={iconMode}
            onChange={(event) => setIconMode(event.target.value as IconMode)}
          >
            <option value="abstract">abstract</option>
            <option value="concrete">concrete</option>
          </select>
          <button onClick={restart}>New Game</button>
        </div>
      </header>

      <main className="content-grid">
        <section className="board-card">
          <GraphBoard
            nodes={state.nodes}
            edges={state.edges}
            selectedNodeId={selectedNode?.id ?? ''}
            iconMode={iconMode}
            onSelectNode={setSelectedNodeId}
          />
          <div className="icon-legend" aria-label="Icon legend">
            <h3>Icon Legend</h3>
            <div className="icon-legend-grid">
              {iconLegendRows.map((row) => (
                <p key={row.id}>
                  <span className="icon-legend-mark">{row.icon}</span>
                  <span>{row.name}</span>
                </p>
              ))}
            </div>
          </div>
        </section>

        <aside className="panel-card">
          <h2>Status</h2>
          <div className="status-grid">
            <div>
              <span>Sprint</span>
              <strong>{Math.min(state.sprint, state.config.maxSprints)}</strong>
            </div>
            <div>
              <span>Turn</span>
              <strong>{state.turn}</strong>
            </div>
            <div>
              <span>CH</span>
              <strong className={state.ch < 40 ? 'danger' : ''}>{state.ch}</strong>
            </div>
            <div>
              <span>Active</span>
              <strong>{state.phase === 'finished' ? '-' : state.activeTeam.toUpperCase()}</strong>
            </div>
          </div>

          <h3>Player</h3>
          <p className="mini-stats">
            Cap {state.capacities.player} / Budget {state.budget.player} / DP {state.score.player.dp} / CC{' '}
            {state.score.player.cc} / Rev {state.score.player.revenue}
          </p>

          <h3>AI</h3>
          <p className="mini-stats">
            Cap {state.capacities.ai} / Budget {state.budget.ai} / DP {state.score.ai.dp} / CC{' '}
            {state.score.ai.cc} / Rev {state.score.ai.revenue}
          </p>
          <p className="mini-stats">
            profile {aiDifficulty} / depth {activeLookaheadDepth} / topK {activeTopK}
          </p>

          <h2>CH Drivers</h2>
          <div className="driver-grid">
            <p>backlog: {chBreakdownTotals.backlog}</p>
            <p>debt: {chBreakdownTotals.debt}</p>
            <p>owner: {chBreakdownTotals.owner}</p>
            <p>accident: {chBreakdownTotals.accident}</p>
          </div>

          <h2>Selected Node</h2>
          {selectedNode ? (
            <div className="node-detail">
              <strong>{selectedNode.name}</strong>
              <p>
                demand {selectedNode.demand} / risk {selectedNode.risk} / maturity {selectedNode.maturity}
              </p>
              <p>
                backlog {selectedNode.backlog} / owner {selectedNode.owner ?? 'none'}
              </p>
              <p>assets {selectedNodeAssetOwners.length === 0 ? '-' : selectedNodeAssetOwners.join(', ')}</p>
            </div>
          ) : null}

          <h2>Selected Edge</h2>
          {selectedEdge ? (
            <div className="node-detail">
              <label htmlFor="edge-select">target edge</label>
              <select
                id="edge-select"
                value={selectedEdge.id}
                onChange={(event) => setSelectedEdgeId(event.target.value)}
              >
                {state.edges.map((edge) => (
                  <option key={edge.id} value={edge.id}>
                    {edge.id} ({edge.from}-{edge.to})
                  </option>
                ))}
              </select>
              <p>
                coupling {selectedEdge.coupling} / debt {selectedEdge.integrationDebt}
              </p>
              <p>assets {selectedEdgeAssetOwners.length === 0 ? '-' : selectedEdgeAssetOwners.join(', ')}</p>
            </div>
          ) : null}

          <h2>Actions</h2>
          <div className="actions">
            <button
              disabled={!deliverAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(deliverAction)}
            >
              Work Deliver
            </button>
            <button
              disabled={!sustainAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(sustainAction)}
            >
              Work Sustain
            </button>
            <button
              disabled={!maturityAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(maturityAction)}
            >
              Invest Maturity
            </button>
            <button
              disabled={!assetAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(assetAction)}
            >
              Invest Asset
            </button>
            <button
              disabled={!edgeAssetAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(edgeAssetAction)}
            >
              Invest Edge Asset
            </button>
            <button
              disabled={!passAction || state.activeTeam !== 'player'}
              onClick={() => executeAction(passAction)}
            >
              Pass
            </button>
          </div>

          {state.phase === 'finished' && state.result && postGameReport ? (
            <section className="result-box">
              <h2>Result</h2>
              <p>
                Winner: <strong>{state.result.winner.toUpperCase()}</strong>
              </p>
              <p>
                Player Final {state.result.playerFinal} / AI Final {state.result.aiFinal}
              </p>
              <p>
                Share Player {state.result.playerShare} / Share AI {state.result.aiShare}
              </p>
              <p>
                Style: <strong>{styleLabel(postGameReport.style)}</strong>
              </p>
              <p>{postGameReport.styleReason}</p>
              <p>
                Player action mix: D {postGameReport.actionMix.deliver} / S {postGameReport.actionMix.sustain} / I{' '}
                {postGameReport.actionMix.invest} / P {postGameReport.actionMix.pass}
              </p>
              <p>
                Primary CH driver: <strong>{driverLabel(postGameReport.primaryDriver)}</strong>
              </p>

              <h3>Bottlenecks</h3>
              <ul className="mini-list">
                {postGameReport.bottlenecks.map((row) => (
                  <li key={row.nodeId}>
                    {row.name}: backlog {row.backlog} / risk {row.risk} / debt {row.relatedDebt}
                  </li>
                ))}
              </ul>

              <h3>Accident Hotspots</h3>
              <ul className="mini-list">
                {postGameReport.accidentHotspots.length === 0 ? <li>none</li> : null}
                {postGameReport.accidentHotspots.map((row) => (
                  <li key={row.nodeId}>
                    {row.name}: {row.count} times
                  </li>
                ))}
              </ul>

              <h3>Timeline</h3>
              <ul className="mini-list">
                {postGameReport.timeline.map((row) => (
                  <li key={row.sprint}>
                    S{row.sprint}: loss {row.chLoss} (B{row.backlog}/D{row.debt}/O{row.owner}/A{row.accident})
                    {row.accidentNodes.length > 0 ? ` accidents: ${row.accidentNodes.join(',')}` : ''}
                  </li>
                ))}
              </ul>

              <h3>Sprint Metrics</h3>
              <ul className="mini-list">
                {postGameReport.sprintMetrics.map((row) => (
                  <li key={row.sprint}>
                    S{row.sprint} CH {row.chAfter} (loss {row.chLoss}) | P[D{row.player.deliver}/S
                    {row.player.sustain}/I{row.player.invest}/P{row.player.pass} DP+{row.player.dpGain} CC+
                    {row.player.ccGain}] | AI[D{row.ai.deliver}/S{row.ai.sustain}/I{row.ai.invest}/P{row.ai.pass}{' '}
                    DP+{row.ai.dpGain} CC+{row.ai.ccGain}]
                  </li>
                ))}
              </ul>

              <h3>Chargeback</h3>
              <ul className="mini-list">
                <li>
                  transfers {postGameReport.chargebackSummary.transferCount} / player paid{' '}
                  {postGameReport.chargebackSummary.playerPaid} / received{' '}
                  {postGameReport.chargebackSummary.playerReceived}
                </li>
                <li>
                  ai paid {postGameReport.chargebackSummary.aiPaid} / received{' '}
                  {postGameReport.chargebackSummary.aiReceived}
                </li>
              </ul>

              {state.result.companyFailed ? <p className="danger">Company Failed (CH &lt; 40)</p> : null}
            </section>
          ) : null}
        </aside>
      </main>

      <section className="log-card">
        <h2>Logs</h2>
        <div className="log-list">
          {state.logs.slice(-28).map((entry, index) => (
            <p key={`${entry.turn}-${index}`}>
              [S{entry.sprint} T{entry.turn}] {entry.team}: {entry.message}
            </p>
          ))}
        </div>

        <h2>AI Decision Trace</h2>
        <div className="summary-list">
          {aiDecisionTraceRows.length === 0 ? <p>No AI trace yet.</p> : null}
          {aiDecisionTraceRows.map((entry, index) => {
            if (!entry.decisionTrace) {
              return null;
            }

            const trace = entry.decisionTrace;
            const candidateText = trace.candidates
              .slice(0, 3)
              .map(
                (row, candidateIndex) =>
                  `#${candidateIndex + 1} ${row.action}(${format2(row.score)}|l${format2(row.localScore)}|f${format2(row.futureScore)})`,
              )
              .join(' / ');

            return (
              <p key={`${entry.sprint}-${entry.turn}-${index}`}>
                [S{entry.sprint} T{entry.turn}] {trace.profile ?? 'ai'} d{trace.lookaheadDepth} k{trace.topK}{' '}
                {trace.chosenAction} score {format2(trace.score)} = local {format2(trace.localScore)} + lookahead{' '}
                {format2(trace.lookaheadScore)}
                {candidateText.length > 0 ? ` | ${candidateText}` : ''}
              </p>
            );
          })}
        </div>

        <h2>Sprint Summary</h2>
        <div className="summary-list">
          {state.sprintSummaries.map((summary) => (
            <p key={summary.sprint}>
              S{summary.sprint} CH-{summary.chLoss} = backlog {summary.chLossBacklog} + debt{' '}
              {summary.chLossDebt} + owner {summary.chLossOwner} + accident {summary.chLossAccident}
            </p>
          ))}
        </div>

        <h2>Seed Comparison</h2>
        <div className="summary-list">
          {history.length === 0 ? <p>Run a game to collect comparison rows.</p> : null}
          {history.map((row) => (
            <p key={row.key}>
              seed {row.seed} / winner {row.winner} / final {row.playerFinal}:{row.aiFinal} / CH {row.ch} /
              style {styleLabel(row.style)} / ai {row.difficulty} d{row.lookaheadDepth} k{row.topK} / trace{' '}
              {row.aiDecisionCount} avgS {row.aiAvgScore.toFixed(2)} avgL {row.aiAvgLookahead.toFixed(2)}
            </p>
          ))}
        </div>

        <h2>Difficulty Comparison</h2>
        <div className="summary-list">
          {difficultySummary.length === 0 ? <p>No comparison rows yet.</p> : null}
          {difficultySummary.map((row) => (
            <p key={row.key}>
              {row.difficulty} d{row.lookaheadDepth} k{row.topK}: runs {row.runs} / player win{' '}
              {(row.winRate * 100).toFixed(1)}% / avg final {row.avgPlayerFinal.toFixed(1)}:
              {row.avgAiFinal.toFixed(1)} / avg CH {row.avgCh.toFixed(1)}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
