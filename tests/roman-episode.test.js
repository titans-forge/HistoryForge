import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { evidenceRecord, evidenceMarkdown } from "../src/exports.js";
import { dataPath } from "../src/api.js";

const root = new URL("../", import.meta.url);
const read = (name) => JSON.parse(fs.readFileSync(new URL("public/data/"+name, root)));
const input = read("roman-inputs.json"), corpus = read("rome-negotiations-49bce.json");
const graph = read("tapestry.json"), edges = graph.edges.filter((e) => e.dossier === corpus.dossier.id);
test("Roman pack is four distinct source-bound records and five typed reports", () => {
  assert.equal(input.nodes.length, 4);
  assert.equal(edges.length, 5);
  assert.equal(new Set(input.nodes.map((n) => n.id)).size, 4);
  assert.ok(input.nodes.every((n) => n.identity_status === "source_bound"));
  assert.deepEqual(edges.map((e) => e.relationship_type), ["reported_message", "reported_message", "requested_delivery", "requested_delivery", "proposed_disbandment"]);
  assert.notEqual(input.nodes.find((n) => n.label === "Julius Caesar").id, input.nodes.find((n) => n.label.startsWith("Lucius")).id);
  for (const edge of edges) {
    assert.equal(edge.date_precision, "year_context");
    assert.match(edge.date_basis, /no calendar day/);
    assert.match(edge.note, /not an executed agreement/);
  }
});
test("Roman exports retain attribution, exact quotes, identities and full reuse terms", () => {
  for (const edge of edges) {
    const record = evidenceRecord(edge, corpus), md = evidenceMarkdown(record);
    assert.match(record.qualification, /retrospective/);
    assert.ok(!record.qualification.includes("July 4"));
    for (const { passage, source } of record.evidence) {
      assert.equal(createHash("sha256").update(passage.text).digest("hex"), passage.text_sha256);
      assert.ok(md.includes(passage.text));
      for (const value of [source.reuse_notice.notice, source.reuse_notice.full_license, source.reuse_notice.original_url, source.reuse_notice.license_url, source.provenance_credit, source.dependence]) assert.ok(md.includes(value));
    }
    assert.equal(record.identity_evidence.length, 2);
    assert.match(md, /public-domain/);
    assert.match(md, /USA/);
    assert.ok(!md.includes("Later biographical identification from NARA"));
  }
});
test("new episode export fails closed without episode qualifications", () => {
  for (const key of ["qualification", "scope", "historical_text_rights"]) {
    const damaged = structuredClone(corpus);
    delete damaged[key];
    assert.throws(() => evidenceRecord(edges[0], damaged), /qualifications/);
  }
  assert.equal(dataPath("/api/corpus?dossier=rome-negotiations-49bce"), "/HistoryForge/data/rome-negotiations-49bce.json");
});
test("production build rejects missing, pending, reused-agent or drifted Roman review receipts", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "hf-review-gate-"));
  try {
    fs.mkdirSync(path.join(temp, "scripts"));
    fs.mkdirSync(path.join(temp, "public/data"), { recursive: true });
    fs.copyFileSync(new URL("scripts/build_collection.py", root), path.join(temp, "scripts/build_collection.py"));
    for (const file of ["source-inputs.json", "roman-inputs.json"])
      fs.copyFileSync(new URL("public/data/"+file, root), path.join(temp, "public/data", file));
    const sha = createHash("sha256").update(fs.readFileSync(new URL("public/data/roman-inputs.json", root))).digest("hex");
    const accepted_claim_ids = edges.map((e) => e.claim_id);
    const valid = { input_sha256: sha, status: "accepted_for_local_public_candidate", accepted_claim_ids, reviews: { textual: { agent_id: "a", report_sha256: "a".repeat(64), accepted_claim_ids }, rights_identity: { agent_id: "b", report_sha256: "b".repeat(64), accepted_claim_ids } } };
    for (const receipt of [null, { status: "pending" }, { ...valid, input_sha256: "b".repeat(64) }, { ...valid, reviews: { ...valid.reviews, rights_identity: valid.reviews.textual } }, { ...valid, accepted_claim_ids: [] }, { ...valid, reviews: { ...valid.reviews, textual: { ...valid.reviews.textual, accepted_claim_ids: [] } } }]) {
      const dest = path.join(temp, "public/data/roman-review.json");
      if (receipt) fs.writeFileSync(dest, JSON.stringify(receipt));
      const env = { ...process.env }; delete env.HISTORY_FORGE_REVIEW_CANDIDATE;
      for (const flags of [["-B"], ["-B", "-O"]]) {
        const result = spawnSync("python3", [...flags, "scripts/build_collection.py"], { cwd: temp, env, encoding: "utf8" });
        assert.notEqual(result.status, 0);
        assert.equal(fs.existsSync(path.join(temp, "public/data/tapestry.json")), false);
      }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
