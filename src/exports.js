import { bindTapestryEvidence } from "./tapestryFocus.js";
export function evidenceRecord(edge, corpus) {
  const bound = bindTapestryEvidence(edge, corpus);
  if (edge.relationship_type !== "listed_signature" &&
      (!corpus.qualification || !corpus.scope || !corpus.historical_text_rights))
    throw new Error("This episode is missing its source-specific export qualifications.");
  return {
    schema: "history-forge-public-evidence-v1",
    scope: corpus.scope || "Public signatory pilot; not the full private research corpus.",
    code_license: "Apache-2.0",
    original_data_license: "Apache-2.0",
    historical_text_rights:
      corpus.historical_text_rights || "Public-domain historical signature text; see source-specific notices.",
    relationship: edge,
    claim: bound.claim,
    evidence: bound.passages,
    identity_evidence: corpus.identity_evidence.filter(
      (item) => item.person_id === edge.source || item.person_id === edge.target,
    ),
    audit: corpus.audit,
    qualification:
      corpus.qualification || "A listed signature is not proof of a personal meeting, co-authorship, or assent to every clause. July 4, 1776 is the Declaration's adoption date, not an assigned individual signing date.",
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
    ...[...new Map(record.evidence.filter(({ source }) => source.reuse_notice).map(({ source }) => [source.id, source.reuse_notice])).values()].flatMap((notice) => [
      "", "## " + notice.label, "", notice.notice, "", notice.license_url,
      "Original format: " + notice.original_url, "", notice.full_license,
    ]),
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
        item.statement ? item.label + ": " + item.statement + "\n" + item.citation + "\n" + item.url : item.signature +
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
    record.historical_text_rights,
    "",
    "Original application code, structured data and annotations: Apache-2.0. Historical text retains its separate public-domain status within the stated rights scope and any source-specific reuse terms. No source provider endorsement is implied.",
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
