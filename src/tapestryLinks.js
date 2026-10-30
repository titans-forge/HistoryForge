export function tapestryHref({
  node,
  region,
  relation,
  query,
  experience,
  edge,
  lens,
  revision,
  space,
} = {}) {
  const p = new URLSearchParams({ tapestry: "1" });
  if (node) p.set("node", node);
  if (region && region !== "all") p.set("region", region);
  if (relation && relation !== "all") p.set("relation", relation);
  if (query) p.set("q", query);
  if (experience === "focus") {
    p.set("tapestry_v2", "1");
    if (edge) p.set("edge", edge);
    if (lens === "focus") p.set("lens", lens);
    if (revision) p.set("revision", revision);
    if (space === "3d") p.set("space", space);
  }
  return (import.meta.env?.BASE_URL || "/HistoryForge/") + "?" + p;
}

export function tapestryEvidenceHref(edge, state) {
  const p = new URLSearchParams(edge.href.split("?")[1]);
  p.set("return_tapestry", "1");
  if (state.node) p.set("return_node", state.node);
  if (state.region !== "all") p.set("return_region", state.region);
  if (state.relation !== "all") p.set("return_relation", state.relation);
  if (state.query) p.set("return_query", state.query);
  if (state.experience === "focus") {
    p.set("return_experience", "focus");
    if (state.edge) p.set("return_edge", state.edge);
    if (state.lens) p.set("return_lens", state.lens);
    if (state.revision) p.set("return_revision", state.revision);
    if (state.space === "3d") p.set("return_space", state.space);
  }
  return (import.meta.env?.BASE_URL || "/HistoryForge/") + "?" + p;
}

export function tapestryReturnHref(search) {
  const p = new URLSearchParams(search);
  if (
    p.getAll("return_tapestry").length !== 1 ||
    p.get("return_tapestry") !== "1"
  )
    return null;
  for (const key of [
    "return_node",
    "return_region",
    "return_relation",
    "return_query",
    "return_experience",
    "return_edge",
    "return_lens",
    "return_revision",
    "return_space",
  ]) {
    if (p.getAll(key).length > 1 || (p.get(key)?.length || 0) > 512)
      return null;
  }
  return tapestryHref({
    node: p.get("return_node"),
    region: p.get("return_region"),
    relation: p.get("return_relation"),
    query: p.get("return_query"),
    experience: p.get("return_experience"),
    edge: p.get("return_edge"),
    lens: p.get("return_lens"),
    revision: p.get("return_revision"),
    space: p.get("return_space"),
  });
}
