import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const importScript = path.join(root, "scripts", "product-core-import.mjs");
const parityScript = path.join(root, "scripts", "product-core-parity.mjs");

const importer = fs.readFileSync(importScript, "utf8");
const parity = fs.readFileSync(parityScript, "utf8");

assert.match(
  importer,
  /confirmation !== "IMPORT-PRODUCTION-PRODUCTS"/,
  "Production importer must keep the explicit confirmation literal.",
);
assert.match(
  importer,
  /environment === "production" && existingProductCount !== 0/,
  "Production importer must refuse non-empty Product Core.",
);
assert.match(
  importer,
  /black-sheep-commerce-prod/,
  "Production importer must target the Production D1 database explicitly.",
);
assert.match(
  parity,
  /\["staging", "production"\]/,
  "Parity verifier must explicitly support staging and production.",
);
assert.match(
  parity,
  /black-sheep-commerce-prod/,
  "Production parity must target the Production D1 database explicitly.",
);

function run(args) {
  return spawnSync(process.execPath, [importScript, ...args], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
}

const missingConfirmation = run(["--remote", "--env", "production"]);
assert.notEqual(
  missingConfirmation.status,
  0,
  "Production importer must fail without confirmation.",
);
assert.match(
  String(missingConfirmation.stderr || missingConfirmation.stdout),
  /IMPORT-PRODUCTION-PRODUCTS/,
);

const stagingNoRemote = run(["--env", "staging"]);
assert.notEqual(stagingNoRemote.status, 0, "Importer must require --remote.");

console.log("Production Product Core import guard checks passed.");
