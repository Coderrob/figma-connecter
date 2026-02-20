/**
 * @fileoverview Disallow inline require() statements, especially when immediately used with typeof/instanceof
 * @author figma-connecter
 *
 * This rule prevents the anti-pattern of using inline require() statements, particularly
 * when the required value is immediately checked with typeof or instanceof against another
 * inline import. All imports and requires should be defined at the top of the file module.
 *
 * Examples of incorrect code:
 * ```typescript
 * const factory = require('../../src/parsers/factory') as typeof import('../../src/parsers/factory');
 * if (typeof value === typeof require('./module').SomeType) { ... }
 * if (value instanceof require('./module').SomeClass) { ... }
 * ```
 *
 * Examples of correct code:
 * ```typescript
 * import * as factory from '../../src/parsers/factory';
 * import { SomeType, SomeClass } from './module';
 * ```
 */

const UNWRAP_TYPES = new Set(['ChainExpression', 'ParenthesizedExpression', 'TSAsExpression']);

/**
 * Unwraps expression nodes that are wrappers (parentheses, chains, type assertions).
 *
 * @param {object} node - AST node to unwrap
 * @returns {object} Unwrapped node
 */
function unwrapExpression(node) {
  let current = node;
  while (current && UNWRAP_TYPES.has(current.type)) {
    current = current.expression || current.left;
  }
  return current;
}

/**
 * Checks if a node is a require() call expression.
 *
 * @param {object} node - AST node to check
 * @returns {boolean} True if node is a require() call
 */
function isRequireCall(node) {
  if (!node) return false;
  const unwrapped = unwrapExpression(node);
  return (
    unwrapped?.type === 'CallExpression' &&
    unwrapped.callee?.type === 'Identifier' &&
    unwrapped.callee.name === 'require'
  );
}

/**
 * Checks if a node is an inline import() expression.
 *
 * @param {object} node - AST node to check
 * @returns {boolean} True if node is an import() expression
 */
function isImportExpression(node) {
  if (!node) return false;
  const unwrapped = unwrapExpression(node);
  return unwrapped?.type === 'ImportExpression';
}

/**
 * Checks if a node is a typeof expression with require() or import().
 *
 * @param {object} node - AST node to check
 * @returns {boolean} True if node is typeof with inline require/import
 */
function isTypeofWithInlineRequire(node) {
  if (node?.type !== 'UnaryExpression' || node.operator !== 'typeof') {
    return false;
  }
  const argument = unwrapExpression(node.argument);
  return isRequireCall(argument) || isImportExpression(argument);
}

/**
 * Checks if a node uses inline require/import in instanceof.
 *
 * @param {object} node - AST node to check
 * @returns {boolean} True if uses inline require/import in instanceof
 */
function isInstanceofWithInlineRequire(node) {
  if (node?.type !== 'BinaryExpression' || node.operator !== 'instanceof') {
    return false;
  }
  const right = unwrapExpression(node.right);
  return isRequireCall(right) || isImportExpression(right);
}

const noInlineRequireTypeofRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline require() and import() statements; all imports should be at the top of the file',
      category: 'Best Practices',
      recommended: true,
    },
    schema: [],
    messages: {
      inlineRequire:
        'Inline require() is an anti-pattern. Move require() to the top of the file as an import statement.',
      inlineImport:
        'Inline import() expression should be avoided in synchronous code. Use static imports at the top of the file.',
      typeofWithInlineRequire:
        'Using typeof with inline require() or import() is an anti-pattern. Define imports at the top of the file.',
      instanceofWithInlineRequire:
        'Using instanceof with inline require() or import() is an anti-pattern. Define imports at the top of the file.',
      requireWithTypeAssertion:
        'Using require() with type assertion (as typeof import(...)) is an anti-pattern. Use static imports at the top of the file instead.',
    },
  },
  create(context) {
    return {
      /**
       * Check variable declarations for inline require().
       *
       * @param {object} node - VariableDeclarator node
       * @returns {void}
       */
      VariableDeclarator(node) {
        // Allow jest.isolateModules() callback contexts
        let current = node;
        while (current) {
          if (
            current.type === 'CallExpression' &&
            current.callee?.type === 'MemberExpression' &&
            current.callee.object?.name === 'jest' &&
            current.callee.property?.name === 'isolateModules'
          ) {
            return; // Skip - this is inside jest.isolateModules()
          }
          current = current.parent;
        }

        if (!node.init) return;

        const init = unwrapExpression(node.init);

        // Check for inline require()
        if (isRequireCall(init)) {
          context.report({
            node: node.init,
            messageId: 'inlineRequire',
          });
          return;
        }

        // Check for require() with type assertion: require(...) as typeof import(...)
        if (node.init.type === 'TSAsExpression' && isRequireCall(node.init.expression)) {
          context.report({
            node: node.init,
            messageId: 'requireWithTypeAssertion',
          });
          return;
        }

        // Check for inline import()
        if (isImportExpression(init)) {
          context.report({
            node: node.init,
            messageId: 'inlineImport',
          });
        }
      },

      /**
       * Check unary expressions for typeof with inline require().
       *
       * @param {object} node - UnaryExpression node
       * @returns {void}
       */
      UnaryExpression(node) {
        if (isTypeofWithInlineRequire(node)) {
          context.report({
            node,
            messageId: 'typeofWithInlineRequire',
          });
        }
      },

      /**
       * Check binary expressions for instanceof with inline require().
       *
       * @param {object} node - BinaryExpression node
       * @returns {void}
       */
      BinaryExpression(node) {
        if (isInstanceofWithInlineRequire(node)) {
          context.report({
            node,
            messageId: 'instanceofWithInlineRequire',
          });
        }
      },

      /**
       * Check call expressions for inline require() in arguments.
       *
       * @param {object} node - CallExpression node
       * @returns {void}
       */
      CallExpression(node) {
        // Allow jest.isolateModules() itself
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.object?.name === 'jest' &&
          node.callee.property?.name === 'isolateModules'
        ) {
          return;
        }

        // Check arguments for inline require() or import()
        for (const arg of node.arguments || []) {
          const unwrapped = unwrapExpression(arg);
          if (isRequireCall(unwrapped) || isImportExpression(unwrapped)) {
            const messageId = isRequireCall(unwrapped) ? 'inlineRequire' : 'inlineImport';
            context.report({
              node: arg,
              messageId,
            });
          }
        }
      },
    };
  },
};

export default noInlineRequireTypeofRule;
