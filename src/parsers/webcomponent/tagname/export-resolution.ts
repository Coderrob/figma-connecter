/**
 * Tag-name import/export resolution helpers.
 */

import path from "node:path";
import { nodeIoAdapter } from "@/src/io/adapter";

import { getLiteralValue } from "@/src/utils/ts";
import ts from "typescript";
import { applyNamespace } from "./namespace";

const CONSTANTS_MODULE_BASENAME = "constants";
const CONSTANTS_SUFFIX = ".constants.ts";
const CONSTRUCT_TAG_NAME_FUNCTION = "constructTagName";

interface IExportResolutionContext {
  readonly componentDir: string;
  readonly exportName: string;
  readonly resolvedPath: string;
  readonly sourceFile: Readonly<ts.SourceFile>;
  readonly visited: Readonly<Set<string>>;
}

/**
 * Creates a TypeScript source file from raw text.
 *
 * @param filePath - Source file path.
 * @param contents - File contents.
 * @returns Parsed TypeScript source file.
 */
const createSourceFile = (filePath: string, contents: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

/**
 * Reads a file when it exists.
 *
 * @param filePath - Absolute file path.
 * @returns File contents or null when unreadable.
 */
const readFileIfExists = (filePath: string): string | null => {
  try {
    if (!nodeIoAdapter.exists(filePath)) {
      return null;
    }
    return nodeIoAdapter.readFile(filePath);
  } catch {
    return null;
  }
};

/**
 * Resolves an exported identifier value by walking export chains.
 *
 * @param filePath - File path to inspect.
 * @param exportName - Exported symbol name to resolve.
 * @param componentDir - Component directory used for namespace resolution.
 * @param visited - Visited file set used to avoid cycles.
 * @returns Resolved tag-name string or null when unresolved.
 */
function resolveExportedValue(
  filePath: string,
  exportName: string,
  componentDir: string,
  visited: Readonly<Set<string>>,
): string | null {
  const resolvedPath = path.resolve(filePath);
  if (visited.has(resolvedPath)) {
    return null;
  }
  visited.add(resolvedPath);

  const contents = readFileIfExists(resolvedPath);
  if (!contents) {
    return null;
  }

  const sourceFile = createSourceFile(resolvedPath, contents);
  const context: IExportResolutionContext = {
    componentDir,
    exportName,
    resolvedPath,
    sourceFile,
    visited,
  };
  const localMatch = findLocalVariableDeclaration(sourceFile, exportName);

  if (localMatch?.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  for (const exportDecl of getExportDeclarations(sourceFile)) {
    const resolved = resolveFromExportDeclaration(exportDecl, context);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/**
 * Returns export declarations from a source file.
 *
 * @param sourceFile - Source file to inspect.
 * @returns Export declarations from the source file.
 */
function getExportDeclarations(
  sourceFile: Readonly<ts.SourceFile>,
): readonly ts.ExportDeclaration[] {
  return sourceFile.statements.filter(ts.isExportDeclaration);
}

/**
 * Finds a local variable declaration by name.
 *
 * @param sourceFile - Source file to inspect.
 * @param identifierName - Variable name to find.
 * @returns Matching variable declaration, if present.
 */
function findLocalVariableDeclaration(
  sourceFile: Readonly<ts.SourceFile>,
  identifierName: string,
): ts.VariableDeclaration | undefined {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === identifierName
      ) {
        return declaration;
      }
    }
  }
  return undefined;
}

/**
 * Finds an export specifier by exported name.
 *
 * @param exportClause - Named export clause to inspect.
 * @param exportName - Exported symbol name to match.
 * @returns Matching export specifier, if present.
 */
function findExportSpecifier(
  exportClause: Readonly<ts.NamedExports>,
  exportName: string,
): ts.ExportSpecifier | undefined {
  return exportClause.elements.find((element) => element.name.text === exportName);
}

/**
 * Resolves an export declaration to a tag-name value.
 *
 * @param exportDecl - Export declaration to inspect.
 * @param context - Shared export resolution context.
 * @returns Resolved tag-name string or null when unresolved.
 */
function resolveFromExportDeclaration(
  exportDecl: Readonly<ts.ExportDeclaration>,
  context: Readonly<IExportResolutionContext>,
): string | null {
  const localResolution = resolveFromLocalExportDeclaration(
    exportDecl,
    context,
  );
  if (localResolution !== undefined) {
    return localResolution;
  }

  const targetPath = resolveExportTargetPath(
    exportDecl,
    context.resolvedPath,
    context.componentDir,
  );
  if (!targetPath) {
    return null;
  }

  return resolveFromForwardedExport(
    exportDecl,
    targetPath,
    context,
  );
}

/**
 * Resolves a local `export { ... }` declaration.
 *
 * @param exportDecl - Export declaration to inspect.
 * @param context - Shared export resolution context.
 * @returns Resolved tag-name string, null when unresolved, or undefined when not applicable.
 */
function resolveFromLocalExportDeclaration(
  exportDecl: Readonly<ts.ExportDeclaration>,
  context: Readonly<IExportResolutionContext>,
): string | null | undefined {
  const { exportClause, moduleSpecifier } = exportDecl;
  if (moduleSpecifier || !exportClause || !ts.isNamedExports(exportClause)) {
    return undefined;
  }

  const match = findExportSpecifier(exportClause, context.exportName);
  if (!match) {
    return null;
  }

  const localName = match.propertyName?.text ?? match.name.text;
  return resolveIdentifierNameValue(
    context.sourceFile,
    localName,
    context.componentDir,
    context.visited,
  );
}

/**
 * Resolves the target file for a forwarded export declaration.
 *
 * @param exportDecl - Export declaration to inspect.
 * @param resolvedPath - Absolute file path for the source file.
 * @param componentDir - Component directory used for namespace resolution.
 * @returns Resolved forwarded target path or null.
 */
function resolveExportTargetPath(
  exportDecl: Readonly<ts.ExportDeclaration>,
  resolvedPath: string,
  componentDir: string,
): string | null {
  const { moduleSpecifier } = exportDecl;
  if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
    return null;
  }

  return resolveModulePath(
    path.dirname(resolvedPath),
    moduleSpecifier.text,
    componentDir,
  );
}

/**
 * Resolves a forwarded export declaration.
 *
 * @param exportDecl - Export declaration to inspect.
 * @param targetPath - Resolved target file path.
 * @param context - Shared export resolution context.
 * @returns Resolved tag-name string or null when unresolved.
 */
function resolveFromForwardedExport(
  exportDecl: Readonly<ts.ExportDeclaration>,
  targetPath: string,
  context: Readonly<IExportResolutionContext>,
): string | null {
  const { exportClause } = exportDecl;
  if (!exportClause) {
    return resolveExportedValue(
      targetPath,
      context.exportName,
      context.componentDir,
      context.visited,
    );
  }
  if (!ts.isNamedExports(exportClause)) {
    return null;
  }

  const match = findExportSpecifier(exportClause, context.exportName);
  if (!match) {
    return null;
  }

  const forwardedName = match.propertyName?.text ?? match.name.text;
  return resolveExportedValue(
    targetPath,
    forwardedName,
    context.componentDir,
    context.visited,
  );
}

/**
 * Resolves a local/imported identifier name within a source file.
 *
 * @param sourceFile - Source file containing the identifier usage.
 * @param identifierName - Identifier name to resolve.
 * @param componentDir - Component directory used for namespace resolution.
 * @param visited - Visited file set used to avoid cycles.
 * @returns Resolved tag-name string or null when unresolved.
 */
function resolveIdentifierNameValue(
  sourceFile: Readonly<ts.SourceFile>,
  identifierName: string,
  componentDir: string,
  visited: Readonly<Set<string>>,
): string | null {
  const localMatch = findLocalVariableDeclaration(sourceFile, identifierName);

  if (localMatch?.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  let importedName = identifierName;
  let importDeclaration: ts.ImportDeclaration | undefined;
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const clause = statement.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
      continue;
    }

    for (const element of clause.namedBindings.elements) {
      if (element.name.text === identifierName) {
        importedName = element.propertyName?.text ?? element.name.text;
        importDeclaration = statement;
        break;
      }
    }

    if (importDeclaration) {
      break;
    }
  }

  if (!importDeclaration) {
    return null;
  }

  const { moduleSpecifier } = importDeclaration;
  if (!ts.isStringLiteral(moduleSpecifier)) {
    return null;
  }

  const importPath = moduleSpecifier.text;
  if (!importPath.startsWith(".")) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile.fileName);
  const targetPath = resolveModulePath(sourceDir, importPath, componentDir);
  if (!targetPath) {
    return null;
  }

  return resolveExportedValue(targetPath, importedName, componentDir, visited);
}

/**
 * Resolves a tag-name value from an identifier expression.
 *
 * @param sourceFile - Source file containing the identifier.
 * @param identifier - Identifier node to resolve.
 * @param componentDir - Component directory used for namespace resolution.
 * @returns Resolved tag-name string or null when unresolved.
 */
export const resolveIdentifierValue = (
  sourceFile: Readonly<ts.SourceFile>,
  identifier: Readonly<ts.Identifier>,
  componentDir: string,
): string | null =>
  resolveIdentifierNameValue(
    sourceFile,
    identifier.text,
    componentDir,
    new Set<string>(),
  );

/**
 * Resolves a relative module specifier to an existing file path.
 *
 * @param baseDir - Base directory for resolution.
 * @param modulePath - Relative module specifier.
 * @param componentDir - Component directory used for constants fallback.
 * @returns Resolved file path or null when not found.
 */
function resolveModulePath(
  baseDir: string,
  modulePath: string,
  componentDir: string,
): string | null {
  if (!modulePath.startsWith(".")) {
    return null;
  }

  const resolved = path.resolve(baseDir, modulePath);
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}.js`,
    `${resolved}.jsx`,
    path.join(resolved, "index.ts"),
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.js"),
    path.join(resolved, "index.jsx"),
  ];

  let existing: string | undefined;
  for (const candidate of candidates) {
    if (nodeIoAdapter.exists(candidate)) {
      existing = candidate;
      break;
    }
  }
  if (existing) {
    return existing;
  }

  const basename = path.basename(resolved);
  if (basename === CONSTANTS_MODULE_BASENAME) {
    const dir = path.dirname(resolved);
    const componentName = path.basename(componentDir);
    const componentConstants = path.join(dir, `${componentName}.constants.ts`);
    if (nodeIoAdapter.exists(componentConstants)) {
      return componentConstants;
    }

    try {
      const entries = nodeIoAdapter.listFiles
        ? nodeIoAdapter.listFiles(dir)
        : [];
      let matches: string[] = [];
      for (const entry of entries) {
        if (entry.endsWith(CONSTANTS_SUFFIX)) {
          matches = [...matches, entry];
        }
      }
      if (matches.length === 1) {
        return path.join(dir, matches[0]);
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves a tag-name value from an initializer expression.
 *
 * @param initializer - Initializer expression to resolve.
 * @param componentDir - Component directory path.
 * @returns Resolved tag name or null when unresolved.
 */
function resolveTagNameInitializer(
  initializer: Readonly<ts.Expression>,
  componentDir: string,
): string | null {
  const literal = getLiteralValue(initializer);
  if (typeof literal === "string") {
    return literal;
  }

  if (ts.isCallExpression(initializer)) {
    const callee = initializer.expression;
    let calleeName = "";
    if (ts.isIdentifier(callee)) {
      calleeName = callee.text;
    } else if (ts.isPropertyAccessExpression(callee)) {
      calleeName = callee.name.text;
    }

    if (calleeName === CONSTRUCT_TAG_NAME_FUNCTION) {
      const [arg] = initializer.arguments;
      const argLiteral = getLiteralValue(arg);
      if (typeof argLiteral === "string") {
        return applyNamespace(componentDir, argLiteral);
      }
    }
  }

  return null;
}
