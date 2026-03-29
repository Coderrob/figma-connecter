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
 * @module parsers/webcomponent/shared/ast-visitor
 */

import ts from "typescript";

const CUSTOM_EVENT_TYPE = "CustomEvent";
const DISPATCH_EVENT_METHOD = "dispatchEvent";
const REGISTER_METHOD = "register";

export interface IDispatchEventCall {
  readonly eventName: string;
  readonly containingClass: ts.ClassLikeDeclaration;
  readonly callNode: ts.CallExpression;
}

export interface IRegisterCall {
  readonly receiver?: string;
  readonly argument: ts.Expression | undefined;
  readonly callNode: ts.CallExpression;
}

export interface IASTVisitorResult {
  readonly classDeclarations: readonly ts.ClassDeclaration[];
  readonly defaultExport?: ts.Identifier | ts.Expression;
  readonly classDecorators: ReadonlyMap<
    ts.ClassDeclaration,
    readonly ts.Decorator[]
  >;
  readonly classJSDocTags: ReadonlyMap<
    ts.ClassDeclaration,
    readonly ts.JSDocTag[]
  >;
  readonly dispatchEventCalls: readonly IDispatchEventCall[];
  readonly registerCalls: readonly IRegisterCall[];
}

/**
 * Extracts the event name from a `CustomEvent(...)` constructor call.
 *
 * @param arg - Argument to the dispatchEvent call.
 * @returns Event name when identifiable, otherwise null.
 */
const extractEventName = (arg: Readonly<ts.Expression>): string | null => {
  if (!ts.isNewExpression(arg)) {
    return null;
  }

  const eventType = arg.expression;
  if (!ts.isIdentifier(eventType) || eventType.text !== CUSTOM_EVENT_TYPE) {
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
 * Visits a source file's AST once and collects all relevant information.
 *
 * @param sourceFile - TypeScript source file to visit.
 * @returns Collected AST information.
 */
export function visitSourceFile(
  sourceFile: Readonly<ts.SourceFile>,
): IASTVisitorResult {
  let classDeclarations: ts.ClassDeclaration[] = [];
  const classDecorators = new Map<
    ts.ClassDeclaration,
    readonly ts.Decorator[]
  >();
  const classJSDocTags = new Map<ts.ClassDeclaration, readonly ts.JSDocTag[]>();
  let dispatchEventCalls: IDispatchEventCall[] = [];
  let registerCalls: IRegisterCall[] = [];
  let defaultExport: ts.Identifier | ts.Expression | undefined;
  let classStack: readonly ts.ClassLikeDeclaration[] = [];

  /**
   * Recursively visits nodes in the AST.
   *
   * @param node - Current node being visited.
   * @returns Nothing.
   */
  const visit = (node: Readonly<ts.Node>): void => {
    if (ts.isClassDeclaration(node)) {
      classDeclarations = [...classDeclarations, node];

      const decorators = ts.canHaveDecorators(node)
        ? (ts.getDecorators(node) ?? [])
        : [];
      if (decorators.length > 0) {
        classDecorators.set(node, decorators);
      }

      const jsdocTags = ts.getJSDocTags(node);
      if (jsdocTags.length > 0) {
        classJSDocTags.set(node, jsdocTags);
      }

      classStack = [...classStack, node];
      ts.forEachChild(node, visit);
      classStack = classStack.slice(0, -1);
      return;
    }

    if (ts.isClassExpression(node)) {
      classStack = [...classStack, node];
      ts.forEachChild(node, visit);
      classStack = classStack.slice(0, -1);
      return;
    }

    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      defaultExport = node.expression;
    }

    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propertyAccess = node.expression;

      if (propertyAccess.name.text === DISPATCH_EVENT_METHOD) {
        const [arg] = node.arguments;
        if (arg) {
          const eventName = extractEventName(arg);
          if (eventName) {
            const containingClass = classStack.at(-1);
            if (containingClass) {
              dispatchEventCalls = [
                ...dispatchEventCalls,
                {
                  eventName,
                  containingClass,
                  callNode: node,
                },
              ];
            }
          }
        }
      }

      if (propertyAccess.name.text === REGISTER_METHOD) {
        const receiver = ts.isIdentifier(propertyAccess.expression)
          ? propertyAccess.expression.text
          : undefined;
        registerCalls = [
          ...registerCalls,
          {
            receiver,
            argument: node.arguments[0],
            callNode: node,
          },
        ];
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
