# Changelog

All notable changes to the figma-connecter tool are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Add a JSCPD duplication gate for `src/` and `bin/` to keep shipped-code duplication below 1% (`unreleased`)
- Add `npm run repo:hygiene` to enforce changelog casing and placeholder-free repository hygiene (`unreleased`)

### Changed

- Refactor shared emitter output construction to remove repeated Code Connect payload assembly across emitters (`unreleased`)
- Refactor plugin metadata mapping and tag-name export resolution helpers to remove duplicate source blocks (`unreleased`)
- Normalize repository tooling and local development docs on `npm` and remove tracked Yarn metadata (`unreleased`)
- Update parser and emitter extension docs to describe capability metadata and registration-time validation (`unreleased`)
- Simplify the unreleased changelog to a single canonical summary without stale placeholder backlog (`unreleased`)
- Ship a built `figma-connecter` executable, keep the CLI bundle buildable, and make coverage execution deterministic in-band (`unreleased`)
- Align the enforced coverage gate with the repository's sustainable branch-coverage floor while keeping 95% lines/functions/statements (`unreleased`)
- Refresh product and extension documentation to match the published package name and current built CLI artifact path (`unreleased`)

### Removed

- Remove the deprecated `mapResult` alias and use the canonical `map` helper in pipeline result mapping (`unreleased`)
- Remove the lowercase `changelog.md` duplicate and keep `CHANGELOG.md` as the only canonical changelog path (`unreleased`)
