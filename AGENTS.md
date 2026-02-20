# Figma Connecter Tool - Agent Guidelines

This document defines the quality standards, design principles, and development guidelines for the `figma-connecter` CLI tool.

---

## Design Principles

### 1. Separation of Concerns

Each module has a single, well-defined responsibility:

| Layer        | Responsibility                                     | Example                     |
| ------------ | -------------------------------------------------- | --------------------------- |
| **CLI**      | Argument parsing, validation, user interaction     | `src/cli/`, `src/commands/` |
| **Core**     | Shared types, logging, reporting                   | `src/core/`                 |
| **IO**       | File system operations, TypeScript program loading | `src/io/`                   |
| **Parsers**  | AST traversal, metadata extraction                 | `src/parsers/`              |
| **Emitters** | Code generation, template rendering                | `src/emitters/`             |
| **Pipeline** | Orchestration, batch processing                    | `src/pipeline/`             |
| **Utils**    | Pure utility functions                             | `src/utils/`                |

### 2. Immutability First

- All core data structures are **readonly**.
- Functions return new objects rather than mutating inputs.
- Use spread operators and functional patterns over imperative mutation.

```typescript
// ✅ Good - Returns new object
export function addWarning(result: ComponentResult, warning: string): ComponentResult {
  return {
    ...result,
    warnings: [...result.warnings, warning],
  };
}

// ❌ Bad - Mutates input
export function addWarning(result: ComponentResult, warning: string): void {
  result.warnings.push(warning);
}
```

### 3. Strategy + Factory Patterns

- **Parsers** and **Emitters** follow the Strategy pattern.
- A **Factory** selects the appropriate implementation at runtime.
- New implementations can be added without modifying existing code.

```typescript
// Factory creates emitters based on target selection
const emitters = createEmitters({ targets: [EmitterTarget.WebComponent, EmitterTarget.React] });

// Each emitter implements the same interface
for (const emitter of emitters) {
  const result = emitter.emit(model, options);
}
```

### 4. Fail Fast, Recover Gracefully

- Validate inputs early and throw clear errors.
- Accumulate warnings for non-fatal issues.
- Continue processing remaining items when one fails (configurable).

### 5. Operational Transparency

- Structured logging with context (stage, component, duration).
- Generation reports include created/updated/unchanged counts.
- Warnings and errors are accumulated and reported.

---

## Code Quality Standards

### Naming Conventions

| Type         | Convention           | Example                    |
| ------------ | -------------------- | -------------------------- |
| Files        | kebab-case           | `file-discovery.ts`        |
| Classes      | PascalCase           | `FigmaWebComponentEmitter` |
| Interfaces   | PascalCase           | `ComponentModel`           |
| Functions    | camelCase            | `discoverComponentFiles`   |
| Constants    | SCREAMING_SNAKE_CASE | `DEFAULT_SECTION_MARKERS`  |
| Type aliases | PascalCase           | `FigmaPropertyType`        |

### Function Design

1. **Pure functions preferred** - Same input always produces same output.
2. **Single responsibility** - One function, one job.
3. **Early returns** - Handle edge cases first, then main logic.
4. **Descriptive names** - Function name describes what it does.

```typescript
// ✅ Good - Pure, single responsibility, early return
export const isComponentFile = (filePath: string): boolean => {
  if (!filePath) return false;
  return filePath.toLowerCase().endsWith(COMPONENT_SUFFIX);
};
```

### Error Handling

1. **Throw for programmer errors** - Missing required arguments, invalid state.
2. **Return errors for user errors** - File not found, invalid input path.
3. **Never swallow errors silently** - Always log or report.

```typescript
// Validation throws for invalid options
export function validateGlobalOptions(options: GlobalCliOptions): void {
  if (options.verbose && options.quiet) {
    throw new Error('Cannot use --verbose and --quiet together.');
  }
}

// Processing returns errors in report
if (!parseResult.model) {
  result = addError(result, 'Failed to parse component.');
}
```

### TypeScript Guidelines

1. **Explicit return types** on exported functions.
2. **Readonly arrays and objects** in interfaces.
3. **Discriminated unions** for variant types.
4. **No `any`** - Use `unknown` and narrow with type guards.
5. **No inline require() or import()** - All imports and requires must be defined at the top of the file module.

### Import Anti-Patterns

**❌ NEVER use inline require() statements:**

```typescript
// ❌ BAD - Inline require with type assertion
const factory = require('../../src/parsers/factory') as typeof import('../../src/parsers/factory');

// ❌ BAD - Inline require in typeof check
if (typeof value === typeof require('./module').SomeType) { ... }

// ❌ BAD - Inline require in instanceof check
if (value instanceof require('./module').SomeClass) { ... }

// ❌ BAD - Inline require in variable declaration
const { helper } = require('./utils');
```

**✅ ALWAYS use static imports at the top of the file:**

```typescript
// ✅ GOOD - Import at top of file
import * as factory from '../../src/parsers/factory';
import { SomeType, SomeClass } from './module';
import { helper } from './utils';

// Then use normally in your code
if (typeof value === typeof SomeType) { ... }
if (value instanceof SomeClass) { ... }
```

**Exception**: Inline requires are permitted ONLY within `jest.isolateModules()` callbacks for testing module isolation:

```typescript
// ✅ ALLOWED - Testing module isolation
it('should isolate module', () => {
  jest.isolateModules(() => {
    const factory = require('../../src/parsers/factory');
    // test logic...
  });
});
```

**Why this matters**:
- **Maintainability**: All dependencies are clearly visible at the top of the file
- **Performance**: Static imports can be optimized by bundlers and tree-shaking
- **Type Safety**: TypeScript can better infer types with static imports
- **Readability**: Easier to understand module dependencies at a glance
- **Refactoring**: IDEs can better track and update import paths

This anti-pattern is enforced by the custom ESLint rule `custom/no-inline-require-typeof`.

---

## File Structure Conventions

```
src/
├── cli/
│   └── index.ts              # CLI setup, validation, helpers
├── commands/
│   ├── index.ts              # Command registry
│   └── <command>/
│       └── index.ts          # Command implementation
├── core/
│   ├── index.ts              # Barrel export
│   ├── types.ts              # Shared interfaces and types
│   ├── logger.ts             # Structured logging
│   └── report.ts             # Report building utilities
├── emitters/
│   ├── index.ts              # Barrel export
│   ├── types.ts              # Emitter interface
│   ├── factory.ts            # Emitter factory
│   └── <emitter-name>/
│       └── index.ts          # Emitter implementation
├── io/
│   ├── index.ts              # Barrel export
│   └── <module>.ts           # IO operations
├── parsers/
│   ├── index.ts              # Barrel export
│   └── <parser-name>/
│       ├── index.ts          # Parser orchestrator
│       └── <sub-module>.ts   # Parser components
├── pipeline/
│   ├── index.ts              # Pipeline orchestrator
│   └── batch.ts              # Batch processing
└── utils/
    ├── index.ts              # Barrel export
    └── <utility>.ts          # Utility functions
```

### Barrel Exports

Every folder with multiple modules should have an `index.ts` that re-exports public APIs:

```typescript
// src/emitters/index.ts
export * from './factory';
export * from './types';
export { FigmaReactEmitter } from './figma-react';
export { FigmaWebComponentEmitter } from './figma-webcomponent';
```

---

## Documentation Standards

### JSDoc Requirements

All exported functions, classes, and interfaces must have JSDoc comments:

````typescript
/**
 * Discovers component files from a file or directory path.
 *
 * @param inputPath - File or directory path to scan.
 * @param options - Discovery options.
 * @returns Array of discovered component metadata.
 *
 * @example
 * ```typescript
 * const files = discoverComponentFiles('./src/components', { recursive: true });
 * ```
 */
export function discoverComponentFiles(
  inputPath: string,
  options: FileDiscoveryOptions = {}
): DiscoveredFile[] {
````

### Module Headers

Each file should have a module-level JSDoc comment:

```typescript
/**
 * File Discovery Module
 *
 * Locates Web Component source files for processing.
 *
 * @module io/file-discovery
 */
```

---

## Commit and PR Guidelines

### Commit Messages

Follow conventional commits:

```
feat(emitters): add Vue emitter support
fix(parser): handle mixins with multiple type parameters
docs(readme): add CLI usage examples
test(io): add section-updater edge case tests
refactor(core): extract report helpers to separate module
```

### PR Checklist

- [ ] All tests pass
- [ ] New code has tests
- [ ] JSDoc added for public APIs
- [ ] No `console.log` statements (use Logger)
- [ ] Types are explicit, no `any`
- [ ] Follows immutability patterns
- [ ] CHANGELOG.md updated with changes

---

## Changelog Maintenance

### CHANGELOG.md Requirements

The `CHANGELOG.md` file must be kept up-to-date as an audit trail of all changes within the `figma-connecter` folder. This ensures traceability and accountability for every modification.

### Format

Follow [Keep a Changelog](https://keepachangelog.com/) format with commit SHA references:

```markdown
# Changelog

All notable changes to the figma-connecter tool will be documented in this file.

## [Unreleased]

### Added

- New Vue emitter support (`a1b2c3d`)
- Progress indicator for CLI operations (`e4f5g6h`)

### Changed

- Refactored parser to use strategy pattern (`i7j8k9l`)
- Improved error messages for missing tsconfig (`m0n1o2p`)

### Fixed

- Handle mixins with multiple type parameters (`q3r4s5t`)
- Resolve circular dependency in emitters (`u6v7w8x`)

### Removed

- Deprecated Angular-specific utilities (`y9z0a1b`)

## [1.0.0] - 2026-01-15

### Added

- Initial release with WebComponent and React emitters
```

### Rules

1. **Every commit touching `figma-connecter/` must have a CHANGELOG entry** - No exceptions.
2. **Include the commit SHA** - Format as `(<short-sha>)` at the end of each entry.
3. **Use present tense** - "Add feature" not "Added feature".
4. **Group by change type** - Added, Changed, Fixed, Deprecated, Removed, Security.
5. **Keep entries concise** - One line per change, link to PR/issue if needed.
6. **Unreleased section** - All pending changes go under `[Unreleased]` until release.

### Workflow

1. **Before committing**: Add entry to `[Unreleased]` section.
2. **After committing**: Update the entry with the actual commit SHA.
3. **On release**: Move `[Unreleased]` entries to a versioned section with release date.

### Retrieving Commit SHAs

```bash
# Get short SHA of last commit
git rev-parse --short HEAD

# Get SHAs of commits touching figma-connecter
git log --oneline --follow -- packages/tools/figma-connecter/

# Verify all figma-connecter commits are in CHANGELOG
git log --oneline --follow -- packages/tools/figma-connecter/ | while read sha msg; do
  grep -q "$sha" CHANGELOG.md || echo "Missing: $sha $msg"
done
```

### Validation

Before merging, verify:

- [ ] All commits affecting `figma-connecter/` have CHANGELOG entries
- [ ] Each entry includes the commit SHA
- [ ] Entries are categorized correctly (Added/Changed/Fixed/etc.)
- [ ] No duplicate entries exist

---

## Performance Considerations

1. **Lazy loading** - Commands are loaded on-demand.
2. **Batch processing** - Multiple components processed in single TypeScript Program.
3. **Early termination** - Stop on first error when `continueOnError: false`.
4. **Minimal file I/O** - Read once, write once per file.

---

## Security Guidelines

1. **No eval or dynamic code execution**.
2. **Validate all file paths** - Prevent path traversal.
3. **Sanitize user input** - Especially in generated code.
4. **No sensitive data in logs** - Avoid logging file contents.
