/**
 * Tag-name import/export resolution helpers.
 */

import path from "node:path";
import ts from "typescript";

import { nodeIoAdapter } from "../../../io/adapter";
import { getLiteralValue } from "../../../utils/ts";
import { applyNamespace } from "./namespace";

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

const createSourceFile = (filePath: string, contents: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

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

  const existing = candidates.find((candidate) =>
    nodeIoAdapter.exists(candidate),
  );
  if (existing) {
    return existing;
  }

  const basename = path.basename(resolved);
  if (basename === "constants") {
    const dir = path.dirname(resolved);
    const componentName = path.basename(componentDir);
    const componentConstants = path.join(dir, `${componentName}.constants.ts`);
    if (nodeIoAdapter.exists(componentConstants)) {
      return componentConstants;
    }

    try {
      const entries = nodeIoAdapter.listFiles ? nodeIoAdapter.listFiles(dir) : [];
      const matches = entries.filter((entry) => entry.endsWith(".constants.ts"));
      if (matches.length === 1) {
        return path.join(dir, matches[0]);
      }
    } catch {
      return null;
    }
  }

  return null;
}

const resolveTagNameInitializer = (
  initializer: ts.Expression,
  componentDir: string,
): string | null => {
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

    if (calleeName === "constructTagName") {
      const [arg] = initializer.arguments;
      const argLiteral = getLiteralValue(arg);
      if (typeof argLiteral === "string") {
        return applyNamespace(componentDir, argLiteral);
      }
    }
  }

  return null;
};

function resolveIdentifierNameValue(
  sourceFile: ts.SourceFile,
  identifierName: string,
  componentDir: string,
  visited: Set<string>,
): string | null {
  const localMatch = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (declaration) =>
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === identifierName,
    );

  if (localMatch?.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  let importedName = identifierName;
  const importDeclaration = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .find((statement) => {
      const clause = statement.importClause;
      if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
        return false;
      }

      const matched = clause.namedBindings.elements.find(
        (element) => element.name.text === identifierName,
      );
      if (matched) {
        importedName = matched.propertyName?.text ?? matched.name.text;
        return true;
      }

      return false;
    });

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

function resolveExportedValue(
  filePath: string,
  exportName: string,
  componentDir: string,
  visited: Set<string>,
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

  const localMatch = sourceFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === exportName,
    );

  if (localMatch?.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  const exportDeclarations = sourceFile.statements.filter(ts.isExportDeclaration);
  for (const exportDecl of exportDeclarations) {
    const { moduleSpecifier } = exportDecl;
    const { exportClause } = exportDecl;

    if (!moduleSpecifier && exportClause && ts.isNamedExports(exportClause)) {
      const match = exportClause.elements.find(
        (element) => element.name.text === exportName,
      );
      if (match) {
        const localName = match.propertyName?.text ?? match.name.text;
        const resolved = resolveIdentifierNameValue(
          sourceFile,
          localName,
          componentDir,
          visited,
        );
        if (resolved) {
          return resolved;
        }
      }
      continue;
    }

    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      continue;
    }

    const targetPath = resolveModulePath(
      path.dirname(resolvedPath),
      moduleSpecifier.text,
      componentDir,
    );
    if (!targetPath) {
      continue;
    }

    if (!exportClause) {
      const resolved = resolveExportedValue(
        targetPath,
        exportName,
        componentDir,
        visited,
      );
      if (resolved) {
        return resolved;
      }
      continue;
    }

    if (ts.isNamedExports(exportClause)) {
      const match = exportClause.elements.find(
        (element) => element.name.text === exportName,
      );
      if (!match) {
        continue;
      }

      const forwardedName = match.propertyName?.text ?? match.name.text;
      const resolved = resolveExportedValue(
        targetPath,
        forwardedName,
        componentDir,
        visited,
      );
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

export const resolveIdentifierValue = (
  sourceFile: ts.SourceFile,
  identifier: ts.Identifier,
  componentDir: string,
): string | null =>
  resolveIdentifierNameValue(
    sourceFile,
    identifier.text,
    componentDir,
    new Set<string>(),
  );
