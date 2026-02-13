# Changelog

All notable changes to the figma-connecter tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

Each entry includes a commit SHA reference in parentheses for audit traceability.

## [Unreleased]

### Added

- Add generic `RegistryFactory<TTarget, TInstance, TMetadata>` base class (`ff2a160`)
- Add 19 comprehensive tests for registry factory base class (`ff2a160`)
- Add comprehensive test coverage for plugin system (`da7c332`)
- Add tests for `src/plugins.ts` module achieving 100% coverage (`da7c332`)
- Add tests for `src/internal-plugin-registry.ts` achieving 100% coverage (`da7c332`)
- Add tests for parser factory uncovered branches (`da7c332`)
- Add tests for core result module functions (`da7c332`)
- Add tests for emitter utils file payload builders (`da7c332`)
- Add generic `ExtractionResult<T>` type for extraction operations (`68e0088`)
- Add `.gitignore` file to exclude build artifacts and dependencies (`4ec618a`)

### Changed

- Refactor parser factory to extend generic `RegistryFactory` class, reducing 26 lines (`be8fd5d`)
- Refactor emitter factory to extend generic `RegistryFactory` class, reducing 21 lines (`5181620`)
- Refactor `PropertyExtractionResult` to use generic `ExtractionResult<PropertyDescriptor>` (`68e0088`)
- Refactor `EventExtractionResult` to use generic `ExtractionResult<EventDescriptor>` (`68e0088`)
- Update all extraction functions to use `.items` instead of `.properties` or `.events` (`68e0088`)
- Update test files to reference `.items` from extraction results (`68e0088`)
- Export `RegistryFactory`, `PluginOptions`, and `RegistryEntry` from core module (`ff2a160`)
- Export additional helper functions from core module: `addErrors`, `addWarnings`, `hasErrors`, `hasWarnings`, `hasDiagnostics` (`da7c332`)

### Fixed

- Fix failing unit tests: Update test expectations to match mdc- namespace prefix in fixtures (`pending`).
- Fix base fixture references: Rename button.component to base.component in base directory index and constants (`pending`).
- Fix inheritance test: Update to test Button with BaseComponent instead of DisabledMixin (`pending`).
- Fix integration test: Add base component to expected output files list (`pending`).
- Fix external directory test: Replace non-existent external path with fixture path (`pending`).
- Fix Promise return: Wrap runConnectPipeline return values in Promise.resolve (`pending`).
- Fix logger proxy type: Add type cast for function call in scoped logger implementation (`pending`).
- Fix corepack yarn error: Remove invalid yarnPath configuration from .yarnrc.yml (`pending`).
- Fix type safety: Replace empty object type `{}` with `Record<string, unknown>` in CommandContext (`pending`).
- Fix unsafe any returns: Add explicit type assertions in CLI options and program utilities (`pending`).
- Fix unsafe enum comparisons: Add string type assertions for enum values in handler, emitters, and parsers (`pending`).
- Fix unbound methods: Wrap TypeScript compiler API method calls in arrow functions (`pending`).
- Fix unnecessary type assertion: Remove redundant type cast in logger proxy implementation (`pending`).
- Fix missing JSDoc: Add complete documentation blocks with descriptions for utility functions (`pending`).
- Fix async without await: Remove async keyword from runConnectPipeline function (`pending`).
- Add ESLint disable comment for required jest.isolateModules usage in tests (`pending`).
- Remove duplicate incomplete JSDoc blocks from section-updater utility functions (`pending`).

### Removed

- Remove `.eslintrc.cjs` in favor of `eslint.config.mjs` flat config (`pending`).

### Changed

- Upgrade ESLint to v9.39.2 with flat config format (`pending`).
- Migrate all rules from `.eslintrc.cjs` to `eslint.config.mjs` as default config (`pending`).
- Update typescript-eslint to v8.22.0 for better TypeScript support (`pending`).
- Enable projectService for faster type-aware linting (`pending`).
- Update eslint-plugin-jsdoc to v50.6.2 for improved JSDoc validation (`pending`).
- Update eslint-plugin-import to v2.31.0 and install eslint-import-resolver-typescript (`pending`).
- Update globals package to v15.14.0 for latest global definitions (`pending`).
- Disable jsdoc/check-indentation to allow license headers (`pending`).
- Merge complexity limits from .eslintrc.cjs (15 for general, 25 for parsers/emitters) (`pending`).
- Add parser/emitter, CLI, and logger specific rule overrides to flat config (`pending`).
- Configure Rollup bundler to output only minified `dist/index.cjs` and `dist/index.d.ts` (`pending`).
- Replace TypeScript compilation with Rollup bundling for production builds (`pending`).
- Switch build scripts from yarn to npm for consistency (`pending`).
- Remove `ignoreDeprecations` from tsconfig.json (`pending`).
- Use relative `dist/react` import path for React emitter when no base import path is provided (`pending`).
- Introduce pipeline and parse context objects to reduce parameter passing.
- Add shared TypeScript AST helpers for JSDoc, decorators, and literals (`pending`).
- Deduplicate class-chain event extraction via shared chain helper (`pending`).
- Expand tag name resolution to follow re-exports and constants patterns.
- Handle mixins and nested base classes during inheritance resolution (`pending`).
- Normalize CLI option helpers and JSDoc coverage to satisfy linting (`pending`).
- Replace full snapshots with targeted assertions and helper validators (`pending`).
- Use shared class-chain extractor helper for property and event parsing (`pending`).
- Use Result helper to aggregate warnings/errors in parser and reporting flows.
- Switch to registry-based factories for parsers and emitters.
- Normalize emit target parsing via core utility (`pending`).
- Use shared attribute mapper and merge helper in webcomponent parsing (`pending`).
- Standardize ComponentModel to use `props` across parser, emitters, and pipeline (`pending`).
- Adopt generated section markers for props/example updates and section-based writes.
- Add dry-run change detail reporting with per-component counts and reasons (`pending`).
- Normalize path handling and component base-name derivation across parser and emitters (`pending`).
- Configure figma-connecter TypeScript build to emit to `dist/` and ignore src artifacts (`pending`).
- Normalize barrel exports to extensionless paths for TS/Jest compatibility (`pending`).
- Enforce sorted imports/exports via ESLint autofix (`pending`).
- Disallow parent-path re-exports via ESLint rule (`pending`).
- Move CLI command registration and parser defaults to registry-driven helpers (`pending`).

### Added

- Created `bin/figma-connecter.ts` CLI entry point with shebang.
- Configured Commander.js program with name, description, and version.
- Added global options (`verbose`, `quiet`, `config`).
- Set up command registration pattern.
- Created `src/commands/index.ts` command registry.
- Created `src/commands/connect/index.ts` main connect command.
- Added `--path` option for component folder path.
- Added `--recursive` option for recursive folder traversal.
- Added `--dry-run` option for preview mode.
- Added `--emit` option for target selection (webcomponent, react, all).
- Added `--strict` option for strict mode.
- Added attribute mapping utilities for property-to-attribute derivation (`pending`).
- Added merge-by-key utility for deterministic map deduping (`pending`).
- Added `lint` and `lint:fix` scripts for ESLint fixes (`pending`).
- Added generated section marker spec for named props/example blocks.
- Added Result helper utilities (`Result<T>`, `mergeWarnings`, `mergeErrors`, `map`, `chain`).
- Created `src/cli/index.ts` CLI helpers.
- Implemented argument validation.
- Implemented help text formatting.
- Implemented progress indicators.
- Added parser fixtures for component mixin inheritance.
- Added extra CLI/options and AST utility test coverage (`pending`).

### Fixed

- Guard optional file change payloads during batch emission updates (`pending`).

### Core Types & Infrastructure

- Created `src/core/types.ts` with all data models.
- Defined `ComponentModel` interface.
- Defined `PropertyDescriptor` interface.
- Defined `AttributeDescriptor` interface.
- Defined `EventDescriptor` interface.
- Defined `GenerationReport` interface.
- Defined `EmitterTarget` enum.
- Created `src/core/logger.ts` structured logging.
- Implemented log levels (debug, info, warn, error).
- Added context-aware logging (stage, component, duration).
- Added quiet/verbose mode support.
- Created `src/core/report.ts` generation report builder.
- Implemented report accumulation (warnings, errors).
- Implemented report summary formatting.
- Added timing/duration tracking.
- Added file change detail types and per-component report fields for dry-run reporting (`pending`).

### File Discovery & Loading

- Created `src/io/file-discovery.ts` component finder.
- Implemented glob pattern for `*.component.ts` files.
- Implemented recursive directory traversal.
- Implemented file filtering (exclude node_modules, dist).
- Returned discovered file paths with metadata.
- Created `src/io/source-loader.ts` TypeScript program loader.
- Created TypeScript `Program` from component files.
- Resolved `tsconfig.json` paths.
- Exposed `TypeChecker` for symbol resolution.
- Handled file read errors gracefully.
- Created `src/io/file-writer.ts` output file writer.
- Implemented create new file logic.
- Implemented update existing file logic.
- Implemented dry-run mode (no writes).
- Returned write status (created, updated, unchanged).
- Created `src/io/section-updater.ts` partial file updates.
- Defined section markers (BEGIN/END GENERATED).
- Implemented section extraction.
- Implemented section replacement.
- Preserved non-generated content.
- Added named generated section updates for props/example blocks.

### Web Component Parser

- Created `src/parsers/webcomponent/component-discovery.ts`.
- Found primary class declaration in file.
- Supported default export detection.
- Supported `@customElement` decorator detection.
- Supported `@tagname` JSDoc heuristic.
- Created `src/parsers/webcomponent/tagname-resolver.ts`.
- Parsed JSDoc `@tagname` tag.
- Parsed sibling `index.ts` for `register(TAG_NAME)`.
- Added fallback to file-name derived tag.
- Implemented chain-of-responsibility pattern.
- Created `src/parsers/webcomponent/inheritance-resolver.ts`.
- Used `TypeChecker` for symbol resolution.
- Traversed `extends` clauses.
- Handled mixin expressions (e.g., `DisabledMixin(Component)`).
- Returned linearized class chain.
- De-duplicated by symbol.
- Created `src/parsers/webcomponent/decorator-extractor.ts`.
- Extracted `@property` decorators.
- Included protected properties and excluded private ones during decorator extraction (`pending`).
- Parsed decorator options (type, attribute, reflect).
- Resolved attribute names (explicit, false, default kebab).
- Extracted default values from initializers.
- Extracted JSDoc descriptions.
- Created `src/parsers/webcomponent/event-extractor.ts`.
- Parsed JSDoc `@event` tags.
- Detected `dispatchEvent(new CustomEvent(...))` patterns.
- Mapped event names to React handlers.
- Created `src/parsers/webcomponent/index.ts` main parser.
- Orchestrated all extraction steps.
- Built `ComponentModel` from extracted data.
- Handled partial failures gracefully.
- Returned model with warnings.

### Emitters

- Created `src/emitters/types.ts` emitter interface.
- Defined `Emitter` interface with `emit(model)` method.
- Defined `EmitterResult` type.
- Created `src/emitters/figma-webcomponent/index.ts`.
- Generated `figma.connect()` call for web components.
- Mapped properties to `figma.boolean()`, `figma.string()`, etc.
- Generated HTML `example` template.
- Generated proper imports.
- Handled attribute vs property mapping.
- Created `src/emitters/figma-react/index.ts`.
- Generated `figma.connect()` call for React.
- Mapped properties to React props.
- Generated JSX `example` template.
- Generated proper React imports.
- Sort props and attributes deterministically in emitter output.
- Emit unknown property types as figma.string with report warnings.
- Normalize boolean attribute bindings in HTML example templates.
- Wrapped props/example blocks in generated section markers for React/WebComponent emitters.
- Centralized component base-name derivation for emitter output paths (`pending`).
- Created `src/emitters/factory.ts` emitter factory.
- Registered available emitters.
- Selected emitters by target names.
- Returned emitter instances.

### Generation Pipeline

- Created `src/pipeline/index.ts` main orchestrator.
- Accepted component path and options.
- Loaded source files.
- Parsed component model.
- Ran selected emitters.
- Wrote output files.
- Applied section-based updates when writing emissions to preserve manual edits.
- Recorded per-component file change details for dry-run reporting (`pending`).
- Returned generation report.
- Created `src/pipeline/batch.ts` batch processor.
- Processed multiple components in sequence.
- Aggregated reports.
- Handled individual failures.
- Added continue on error option.

### Utilities

- Created/updated `src/utils/strings.ts`.
- Implemented `toKebabCase` function.
- Implemented `toPascalCase` function.
- Implemented `toCamelCase` function.
- Implemented `upperCaseFirstCharacter` function.
- Implemented `kebabToTitleCase` function.
- Added `normalizePath` helper for cross-platform path handling (`pending`).

### Testing

- Add ComponentModel shape snapshot test (`pending`).
- Add parser robustness tests for mixin class expressions and visibility rules (`pending`).
- Add property extraction tests for attribute/reflect/type inference (`pending`).
- Add tag name resolver tests for JSDoc, register constants, filename fallback, and component fixtures.
- Add emitter snapshot tests for WebComponent and React output.
- Add emit target parsing tests (`pending`).
- Add coverage tests for CLI, pipeline, and source loader to meet 95% threshold (`pending`).
- Add section-updater regression tests for partial updates.
- Add merge-by-key and attribute mapper unit tests (`pending`).
- Add factory registry tests for parsers and emitters.
- Add Result helper unit tests.
- Created `__tests__/AGENTS.md` testing guidelines.
- Created `__tests__/helpers/fixtures.ts` shared test fixtures.
- Created `__tests__/helpers/mocks.ts` shared mock utilities.
- Created `__tests__/helpers/index.ts` helpers barrel export.
- Created `jest.config.js` Jest configuration.
- Created `tsconfig.test.json` TypeScript test config.
- Added `@types/jest` to devDependencies.
- Created `__tests__/utils/strings.test.ts`.
- Created `__tests__/io/file-discovery.test.ts`.
- Created `__tests__/io/file-writer.test.ts`.
- Created `__tests__/io/section-updater.test.ts`.
- Created `__tests__/core/report.test.ts`.
- Created `__tests__/emitters/factory.test.ts`.
- Created `__tests__/emitters/figma-webcomponent.test.ts`.

### Documentation & Polish

- Add README for figma-connecter CLI usage (`pending`).
- Updated `package.json` with bin entry.
- Updated `package.json` with dependencies (commander, glob).
- Added build scripts.
- Added test scripts.
- Added inline JSDoc to public APIs.
