import { useEffect, useRef, useState } from "react";
import {
  UserRound,
  Users,
  Building2,
  MapPin,
  FileText,
  CalendarDays,
  Shapes,
} from "lucide-react";

export function EntityGlyph({ type, ...props }) {
  const Icon =
    {
      person: UserRound,
      group: Users,
      institution: Building2,
      organization: Building2,
      place: MapPin,
      document: FileText,
      work: FileText,
      event: CalendarDays,
    }[type] || Shapes;
  return <Icon {...props} />;
}

export default function TapestryFocusGraph({
  graph,
  selected,
  activeEdge,
  onNode,
  onEdge,
  onCapacity,
}) {
  const host = useRef(null),
    [size, setSize] = useState({ width: 800, height: 500 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const compact = size.width < 560;
  useEffect(() => {
    onCapacity?.(compact ? 1 : 6);
  }, [compact, onCapacity]);
  const width = size.width,
    height = size.height;
  const active = graph.edges.find((e) => e.id === activeEdge);
  const positions = new Map();
  if (active && active.source !== active.target) {
    positions.set(active.source, {
      x: width * (compact ? 0.2 : 0.22),
      y: height * 0.48,
    });
    positions.set(active.target, {
      x: width * (compact ? 0.8 : 0.78),
      y: height * 0.48,
    });
  } else if (compact && !active) {
    const others = graph.nodes.filter((n) => n.id !== selected);
    positions.set(selected, { x: width * 0.2, y: height * 0.43 });
    others.forEach((n, i) =>
      positions.set(n.id, {
        x: width * 0.8,
        y: height * (others.length === 1 ? 0.43 : i === 0 ? 0.17 : 0.69),
      }),
    );
  } else {
    positions.set(selected, { x: width / 2, y: height / 2 });
    const others = graph.nodes.filter((n) => n.id !== selected);
    others.forEach((n, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / others.length;
      positions.set(n.id, {
        x: width / 2 + Math.cos(angle) * Math.max(45, width / 2 - 95),
        y: height / 2 + Math.sin(angle) * Math.max(0, height / 2 - 115),
      });
    });
  }
  const pairs = new Map();
  return (
    <div
      className={"tf-focus-graph " + (compact ? "compact" : "")}
      ref={host}
      aria-label="Focused sourced connections"
    >
      <svg
        className="tf-strands"
        width={width}
        height={height}
        aria-hidden="true"
      >
        <defs>
          <marker
            id="tf-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10" fill="context-stroke" />
          </marker>
        </defs>
        {graph.edges.map((e) => {
          const a = positions.get(e.source),
            b = positions.get(e.target);
          if (!a || !b) return null;
          const pair = [e.source, e.target].sort().join("|"),
            slot = pairs.get(pair) || 0;
          pairs.set(pair, slot + 1);
          const dx = b.x - a.x,
            dy = b.y - a.y,
            len = Math.hypot(dx, dy) || 1;
          const pad = compact ? 48 : 77;
          const start = {
              x: a.x + (dx / len) * pad,
              y: a.y + (dy / len) * pad,
            },
            end = { x: b.x - (dx / len) * pad, y: b.y - (dy / len) * pad };
          const bend = (slot % 2 ? 1 : -1) * Math.ceil(slot / 2) * 28;
          const control = {
            x: (a.x + b.x) / 2 - (dy / len) * bend,
            y: (a.y + b.y) / 2 + (dx / len) * bend,
          };
          const d =
            e.source === e.target
              ? `M ${a.x - 30} ${a.y} C ${a.x - 120} ${Math.max(18, a.y - 100)}, ${a.x + 120} ${Math.max(18, a.y - 100)}, ${a.x + 30} ${a.y}`
              : `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
          return (
            <g key={e.id}>
              <path
                d={d}
                stroke={e.color}
                strokeWidth={active ? 2 : 1.5}
                fill="none"
                markerEnd="url(#tf-arrow)"
                opacity={active ? 1 : 0.65}
              />
              <path
                d={d}
                stroke="transparent"
                strokeWidth="24"
                fill="none"
                onClick={() => onEdge(e.id)}
                className="tf-edge-hit"
              />
            </g>
          );
        })}
      </svg>
      {active && (
        <div
          className="tf-predicate"
          style={{
            left: "50%",
            top:
              active.source === active.target
                ? "18%"
                : compact
                  ? Math.max(22, height * 0.12)
                  : "48%",
          }}
        >
          <span>{active.predicate || active.relationship_label}</span>
          <small>{active.relationship_label}</small>
        </div>
      )}
      {graph.nodes.map((n) => {
        const p = positions.get(n.id);
        if (!p) return null;
        return (
          <button
            key={n.id}
            className={"tf-graph-node " + (n.id === selected ? "selected" : "")}
            style={{ left: p.x, top: p.y, "--entity-color": n.color }}
            onClick={() => onNode(n.id)}
            aria-label={"Explore " + n.label}
          >
            <span className="tf-node-mark">
              <EntityGlyph type={n.type} size={22} />
            </span>
            <strong>{n.label.replaceAll("|", " ")}</strong>
            <small>{n.type.replaceAll("_", " ")}</small>
          </button>
        );
      })}
    </div>
  );
}
