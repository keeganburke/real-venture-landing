// Build-time generator: scans public/reviews/ and writes app/reviews-manifest.json.
// Runs via the package.json "prebuild" hook, chained after the wins generator.
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reviewsDir = path.join(root, "public", "reviews");
const outFile = path.join(root, "app", "reviews-manifest.json");

// review-NN.png, with an optional -x disambiguator like the wins pattern.
const PATTERN = /^review-\d{2}(-[a-z])?\.png$/i;

const entries = [];
for (const file of readdirSync(reviewsDir)) {
  if (file.startsWith(".")) continue;
  if (!PATTERN.test(file)) {
    console.warn(`WARN: public/reviews/${file} does not match review-NN.png, skipping`);
    continue;
  }
  entries.push({ file });
}

// Newest first: higher review number = more recent.
entries.sort((a, b) => b.file.localeCompare(a.file));
writeFileSync(outFile, JSON.stringify(entries, null, 2) + "\n");
console.log(`${entries.length} files processed -> app/reviews-manifest.json`);
