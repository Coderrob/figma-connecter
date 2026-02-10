# Plugin System Guide

This guide explains how to extend the Figma Connecter tool with custom emitters and parsers using the plugin registration API.

## Overview

The plugin system allows external packages to register custom:

- **Emitters**: Generate Figma Code Connect files for new target frameworks
- **Parsers**: Extract component metadata from new component formats

All registration happens at runtime without modifying core tool code.

## Quick Start

### Single Registration

Register individual plugins:

```typescript
import { registerEmitterPlugin } from '@momentum-design/figma-connecter/emitters/factory';
import { registerParserPlugin } from '@momentum-design/figma-connecter/parsers/factory';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';

// Register an emitter
registerEmitterPlugin({
  target: EmitterTarget.MyTarget,
  factory: () => new MyEmitter(),
  metadata: {
    fileExtension: '.my-target.figma.ts',
    displayName: 'My Target',
    description: 'Figma Code Connect for My Target',
  },
});

// Register a parser
registerParserPlugin({
  target: ParserTarget.MyTarget,
  factory: () => new MyParser(),
  metadata: {
    displayName: 'My Target Parser',
    description: 'Parses My Target component format',
    filePatterns: ['*.mytarget.ts'],
  },
});
```

### Unified Registration

Register multiple plugins at once:

```typescript
import { registerPlugin } from '@momentum-design/figma-connecter/plugins';

registerPlugin({
  emitters: [
    {
      target: EmitterTarget.Vue,
      factory: () => new VueEmitter(),
      metadata: {
        fileExtension: '.vue.figma.ts',
        displayName: 'Vue',
        description: 'Figma Code Connect for Vue components',
      },
    },
  ],
  parsers: [
    {
      target: ParserTarget.VueSFC,
      factory: () => new VueSFCParser(),
      metadata: {
        displayName: 'Vue SFC',
        description: 'Parses Vue Single File Components',
        filePatterns: ['*.vue'],
      },
    },
  ],
});
```

## Creating Plugins

### Emitter Plugin

1. **Implement the Emitter Interface**

```typescript
import type { Emitter, EmitterContext, EmitResult } from '@momentum-design/figma-connecter/emitters/types';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';

export class VueEmitter implements Emitter {
  readonly target = EmitterTarget.Vue;

  emit(context: EmitterContext): EmitResult {
    const { model } = context;

    // Generate Vue-specific Figma Code Connect
    const content = this.generateVueConnect(model);

    return {
      filePath: context.filePath.replace(/\.vue$/, '.vue.figma.ts'),
      content,
      action: 'created',
    };
  }

  private generateVueConnect(model: ComponentModel): string {
    // Implementation...
  }
}
```

1. **Register the Plugin**

```typescript
import { registerEmitterPlugin } from '@momentum-design/figma-connecter/emitters/factory';

registerEmitterPlugin({
  target: EmitterTarget.Vue,
  factory: () => new VueEmitter(),
  metadata: {
    fileExtension: '.vue.figma.ts',
    displayName: 'Vue',
    description: 'Figma Code Connect for Vue components',
  },
});
```

### Parser Plugin

1. **Implement the Parser Interface**

```typescript
import type { Parser, ParseContext } from '@momentum-design/figma-connecter/parsers/types';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';
import type { ComponentModel } from '@momentum-design/figma-connecter/core/types';
import { createResult } from '@momentum-design/figma-connecter/utils/result';

export class VueSFCParser implements Parser {
  readonly target = ParserTarget.VueSFC;

  parse(context: ParseContext): Result<ComponentModel> {
    // Extract component metadata from Vue SFC
    const className = this.extractClassName(context.sourceFile);
    const props = this.extractProps(context.sourceFile);

    return createResult({
      className,
      tagName: this.deriveTagName(className),
      properties: props,
      events: [],
    });
  }

  private extractClassName(sourceFile: ts.SourceFile): string {
    // Implementation...
  }

  private extractProps(sourceFile: ts.SourceFile): PropertyDescriptor[] {
    // Implementation...
  }
}
```

1. **Register the Plugin**

```typescript
import { registerParserPlugin } from '@momentum-design/figma-connecter/parsers/factory';

registerParserPlugin({
  target: ParserTarget.VueSFC,
  factory: () => new VueSFCParser(),
  metadata: {
    displayName: 'Vue SFC',
    description: 'Parses Vue Single File Components',
    filePatterns: ['*.vue'],
  },
});
```

## Plugin Distribution

### NPM Package Structure

Create a package that exports a registration function:

```
@myorg/figma-connecter-vue-plugin/
├── package.json
├── src/
│   ├── index.ts           # Main export
│   ├── emitter.ts         # VueEmitter implementation
│   └── parser.ts          # VueSFCParser implementation
└── README.md
```

**src/index.ts**:

```typescript
import { registerPlugin } from '@momentum-design/figma-connecter/plugins';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';
import { VueEmitter } from './emitter';
import { VueSFCParser } from './parser';

export const registerVuePlugin = (): void => {
  registerPlugin({
    emitters: [
      {
        target: EmitterTarget.Vue,
        factory: () => new VueEmitter(),
        metadata: {
          fileExtension: '.vue.figma.ts',
          displayName: 'Vue',
          description: 'Figma Code Connect for Vue components',
        },
      },
    ],
    parsers: [
      {
        target: ParserTarget.VueSFC,
        factory: () => new VueSFCParser(),
        metadata: {
          displayName: 'Vue SFC',
          description: 'Parses Vue Single File Components',
          filePatterns: ['*.vue'],
        },
      },
    ],
  });
};

// Auto-register if imported
registerVuePlugin();
```

**package.json**:

```json
{
  "name": "@myorg/figma-connecter-vue-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@momentum-design/figma-connecter": "^1.0.0"
  }
}
```

### Usage

Users install and import your plugin:

```bash
npm install @myorg/figma-connecter-vue-plugin
```

```typescript
// Import to auto-register
import '@myorg/figma-connecter-vue-plugin';

// Or manually register
import { registerVuePlugin } from '@myorg/figma-connecter-vue-plugin';
registerVuePlugin();
```

## Plugin Registration Rules

### Timing

- **Register early**: Plugins must be registered before factory functions are called
- **One-time registration**: Each target can only be registered once
- **No overrides**: Cannot replace existing registrations

### Validation

The registration API validates:

1. **Duplicate targets**: Throws if target already registered
2. **Required metadata**: All metadata fields must be provided
3. **Type safety**: Factory must return correct interface implementation

### Error Handling

```typescript
import { registerEmitterPlugin, hasEmitterPlugin } from '@momentum-design/figma-connecter/emitters/factory';

// Check before registering
if (!hasEmitterPlugin(EmitterTarget.MyTarget)) {
  registerEmitterPlugin({...});
} else {
  console.log('Plugin already registered');
}

// Catch registration errors
try {
  registerEmitterPlugin({...});
} catch (error) {
  console.error('Plugin registration failed:', error.message);
}
```

## Advanced Patterns

### Conditional Registration

Register plugins based on project detection:

```typescript
import { existsSync } from 'fs';
import { registerParserPlugin } from '@momentum-design/figma-connecter/parsers/factory';

// Only register if project uses Vue
if (existsSync('./vite.config.ts') || existsSync('./vue.config.js')) {
  registerParserPlugin({...});
}
```

### Plugin with Options

Allow users to configure your plugin:

```typescript
export interface VuePluginOptions {
  readonly scriptSetup?: boolean;
  readonly composition?: boolean;
}

export const registerVuePlugin = (options: VuePluginOptions = {}): void => {
  registerPlugin({
    parsers: [
      {
        factory: () => new VueSFCParser(options),
        // ...
      },
    ],
  });
};
```

### Plugin Discovery

List all registered plugins:

```typescript
import { getPluginInfo } from '@momentum-design/figga-connect/plugins';

const info = getPluginInfo();
console.log('Emitters:', Array.from(info.emitters.keys()));
console.log('Parsers:', Array.from(info.parsers.keys()));
```

## Testing Plugins

### Unit Testing

Test your emitter/parser in isolation:

```typescript
import { VueEmitter } from './emitter';

describe('VueEmitter', () => {
  it('generates valid Vue Figma Connect', () => {
    const emitter = new VueEmitter();
    const result = emitter.emit({
      model: mockComponentModel,
      filePath: 'Button.vue',
    });

    expect(result.content).toContain('figma.connect');
    expect(result.filePath).toEndWith('.vue.figma.ts');
  });
});
```

### Integration Testing

Test registration:

```typescript
import { registerVuePlugin } from './';
import { hasEmitterPlugin, hasParserPlugin } from '@momentum-design/figma-connecter/plugins';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';

describe('Vue Plugin Registration', () => {
  it('registers emitter and parser', () => {
    registerVuePlugin();

    expect(hasEmitterPlugin(EmitterTarget.Vue)).toBe(true);
    expect(hasParserPlugin(ParserTarget.VueSFC)).toBe(true);
  });
});
```

## Best Practices

1. **Isolation**: Keep plugin code separate from core tool
2. **Type Safety**: Export typed interfaces for plugin options
3. **Documentation**: Document plugin capabilities and limitations
4. **Error Handling**: Gracefully handle parse/emit failures
5. **Testing**: Provide comprehensive test coverage
6. **Versioning**: Follow semver for plugin packages
7. **Peer Dependencies**: Specify compatible tool versions

## Examples

### Vue Plugin

```typescript
import { registerPlugin } from '@momentum-design/figma-connecter/plugins';
import { EmitterTarget } from '@momentum-design/figma-connecter/core/types';
import { ParserTarget } from '@momentum-design/figma-connecter/parsers/types';

registerPlugin({
  emitters: [
    {
      target: EmitterTarget.Vue,
      factory: () => new VueEmitter(),
      metadata: {
        fileExtension: '.vue.figma.ts',
        displayName: 'Vue',
        description: 'Figma Code Connect for Vue 3 components',
      },
    },
  ],
  parsers: [
    {
      target: ParserTarget.VueSFC,
      factory: () => new VueSFCParser(),
      metadata: {
        displayName: 'Vue SFC',
        description: 'Parses Vue 3 Single File Components with script setup',
        filePatterns: ['*.vue'],
      },
    },
  ],
});
```

### Angular Plugin

```typescript
registerPlugin({
  emitters: [
    {
      target: EmitterTarget.Angular,
      factory: () => new AngularEmitter(),
      metadata: {
        fileExtension: '.angular.figma.ts',
        displayName: 'Angular',
        description: 'Figma Code Connect for Angular components',
      },
    },
  ],
  parsers: [
    {
      target: ParserTarget.Angular,
      factory: () => new AngularParser(),
      metadata: {
        displayName: 'Angular',
        description: 'Parses Angular components with @Component decorator',
        filePatterns: ['*.component.ts'],
      },
    },
  ],
});
```

## See Also

- [Emitter Extension Guide](./emitters/EXTENDING.md) - Detailed emitter implementation
- [Parser Extension Guide](./parsers/EXTENDING.md) - Detailed parser implementation
- [API Reference](./plugins.ts) - Plugin API types and functions
