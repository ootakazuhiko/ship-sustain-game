import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chooseAction } from '@ship/ai';
import { createInitialState, defaultScenario, simulateGame, type GameAction, type GameState } from '@ship/engine';

interface ActionCount {
  deliver: number;
  sustain: number;
  investMaturity: number;
  investAsset: number;
  pass: number;
}

interface RunSummary {
  seed: number;
  winner: string;
  companyFailed: boolean;
  playerFinal: number;
  aiFinal: number;
  ch: number;
  actionCount: Record<'player' | 'ai', ActionCount>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'playlogs');

const seeds = [42, 314, 2718];

function initActionCount(): ActionCount {
  return {
    deliver: 0,
    sustain: 0,
    investMaturity: 0,
    investAsset: 0,
    pass: 0,
  };
}

function countActions(state: GameState): Record<'player' | 'ai', ActionCount> {
  const result: Record<'player' | 'ai', ActionCount> = {
    player: initActionCount(),
    ai: initActionCount(),
  };

  for (const entry of state.logs) {
    const team = entry.team;
    if (entry.message.startsWith('Work Deliver')) {
      result[team].deliver += 1;
      continue;
    }
    if (entry.message.startsWith('Work Sustain')) {
      result[team].sustain += 1;
      continue;
    }
    if (entry.message.startsWith('Invest Maturity')) {
      result[team].investMaturity += 1;
      continue;
    }
    if (entry.message.startsWith('Invest Asset') || entry.message.startsWith('Invest Edge Asset')) {
      result[team].investAsset += 1;
      continue;
    }
    if (entry.message.startsWith('Pass')) {
      result[team].pass += 1;
    }
  }

  return result;
}

function chooseForTeam(state: GameState): GameAction {
  return chooseAction(state).action;
}

function toMarkdown(runs: RunSummary[]): string {
  const avgPlayerFinal = runs.reduce((sum, run) => sum + run.playerFinal, 0) / runs.length;
  const avgAiFinal = runs.reduce((sum, run) => sum + run.aiFinal, 0) / runs.length;
  const avgCH = runs.reduce((sum, run) => sum + run.ch, 0) / runs.length;
  const companyFailCount = runs.filter((run) => run.companyFailed).length;
  const playerWinCount = runs.filter((run) => run.winner === 'player').length;
  const aiWinCount = runs.filter((run) => run.winner === 'ai').length;

  const lines: string[] = [];
  lines.push('# v0 playlog summary');
  lines.push('');
  lines.push(`- Run date: ${new Date().toISOString()}`);
  lines.push(`- Seeds: ${seeds.join(', ')}`);
  lines.push(`- Player wins: ${playerWinCount}`);
  lines.push(`- AI wins: ${aiWinCount}`);
  lines.push(`- Draws: ${runs.length - playerWinCount - aiWinCount}`);
  lines.push(`- Company failed count (CH < 40): ${companyFailCount}/${runs.length}`);
  lines.push(`- Average final score: player ${avgPlayerFinal.toFixed(2)}, ai ${avgAiFinal.toFixed(2)}`);
  lines.push(`- Average CH end: ${avgCH.toFixed(2)}`);
  lines.push('');
  lines.push('## Per seed');
  lines.push('');
  lines.push('| Seed | Winner | Player Final | AI Final | CH | Company Failed |');
  lines.push('| --- | --- | ---: | ---: | ---: | --- |');
  for (const run of runs) {
    lines.push(
      `| ${run.seed} | ${run.winner} | ${run.playerFinal.toFixed(2)} | ${run.aiFinal.toFixed(2)} | ${run.ch} | ${run.companyFailed ? 'yes' : 'no'} |`,
    );
  }

  lines.push('');
  lines.push('## Initial balance observations');
  lines.push('');

  if (companyFailCount === runs.length) {
    lines.push('- All runs ended with CH < 40. End-of-sprint penalties are likely too strong for v0.');
  } else if (companyFailCount > 0) {
    lines.push('- Some runs ended with CH < 40. CH penalty parameters should be tuned after manual play.');
  } else {
    lines.push('- No run triggered CH gate. Pressure from sustain side may be too weak.');
  }

  if (playerWinCount === runs.length || aiWinCount === runs.length) {
    lines.push('- One side wins all runs. Turn order or heuristic bias should be reviewed.');
  } else {
    lines.push('- Win/loss is mixed across seeds. Current heuristic produces non-trivial outcomes.');
  }

  lines.push('- Detailed raw logs are saved as JSON files in docs/playlogs/.');

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  const runSummaries: RunSummary[] = [];

  for (const seed of seeds) {
    const initial = createInitialState(defaultScenario, seed);
    const finalState = simulateGame(initial, {
      player: chooseForTeam,
      ai: chooseForTeam,
    });

    if (!finalState.result) {
      throw new Error(`Result is null for seed ${seed}`);
    }

    const actionCount = countActions(finalState);

    const runSummary: RunSummary = {
      seed,
      winner: finalState.result.winner,
      companyFailed: finalState.result.companyFailed,
      playerFinal: finalState.result.playerFinal,
      aiFinal: finalState.result.aiFinal,
      ch: finalState.ch,
      actionCount,
    };

    runSummaries.push(runSummary);

    const jsonPayload = {
      seed,
      config: finalState.config,
      score: finalState.score,
      result: finalState.result,
      ch: finalState.ch,
      sprintSummaries: finalState.sprintSummaries,
      actionCount,
      logs: finalState.logs,
    };

    await writeFile(
      path.join(outputDir, `v0-seed-${seed}.json`),
      `${JSON.stringify(jsonPayload, null, 2)}\n`,
      'utf8',
    );
  }

  const summaryMarkdown = toMarkdown(runSummaries);
  await writeFile(path.join(outputDir, 'v0-summary.md'), summaryMarkdown, 'utf8');

  console.log('Saved playlogs:', runSummaries.map((run) => `v0-seed-${run.seed}.json`).join(', '));
  console.log('Saved summary: docs/playlogs/v0-summary.md');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
