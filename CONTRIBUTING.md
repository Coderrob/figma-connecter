# @momentum-design/figma-connecter - Contributing Guide

## Code Organization

### Barrel File Convention

All `index.ts` files within figma-connecter **MUST** only contain `export` statements. They serve as barrel files for convenient importing and should not define any:

- Types (`type`, `interface`)
- Constants (`const`, `enum`)
- Classes (`class`)
- Functions
- Objects

**Why?** This convention promotes:

- **High cohesion, low coupling**: Each file has a single, clear purpose
- **Easier testing**: Implementation files can be tested independently
- **Better maintainability**: Changes to implementations don't affect barrel file structure
- **Clearer dependencies**: Import statements reveal actual module dependencies

### File Organization Pattern

When a module needs to define code, organize it into focused files:

```text
module/
  index.ts           # Barrel file - exports only
  types.ts           # Type definitions
  constants.ts       # Constants and enums
  helpers.ts         # Helper functions
  factory.ts         # Factory functions
  <feature>.ts       # Feature-specific implementations
```

**Example:**

```typescript
// ❌ BAD: index.ts with implementations
export const DEFAULT_VALUE = 'foo';
export interface Options { ... }
export function create() { ... }

// ✅ GOOD: Separate files
// constants.ts
export const DEFAULT_VALUE = 'foo';

// types.ts
export interface Options { ... }

// factory.ts
export function create() { ... }

// index.ts (barrel file)
export { DEFAULT_VALUE } from './constants';
export type { Options } from './types';
export { create } from './factory';
```

## Contributing

This component package was generated with a script, please report any issues.
