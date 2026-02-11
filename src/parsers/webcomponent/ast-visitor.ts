/**
 * Copyright (c) 2026 Robert Lindley
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Unified AST Visitor Module
 *
 * Consolidates multiple AST traversals into a single pass.
 * Collects all information needed by component discovery, event extraction,
 * and tag name resolution in one traversal.
 *
 * @module parsers/webcomponent/ast-visitor
 */

import ts from 'typescript';

/**
 * Information about a dispatchEvent call found in the AST.
 */
export interface DispatchEventCall {
  /** The event name literal (if identifiable) */
  readonly eventName: string;
  /** The containing class declaration */
  readonly containingClass: ts.ClassLikeDeclaration;
  /** The call expression node */
  readonly callNode: ts.CallExpression;
}

/**
 * Information about a register() call found in the AST.
 */
export interface RegisterCall {
  /** The receiver identifier (e.g., 'MyComponent' in MyComponent.register()) */
  readonly receiver?: string;
  /** The first argument to register() */
  readonly argument: ts.Expression | undefined;
  /** The call expression node */
  readonly callNode: ts.CallExpression;
}

/**
 * Result of visiting a source file's AST.
 * Contains all information needed by extractors without requiring additional traversals.
 */
export interface ASTVisitorResult {
  /** All class declarations found in the source file */
  readonly classDeclarations: readonly ts.ClassDeclaration[];

  /** Default export assignment (if present) */
  readonly defaultExport?: ts.Identifier | ts.Expression;

  /** Map of class declarations to their decorators */
  readonly classDecorators: ReadonlyMap<ts.ClassDeclaration, readonly ts.Decorator[]>;

  /** Map of class declarations to their JSDoc tags */
  readonly classJSDocTags: ReadonlyMap<ts.ClassDeclaration, readonly ts.JSDocTag[]>;

  /** All dispatchEvent calls found in class methods */
  readonly dispatchEventCalls: readonly DispatchEventCall[];

  /** All register() calls found in the source file */
  readonly registerCalls: readonly RegisterCall[];
}

/**
 * Extracts the event name from a CustomEvent constructor call.
 *
 * @param arg - Argument to the dispatchEvent call.
 * @returns Event name if it's a CustomEvent with a string literal, otherwise null.
 */
const extractEventName = (arg: ts.Expression): string | null => {
  if (!ts.isNewExpression(arg)) {
    return null;
  }

  const eventType = arg.expression;
  if (!ts.isIdentifier(eventType) || eventType.text !== 'CustomEvent') {
    return null;
  }

  const [eventNameArg] = arg.arguments ?? [];
  if (!eventNameArg) {
    return null;
  }

  if (ts.isStringLiteral(eventNameArg)) {
    return eventNameArg.text;
  }

  if (ts.isNoSubstitutionTemplateLiteral(eventNameArg)) {
    return eventNameArg.text;
  }

  return null;
};

/**
 * Visits a source file's AST once and collects all relevant information
 * for component discovery, event extraction, and tag name resolution.
 *
 * This eliminates the need for multiple AST traversals by different extractors.
 *
 * @param sourceFile - TypeScript source file to visit.
 * @returns Collected AST information.
 */
export function visitSourceFile(sourceFile: ts.SourceFile): ASTVisitorResult {
  const classDeclarations: ts.ClassDeclaration[] = [];
  const classDecorators = new Map<ts.ClassDeclaration, readonly ts.Decorator[]>();
  const classJSDocTags = new Map<ts.ClassDeclaration, readonly ts.JSDocTag[]>();
  const dispatchEventCalls: DispatchEventCall[] = [];
  const registerCalls: RegisterCall[] = [];
  let defaultExport: ts.Identifier | ts.Expression | undefined;

  // Stack to track current class context during traversal
  const classStack: ts.ClassLikeDeclaration[] = [];

  /**
   * Recursively visits nodes in the AST.
   *
   * @param node - Current node being visited.
   */
  const visit = (node: ts.Node): void => {
    // Collect class declarations
    if (ts.isClassDeclaration(node)) {
      classDeclarations.push(node);

      // Collect decorators
      const decorators = ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
      if (decorators.length > 0) {
        classDecorators.set(node, decorators);
      }

      // Collect JSDoc tags
      const jsdocTags = ts.getJSDocTags(node);
      if (jsdocTags.length > 0) {
        classJSDocTags.set(node, jsdocTags);
      }

      // Push onto stack for nested class tracking
      classStack.push(node);
      ts.forEachChild(node, visit);
      classStack.pop();
      return;
    }

    // Track class expressions (for mixins, etc.)
    if (ts.isClassExpression(node)) {
      classStack.push(node);
      ts.forEachChild(node, visit);
      classStack.pop();
      return;
    }

    // Collect default exports
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      defaultExport = node.expression as ts.Identifier | ts.Expression;
    }

    // Collect dispatchEvent calls
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const propertyAccess = node.expression;

      // Check for dispatchEvent
      if (propertyAccess.name.text === 'dispatchEvent') {
        const [arg] = node.arguments;
        if (arg) {
          const eventName = extractEventName(arg);
          if (eventName) {
            const containingClass = classStack.at(-1);
            if (containingClass) {
              dispatchEventCalls.push({
                eventName,
                containingClass,
                callNode: node,
              });
            }
          }
        }
      }

      // Check for register() calls
      if (propertyAccess.name.text === 'register') {
        const receiver = ts.isIdentifier(propertyAccess.expression) ? propertyAccess.expression.text : undefined;
        registerCalls.push({
          receiver,
          argument: node.arguments[0],
          callNode: node,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return {
    classDeclarations,
    defaultExport,
    classDecorators,
    classJSDocTags,
    dispatchEventCalls,
    registerCalls,
  };
}
