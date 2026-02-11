# Extending Parsers

This guide shows how to add new parser targets using the registry pattern.

## Adding a New Parser Target

The registry pattern ensures new parser targets require **zero changes** to pipeline orchestration code (`runner.ts`, `batch.ts`). All target-specific behavior is isolated within the parser implementation and its registry entry.

### Steps

#### 1. Create Your Parser Class

Implement the `Parser` interface:

```typescript
// src/parsers/my-target/index.ts
import type { Parser, ParseContext } from '../types';
import { ParserTarget } from '../types';

export class MyTargetParser implements Parser {
  readonly target = ParserTarget.MyTarget; // Add to ParserTarget enum first

  parse(context: ParseContext): Result<ComponentModel> {
    // Implementation here
    return createResult({
      className: '...',
      tagName: '...',
      // ... component model ...
    });
  }
}
```

#### 2. Register in the Factory

Add your parser to `PARSER_REGISTRY` in `src/parsers/factory.ts`:

```typescript
const PARSER_REGISTRY: ReadonlyMap<ParserTarget, ParserRegistryEntry> = new Map([
  // ... existing entries ...
  [
    ParserTarget.MyTarget,
    {
      factory: () => new MyTargetParser(),
      metadata: {
        displayName: 'My Target',
        description: 'Parses My Target component format',
        filePatterns: ['*.mytarget.ts', '*.mytarget.tsx'],
      },
    },
  ],
]);
```

#### 3. Done

No other changes needed. The pipeline will automatically:

- Use your parser when selected or as default
- Display your parser in help text
- Handle all orchestration generically

## Registry Benefits

### Zero Branching in Orchestration

Pipeline code remains clean:

```typescript
// No if/switch needed - works for all targets
const parseResult = context.parser.parse(parseContext);
// ... handle result ...
```

### Metadata-Driven Configuration

File patterns and descriptions are declarative:

```typescript
const metadata = getParserMetadata(ParserTarget.MyTarget);
console.log(metadata.displayName); // "My Target"
console.log(metadata.filePatterns); // ["*.mytarget.ts", "*.mytarget.tsx"]
```

### Flexible Default Selection

The first registered parser becomes the default:

```typescript
const parser = createDefaultParser();
// Uses first entry in PARSER_REGISTRY
```

## Parser Context

All parsers receive standardized context:

```typescript
interface ParseContext {
  readonly sourceFile: ts.SourceFile; // Parsed TypeScript AST
  readonly filePath: string; // Component file path
  readonly componentDir: string; // Component directory
  readonly checker: ts.TypeChecker; // Type resolution
  readonly strict?: boolean; // Strict mode flag
}
```

This ensures parsers work uniformly within the pipeline.

## Testing

Registries support dependency injection:

```typescript
// Custom registry for tests
const testRegistry = new Map([
  [ParserTarget.MyTarget, {
    factory: () => new MockParser(),
    metadata: { ... }
  }],
]);

// Use in tests
const parser = createParser(ParserTarget.MyTarget, testRegistry);
```

## Best Practices

1. **Follow Result monad pattern** - Return `Result<ComponentModel>`
2. **Collect diagnostics** - Add warnings/errors to Result
3. **Use TypeScript APIs** - Leverage `ts.*` for AST traversal
4. **Document patterns** - Use metadata for file pattern hints
5. **Handle edge cases** - Add warnings for unsupported features

## File Pattern Matching

Metadata file patterns enable future auto-detection:

```typescript
metadata: {
  filePatterns: [
    '*.component.ts', // Component files
    '*.element.ts', // Element files
    '!*.spec.ts', // Exclude test files
  ];
}
```

Patterns follow glob syntax and can be used for:

- Auto-selecting appropriate parser
- Filtering discovery results
- IDE integration hints

## Plugin API

The formal plugin interface allows external packages to register parsers without modifying factory code.

### Registering an External Parser

Use the `registerParserPlugin` function:

```typescript
import { registerParserPlugin, type ParserPluginOptions } from '@momentum-design/figma-connecter/parsers/factory';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';
import { MyExternalParser } from './my-parser';

// Register before pipeline execution
registerParserPlugin({
  target: ParserTarget.MyExternal,
  factory: () => new MyExternalParser(),
  metadata: {
    displayName: 'External Parser',
    description: 'Parses external component format',
    filePatterns: ['*.external.ts', '*.external.tsx'],
  },
});
```

### Plugin Registration Rules

1. **No Duplicates**: Cannot register the same target twice
2. **Early Registration**: Register before any factory calls
3. **Type Safety**: Must implement `Parser` interface
4. **Metadata Required**: All metadata fields must be provided (filePatterns optional)

### Checking Registration

Verify if a target is registered:

```typescript
import { hasParserPlugin } from '@momentum-design/figma-connecter/parsers/factory';

if (!hasParserPlugin(ParserTarget.MyExternal)) {
  registerParserPlugin({...});
}
```

### Use Cases

- **Alternative frameworks**: Add Vue SFC, Svelte, Stencil parsers
- **Custom decorators**: Parse company-specific property systems
- **Multi-format support**: Handle JSDoc-only, Vanilla JS, or TypeDoc
- **Plugin packages**: Distribute parsers as separate npm packages

## Future Extensions

The plugin API supports:

- Multi-parser pipelines (try multiple parsers per file)
- Parser auto-detection based on file patterns
- Parser versioning and compatibility checks
- Conditional parser loading based on project detection
