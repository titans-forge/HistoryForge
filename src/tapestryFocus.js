import { visibleTapestry } from "./tapestry.js";

export function readFocusState(search, data) {
  const params = new URLSearchParams(search);
  const keys = [
    "node",
    "edge",
    "region",
    "relation",
    "q",
    "lens",
    "revision",
    "space",
  ];
  const ambiguous = keys.some(
    (key) =>
      params.getAll(key).length > 1 || (params.get(key)?.length || 0) > 512,
  );
  const get = (key) => (ambiguous ? "" : params.get(key) || "");
  const state = {
    experience: "focus",
    node: get("node"),
    edge: get("edge"),
    region: get("region") || "all",
    relation: get("relation") || "all",
    query: get("q").slice(0, 160),
    lens: get("lens") === "focus" ? "focus" : "overview",
    space: get("space") === "3d" ? "3d" : "2d",
    revision: get("revision"),
  };
  let notice = ambiguous ? "Ambiguous saved selection was cleared." : "";
  if (!data) return { state, notice };
  if (state.revision && state.revision !== data.revision) {
    state.node = "";
    state.edge = "";
    state.lens = "overview";
    notice =
      "The collection has changed. The saved selection was cleared; filters were checked against this revision.";
  }
  state.revision = data.revision;
  if (!data.regions.some((r) => r.id === state.region)) state.region = "all";
  if (!data.edges.some((e) => e.relationship_type === state.relation))
    state.relation = "all";
  const visible = visibleTapestry(data, state.region, state.relation);
  const edge = visible.edges.find((e) => e.id === state.edge);
  if (!edge) state.edge = "";
  if (!visible.nodes.some((n) => n.id === state.node)) state.node = "";
  if (edge && ![edge.source, edge.target].includes(state.node))
    state.node = edge.source;
  if (!state.node) state.lens = "overview";
  return { state, notice };
}

export function focusNeighborhood(scene, node, edgeId, page = 0, pageSize = 6) {
  const selectedEdge = scene.edges.find((e) => e.id === edgeId);
  const connected = scene.edges.filter(
    (e) => e.source === node || e.target === node,
  );
  const neighbors = [...new Set(connected.flatMap((e) => [e.source, e.target]))]
    .filter((id) => id !== node)
    .sort();
  const pages = Math.max(1, Math.ceil(neighbors.length / pageSize));
  const current = Math.max(0, Math.min(page, pages - 1));
  const ids = new Set(
    selectedEdge
      ? [selectedEdge.source, selectedEdge.target]
      : [
          node,
          ...neighbors.slice(current * pageSize, (current + 1) * pageSize),
        ],
  );
  const edges = selectedEdge
    ? [selectedEdge]
    : connected.filter((e) => ids.has(e.source) && ids.has(e.target));
  return {
    nodes: scene.nodes.filter((n) => ids.has(n.id)),
    edges,
    totalConnections: connected.length,
    pages,
    page: current,
  };
}

export function bindTapestryEvidence(edge, corpus) {
  if (corpus.audit?.corpus_sha256 !== edge.corpus_sha256)
    throw new Error(
      "Evidence revision changed. Refresh the collection before reading this connection.",
    );
  const claim = corpus.claims.find((c) => c.id === edge.claim_id);
  if (!claim || claim.text !== edge.text)
    throw new Error("This connection no longer matches its dossier.");
  if (
    claim.passage_ids.length !== edge.citations.length ||
    !claim.passage_ids.every((id) =>
      edge.citations.some((c) => c.passage_id === id),
    )
  )
    throw new Error("The supporting passage set has changed.");
  const passages = edge.citations.map((citation) => {
    const passage = corpus.passages.find((p) => p.id === citation.passage_id);
    const source = corpus.sources.find((s) => s.id === passage?.source_id);
    if (
      !passage ||
      !source ||
      passage.text_sha256 !== citation.text_sha256 ||
      passage.url !== citation.url
    )
      throw new Error("The source binding has changed.");
    return { passage, source };
  });
  return { claim, passages };
}
