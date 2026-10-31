import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { canvasResolution, MAX_CANVAS_SIDE, MAX_CANVAS_PIXELS } from "../src/canvasSizing.js";
import { evidenceLabel, relationshipLabel } from "../src/evidenceLabels.js";

test("canvas backing allocation follows CSS size at DPR 1 and 2", () => {
  assert.deepEqual(canvasResolution(390, 151, 1), { width: 390, height: 151 });
  assert.deepEqual(canvasResolution(1061, 590, 2), { width: 2122, height: 1180 });
  assert.deepEqual(canvasResolution(390, 151, 4), canvasResolution(390, 151, 2));
});

test("pathological sizes cannot allocate an unbounded canvas", () => {
  for (const width of [0, -1, NaN, Infinity, 390, 10000, 16777215, 1e308])
    for (const height of [0, -1, NaN, Infinity, 151, 10000, 16777215, 1e308])
      for (const dpr of [0, -1, NaN, Infinity, 1, 2, 10]) {
        const size = canvasResolution(width, height, dpr);
        assert.ok(Number.isInteger(size.width) && size.width >= 1 && size.width <= MAX_CANVAS_SIDE);
        assert.ok(Number.isInteger(size.height) && size.height >= 1 && size.height <= MAX_CANVAS_SIDE);
        assert.ok(size.width * size.height <= MAX_CANVAS_PIXELS);
      }
});

test("the canvas component owns its containment stylesheet", () => {
  const component = fs.readFileSync(new URL("../src/components/TapestryCanvas.jsx", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("../src/tapestryCanvas.css", import.meta.url), "utf8");
  assert.match(component, /import "\.\.\/tapestryCanvas\.css"/);
  assert.match(css, /contain: size layout paint/);
  assert.match(css, /\.tapestry-canvas canvas\s*\{[^}]*width: 100%;[^}]*height: 100%;/);
});

test("readable labels never mutate evidence or broaden reuse", () => {
  const edge = { predicate: "listed_signature", relationship_label: "Listed signature" };
  const before = JSON.stringify(edge);
  assert.equal(relationshipLabel(edge), "Listed signature");
  assert.equal(evidenceLabel("public_domain_historical_text"), "Public domain historical text");
  assert.equal(evidenceLabel("private_research_only"), "Private research only");
  assert.equal(relationshipLabel({ predicate: "reported_order" }), "Reported order");
  assert.equal(evidenceLabel(null), "");
  assert.equal(JSON.stringify(edge), before);
});
