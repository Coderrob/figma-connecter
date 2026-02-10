/**
 * @fileoverview ESLint Flat Configuration for figma-connecter
 *
 * A comprehensive ESLint configuration optimized for TypeScript CLI tool development
 * with strict code quality, documentation, and maintainability rules.
 *
 * @version 2.0.0
 * @license MIT
 * @see https://eslint.org/docs/latest/use/configure/configuration-files-new
 */

// ============================================================================
// IMPORTS
// ============================================================================

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import globals from 'globals';

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * TypeScript project configuration path.
 */
const TS_PROJECT_PATH = './tsconfig.json';

/**
 * Glob patterns matching all TypeScript file extensions.
 */
const TS_FILE_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

/**
 * Glob patterns for source files (excluding tests).
 */
const SOURCE_FILE_GLOBS = ['src/**/*.ts', 'src/**/*.tsx', 'bin/**/*.ts'];

/**
 * Glob patterns for test and mock files.
 */
const TEST_FILE_GLOBS = [
  '**/__tests__/**/*.ts',
  '**/__mocks__/**/*.ts',
  '**/*.test.ts',
  '**/*.spec.ts',
];

/**
 * Complexity thresholds for maintainable code.
 * Set to reasonable limits for a CLI tool with AST parsing logic.
 */
const COMPLEXITY_LIMITS = {
  cyclomatic: 15,
  maxDepth: 5,
  maxNestedCallbacks: 4,
  maxParams: 4,
};

/**
 * Enhanced complexity for parser/emitter files (complex AST traversal).
 */
const PARSER_COMPLEXITY_LIMITS = {
  cyclomatic: 25,
  maxDepth: 6,
};

// ============================================================================
// SHARED RULE CONFIGURATIONS
// ============================================================================

/**
 * TypeScript unused variables configuration.
 * Allows underscore-prefixed variables to be intentionally unused.
 */
const UNUSED_VARS_CONFIG = {
  argsIgnorePattern: '^_',
  caughtErrors: 'all',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
  ignoreRestSiblings: true,
  varsIgnorePattern: '^_',
};

/**
 * Restricted syntax patterns to enforce explicit typing and clean imports.
 */
const RESTRICTED_SYNTAX_PATTERNS = [
  {
    message:
      'Do not use ReturnType; prefer explicit function return types or exported interfaces.',
    selector: 'TSTypeReference[typeName.name="ReturnType"]',
  },
  {
    message:
      "Do not use indexed access types (e.g., Interface['property']); define explicit types or interfaces instead.",
    selector:
      'TSIndexedAccessType[objectType.type="TSTypeReference"][objectType.typeName.type="Identifier"]:not([objectType.typeName.name=/^(Parameters|ReturnType|Awaited|ConstructorParameters|InstanceType|ThisParameterType|OmitThisParameter)$/])',
  },
  {
    message:
      'Do not re-export from parent directories (../). Re-exports should only reference sibling or child modules to prevent circular dependencies.',
    selector: 'ExportAllDeclaration[source.value=/^[.][.]/]',
  },
  {
    message:
      'Do not re-export from parent directories (../). Re-exports should only reference sibling or child modules to prevent circular dependencies.',
    selector: 'ExportNamedDeclaration[source.value=/^[.][.]/]',
  },
  {
    message: 'Do not use unions of literal types. Use an enum instead.',
    selector:
      'TSTypeAliasDeclaration[typeAnnotation.type="TSUnionType"] > TSUnionType > TSLiteralType',
  },
  {
    selector: 'ForInStatement',
    message:
      'for..in loops iterate over the entire prototype chain. Use Object.{keys,values,entries} instead.',
  },
  {
    selector: 'LabeledStatement',
    message:
      'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
  },
  {
    selector: 'WithStatement',
    message:
      '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
  },
];

// ============================================================================
// RULE DEFINITIONS BY CATEGORY
// ============================================================================

/**
 * Core TypeScript rules for type safety and code quality.
 */
const typescriptRules = {
  // Type Safety
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-unused-vars': ['error', UNUSED_VARS_CONFIG],
  '@typescript-eslint/explicit-function-return-type': 'off',
  '@typescript-eslint/no-use-before-define': [
    'error',
    {
      allowNamedExports: true,
      classes: true,
      functions: false,
      variables: true,
    },
  ],

  // Disable base rule in favor of TypeScript version
  'no-duplicate-imports': 'off',
  'no-undef': 'off', // TypeScript handles this
  'no-use-before-define': 'off',
};

/**
 * Code complexity and maintainability rules.
 */
const complexityRules = {
  complexity: ['warn', { max: COMPLEXITY_LIMITS.cyclomatic }],
  'max-depth': ['warn', { max: COMPLEXITY_LIMITS.maxDepth }],
  'max-len': ['error', { code: 120, ignorePattern: '^\\s*(//|/\\*|\\*)' }],
  'max-nested-callbacks': ['error', { max: COMPLEXITY_LIMITS.maxNestedCallbacks }],
  'max-params': ['error', { max: COMPLEXITY_LIMITS.maxParams }],
  'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX_PATTERNS],
};

/**
 * JSDoc documentation rules for exported APIs.
 */
const jsdocRules = {
  // Required Documentation
  'jsdoc/require-jsdoc': [
    'error',
    {
      contexts: [
        'FunctionDeclaration',
        'FunctionExpression',
        'ArrowFunctionExpression',
        'MethodDefinition',
      ],
      publicOnly: false,
      require: {
        ArrowFunctionExpression: true,
        ClassDeclaration: true,
        FunctionDeclaration: true,
        FunctionExpression: true,
        MethodDefinition: true,
      },
    },
  ],

  // Validation Rules
  'jsdoc/check-alignment': 'error',
  'jsdoc/check-indentation': 'off', // Too strict for license headers
  'jsdoc/check-line-alignment': ['error', 'never'],
  'jsdoc/check-param-names': 'error',
  'jsdoc/check-tag-names': 'error',
  'jsdoc/no-blank-blocks': 'error',

  // Required Documentation Components
  'jsdoc/require-description': 'error',
  'jsdoc/require-param': 'error',
  'jsdoc/require-param-description': 'error',
  'jsdoc/require-returns': 'error',
  'jsdoc/require-returns-description': 'error',

  // Disabled Rules (TypeScript handles types)
  'jsdoc/check-types': 'off',
  'jsdoc/no-blank-block-descriptions': 'off',
  'jsdoc/no-undefined-types': 'off',
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns-type': 'off',
  'jsdoc/tag-lines': 'off',
  'jsdoc/valid-types': 'off',
};

/**
 * Import organization and validation rules.
 */
const importRules = {
  'import/default': 'error',
  'import/export': 'off', // TypeScript handles duplicate exports
  'import/first': 'error',
  'import/named': 'error',
  'import/namespace': 'error',
  'import/newline-after-import': 'error',
  'import/no-cycle': 'error',
  'import/no-duplicates': 'error',
  'import/no-extraneous-dependencies': 'off',
  'import/no-mutable-exports': 'error',
  'import/no-unresolved': 'off', // TypeScript handles module resolution
  'import/order': 'off', // Using simple-import-sort instead
  'sort-imports': 'off', // Using simple-import-sort instead
};

/**
 * Code quality and style rules.
 */
const codeQualityRules = {
  camelcase: ['error', { ignoreDestructuring: true, properties: 'never' }],
  curly: ['error', 'all'],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'global-require': 'off',
  'implicit-arrow-linebreak': 'off', // Conflicts with max-len and Prettier
  'no-alert': 'error',
  'no-bitwise': 'off', // Allow bitwise ops for TypeScript modifier flags
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  'no-continue': 'off', // Allow continue in loops
  'no-debugger': 'error',
  'no-nested-ternary': 'off', // Allow for concise conditional expressions
  'no-param-reassign': ['error', { props: false }],
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-arrow-callback': 'error',
  'prefer-const': 'error',
  'prefer-template': 'error',
};

// ============================================================================
// TYPESCRIPT CONFIGURATIONS
// ============================================================================

/**
 * Type-checked TypeScript configuration for source files.
 */
const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: SOURCE_FILE_GLOBS,
  languageOptions: {
    ...config.languageOptions,
    globals: {
      ...globals.node,
      ...config.languageOptions?.globals,
    },
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      ecmaVersion: 'latest',
      projectService: true,
      sourceType: 'module',
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

/**
 * Basic TypeScript configuration for all TypeScript files (no type checking).
 */
const basicTsConfigs = tseslint.configs.recommended.map((config) => ({
  ...config,
  files: TS_FILE_PATTERNS,
}));

// ============================================================================
// TEST FILE RULE OVERRIDES
// ============================================================================

/**
 * Relaxed rules for test and mock files.
 */
const testFileRuleOverrides = {
  // Complexity Rules - Disabled
  complexity: 'off',
  'max-depth': 'off',
  'max-nested-callbacks': 'off',
  'max-params': 'off',

  // Documentation Rules - Disabled
  'jsdoc/require-description': 'off',
  'jsdoc/require-jsdoc': 'off',
  'jsdoc/require-param': 'off',
  'jsdoc/require-param-description': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-returns-description': 'off',

  // Type Safety Rules - Relaxed for mocking
  '@typescript-eslint/no-explicit-any': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unused-vars': ['error', UNUSED_VARS_CONFIG],

  // Other Rules - Relaxed
  'import/no-extraneous-dependencies': 'off',
  'no-console': 'off',
  'no-magic-numbers': 'off',
};

// ============================================================================
// IGNORED PATHS
// ============================================================================

/**
 * Paths to completely ignore from linting.
 */
const IGNORED_PATHS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/__fixtures__/**',
  '**/__tests__/__output__/**',
  '**/.cache/**',
  '**/tmp/**',
  '**/temp/**',
  '**/*.min.js',
  '**/*.d.ts',
  '**/*.js',
  '**/*.cjs',
  '**/*.mjs',
  '!eslint.config.mjs',
];

// ============================================================================
// EXPORTED CONFIGURATION
// ============================================================================

export default [
  // ──────────────────────────────────────────────────────────────────────────
  // Global Ignores
  // ──────────────────────────────────────────────────────────────────────────
  {
    ignores: IGNORED_PATHS,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Base Configurations
  // ──────────────────────────────────────────────────────────────────────────
  eslint.configs.recommended,
  ...basicTsConfigs,
  ...typeCheckedConfigs,

  // ──────────────────────────────────────────────────────────────────────────
  // Source File Configuration
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: SOURCE_FILE_GLOBS,
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        projectService: true,
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
      jsdoc: jsdocPlugin,
    },
    rules: {
      ...typescriptRules,
      ...complexityRules,
      ...jsdocRules,
      ...importRules,
      ...codeQualityRules,
    },
    settings: {
      'import/resolver': {
        node: true,
        typescript: {
          alwaysTryTypes: true,
          project: TS_PROJECT_PATH,
        },
      },
      jsdoc: {
        mode: 'typescript',
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Parser and Emitter Files Configuration (complex AST traversal)
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ['src/parsers/**/*.ts', 'src/emitters/**/*.ts'],
    rules: {
      complexity: ['warn', { max: PARSER_COMPLEXITY_LIMITS.cyclomatic }],
      'max-depth': ['warn', { max: PARSER_COMPLEXITY_LIMITS.maxDepth }],
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // CLI Entry Point Configuration
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ['bin/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Logger Configuration (console is the primary output mechanism)
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: ['src/core/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // Test File Configuration
  // ──────────────────────────────────────────────────────────────────────────
  {
    files: TEST_FILE_GLOBS,
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        projectService: true,
        sourceType: 'module',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      jsdoc: jsdocPlugin,
    },
    rules: {
      ...testFileRuleOverrides,
    },
  },
];
