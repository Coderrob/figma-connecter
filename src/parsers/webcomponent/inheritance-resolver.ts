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

import ts from "typescript";
import type {
  InheritanceResolution,
  InheritanceContext,
} from "../../types/parsers-webcomponent";

/**
 * Resolves an aliased symbol for a node if present.
 *
 * @param checker - Type checker for symbol resolution.
 * @param node - Node to resolve.
 * @returns Resolved symbol or undefined.
 */
const resolveAliasedSymbol = (
  checker: ts.TypeChecker,
  node: ts.Node,
): ts.Symbol | undefined => {
  const symbol = checker.getSymbolAtLocation(node);
  if (!symbol) {
    return undefined;
  }
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
};

/**
 * Finds the first class declaration associated with a symbol.
 *
 * @param symbol - Symbol to inspect.
 * @returns Class declaration or null when missing.
 */
const resolveClassDeclarationFromSymbol = (
  symbol: ts.Symbol,
): ts.ClassDeclaration | null => {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.find(ts.isClassDeclaration) ?? null;
};

/**
 * Checks if a symbol is from an external library or built-in type.
 *
 * @param symbol - Symbol to inspect.
 * @returns True if the symbol is external.
 */
const isExternalSymbol = (symbol: ts.Symbol): boolean => {
  const declarations = symbol.getDeclarations() ?? [];
  if (declarations.length === 0) {
    return true;
  }
  // Check if any declaration is from a .d.ts file (library definition)
  return declarations.some((decl) => {
    const sourceFile = decl.getSourceFile();
    return sourceFile.isDeclarationFile;
  });
};

/**
 * Checks if a symbol represents a function or method parameter.
 *
 * @param symbol - Symbol to inspect.
 * @returns True if the symbol is a parameter.
 */
const isParameterSymbol = (symbol: ts.Symbol): boolean => {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.some((decl) => ts.isParameter(decl));
};

/**
 * Resolves a class declaration from an expression.
 *
 * @param checker - Type checker for symbol resolution.
 * @param expression - Expression to resolve.
 * @returns Class declaration or null when unresolved.
 */
const resolveClassDeclarationFromExpression = (
  checker: ts.TypeChecker,
  expression: ts.Expression,
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
 * Retrieves the function body for a declaration if available.
 *
 * @param declaration - Declaration to inspect.
 * @returns Function body block or null.
 */
const getFunctionBody = (declaration: ts.Declaration): ts.Block | null => {
  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration)
  ) {
    return declaration.body ?? null;
  }
  if (ts.isArrowFunction(declaration)) {
    return ts.isBlock(declaration.body) ? declaration.body : null;
  }
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    const { initializer } = declaration;
    if (ts.isArrowFunction(initializer)) {
      return ts.isBlock(initializer.body) ? initializer.body : null;
    }
    if (ts.isFunctionExpression(initializer)) {
      return initializer.body ?? null;
    }
  }
  return null;
};

/**
 * Unwraps parenthesized expressions to the inner expression.
 *
 * @param expression - Expression to unwrap.
 * @returns Unwrapped expression.
 */
const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
};

/**
 * Resolves a returned expression from a function or variable declaration.
 *
 * @param declaration - Declaration to inspect.
 * @returns Returned expression or null.
 */
const getReturnExpression = (
  declaration: ts.Declaration,
): ts.Expression | null => {
  if (ts.isArrowFunction(declaration)) {
    if (!ts.isBlock(declaration.body)) {
      return declaration.body;
    }
  }

  if (
    ts.isFunctionDeclaration(declaration) ||
    ts.isFunctionExpression(declaration)
  ) {
    const { body } = declaration;
    if (!body) {
      return null;
    }
    const returnStatement = body.statements.find(ts.isReturnStatement);
    return returnStatement?.expression ?? null;
  }

  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    const { initializer } = declaration;
    if (ts.isArrowFunction(initializer)) {
      if (!ts.isBlock(initializer.body)) {
        return initializer.body;
      }
      const returnStatement = initializer.body.statements.find(
        ts.isReturnStatement,
      );
      return returnStatement?.expression ?? null;
    }
    if (ts.isFunctionExpression(initializer)) {
      const returnStatement = initializer.body?.statements.find(
        ts.isReturnStatement,
      );
      return returnStatement?.expression ?? null;
    }
  }

  return null;
};

/**
 * Resolves a mixin call expression to its returned class declaration.
 *
 * @param checker - Type checker for symbol resolution.
 * @param callExpression - Call expression for a mixin.
 * @returns Class-like declaration or null when unresolved.
 */
const resolveMixinClassFromCall = (
  checker: ts.TypeChecker,
  callExpression: ts.CallExpression,
): ts.ClassLikeDeclaration | null => {
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
        const returnName = unwrapped.text;
        const classDeclarations = body.statements.filter(ts.isClassDeclaration);
        const match = classDeclarations.find(
          (classDecl) => classDecl.name?.text === returnName,
        );
        if (match) {
          return match;
        }

        const classExpressionDeclaration = body.statements
          .filter(ts.isVariableStatement)
          .flatMap((statement) => statement.declarationList.declarations)
          .find(
            (decl) =>
              ts.isIdentifier(decl.name) && decl.name.text === returnName,
          );
        if (
          classExpressionDeclaration?.initializer &&
          ts.isClassExpression(classExpressionDeclaration.initializer)
        ) {
          return classExpressionDeclaration.initializer;
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
};

/**
 * Builds a stable symbol key for class de-duplication.
 *
 * @param checker - Type checker for symbol lookup.
 * @param classDecl - Class declaration to key.
 * @returns Unique key for the class declaration.
 */
const getSymbolKey = (
  checker: ts.TypeChecker,
  classDecl: ts.ClassLikeDeclaration,
): string =>
  // Always use file path + position for uniqueness, especially important for
  // mixin patterns where multiple classes may have the same name (e.g., InnerMixinClass)
  `${classDecl.getSourceFile().fileName}:${classDecl.pos}`;

/**
 * Resolves the inheritance chain for a class declaration.
 *
 * @param classDeclaration - Class declaration to resolve.
 * @param context - Inheritance resolution context.
 * @returns Resolved inheritance chain with warnings.
 */
export const resolveInheritanceChain = (
  classDeclaration: ts.ClassDeclaration,
  context: InheritanceContext,
): InheritanceResolution => {
  const { checker } = context;
  const chain: ts.ClassLikeDeclaration[] = [];
  const warnings: string[] = [];
  const unresolved: string[] = [];
  const seen = new Set<string>();

  /**
   * Tracks unresolved base classes for diagnostics.
   *
   * @param expression - Expression that could not be resolved.
   * @returns Nothing.
   */
  const handleUnresolved = (expression: ts.Expression): void => {
    const text = expression.getText(expression.getSourceFile());
    unresolved.push(text);
    warnings.push(`Unable to resolve base class for expression: ${text}`);
  };

  /**
   * Collects a class declaration and its base classes into the chain.
   *
   * @param classDecl - Class-like declaration to collect.
   * @returns Nothing.
   */
  function collectFromClass(classDecl: ts.ClassLikeDeclaration): void {
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

    chain.push(classDecl);
  }

  /**
   * Collects class declarations from a heritage expression.
   *
   * @param expression - Heritage expression to resolve.
   * @returns Nothing.
   */
  function collectFromExpression(expression: ts.Expression): void {
    if (ts.isCallExpression(expression)) {
      expression.arguments.forEach((arg) => collectFromExpression(arg));
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

    // Check if this identifier/property access couldn't be resolved
    // but is an acceptable case (external or parameter)
    if (
      ts.isIdentifier(expression) ||
      ts.isPropertyAccessExpression(expression)
    ) {
      const symbol = resolveAliasedSymbol(checker, expression);
      if (symbol) {
        // If there's a symbol and it's external (like HTMLElement), skip silently
        if (isExternalSymbol(symbol)) {
          return;
        }
        // If there's a symbol and it's a parameter (like superClass), skip silently
        if (isParameterSymbol(symbol)) {
          return;
        }
      }
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
