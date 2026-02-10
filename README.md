# Figma Connecter CLI

Generate and maintain Figma Code Connect files for Momentum Design components.

This CLI scans Web Component source files, extracts metadata (properties, attributes, events, tag names),
and emits Code Connect files for Web Components and React.

## Features

- Discover `.component.ts` files from a file path or directory.
- Resolve component classes by default export, `@customElement` decorator, `@tagname` JSDoc tag,
  or first class fallback.
- Resolve tag names via JSDoc, local registration, constants-based namespaces, or file name fallback.
- Generate `webcomponent` and `react` Code Connect files with standardized sections.
- Update only generated sections when files already exist.
- Provide dry-run mode, strict inheritance checks, and structured warnings/errors.
- Force rewrite mode that only replaces the target connect file (no folder deletes).

## Requirements

- Node `>=20`.
- Yarn `3.2.4` if building from this repo.
- TypeScript source files using the `*.component.ts` suffix.

## Install / Build (from this repo)

```bash
# From the repo root

yarn build
node dist/bin/figma-connecter.js --help
```

If this package is installed from a registry, the `figma-connecter` binary is available on your `PATH` after install.

## Quick Start

```bash
# Generate Code Connect files for a single component
figma-connecter connect --path ./packages/components/src

# Scan a directory tree for components
figma-connecter connect --path ./packages/components/src/button --recursive

# Emit only Web Component targets
figma-connecter connect --path ./packages/components/src/button --emit webcomponent

# Preview file changes without writing
figma-connecter connect --path ./packages/components/src/button --dry-run

# Continue processing even when errors occur
figma-connecter connect --path ./packages/components/src/button --continue-on-error

# Stop on the first error
figma-connecter connect --path ./packages/components/src/button --no-continue-on-error

# Force rewrite connect files instead of section updates
figma-connecter connect --path ./packages/components/src/button --force

# Use custom import path for components
figma-connecter connect --path ./packages/components/src/button --base-import-path @ui/components
```

## Command Reference

`figma-connecter connect`

| Option                      | Description                                                        | Default       |
| --------------------------- | ------------------------------------------------------------------ | ------------- |
| `-p, --path <path>`         | Path to a component file or directory.                             | Required      |
| `-r, --recursive`           | Recursively scan subdirectories for `*.component.ts` files.        | `false`       |
| `-d, --dry-run`             | Preview changes without writing files.                             | `false`       |
| `-e, --emit <targets>`      | Emit targets: `webcomponent`, `react`, or `all` (comma-separated). | `all`         |
| `--strict`                  | Fail on unresolved base classes.                                   | `true`        |
| `--no-strict`               | Allow unresolved base classes.                                     | `false`       |
| `--continue-on-error`       | Continue processing remaining components when errors occur.        | `true`        |
| `--no-continue-on-error`    | Stop processing on the first error.                                | `false`       |
| `--force`                   | Force rewrite connect files instead of section updates.            | `false`       |
| `--base-import-path <path>` | Custom base path for component imports.                            | Auto-detected |

Global options

| Option                | Description                                                    | Default       |
| --------------------- | -------------------------------------------------------------- | ------------- |
| `-v, --verbose`       | Enable verbose logging.                                        | `false`       |
| `-q, --quiet`         | Suppress non-error output.                                     | `false`       |
| `-d, --dry-run`       | Preview changes without writing files.                         | `false`       |
| `-c, --config <path>` | Path to a `tsconfig.json` file for TypeScript program loading. | Auto-resolved |

## Discovery Rules

- Component files must end in `.component.ts`.
- Directory scans exclude `node_modules` and `dist`.
- Without `--recursive`, only the provided directory is scanned.

## Output

Generated files are written to a `code-connect` directory under each component folder.

Web Component target

- `code-connect/<ComponentName>.webcomponent.figma.ts`

React target

- `code-connect/<ComponentName>.react.figma.tsx`

Placeholders like `<FIGMA_<COMPONENT>_URL>` are inserted and should be replaced with real Figma URLs.

## Generated Sections

When an output file already exists, the CLI updates only the generated sections. It looks for markers like:

```text
// BEGIN GENERATED: props
// END GENERATED: props
```

If the markers are missing, the CLI skips updates and reports a warning to avoid overwriting manual edits.

When `--force` is enabled, the CLI rewrites the full connect file and ignores existing markers.

## Configuration

The CLI loads a TypeScript program to resolve symbols and inheritance.

- If `--config` is provided, it must point to a valid `tsconfig.json` file.
- If `--config` is not provided, the CLI searches for the nearest `tsconfig.json`
  starting from the input path.
- If no `tsconfig.json` is found, default TypeScript compiler options are used
  and any errors are reported in the summary.

## Troubleshooting

- `Path not found`: ensure `--path` points to an existing file or directory.
- `Invalid emit targets`: use `webcomponent`, `react`, or `all`.
- `Generated section markers not found`: re-run after adding the marker blocks
  or remove manual edits from generated sections.
- `No component files found`: confirm files use the `.component.ts` suffix.

## Development

```bash
# Build the CLI

yarn build

# Run unit tests

yarn test

# Run linting

yarn lint

# Run type checking

yarn typecheck
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this tool.

## Extending

- Emitters: `packages/tools/figma-connecter/src/emitters/EXTENDING.md`
- Parsers: `packages/tools/figma-connecter/src/parsers/EXTENDING.md`
