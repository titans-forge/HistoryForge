import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  layoutTapestry,
  visibleTapestry,
  searchEntities,
} from "../src/tapestry.js";
import { readFocusState, bindTapestryEvidence } from "../src/tapestryFocus.js";
import {
  tapestryHref,
  tapestryEvidenceHref,
  tapestryReturnHref,
} from "../src/tapestryLinks.js";
import { dataPath } from "../src/api.js";
import { evidenceRecord, evidenceMarkdown } from "../src/exports.js";

const read = (name) =>
  JSON.parse(
    fs.readFileSync(new URL("../public/data/" + name, import.meta.url), "utf8"),
  );
const graph = read("tapestry.json"),
  inputs = read("source-inputs.json");
const corpora = Object.fromEntries(
  graph.dossiers.map((d) => [d.id, read(d.id + ".json")]),
);
const hashText = (s) => createHash("sha256").update(s).digest("hex");
const stable = (o) =>
  Array.isArray(o)
    ? o.map(stable)
    : o && typeof o === "object"
      ? Object.fromEntries(
          Object.keys(o)
            .sort()
            .map((k) => [k, stable(o[k])]),
        )
      : o;
const canonical = (o) =>
  JSON.stringify(stable(o)).replace(
    /[\u007f-\uffff]/g,
    (s) => "\\u" + s.charCodeAt(0).toString(16).padStart(4, "0"),
  );

test("bounded counts and identity crossings are explicit", () => {
  assert.deepEqual(graph.counts, {
    entities: 91,
    connections: 95,
    dossiers: 2,
  });
  assert.equal(graph.nodes.filter((n) => n.type === "person").length, 89);
  assert.equal(graph.nodes.filter((n) => n.appearances.length === 2).length, 6);
  assert.equal(new Set(graph.nodes.map((n) => n.id)).size, 91);
  assert.equal(corpora["declaration-1776"].claims.length, 56);
  assert.equal(corpora["constitution-1787"].claims.length, 39);
});
test("every edge binds to its exact source passage and claim", () => {
  for (const edge of graph.edges) {
    const corpus = corpora[edge.dossier];
    const bound = bindTapestryEvidence(edge, corpus);
    assert.equal(bound.claim.subject, edge.source);
    assert.equal(bound.claim.object, edge.target);
    for (const { passage } of bound.passages)
      assert.equal(hashText(passage.text), passage.text_sha256);
    assert.equal(edge.relationship_type, "listed_signature");
    assert.equal(edge.provisional_endpoints.length, 0);
  }
});
test("corpus and graph content hashes are reproducible", () => {
  for (const corpus of Object.values(corpora)) {
    const { audit, ...body } = corpus;
    assert.equal(hashText(canonical(body)), audit.corpus_sha256);
  }
  const { revision, ...body } = graph;
  assert.equal(hashText(canonical(body)), revision);
});
test("every quote is a literal frozen historical signature block", () => {
  for (const [short, year] of [
    ["declaration", "1776"],
    ["constitution", "1787"],
  ]) {
    const corpus = corpora[short + "-" + year];
    assert.deepEqual(
      corpus.passages.map((p) => p.text),
      inputs[short].map((g) => g.lines.join("\n")),
    );
    for (const claim of corpus.claims) {
      const group = inputs[short].find((g) =>
        g.names.includes(claim.source_signature),
      );
      assert.equal(group.heading, claim.source_heading);
    }
  }
  assert.ok(!graph.nodes.some((n) => /William Jackson/.test(n.label)));
});
test("dates cannot imply all Declaration names signed on July 4", () => {
  for (const edge of graph.edges) {
    assert.equal(edge.date_precision, "document_date_only");
    if (edge.dossier === "declaration-1776")
      assert.match(edge.date_basis, /not an individual signing date/);
  }
});
test("the six mappings retain signatures, later-biography provenance and capture hashes", () => {
  const identities = corpora["constitution-1787"].identity_evidence;
  assert.equal(identities.length, 6);
  for (const item of identities) {
    assert.match(
      item.url,
      /^https:\/\/www.archives.gov\/founding-docs\/founding-fathers-/,
    );
    assert.match(item.capture_sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      graph.nodes.find((n) => n.id === item.person_id).label,
      item.label,
    );
  }
  assert.notEqual(
    graph.nodes.find((n) => n.label === "Gouv Morris").id,
    graph.nodes.find((n) => n.label === "Robert Morris").id,
  );
});
test("identity IDs never substitute for unreviewed similarity matches", () => {
  assert.equal(
    graph.nodes.find((n) => n.label === "Charles Carroll of Carrollton")
      .appearances.length,
    1,
  );
  assert.equal(
    graph.nodes.find((n) => n.label === "Danl. Carroll").appearances.length,
    1,
  );
});
test("the upstream Morris locator defect is explicit, not silently repaired", () => {
  const item = corpora["constitution-1787"].identity_evidence.find(
    (i) => i.label === "Robert Morris",
  );
  assert.ok(item.url.endsWith("#rmorris"));
  assert.ok(item.transcription_href.endsWith("#morris"));
  assert.match(item.locator_note, /editorial/);
  const edge = graph.edges.find(
    (e) => e.dossier === "constitution-1787" && e.source === item.person_id,
  );
  const markdown = evidenceMarkdown(
    evidenceRecord(edge, corpora[edge.dossier]),
  );
  assert.ok(
    markdown.includes(item.url) &&
      markdown.includes(item.transcription_href) &&
      markdown.includes(item.locator_note),
  );
  assert.match(markdown, /Source dependence/);
  assert.match(markdown, /not an independent primary witness/);
});
test("all JSON and Markdown exports retain rights, qualifications, source and hashes", () => {
  for (const edge of graph.edges) {
    const record = evidenceRecord(edge, corpora[edge.dossier]);
    assert.ok(record.relationship.href.startsWith("/HistoryForge/?dossier="));
    const markdown = evidenceMarkdown(record);
    assert.equal(JSON.parse(JSON.stringify(record)).claim.id, edge.claim_id);
    for (const text of [
      edge.text,
      edge.date_basis,
      edge.corpus_sha256,
      edge.citations[0].url,
      edge.citations[0].text_sha256,
      "Apache-2.0",
      "public-domain",
      "not the full",
    ])
      assert.ok(markdown.includes(text), text);
    assert.ok(
      record.evidence.every(({ passage }) =>
        markdown.includes(passage.text.split("\n")[0]),
      ),
    );
  }
});
test("evidence rejects revision drift, changed claim, passage set or source URL", () => {
  const edge = graph.edges[0],
    corpus = corpora[edge.dossier];
  for (const mutate of [
    (c) => (c.audit.corpus_sha256 = "changed"),
    (c) => (c.claims[0].text = "changed"),
    (c) => (c.claims[0].passage_ids = []),
    (c) => (c.passages[0].url = "https://invalid.example/"),
  ]) {
    const copy = structuredClone(corpus);
    mutate(copy);
    assert.throws(() => bindTapestryEvidence(edge, copy));
  }
});
test("nested Pages URLs preserve graph selection and return state", () => {
  const edge = graph.edges[0];
  const state = {
    experience: "focus",
    node: edge.source,
    edge: edge.id,
    revision: graph.revision,
    region: "all",
    relation: "all",
    query: "",
    lens: "focus",
    space: "3d",
  };
  const href = tapestryEvidenceHref(edge, state);
  assert.ok(href.startsWith("/HistoryForge/?"));
  const back = tapestryReturnHref(href.split("?")[1]);
  assert.equal(back, tapestryHref(state));
  assert.match(back, /space=3d/);
});
test("static API is read-only and dossier allowlisted", () => {
  assert.equal(dataPath("/api/tapestry"), "/HistoryForge/data/tapestry.json");
  assert.equal(
    dataPath("/api/corpus?dossier=constitution-1787"),
    "/HistoryForge/data/constitution-1787.json",
  );
  for (const path of [
    "/api/corpus?dossier=private",
    "/api/corpus?dossier=declaration-1776&dossier=constitution-1787",
    "/api/notebook",
    "/api/corpus?dossier=../../.env",
  ])
    assert.throws(() => dataPath(path));
  assert.throws(() => dataPath("/api/tapestry", {}));
});
test("layout, searches and selection parsing work on the published graph", () => {
  const scene = layoutTapestry(graph);
  assert.ok(
    scene.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)),
  );
  assert.equal(visibleTapestry(scene).edges.length, 95);
  assert.equal(
    searchEntities(scene.nodes, "Franklin")[0].label,
    "Benjamin Franklin",
  );
  assert.equal(
    readFocusState("?node=person-benjamin-franklin&space=3d", graph).state
      .space,
    "3d",
  );
  assert.equal(readFocusState("?node=one&node=two", graph).state.node, "");
});
test("only four allowlisted public payloads are distributed", () => {
  assert.deepEqual(
    fs.readdirSync(new URL("../public/data", import.meta.url)).sort(),
    [
      "constitution-1787.json",
      "declaration-1776.json",
      "source-inputs.json",
      "tapestry.json",
    ],
  );
});
