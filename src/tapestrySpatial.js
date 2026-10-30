// The third axis is a schematic hop layer, never geography, time or certainty.
export function celestialScale(count) {
  // Projected body area reflects recorded coverage, capped to protect small neighbors.
  const coverage = Number.isFinite(count)
    ? Math.max(0, Math.min(40, count))
    : 0;
  return Math.sqrt(1 + coverage * 0.3);
}

export function spatialPositions(scene) {
  const adjacency = new Map(scene.nodes.map((n) => [n.id, new Set()]));
  for (const edge of scene.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target))
      throw new Error("Spatial connection has an unknown endpoint.");
    adjacency.get(edge.source).add(edge.target);
    adjacency.get(edge.target).add(edge.source);
  }
  const roots = [...scene.nodes].sort(
    (a, b) =>
      adjacency.get(b.id).size - adjacency.get(a.id).size ||
      a.id.localeCompare(b.id),
  );
  const positions = new Map();
  const index = new Map(scene.nodes.map((n) => [n.id, n]));
  for (const root of roots) {
    if (positions.has(root.id)) continue;
    const queue = [[root.id, 0]],
      seen = new Set([root.id]);
    for (let i = 0; i < queue.length; i++) {
      const [id, hops] = queue[i],
        n = index.get(id);
      if (![n.x, n.y].every(Number.isFinite))
        throw new Error("Invalid spatial position.");
      positions.set(id, { x: n.x, y: -n.y, z: Math.min(hops, 6) * 70, hops });
      for (const neighbor of [...adjacency.get(id)].sort()) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        queue.push([neighbor, hops + 1]);
      }
    }
  }
  return positions;
}

export function selectedPositions(positions, edge) {
  if (!edge) return positions;
  // A selected assertion is framed as a readable two-endpoint schematic.
  return edge.source === edge.target
    ? new Map([[edge.source, { x: 0, y: 0, z: 0 }]])
    : new Map([
        [edge.source, { x: -70, y: 0, z: 0 }],
        [edge.target, { x: 70, y: 0, z: 18 }],
      ]);
}

export function spatialRoutes(edges, positions, bundled = true) {
  const pairs = new Map();
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!positions.has(edge.source) || !positions.has(edge.target))
      throw new Error("Spatial route has an unknown endpoint.");
    const key = JSON.stringify([edge.source, edge.target].sort());
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(edge);
  }
  return [...pairs.entries()].flatMap(([key, members]) => {
    const groups = bundled ? [members] : members.map((e) => [e]);
    return groups.map((claims, i) => {
      const edge = claims[0],
        a = positions.get(edge.source),
        b = positions.get(edge.target);
      const offset = (i - (groups.length - 1) / 2) * 8;
      const points = Array.from({ length: 25 }, (_, step) => {
        const t = step / 24;
        if (edge.source === edge.target) {
          const angle = t * Math.PI * 2;
          return {
            x: a.x + Math.sin(angle) * (22 + Math.abs(offset)),
            y: a.y + (1 - Math.cos(angle)) * 18,
            z: a.z + Math.sin(t * Math.PI) * (18 + offset),
          };
        }
        const dx = b.x - a.x,
          dy = b.y - a.y,
          length = Math.hypot(dx, dy) || 1;
        const orientation = edge.source < edge.target ? 1 : -1;
        const curve = 4 * t * (1 - t);
        return {
          x: a.x + dx * t - (dy / length) * offset * curve * orientation,
          y: a.y + dy * t + (dx / length) * offset * curve * orientation,
          z: a.z + (b.z - a.z) * t + (10 + Math.abs(offset)) * curve,
        };
      });
      return {
        id: bundled ? key : edge.id,
        edges: claims,
        points,
        color:
          new Set(claims.map((e) => e.color)).size > 1 ? "#a9b7b0" : edge.color,
      };
    });
  });
}

export function readSpatialCamera(raw) {
  try {
    const value = JSON.parse(raw);
    if (
      value.version !== 1 ||
      !Number.isFinite(value.zoom) ||
      value.zoom < 0.25 ||
      value.zoom > 16
    )
      return null;
    for (const name of ["position", "target"]) {
      if (
        !Array.isArray(value[name]) ||
        value[name].length !== 3 ||
        !value[name].every((v) => Number.isFinite(v) && Math.abs(v) <= 100000)
      )
        return null;
    }
    const distance = Math.hypot(
      ...value.position.map((v, i) => v - value.target[i]),
    );
    if (distance < 1 || distance > 100000) return null;
    return value;
  } catch {
    return null;
  }
}

export function nearestSpatialMarks(point, nodes, routes, radius = 15) {
  const hits = nodes
    .filter(
      (n) =>
        Math.hypot(n.x - point.x, n.y - point.y) <=
        Math.max(radius, n.radius || 0),
    )
    .map((n) => ({
      kind: "node",
      id: n.id,
      distance: Math.hypot(n.x - point.x, n.y - point.y),
    }))
    .sort((a, b) => a.distance - b.distance);
  if (hits.length)
    return hits.filter((n) => n.distance <= hits[0].distance + 4).slice(0, 6);
  const edges = [];
  for (const route of routes) {
    let distance = Infinity;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1],
        b = route.points[i];
      if (a.visible === false || b.visible === false) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - a.x) * dx + (point.y - a.y) * dy) /
            (dx * dx + dy * dy || 1),
        ),
      );
      distance = Math.min(
        distance,
        Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy),
      );
    }
    if (distance <= 7) edges.push({ kind: "route", id: route.id, distance });
  }
  return edges.sort((a, b) => a.distance - b.distance).slice(0, 4);
}
