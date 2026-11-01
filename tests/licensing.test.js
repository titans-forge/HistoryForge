import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (name) => fs.readFileSync(name, "utf8");

test("layered licensing preserves Apache software and preview grants", () => {
  const pkg = JSON.parse(read("package.json"));
  const notice = read("NOTICE");
  const scope = read("LICENSING.md");
  const dataLicense = read("HISTORY_FORGE_DATA_LICENSE.md");

  assert.equal(pkg.license, "Apache-2.0");
  assert.match(read("LICENSE"), /Apache License\s+Version 2\.0/);
  assert.match(notice, /existing grant is preserved/i);
  assert.match(scope, /already released in this public preview \| Apache License 2\.0/);
  assert.match(scope, /No file in the current preview becomes Covered Material/i);
  assert.match(dataLicense, /Version 1\.0, 31 October 2026/);
  assert.match(dataLicense, /does not revoke, narrow,\s+condition or replace them/i);
  assert.match(dataLicense, /Commercial Training.*require an agreement with Forge/is);
  assert.doesNotMatch(dataLicense, /DRAFT|TO COMPLETE|NOT ADOPTED/);
});

test("public legal copies match repository licensing documents", () => {
  for (const name of [
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "HISTORY_FORGE_DATA_LICENSE.md",
    "LICENSING.md",
    "COMMERCIAL_AGENT_TRAINING.md",
  ]) {
    assert.equal(read(`public/legal/${name}`), read(name), name);
  }
});
