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
} from "@/src/parsers/webcomponent/types";
import ts from "typescript";

interface IResolutionAccumulator {
  readonly chain: readonly ts.ClassLikeDeclaration[];
  readonly warnings: readonly string[];
  readonly unresolved: readonly string[];
}

/**
 * Finds a class declaration or class-expression variable by name within a block.
 *
 * @param body - Block to scan for matching declarations.
 * @param name - Class or variable name to resolve.
 * @returns Matching class-like declaration or `null` when not found.
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
 * Gets the executable block body for a supported function-like declaration.
 *
 * @param declaration - Declaration that may provide a function body.
 * @returns Function body block or `null` when unavailable.
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
 * Gets a function body from a variable declaration initialized with a function.
 *
 * @param declaration - Variable declaration to inspect.
 * @returns Function body block or `null` when not available.
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
 * Gets the return expression produced by a supported function-like declaration.
 *
 * @param declaration - Declaration to inspect.
 * @returns Return expression or `null` when none can be resolved.
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
 * Returns the first explicit return expression found in a block.
 *
 * @param body - Block to inspect.
 * @returns Return expression or `null` when no return statement exists.
 */
function getReturnExpressionFromBlock(
  body: Readonly<ts.Block>,
): ts.Expression | null {
  const returnStatement = body.statements.find(ts.isReturnStatement);
  return returnStatement?.expression ?? null;
}

/**
 * Gets a return expression from a variable declaration initialized with a function.
 *
 * @param declaration - Variable declaration to inspect.
 * @returns Return expression or `null` when none can be resolved.
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
 * Builds a stable key for de-duplicating class declarations during traversal.
 *
 * @param checker - Type checker for contextual consistency.
 * @param classDecl - Class declaration to key.
 * @returns Stable key combining source file path and position.
 */
const getSymbolKey = (
  checker: Readonly<ts.TypeChecker>,
  classDecl: Readonly<ts.ClassLikeDeclaration>,
): string =>
  // Always use file path + position for uniqueness, especially important for
  // mixin patterns where multiple classes may have the same name (e.g., InnerMixinClass)
  `${classDecl.getSourceFile().fileName}:${classDecl.pos}`;

/**
 * Creates an empty inheritance resolution accumulator.
 *
 * @returns Empty chain, warning, and unresolved collections.
 */
const createResolutionAccumulator = (): IResolutionAccumulator => ({
  chain: [],
  warnings: [],
  unresolved: [],
});

/**
 * Returns true when a symbol is declared only in external declaration files.
 *
 * @param symbol - Symbol to inspect.
 * @returns True when the symbol should be treated as external.
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
 * Returns true when a symbol represents a function parameter.
 *
 * @param symbol - Symbol to inspect.
 * @returns True when the symbol is backed by parameter declarations.
 */
const isParameterSymbol = (symbol: Readonly<ts.Symbol>): boolean => {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.some(ts.isParameter);
};

/**
 * Returns true when an extends expression should be ignored rather than reported.
 *
 * This is used for external built-ins and mixin parameters that are not
 * resolvable to local class declarations.
 *
 * @param checker - Type checker used for symbol resolution.
 * @param expression - Extends expression to inspect.
 * @returns True when the expression should be skipped silently.
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
 * Appends unresolved-expression diagnostics to the current accumulator.
 *
 * @param resolution - Current resolution accumulator.
 * @param expression - Expression that could not be resolved.
 * @returns Updated accumulator including unresolved diagnostics.
 */
function addUnresolvedExpression(
  resolution: Readonly<IResolutionAccumulator>,
  expression: Readonly<ts.Expression>,
): IResolutionAccumulator {
  const text = expression.getText(expression.getSourceFile());
  return {
    chain: resolution.chain,
    unresolved: [...resolution.unresolved, text],
    warnings: [
      ...resolution.warnings,
      `Unable to resolve base class for expression: ${text}`,
    ],
  };
}

/**
 * Resolves a symbol at a node, following aliases when necessary.
 *
 * @param checker - Type checker used for symbol lookup.
 * @param node - Node whose symbol should be resolved.
 * @returns Resolved symbol or `undefined` when lookup fails.
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
 * Resolves a class declaration from an identifier or property-access expression.
 *
 * @param checker - Type checker used for symbol resolution.
 * @param expression - Expression referencing a candidate base class.
 * @returns Resolved class declaration or `null` when not available.
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
 * Resolves the first class declaration backing a symbol.
 *
 * @param symbol - Symbol to inspect.
 * @returns Matching class declaration or `null` when none exists.
 */
function resolveClassDeclarationFromSymbol(
  symbol: Readonly<ts.Symbol>,
): ts.ClassDeclaration | null {
  const declarations = symbol.getDeclarations() ?? [];
  return declarations.find(ts.isClassDeclaration) ?? null;
}

/**
 * Resolves a class inheritance chain, including mixin-produced classes.
 *
 * @param classDeclaration - Starting class declaration.
 * @param context - Inheritance resolution context.
 * @returns Ordered inheritance chain plus warnings and unresolved expressions.
 */
export const resolveInheritanceChain = (
  classDeclaration: Readonly<ts.ClassDeclaration>,
  context: Readonly<IInheritanceContext>,
): IInheritanceResolution => {
  const { checker } = context;
  const seen = new Set<string>();
  const resolution = collectInheritanceFromClass(
    classDeclaration,
    checker,
    seen,
    createResolutionAccumulator(),
  );

  return {
    chain: [...resolution.chain],
    warnings: [...resolution.warnings],
    unresolved: [...resolution.unresolved],
  };
};

/**
 * Collects a class declaration and all resolvable bases into the chain.
 *
 * @param classDecl - Class declaration to collect.
 * @param checker - Type checker used for resolution.
 * @param seen - De-duplication set for visited class-like declarations.
 * @param resolution - Current resolution accumulator.
 * @returns Updated accumulator including the collected class chain.
 */
function collectInheritanceFromClass(
  classDecl: Readonly<ts.ClassLikeDeclaration>,
  checker: Readonly<ts.TypeChecker>,
  seen: Readonly<Set<string>>,
  resolution: Readonly<IResolutionAccumulator>,
): IResolutionAccumulator {
  const key = getSymbolKey(checker, classDecl);
  if (seen.has(key)) {
    return resolution;
  }
  seen.add(key);

  let nextResolution = resolution;
  for (const heritageType of getExtendedTypes(classDecl)) {
    nextResolution = collectInheritanceFromExpression(
      heritageType.expression,
      checker,
      seen,
      nextResolution,
    );
  }

  return {
    chain: [...nextResolution.chain, classDecl],
    warnings: nextResolution.warnings,
    unresolved: nextResolution.unresolved,
  };
}

/**
 * Collects inheritance information from a single extends expression.
 *
 * @param expression - Extends expression to inspect.
 * @param checker - Type checker used for resolution.
 * @param seen - De-duplication set for visited class-like declarations.
 * @param resolution - Current resolution accumulator.
 * @returns Updated accumulator including any resolved or unresolved bases.
 */
function collectInheritanceFromExpression(
  expression: Readonly<ts.Expression>,
  checker: Readonly<ts.TypeChecker>,
  seen: Readonly<Set<string>>,
  resolution: Readonly<IResolutionAccumulator>,
): IResolutionAccumulator {
  if (ts.isCallExpression(expression)) {
    return collectInheritanceFromCallExpression(
      expression,
      checker,
      seen,
      resolution,
    );
  }

  const resolved = resolveClassDeclarationFromExpression(checker, expression);
  if (resolved) {
    return collectInheritanceFromClass(resolved, checker, seen, resolution);
  }

  if (isSkippableExpression(checker, expression)) {
    return resolution;
  }

  return addUnresolvedExpression(resolution, expression);
}

/**
 * Collects inheritance information from a mixin-style call expression.
 *
 * @param expression - Call expression to inspect.
 * @param checker - Type checker used for resolution.
 * @param seen - De-duplication set for visited class-like declarations.
 * @param resolution - Current resolution accumulator.
 * @returns Updated accumulator including resolved call arguments and mixin output.
 */
function collectInheritanceFromCallExpression(
  expression: Readonly<ts.CallExpression>,
  checker: Readonly<ts.TypeChecker>,
  seen: Readonly<Set<string>>,
  resolution: Readonly<IResolutionAccumulator>,
): IResolutionAccumulator {
  let nextResolution = resolution;

  for (const argument of expression.arguments) {
    nextResolution = collectInheritanceFromExpression(
      argument,
      checker,
      seen,
      nextResolution,
    );
  }

  const mixinClass = resolveMixinClassFromCall(checker, expression);
  if (!mixinClass) {
    return addUnresolvedExpression(nextResolution, expression);
  }

  return collectInheritanceFromClass(mixinClass, checker, seen, nextResolution);
}

/**
 * Returns all `extends` heritage types declared on a class-like declaration.
 *
 * @param classDecl - Class declaration to inspect.
 * @returns Heritage types from `extends` clauses only.
 */
function getExtendedTypes(
  classDecl: Readonly<ts.ClassLikeDeclaration>,
): readonly ts.ExpressionWithTypeArguments[] {
  return (classDecl.heritageClauses ?? []).flatMap((clause) =>
    clause.token === ts.SyntaxKind.ExtendsKeyword ? clause.types : [],
  );
}

/**
 * Resolves a class produced by a mixin call expression.
 *
 * @param checker - Type checker used for symbol resolution.
 * @param callExpression - Mixin call expression to inspect.
 * @returns Resolved class-like declaration or `null` when not found.
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
    const resolved = resolveMixinClassFromDeclaration(declaration);
    if (resolved) {
      return resolved;
    }
  }
  return null;
}

/**
 * Resolves a mixin-produced class from a declaration body or return value.
 *
 * @param declaration - Candidate mixin declaration.
 * @returns Resolved class-like declaration or `null` when none is found.
 */
function resolveMixinClassFromDeclaration(
  declaration: Readonly<ts.Declaration>,
): ts.ClassLikeDeclaration | null {
  const body = getFunctionBody(declaration);
  const returnedClass = resolveReturnedMixinClass(declaration, body);
  if (returnedClass) {
    return returnedClass;
  }

  return body ? getFirstClassDeclaration(body) : null;
}

/**
 * Resolves a returned mixin class from a declaration's return expression.
 *
 * @param declaration - Candidate mixin declaration.
 * @param body - Executable function body, when available.
 * @returns Resolved returned class-like declaration or `null`.
 */
function resolveReturnedMixinClass(
  declaration: Readonly<ts.Declaration>,
  body: Readonly<ts.Block> | null,
): ts.ClassLikeDeclaration | null {
  const returnExpression = getReturnExpression(declaration);
  if (!returnExpression) {
    return null;
  }

  const unwrapped = unwrapExpression(returnExpression);
  if (ts.isClassExpression(unwrapped)) {
    return unwrapped;
  }

  if (ts.isIdentifier(unwrapped) && body) {
    return findClassByNameInBlock(body, unwrapped.text);
  }

  return null;
}

/**
 * Returns the first class declaration declared in a function body.
 *
 * @param body - Function body to inspect.
 * @returns First class declaration or `null` when none are present.
 */
function getFirstClassDeclaration(
  body: Readonly<ts.Block>,
): ts.ClassDeclaration | null {
  return body.statements.find(ts.isClassDeclaration) ?? null;
}

/**
 * Removes parenthesized wrappers from an expression.
 *
 * @param expression - Expression to unwrap.
 * @returns Innermost non-parenthesized expression.
 */
function unwrapExpression(expression: Readonly<ts.Expression>): ts.Expression {
  let current = expression;
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}
