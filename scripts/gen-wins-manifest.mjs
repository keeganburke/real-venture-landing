// Build-time generator: scans public/wins/ and writes app/wins-manifest.json.
// Runs via the package.json "prebuild" hook so the manifest always matches disk.
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const winsDir = path.join(root, "public", "wins");
const outFile = path.join(root, "app", "wins-manifest.json");

// NN-name-amount.png, with an optional -x disambiguator for repeat win amounts.
const PATTERN = /^\d{2}-([a-z]+)-(\d+)(-[a-z])?\.png$/i;

const entries = [];
for (const file of readdirSync(winsDir)) {
  if (file.startsWith(".")) continue;
  const m = file.match(PATTERN);
  if (!m) {
    console.warn(`WARN: public/wins/${file} does not match NN-name-amount.png, skipping`);
    continue;
  }
  const name = m[1][0].toUpperCase() + m[1].slice(1);
  entries.push({ file, name, amount: parseInt(m[2], 10) });
}

entries.sort((a, b) => a.file.localeCompare(b.file));
writeFileSync(outFile, JSON.stringify(entries, null, 2) + "\n");
console.log(`${entries.length} files processed -> app/wins-manifest.json`);
