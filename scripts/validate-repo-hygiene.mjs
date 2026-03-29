import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const changelogPath = path.join(projectRoot, "CHANGELOG.md");

/**
 * Throws when a required file is missing.
 *
 * @param {string} filePath - Absolute file path.
 */
function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file is missing: ${path.basename(filePath)}`);
  }
}

/**
 * Throws when the changelog contains a forbidden pattern.
 *
 * @param {string} changelog - Changelog content.
 * @param {RegExp} pattern - Forbidden pattern.
 * @param {string} message - Error message to throw.
 */
function assertPatternAbsent(changelog, pattern, message) {
  if (pattern.test(changelog)) {
    throw new Error(message);
  }
}

/**
 * Throws when a heading appears more than the expected number of times.
 *
 * @param {string} changelog - Changelog content.
 * @param {RegExp} pattern - Heading pattern.
 * @param {number} expectedCount - Allowed count.
 * @param {string} message - Error message to throw.
 */
function assertHeadingCount(changelog, pattern, expectedCount, message) {
  const matches = changelog.match(pattern) ?? [];
  if (matches.length !== expectedCount) {
    throw new Error(message);
  }
}

assertFileExists(changelogPath);
if (fs.readdirSync(projectRoot).includes("changelog.md")) {
  throw new Error("Use CHANGELOG.md only; remove lowercase changelog.md.");
}

const changelog = fs.readFileSync(changelogPath, "utf8");

assertPatternAbsent(
  changelog,
  /\bTBD\b/,
  "CHANGELOG.md contains 'TBD'. Replace placeholders with final text.",
);
assertPatternAbsent(
  changelog,
  /\bpending\b/i,
  "CHANGELOG.md contains 'pending'. Use final text or '(unreleased)'.",
);
assertHeadingCount(
  changelog,
  /^## \[Unreleased\]$/gm,
  1,
  "CHANGELOG.md must contain exactly one [Unreleased] section.",
);

console.log("Repository hygiene checks passed.");
