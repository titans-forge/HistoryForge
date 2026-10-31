// Display only: the source predicates and reuse identifiers remain unchanged.
export function evidenceLabel(value) {
  if (typeof value !== "string") return "";
  const label = value.replaceAll("_", " ").trim();
  return label ? label[0].toUpperCase() + label.slice(1) : "";
}

export function relationshipLabel(edge) {
  return edge.relationship_label || evidenceLabel(edge.predicate);
}
