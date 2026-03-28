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

import type {
  IInheritanceResolution,
  IInheritanceContext,
} from "@/src/types/parsers-webcomponent";
import ts from "typescript";

/**
 * findClassByNameInBlock TODO: describe.
 * @param body TODO: describe parameter
 * @param name TODO: describe parameter
 * @returns TODO: describe return value
 */
const findClassByNameInBlock = (
  body: Readonly<ts.Block>,
  name: string,
): ts.ClassLikeDeclaration | null => {
  for (const statement of body.statements) {
    if (ts.isClassDeclaration(statement) && statement.name?.text === name) {
      return statement;
    }
  }

  for (const statement of body.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.name.text === name) {
        if (decl.initializer && ts.isClassExpression(decl.initializer)) {
          return decl.initializer;
        }
      }
    }
  }

  return null;
};

/**
 * getFunctionBody TODO: describe.
 * @param declaration TODO: describe parameter
 * @returns TODO: describe return value
 */
const getFunctionBody = (
  declaration: Readonly<ts.Declaration>,
): ts.Block | null => {
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration)
  ) {
    return declaration.body ?? null;
  }
  if (ts.isArrowFunction(declaration)) {
    return ts.isBlock(declaration.body) ? declaration.body : null;
  }
  if (ts.isVariableDeclaration(declaration)) {
    return getFunctionBodyFromVariableDeclaration(declaration);
  }
  return null;
};

/**
 * getFunctionBodyFromVariableDeclaration TODO: describe.
 * @param declaration TODO: describe parameter
 * @returns TODO: describe return value
 */
function getFunctionBodyFromVariableDeclaration(
  declaration: Readonly<ts.VariableDeclaration>,
): ts.Block | null {
  const { initializer } = declaration;
  if (!initializer) {
    return null;
  }
  if (ts.isArrowFunction(initializer)) {
    return ts.isBlock(initializer.body) ? initializer.body : null;
  }
  if (ts.isFunctionExpression(initializer)) {
    return initializer.body ?? null;
  }
  return null;
}

/**
 * getReturnExpression TODO: describe.
 * @param declaration TODO: describe parameter
 * @returns TODO: describe return value
 */
const getReturnExpression = (
  declaration: Readonly<ts.Declaration>,
): ts.Expression | null => {
  if (ts.isArrowFunction(declaration)) {
    if (!ts.isBlock(declaration.body)) {
      return declaration.body;
    }
    return getReturnExpressionFromBlock(declaration.body);
  }

  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration)
  ) {
    return declaration.body
      ? getReturnExpressionFromBlock(declaration.body)
      : null;
  }

  if (ts.isVariableDeclaration(declaration)) {
    return getReturnExpressionFromVariableDeclaration(declaration);
  }

  return null;
};

/**
 * getReturnExpressionFromBlock TODO: describe.
 * @param body TODO: describe parameter
 * @returns TODO: describe return value
 */
function getReturnExpressionFromBlock(
  body: Readonly<ts.Block>,
): ts.Expression | null {
  const returnStatement = body.statements.find(ts.isReturnStatement);
  return returnStatement?.expression ?? null;
}

/**
 * getReturnExpressionFromVariableDeclaration TODO: describe.
 * @param declaration TODO: describe parameter
 * @returns TODO: describe return value
 */
function getReturnExpressionFromVariableDeclaration(
  declaration: Readonly<ts.VariableDeclaration>,
): ts.Expression | null {
  const { initializer } = declaration;
  if (!initializer) {
    return null;
  }
  if (ts.isArrowFunction(initializer)) {
    if (!ts.isBlock(initializer.body)) {
      return initializer.body;
    }
    return getReturnExpressionFromBlock(initializer.body);
  }
  if (ts.isFunctionExpression(initializer)) {
    return initializer.body
      ? getReturnExpressionFromBlock(initializer.body)
      : null;
  }
  return null;
}

/**
 * getSymbolKey TODO: describe.
 * @param checker TODO: describe parameter
 * @param classDecl TODO: describe parameter
 * @returns TODO: describe return value
 */
const getSymbolKey = (
  checker: Readonly<ts.TypeChecker>,
  classDecl: Readonly<ts.ClassLikeDeclaration>,
): string =>
  // Always use file path + position for uniqueness, especially important for
  // mixin patterns where multiple classes may have the same name (e.g., InnerMixinClass)
  `${classDecl.getSourceFile().fileName}:${classDecl.pos}`;

/**
 * isExternalSymbol TODO: describe.
 * @param symbol TODO: describe parameter
 * @returns TODO: describe return value
 */
const isExternalSymbol = (symbol: Readonly<ts.Symbol>): boolean => {
  const declarations = symbol.getDeclarations() ?? [];
  if (declarations.length === 0) {
    return true;
  }
  // Check if any declaration is from a .d.ts file (library definition)
  return declarations.some(
    /**
     * Checks whether a declaration is from a .d.ts file.
     *
     * @param decl - Declaration to inspect.
     * @returns True when the declaration is in a declaration file.
     */
    (decl) => {
      const sourceFile = decl.getSourceFile();
      return sourceFile.isDeclarationFile;
    },
  );
};

/**
 * isParameterSymbol TODO: describe.
 * @param symbol TODO: describe parameter
 * @returns TODO: describe return value
 */
const isParameterSymbol = (symbol: Readonly<ts.Symbol>): boolean => {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.some(ts.isParameter);
};

/**
 * isSkippableExpression TODO: describe.
 * @param checker TODO: describe parameter
 * @param expression TODO: describe parameter
 * @returns TODO: describe return value
 */
const isSkippableExpression = (
  checker: Readonly<ts.TypeChecker>,
  expression: Readonly<ts.Expression>,
): boolean => {
  if (
    !ts.isIdentifier(expression) &&
    !ts.isPropertyAccessExpression(expression)
  ) {
    return false;
  }
  const symbol = resolveAliasedSymbol(checker, expression);
  return !!symbol && (isExternalSymbol(symbol) || isParameterSymbol(symbol));
};

/**
 * resolveAliasedSymbol TODO: describe.
 * @param checker TODO: describe parameter
 * @param node TODO: describe parameter
 * @returns TODO: describe return value
 */
function resolveAliasedSymbol(
  checker: Readonly<ts.TypeChecker>,
  node: Readonly<ts.Node>,
): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) {
    return undefined;
  }
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

/**
 * resolveClassDeclarationFromExpression TODO: describe.
 * @param checker TODO: describe parameter
 * @param expression TODO: describe parameter
 * @returns TODO: describe return value
 */
const resolveClassDeclarationFromExpression = (
  checker: Readonly<ts.TypeChecker>,
  expression: Readonly<ts.Expression>,
): ts.ClassDeclaration | null => {
  if (
    !ts.isIdentifier(expression) &&
    !ts.isPropertyAccessExpression(expression)
  ) {
    return null;
  }

  const symbol = resolveAliasedSymbol(checker, expression);
  if (!symbol) {
    return null;
  }

  // Skip external/built-in symbols (e.g., HTMLElement) and parameters  (e.g., superClass)
  if (isExternalSymbol(symbol) || isParameterSymbol(symbol)) {
    return null;
  }

  return resolveClassDeclarationFromSymbol(symbol);
};

/**
 * resolveClassDeclarationFromSymbol TODO: describe.
 * @param symbol TODO: describe parameter
 * @returns TODO: describe return value
 */
function resolveClassDeclarationFromSymbol(
  symbol: Readonly<ts.Symbol>,
): ts.ClassDeclaration | null {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.find(ts.isClassDeclaration) ?? null;
}

/**
 * resolveInheritanceChain TODO: describe.
 * @param classDeclaration TODO: describe parameter
 * @param context TODO: describe parameter
 * @returns TODO: describe return value
 */
export const resolveInheritanceChain = (
  classDeclaration: Readonly<ts.ClassDeclaration>,
  context: Readonly<IInheritanceContext>,
): IInheritanceResolution => {
  const { checker } = context;
  let chain: ts.ClassLikeDeclaration[] = [];
  let warnings: string[] = [];
  let unresolved: string[] = [];
  const seen = new Set<string>();

  /**
   * Tracks unresolved base classes for diagnostics.
   *
   * @param expression - Expression that could not be resolved.
   * @returns Nothing.
   */
  const handleUnresolved = (expression: Readonly<ts.Expression>): void => {
    const text = expression.getText(expression.getSourceFile());
    unresolved = [...unresolved, text];
    warnings = [
      ...warnings,
      `Unable to resolve base class for expression: ${text}`,
    ];
  };

  /**
   * collectFromClass TODO: describe.
   * @param classDecl TODO: describe parameter
   * @returns TODO: describe return value
   */
  function collectFromClass(
    classDecl: Readonly<ts.ClassLikeDeclaration>,
  ): void {
    const key = getSymbolKey(checker, classDecl);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const heritageClauses = classDecl.heritageClauses ?? [];
    for (const clause of heritageClauses) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
        continue;
      }
      for (const heritageType of clause.types) {
        collectFromExpression(heritageType.expression);
      }
    }

    chain = [...chain, classDecl];
  }

  /**
   * collectFromExpression TODO: describe.
   * @param expression TODO: describe parameter
   * @returns TODO: describe return value
   */
  function collectFromExpression(expression: Readonly<ts.Expression>): void {
    if (ts.isCallExpression(expression)) {
      expression.arguments.forEach(collectFromExpression);
      const mixinClass = resolveMixinClassFromCall(checker, expression);
      if (mixinClass) {
        collectFromClass(mixinClass);
      } else {
        handleUnresolved(expression);
      }
      return;
    }

    // Try to resolve as a class declaration
    const resolved = resolveClassDeclarationFromExpression(checker, expression);
    if (resolved) {
      collectFromClass(resolved);
      return;
    }

    // Skip silently for external (e.g., HTMLElement) or parameter (e.g., superClass) symbols
    if (isSkippableExpression(checker, expression)) {
      return;
    }

    // For all other unresolvable cases (including no symbol), report as unresolved
    handleUnresolved(expression);
  }

  collectFromClass(classDeclaration);

  return {
    chain,
    warnings,
    unresolved,
  };
};

/**
 * resolveMixinClassFromCall TODO: describe.
 * @param checker TODO: describe parameter
 * @param callExpression TODO: describe parameter
 * @returns TODO: describe return value
 */
function resolveMixinClassFromCall(
  checker: Readonly<ts.TypeChecker>,
  callExpression: Readonly<ts.CallExpression>,
): ts.ClassLikeDeclaration | null {
  const symbol = resolveAliasedSymbol(checker, callExpression.expression);
  if (!symbol) {
    return null;
  }
  const declarations = symbol.getDeclarations() ?? [];
  for (const declaration of declarations) {
    const body = getFunctionBody(declaration);
    const returnExpression = getReturnExpression(declaration);
    if (returnExpression) {
      const unwrapped = unwrapExpression(returnExpression);
      if (ts.isClassExpression(unwrapped)) {
        return unwrapped;
      }
      if (ts.isIdentifier(unwrapped) && body) {
        const match = findClassByNameInBlock(body, unwrapped.text);
        if (match) {
          return match;
        }
      }
    }
    if (body) {
      const classDeclarations = body.statements.filter(ts.isClassDeclaration);
      if (classDeclarations.length > 0) {
        return classDeclarations[0];
      }
    }
  }
  return null;
}

/**
 * unwrapExpression TODO: describe.
 * @param expression TODO: describe parameter
 * @returns TODO: describe return value
 */
function unwrapExpression(expression: Readonly<ts.Expression>): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}
