# Architecture

This document defines the runtime architecture, source layout, extension model, and tooling used by `@coderrob/figma-connecter`.

## 1. Purpose

`figma-connecter` is a Node.js CLI that scans TypeScript Web Component sources, extracts component metadata from the TypeScript AST, and generates or updates Figma Code Connect files for supported targets.

Current built-in targets:

- Parser: `webcomponent`
- Emitters: `webcomponent`, `react`

Primary outcomes:

- Discover `*.component.ts` source files
- Build a TypeScript program for symbol resolution and inheritance analysis
- Parse component metadata into a normalized model
- Emit Code Connect files into `code-connect/`
- Update generated sections safely when files already exist
- Report warnings, errors, and file changes with structured logging

## 2. System Model

The system is intentionally layered.

| Layer | Responsibility | Main Paths |
| --- | --- | --- |
| CLI | Program bootstrapping, help text, option parsing, command dispatch | `bin/`, `src/cli/`, `src/commands/` |
| Core | Shared enums, result/report helpers, logging, registry primitives | `src/core/` |
| IO | File discovery, tsconfig loading, file writes, generated section updates | `src/io/` |
| Parsers | AST traversal and metadata extraction into a normalized component model | `src/parsers/` |
| Mappers | Data normalization and mapping helpers for emitters | `src/mappers/` |
| Emitters | Target-specific Code Connect generation | `src/emitters/` |
| Pipeline | End-to-end orchestration over discovery, parse, emit, and reporting | `src/pipeline/` |
| Utils | Pure path, string, merge, and TypeScript utility functions | `src/utils/` |

The layers are designed to be mostly one-way:

`CLI -> Pipeline -> IO / Parsers / Emitters -> Core / Utils`

## 3. Design Principles

The repository standards in `AGENTS.md` are reflected in the implementation:

- Separation of concerns: orchestration lives in `pipeline`, AST logic lives in `parsers`, file writes live in `io`.
- Immutability first: result objects and models are built via copies, not in-place mutation.
- Strategy plus factory: parser and emitter selection is registry-driven rather than switch-based.
- Fail fast, recover gracefully: invalid CLI input throws early; parse and emit issues accumulate diagnostics in reports.
- Operational transparency: pipeline and command stages log progress and return structured summaries.

## 4. Runtime Flow

The main execution path is:

1. `bin/figma-connecter.ts` starts the CLI.
2. `src/cli/program.ts` creates the Commander program, global flags, help formatting, and command registration.
3. `src/commands/connect/handler.ts` validates user input, resolves effective options, builds a logger and progress indicator, and calls `runConnectPipeline`.
4. `src/pipeline/runner.ts` orchestrates:
   - file discovery
   - parser/emitter initialization
   - TypeScript program loading
   - per-file batch processing
   - report finalization
5. `src/pipeline/batch.ts` processes each discovered component file:
   - resolve the `ts.SourceFile`
   - parse to `IComponentModel`
   - emit one file per selected emitter
   - write full content or update generated sections
6. The command layer prints the summary, warnings, errors, and dry-run details, then sets `process.exitCode` on failure.

### 4.1 Pipeline Stages

`runConnectPipeline()` in `src/pipeline/runner.ts` runs these steps in order:

- `discoverComponentsStep`
- `initializePipelineStep`
- `loadSourcesStep`
- `warnOnMissingEmittersStep`
- `runBatchStep`
- `finalizeReportStep`

Each stage receives and returns an immutable `IResult<IRunnerContext>` state object. This keeps diagnostics and state transitions explicit.

### 4.2 Per-File Processing

`processComponentBatch()` in `src/pipeline/batch.ts` runs each discovered file through:

- `resolveSourceFileStep`
- `parseComponentStep`
- `emitComponentStep`

Per-file behavior is controlled by shared `IPipelineContext` values such as:

- `dryRun`
- `strict`
- `continueOnError`
- `baseImportPath`
- `force`
- `io`
- `checker`
- `sourceFileMap`

## 5. Core Data Contracts

The architecture depends on a few central contracts.

### 5.1 Component Model

Parsers produce a normalized `IComponentModel` in `src/core/types.ts`. Emitters consume that model without depending on parser internals. This is the main seam that keeps parsing and code generation decoupled.

Typical model contents:

- component/class name
- tag name
- properties and attributes
- events
- inheritance-derived metadata
- source-path context

### 5.2 Result and Diagnostics Model

`src/core/result.ts` provides the result container used across parse and pipeline stages. It carries:

- `value`
- `warnings`
- `errors`

This allows parser and pipeline code to return useful partial outcomes without throwing for every non-fatal issue.

### 5.3 Report Model

`src/core/report.ts` aggregates component-level results into an `IGenerationReport` with:

- created / updated / unchanged counts
- duration
- warning and error collections
- optional `componentResults` for command output and dry-run reporting

## 6. CLI and Command Architecture

The CLI uses `commander` as its command framework.

Main command infrastructure:

- `src/cli/program.ts`: root program construction
- `src/cli/options.ts`: global option access
- `src/cli/validators.ts`: path and config validation
- `src/cli/progress.ts`: progress reporting
- `src/commands/registry.ts`: command registration
- `src/commands/connect/`: the main supported command

The `connect` command is built as staged execution:

- validate
- execute
- report
- onError

That staged design isolates user interaction concerns from pipeline logic.

## 7. Parser Architecture

Parsers are strategy objects created through `src/parsers/factory.ts`.

Built-in parser:

- `WebComponentParser` in `src/parsers/webcomponent/`

Key parser responsibilities:

- find the component class
- resolve decorators and JSDoc metadata
- extract properties and events
- resolve tag names
- follow inheritance when required
- convert AST findings into a stable component model

Important parser modules:

- `component-discovery.ts`
- `decorator-extractor.ts`
- `event-extractor.ts`
- `inheritance-resolver.ts`
- `chain-extractor.ts`
- `tagname-resolver.ts`
- `tagname/export-resolution.ts`
- `tagname/namespace.ts`

The parser layer is intentionally TypeScript-AST-centric. It receives a `ts.SourceFile` plus `ts.TypeChecker` in standardized parse context, which keeps type resolution and inheritance logic inside the parser boundary.

## 8. Emitter Architecture

Emitters are also strategy objects created through `src/emitters/factory.ts`.

Built-in emitters:

- `FigmaWebComponentEmitter`
- `FigmaReactEmitter`

Emitter responsibilities:

- choose output file path and extension
- convert `IComponentModel` into Code Connect source text
- optionally expose generated sections for marker-based partial updates
- return warnings when output can be generated but is incomplete

Shared emitter helpers:

- `file-builder.ts`
- `section-builder.ts`
- `formatting.ts`
- `figma-mapper.ts`
- `utils.ts`

Target-specific emitters live in:

- `src/emitters/figma-webcomponent/`
- `src/emitters/figma-react/`

Registry order matters. `createEmitters()` returns emitters in registration order so file generation stays deterministic even if CLI target order differs.

## 9. IO Architecture

The IO layer isolates file system and TypeScript program interactions.

Main IO modules:

- `file-discovery.ts`: finds supported component sources
- `source-loader.ts`: loads tsconfig, compiler options, program, checker, and source map
- `file-writer.ts`: writes generated files and reports created/updated/unchanged state
- `section-updater.ts`: updates only marked generated blocks in existing files
- `adapter.ts`: filesystem abstraction for runtime and tests

Important behavior:

- Discovery excludes generated and dependency directories such as `dist` and `node_modules`.
- Section updates are safe by default. If generated markers are missing, the file is preserved and a warning is reported.
- `--force` switches from partial update behavior to full file replacement.
- `dryRun` flows through write calls without mutating the filesystem.

## 10. Path and Cross-Platform Behavior

The repo now treats path handling as a first-class concern because the tool runs on Windows and POSIX environments.

Current path design:

- normalization utilities are centralized in `src/utils/paths.ts`
- portable normalization prefers POSIX-style separators in generated/import paths
- absolute-path detection handles both Windows drive roots and POSIX roots
- source loading and output generation avoid leaking platform-specific path bugs into import generation and test expectations

This matters for:

- output file location
- import path calculation
- tsconfig discovery
- snapshot and integration test stability

## 11. Plugin and Registry Model

The codebase is designed for extension without pipeline rewrites.

Registry primitives:

- `src/core/registry-factory.ts`
- `src/emitters/factory.ts`
- `src/parsers/factory.ts`
- `src/plugins/`

Extension rules:

- parsers and emitters register metadata plus a factory function
- targets cannot be registered twice
- registration must happen before factories are used
- orchestration code does not branch on individual targets

Plugin metadata is used for:

- target enumeration
- help and introspection
- file-extension and file-pattern declarations
- external plugin discovery via `getPluginInfo()`

This is a strategy-plus-registry architecture, not an inheritance-heavy framework.

## 12. Testing Architecture

The project uses `jest` with `ts-jest`.

Test layout:

- unit tests under `__tests__/`
- integration coverage in `__tests__/integration/`
- per-layer tests mirroring the source tree
- generated integration output under `__tests__/__output__/`

`jest.config.js` characteristics:

- `preset: 'ts-jest'`
- `testEnvironment: 'node'`
- roots include `__tests__` and `src`
- path alias mapping for `@/`
- global coverage threshold of 95% across branches, functions, lines, and statements

The tests validate:

- AST extraction behavior
- CLI option handling
- report aggregation
- emitter output
- section update logic
- path normalization
- end-to-end connect command behavior

## 13. Build, Packaging, and Tooling

### 13.1 Language and Runtime

- TypeScript `5.9.x`
- Node.js `>=20`
- npm `>=8`
- Yarn `3.2.4` declared as package manager

### 13.2 Build

Rollup is used for packaging.

Build outputs:

- `dist/index.cjs`
- `dist/index.d.ts`

Key build tooling:

- `rollup`
- `@rollup/plugin-typescript`
- `@rollup/plugin-node-resolve`
- `@rollup/plugin-commonjs`
- `@rollup/plugin-terser`
- `rollup-plugin-dts`

The package publishes the `dist/` directory and exposes:

- CommonJS runtime bundle
- bundled type declarations

### 13.3 Linting

Linting uses ESLint flat config in `eslint.config.mjs`.

Major lint components:

- `@eslint/js`
- `typescript-eslint`
- `eslint-plugin-import`
- `eslint-plugin-jsdoc`
- `@coderrob/eslint-plugin-zero-tolerance`

Lint profile characteristics:

- strict type-safety rules
- import hygiene
- required JSDoc on source APIs
- maintainability/complexity limits
- test-specific overrides
- parser/emitter complexity relaxations for AST-heavy files

### 13.4 Type Checking

`tsconfig.json` is strict and produces declarations for builds. The project uses CommonJS output with path aliasing via `@/*`.

### 13.5 Development Commands

Main scripts from `package.json`:

- `npm run build`
- `npm run clean`
- `npm run lint`
- `npm run lint:fix`
- `npm run test`
- `npm run test:coverage`
- `npm run tsc`

## 14. Source Tree Structure

High-level source structure:

```text
bin/
  figma-connecter.ts
src/
  cli/
  commands/
    connect/
  core/
  emitters/
    figma-react/
    figma-webcomponent/
  io/
  mappers/
  parsers/
    webcomponent/
      tagname/
  pipeline/
  plugins/
  utils/
__tests__/
```

Structural conventions:

- folders with multiple public modules expose a barrel `index.ts`
- source files are kebab-case
- tests mirror feature ownership by directory
- public APIs are exported from `src/index.ts`

## 15. Architectural Boundaries

The most important boundaries are:

- CLI code should not parse ASTs directly.
- Emitters should not know how the parser found metadata.
- Parsers should not perform file writes.
- Pipeline code should orchestrate, not implement target-specific business logic.
- IO adapters should be the seam for filesystem behavior in tests.

Violating these boundaries would make extension harder and cross-platform behavior less predictable.

## 16. Non-Goals

The current architecture is not trying to be:

- a general-purpose build system
- a live file watcher or daemon
- a multi-language parser platform
- a runtime plugin loader with sandboxing
- a framework that mutates arbitrary user files outside generated markers by default

It is a focused generation tool with a strong bias toward safe updates and deterministic output.

## 17. Extension Guidance

When adding new capabilities:

- add new parser or emitter targets through the appropriate factory registry
- preserve immutable result flows
- keep the normalized component model as the parse/emit contract
- prefer metadata-driven registration over special-case branching
- keep filesystem effects inside `src/io/`
- add unit tests at the module layer and integration coverage when output behavior changes

Useful extension references already in the repo:

- `src/README.md`
- `src/parsers/README.md`
- `src/emitters/EXTENDING.md`

## 18. Summary

`figma-connecter` is a layered TypeScript CLI with:

- Commander for command execution
- TypeScript AST analysis for component parsing
- registry-based parser and emitter composition
- IO abstractions for safe writes and testability
- strict lint, type-check, and coverage gates
- plugin seams for future targets without rewriting the pipeline

That combination gives the project deterministic generation behavior, clear extension points, and a code structure that can scale beyond the initial Web Component and React targets.
