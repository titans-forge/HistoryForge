import { bindTapestryEvidence } from "./tapestryFocus.js";
export function evidenceRecord(edge, corpus) {
  const bound = bindTapestryEvidence(edge, corpus);
  return {
    schema: "history-forge-public-evidence-v1",
    scope: "Public signatory pilot; not the full private research corpus.",
    code_license: "Apache-2.0",
    original_data_license: "Apache-2.0",
    historical_text_rights:
      "Public-domain historical signature text; see source-specific notices.",
    relationship: edge,
    claim: bound.claim,
    evidence: bound.passages,
    identity_evidence: corpus.identity_evidence.filter(
      (item) => item.person_id === edge.source,
    ),
    audit: corpus.audit,
    qualification:
      "A listed signature is not proof of a personal meeting, co-authorship, or assent to every clause. July 4, 1776 is the Declaration's adoption date, not an assigned individual signing date.",
  };
}
export function evidenceMarkdown(record) {
  const edge = record.relationship;
  return [
    "# History Forge: Public Evidence Record",
    "",
    edge.text,
    "",
    "- Relationship: " + edge.relationship_label,
    "- Date: " + edge.date_label,
    "- Date basis: " + edge.date_basis,
    "- Status: " + edge.status,
    "- Corpus SHA-256: " + edge.corpus_sha256,
    "",
    "## Qualification",
    "",
    record.qualification,
    ...record.evidence.flatMap(({ passage, source }) => [
      "",
      "## Source",
      "",
      source.title,
      "Source type: " + source.kind,
      source.provenance_credit,
      "Source dependence: " + source.dependence,
      "",
      passage.citation,
      "",
      passage.url,
      "",
      ...passage.text.split("\n").map((line) => "> " + line),
      "",
      passage.editorial_context,
      "",
      passage.license_credit,
      "",
      "Passage SHA-256: " + passage.text_sha256,
    ]),
    "",
    "## Identity Evidence",
    "",
    ...record.identity_evidence.map(
      (item) =>
        item.signature +
        " -> " +
        item.label +
        ": " +
        item.url +
        "\nLater biographical identification from NARA, not an independent primary witness." +
        (item.transcription_href
          ? "\nOriginal transcription href: " +
            item.transcription_href +
            "\n" +
            item.locator_note
          : ""),
    ),
    "",
    "## Release Scope And Rights",
    "",
    record.scope,
    "",
    "Original application code, structured data and annotations: Apache-2.0. Historical text retains its separate public-domain status. No National Archives endorsement is implied.",
    "",
  ].join("\n");
}
export function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
