import type { EdgeState, NodeState } from '@ship/engine';

interface Point {
  x: number;
  y: number;
}

export type IconMode = 'abstract' | 'concrete';

interface GraphBoardProps {
  nodes: NodeState[];
  edges: EdgeState[];
  selectedNodeId: string;
  iconMode: IconMode;
  onSelectNode: (nodeId: string) => void;
}

function ownerColor(owner: NodeState['owner']): string {
  if (owner === 'player') {
    return '#0ea5a4';
  }
  if (owner === 'ai') {
    return '#f97316';
  }
  return '#64748b';
}

const ABSTRACT_ICON_BY_NODE_ID: Record<string, string> = {
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
};

const CONCRETE_ICON_BY_NODE_ID: Record<string, string> = {
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
};

function resolveNodeIcon(nodeId: string, mode: IconMode): string {
  if (mode === 'concrete') {
    return CONCRETE_ICON_BY_NODE_ID[nodeId] ?? '🧩';
  }
  return ABSTRACT_ICON_BY_NODE_ID[nodeId] ?? '◌';
}

export function GraphBoard(props: GraphBoardProps) {
  const { nodes, edges, selectedNodeId, iconMode, onSelectNode } = props;
  const size = 620;
  const center = size / 2;
  const radius = 230;

  const points = new Map<string, Point>();
  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2 - Math.PI / 2;
    points.set(node.id, {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    });
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="graph-board" role="img" aria-label="Domain graph">
      <defs>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {edges.map((edge) => {
        const from = points.get(edge.from);
        const to = points.get(edge.to);
        if (!from || !to) {
          return null;
        }

        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={edge.integrationDebt > 3 ? '#ef4444' : '#94a3b8'}
            strokeOpacity={0.6}
            strokeWidth={1 + edge.coupling}
          />
        );
      })}

      {nodes.map((node) => {
        const point = points.get(node.id);
        if (!point) {
          return null;
        }

        const selected = node.id === selectedNodeId;
        const icon = resolveNodeIcon(node.id, iconMode);
        return (
          <g key={node.id} className="graph-node" onClick={() => onSelectNode(node.id)}>
            <circle
              cx={point.x}
              cy={point.y}
              r={selected ? 30 : 24}
              fill={ownerColor(node.owner)}
              stroke={selected ? '#f8fafc' : '#0f172a'}
              strokeWidth={selected ? 4 : 2}
              filter={selected ? 'url(#glow)' : undefined}
            />
            <text x={point.x} y={point.y - 40} textAnchor="middle" className="node-label">
              {node.name}
            </text>
            <text x={point.x} y={point.y + 1} textAnchor="middle" className="node-icon">
              {icon}
            </text>
            <text x={point.x} y={point.y + 38} textAnchor="middle" className="node-value">
              B{node.backlog} M{node.maturity}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
