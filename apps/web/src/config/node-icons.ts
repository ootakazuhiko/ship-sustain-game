export type IconMode = 'abstract' | 'concrete';

const NODE_ICONS: Record<IconMode, Record<string, string>> = {
  abstract: {
    fe: '⬢',
    be: '⬡',
    data: '◍',
    platform: '◈',
    sre: '◎',
    sec: '◉',
    qa: '◐',
    devops: '◒',
    support: '◑',
    mobile: '◓',
    api: '✦',
    analytics: '✶',
  },
  concrete: {
    fe: '🖥️',
    be: '🧠',
    data: '🗄️',
    platform: '🏗️',
    sre: '🚨',
    sec: '🔒',
    qa: '✅',
    devops: '⚙️',
    support: '🎧',
    mobile: '📱',
    api: '🌐',
    analytics: '📈',
  },
};

const FALLBACK_ICON: Record<IconMode, string> = {
  abstract: '◌',
  concrete: '🧩',
};

export function resolveNodeIcon(nodeId: string, mode: IconMode): string {
  return NODE_ICONS[mode][nodeId] ?? FALLBACK_ICON[mode];
}
