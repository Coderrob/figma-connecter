# Extending Emitters

This guide shows how to add new emitter targets using the registry pattern.

## Adding a New Emitter Target

The registry pattern ensures new emitter targets require **zero changes** to pipeline orchestration code (`runner.ts`, `batch.ts`). All target-specific behavior is isolated within the emitter implementation and its registry entry.

### Steps

#### 1. Create Your Emitter Class

Implement the `Emitter` interface:

```typescript
// src/emitters/my-target/index.ts
import type { Emitter, EmitterContext } from '../types';
import { EmitterTarget } from '../../core/types';

export class MyTargetEmitter implements Emitter {
  readonly target = EmitterTarget.MyTarget; // Add to EmitterTarget enum first

  emit(context: EmitterContext): EmitResult {
    // Implementation here
    return {
      filePath: '...',
      content: '...',
      action: 'created',
    };
  }
}
```

#### 2. Register in the Factory

Add your emitter to `EMITTER_REGISTRY` in `src/emitters/factory.ts`:

```typescript
const EMITTER_REGISTRY: ReadonlyMap<EmitterTarget, EmitterRegistryEntry> = new Map([
  // ... existing entries ...
  [
    EmitterTarget.MyTarget,
    {
      factory: () => new MyTargetEmitter(),
      metadata: {
        fileExtension: '.mytarget.figma.ts',
        displayName: 'My Target',
        description: 'Figma Code Connect for My Target components',
      },
    },
  ],
]);
```

#### 3. Done

No other changes needed. The pipeline will automatically:

- Include your emitter when `--emit mytarget` is used
- Generate files with the correct extension
- Display your emitter in help text
- Handle all orchestration generically

## Registry Benefits

### Zero Branching in Orchestration

Pipeline code remains clean:

```typescript
// No if/switch needed - works for all targets
for (const emitter of context.emitters) {
  const emission = emitter.emit({ model, options });
  // ... handle result ...
}
```

### Metadata-Driven Configuration

File extensions, display names, and descriptions are declarative:

```typescript
const metadata = getEmitterMetadata(EmitterTarget.MyTarget);
console.log(metadata.displayName); // "My Target"
console.log(metadata.fileExtension); // ".mytarget.figma.ts"
```

### Consistent Registry Order

Emitters are instantiated in registry order, ensuring predictable output:

```typescript
const emitters = createEmitters({ targets: [Target.B, Target.A] });
// Always returns [A, B] (registry order), not [B, A] (request order)
```

## Testing

Register entries support dependency injection for testing:

```typescript
// Custom registry for tests
const testRegistry = new Map([
  [EmitterTarget.MyTarget, {
    factory: () => new MockEmitter(),
    metadata: { ... }
  }],
]);

// Use in tests
const emitter = createEmitter(EmitterTarget.MyTarget);
```

## Best Practices

1. **Keep emitters isolated** - No cross-emitter dependencies
2. **Use metadata** - Avoid hardcoding file extensions elsewhere
3. **Follow conventions** - File extensions: `.{target}.figma.{ext}`
4. **Document capabilities** - Use meaningful metadata descriptions
5. **Test independently** - Each emitter should be unit-testable

## Plugin API

The formal plugin interface allows external packages to register emitters without modifying factory code.

### Registering an External Emitter

Use the `registerEmitterPlugin` function:

```typescript
import { registerEmitterPlugin, type EmitterPluginOptions } from '@momentum-design/figma-connecter/emitters/factory';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';
import { MyExternalEmitter } from './my-emitter';

// Register before pipeline execution
registerEmitterPlugin({
  target: EmitterTarget.MyExternal,
  factory: () => new MyExternalEmitter(),
  metadata: {
    fileExtension: '.external.figma.ts',
    displayName: 'External Target',
    description: 'External emitter plugin',
  },
});
```

### Plugin Registration Rules

1. **No Duplicates**: Cannot register the same target twice
2. **Early Registration**: Register before any factory calls
3. **Type Safety**: Must implement `Emitter` interface
4. **Metadata Required**: All metadata fields must be provided

### Checking Registration

Verify if a target is registered:

```typescript
import { hasEmitterPlugin } from '@momentum-design/figma-connecter/emitters/factory';

if (!hasEmitterPlugin(EmitterTarget.MyExternal)) {
  registerEmitterPlugin({...});
}
```

### Use Cases

- **Third-party frameworks**: Add Vue, Svelte, Angular emitters
- **Company-specific targets**: Internal design system formats
- **Experimental features**: Test new emitters without core changes
- **Plugin packages**: Distribute emitters as separate npm packages

## Future Extensions

The plugin API supports:

- Dynamic target discovery at runtime
- Conditional emitter loading based on project config
- Emitter versioning and compatibility checks
- Hot-reloading of emitter implementations
