"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
new vm.Script(script);
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  const target = match[1];
  if (/^[a-z]+:/i.test(target)) continue;
  const local = path.resolve(root, target.split("?")[0]);
  assert.ok(local.startsWith(root + path.sep), "Resource outside project");
  assert.ok(fs.existsSync(local), "Missing resource: " + target);
}
const buttons = [...html.matchAll(/data-page="([^"]+)"/g)].map(match => match[1]);
const panels = [...html.matchAll(/data-panel="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual([...buttons].sort(), [...panels].sort(), "Navigation mismatch");
assert.ok(!script.includes("window.openai"), "Preview-only API found");
const { validatePackage } = require("../skills/blanktime-study-coach/scripts/validate-package.cjs");
const sample = JSON.parse(fs.readFileSync(path.join(root, "skills/blanktime-study-coach/examples/minimal-package.json"), "utf8"));
validatePackage(sample);
console.log("Script syntax, page navigation, local links and sample package passed.");

