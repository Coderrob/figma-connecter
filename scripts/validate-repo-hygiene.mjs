import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const changelogPath = path.join(projectRoot, "CHANGELOG.md");
const docPaths = [
  "README.md",
  "CONTRIBUTING.md",
  "ARCHITECTURE.md",
  path.join("__tests__", "AGENTS.md"),
];

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

/**
 * Throws when a documentation file contains a forbidden pattern.
 *
 * @param {string} relativePath - Project-relative file path.
 * @param {RegExp} pattern - Forbidden pattern.
 * @param {string} message - Error message to throw.
 */
function assertDocPatternAbsent(relativePath, pattern, message) {
  const filePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (pattern.test(content)) {
    throw new Error(`${message} (${relativePath})`);
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

for (const docPath of docPaths) {
  assertDocPatternAbsent(
    docPath,
    /\byarn\b/i,
    "Documentation must use npm commands only.",
  );
  assertDocPatternAbsent(
    docPath,
    /â/,
    "Documentation contains mojibake and must be normalized to plain ASCII text.",
  );
}

console.log("Repository hygiene checks passed.");
