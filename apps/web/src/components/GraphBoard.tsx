import type { EdgeState, NodeState } from '@ship/engine';

interface Point {
  x: number;
  y: number;
}

interface GraphBoardProps {
  nodes: NodeState[];
  edges: EdgeState[];
  selectedNodeId: string;
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

export function GraphBoard(props: GraphBoardProps) {
  const { nodes, edges, selectedNodeId, onSelectNode } = props;
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
            <text x={point.x} y={point.y - 34} textAnchor="middle" className="node-label">
              {node.name}
            </text>
            <text x={point.x} y={point.y + 6} textAnchor="middle" className="node-value">
              B{node.backlog}
            </text>
            <text x={point.x} y={point.y + 19} textAnchor="middle" className="node-value-small">
              M{node.maturity}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
