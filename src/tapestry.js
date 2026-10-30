import { MultiDirectedGraph } from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { packSiblings } from "d3-hierarchy";

const CENTERS = {
  mediterranean: [-540, -270],
  europe: [-80, -450],
  africa: [-600, 340],
  asia: [600, -200],
  americas: [40, 400],
  oceania: [650, 490],
  mixed: [50, 0],
  unknown: [640, -540],
};

function hash(text) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
}

export function layoutTapestry(data) {
  const graph = new MultiDirectedGraph();
  for (const n of data.nodes) {
    const center = CENTERS[n.region] || CENTERS.unknown;
    const dossier = n.appearances[0]?.dossier || n.id;
    const a = hash(dossier) * Math.PI * 2;
    const b = hash(n.id) * Math.PI * 2;
    const r = 15 + Math.sqrt(hash(n.id + ":radius")) * 130;
    graph.addNode(n.id, {
      x: center[0] + Math.cos(a) * 160 + Math.cos(b) * r,
      y: center[1] + Math.sin(a) * 160 + Math.sin(b) * r,
      size: 3,
    });
  }
  for (const e of data.edges)
    graph.addDirectedEdgeWithKey(e.id, e.source, e.target);
  if (graph.order > 1)
    forceAtlas2.assign(graph, {
      iterations: 130,
      settings: {
        barnesHutOptimize: true,
        barnesHutTheta: 0.7,
        gravity: 0.7,
        scalingRatio: 12,
        slowDown: 5,
        edgeWeightInfluence: 0,
      },
    });
  // Pack actual connected components, preserving every edge and every gap.
  const seen = new Set(),
    components = [];
  for (const id of graph.nodes()) {
    if (seen.has(id)) continue;
    const members = [],
      queue = [id];
    seen.add(id);
    for (let i = 0; i < queue.length; i++) {
      const next = queue[i];
      members.push(next);
      for (const neighbor of graph.neighbors(next))
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
    }
    components.push({
      members,
      r: Math.max(34, Math.sqrt(members.length) * 22) + 18,
    });
  }
  components.sort(
    (a, b) =>
      b.members.length - a.members.length ||
      a.members[0].localeCompare(b.members[0]),
  );
  packSiblings(components);
  for (const component of components) {
    const positions = component.members.map((id) =>
      graph.getNodeAttributes(id),
    );
    const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length,
      cy = positions.reduce((s, p) => s + p.y, 0) / positions.length;
    const extent = Math.max(
      1,
      ...positions.map((p) => Math.hypot(p.x - cx, p.y - cy)),
    );
    for (const id of component.members) {
      const p = graph.getNodeAttributes(id),
        dx = p.x - cx,
        dy = p.y - cy,
        d = Math.hypot(dx, dy);
      const scale = d
        ? (Math.pow(d / extent, 0.7) * (component.r - 18)) / d
        : 0;
      graph.mergeNodeAttributes(id, {
        x: component.x + dx * scale,
        y: component.y + dy * scale,
      });
    }
  }
  const colors = new Map(data.regions.map((r) => [r.id, r.color]));
  const nodes = data.nodes.map((n) => ({
    ...n,
    ...graph.getNodeAttributes(n.id),
    color: colors.get(n.region) || "#aab4b7",
    radius: 2.2 + Math.min(6, Math.log2(n.connection_count + 1)),
  }));
  if (nodes.some((n) => !Number.isFinite(n.x) || !Number.isFinite(n.y)))
    throw new Error("The tapestry layout could not be calculated.");
  const index = new Map(nodes.map((n) => [n.id, n]));
  const pairs = new Map();
  const edges = data.edges.map((e) => {
    const pair = [e.source, e.target].sort().join("\0");
    const count = pairs.get(pair) || 0;
    pairs.set(pair, count + 1);
    return {
      ...e,
      from: index.get(e.source),
      to: index.get(e.target),
      bend: count ? (count % 2 ? 1 : -1) * (10 + Math.ceil(count / 2) * 7) : 0,
      color: colors.get(e.region) || "#aab4b7",
    };
  });
  return { nodes, edges, index };
}

export function visibleTapestry(scene, region = "all", relation = "all") {
  const edges = scene.edges.filter(
    (e) =>
      (region === "all" || e.region === region) &&
      (relation === "all" || e.relationship_type === relation),
  );
  const ids = new Set(edges.flatMap((e) => [e.source, e.target]));
  return { ...scene, edges, nodes: scene.nodes.filter((n) => ids.has(n.id)) };
}

const fold = (text) =>
  String(text)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase();
export function searchEntities(nodes, query) {
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  return nodes
    .filter((n) =>
      words.every((w) => fold([n.label, ...n.aliases].join(" ")).includes(w)),
    )
    .sort((a, b) =>
      words.length
        ? a.label.localeCompare(b.label)
        : b.connection_count - a.connection_count ||
          a.label.localeCompare(b.label),
    );
}
