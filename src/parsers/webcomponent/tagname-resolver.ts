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

import path from "node:path";
import { nodeIoAdapter } from "../../io/adapter";

import ts from "typescript";

import { TagNameSource } from "../../core/types";
import { toKebabCase } from "../../utils/strings";
import { getJSDocTagText, getLiteralValue } from "../../utils/ts";

import type { ASTVisitorResult } from "./ast-visitor";
import type {
  TagNameResolution,
  TagNameResolverOptions,
} from "../../types/parsers-webcomponent";

/**
 * Reads a file if it exists on disk.
 *
 * @param filePath - Absolute or relative file path.
 * @returns File contents or null when missing/unreadable.
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
 * Creates a TypeScript source file from raw contents.
 *
 * @param filePath - File path to associate with the source.
 * @param contents - Source text to parse.
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
 * Resolves a tag name from a @tagname JSDoc tag on a class.
 *
 * @param classDeclaration - Class declaration to inspect.
 * @param astData - Optional pre-collected AST data from unified visitor.
 * @returns Tag name or null when missing.
 */
const resolveFromJSDoc = (
  classDeclaration?: ts.ClassDeclaration,
  astData?: ASTVisitorResult,
): string | null => {
  if (!classDeclaration) {
    return null;
  }

  // Use pre-collected JSDoc tags if available
  const tags =
    astData?.classJSDocTags.get(classDeclaration) ??
    ts.getJSDocTags(classDeclaration);
  const tag = tags.find((item) => item.tagName.text === "tagname");
  if (!tag) {
    return null;
  }
  const text = getJSDocTagText(tag);
  return text || null;
};

/**
 * Resolves tag namespace settings from tag-name constants.
 *
 * @param componentDir - Component directory for lookup.
 * @returns Namespace prefix/Separator or null when unavailable.
 */
const resolveNamespaceFromConstants = (
  componentDir: string,
): { prefix: string; separator: string } | null => {
  const constantsPath = path.resolve(
    componentDir,
    "../../utils/tag-name/constants.ts",
  );
  const contents = readFileIfExists(constantsPath);
  if (!contents) {
    return null;
  }

  const prefixMatch = contents.match(/PREFIX:\s*['"]([^'"]+)['"]/);
  const separatorMatch = contents.match(/SEPARATOR:\s*['"]([^'"]+)['"]/);
  if (!prefixMatch || !separatorMatch) {
    return null;
  }

  return {
    prefix: prefixMatch[1],
    separator: separatorMatch[1],
  };
};

/**
 * Applies namespace prefixing to a tag name value.
 *
 * @param componentDir - Component directory for namespace lookup.
 * @param value - Raw tag name value.
 * @returns Namespaced tag name.
 */
const applyNamespace = (componentDir: string, value: string): string => {
  const namespace = resolveNamespaceFromConstants(componentDir);
  const normalized = toKebabCase(value);
  if (!namespace) {
    return normalized;
  }
  return `${namespace.prefix}${namespace.separator}${normalized}`;
};

/**
 * Resolves a tag name from an initializer expression.
 *
 * @param initializer - Expression to evaluate.
 * @param componentDir - Component directory for namespace lookup.
 * @returns Tag name or null when unsupported.
 */
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
    const calleeName = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : "";

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

/**
 * Resolves an identifier value within a source file.
 *
 * @param sourceFile - Source file to search.
 * @param identifier - Identifier to resolve.
 * @param componentDir - Component directory for namespace lookup.
 * @returns Tag name or null when unresolved.
 */
const resolveIdentifierValue = (
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

/**
 * Resolves an identifier value by name within a source file.
 *
 * @param sourceFile - Source file to search.
 * @param identifierName - Identifier name to resolve.
 * @param componentDir - Component directory for namespace lookup.
 * @param visited - Set of visited file paths to prevent cycles.
 * @returns Tag name or null when unresolved.
 */
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

  if (localMatch && localMatch.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  let importedName = identifierName;
  const importDeclaration = sourceFile.statements
    .filter(ts.isImportDeclaration)
    .find((statement) => {
      const clause = statement.importClause;
      if (
        !clause ||
        !clause.namedBindings ||
        !ts.isNamedImports(clause.namedBindings)
      ) {
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

/**
 * Resolves an import specifier to a concrete file path.
 *
 * @param baseDir - Directory containing the import.
 * @param modulePath - Module specifier to resolve.
 * @param componentDir - Component directory for constants resolution.
 * @returns Resolved file path or null when missing.
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
      const entries = nodeIoAdapter.listFiles
        ? nodeIoAdapter.listFiles(dir)
        : [];
      const matches = entries.filter((entry) =>
        entry.endsWith(".constants.ts"),
      );
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
 * Resolves an exported constant value from another module.
 *
 * @param filePath - File path to inspect.
 * @param exportName - Exported symbol name to resolve.
 * @param componentDir - Component directory for namespace lookup.
 * @param visited - Set of visited file paths to prevent cycles.
 * @returns Tag name or null when unresolved.
 */
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
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName,
    );

  if (localMatch?.initializer) {
    return resolveTagNameInitializer(localMatch.initializer, componentDir);
  }

  const exportDeclarations = sourceFile.statements.filter(
    ts.isExportDeclaration,
  );
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

/**
 * Resolves a tag name from register() calls in an index file.
 *
 * @param sourceFile - Source file to inspect.
 * @param componentDir - Component directory for namespace lookup.
 * @param className - Optional class name to prioritize.
 * @returns Tag name and optional warning.
 */
const resolveTagNameFromRegister = (
  sourceFile: ts.SourceFile,
  componentDir: string,
  className?: string,
): { tagName: string | null; warning?: string } => {
  const candidates: { receiver?: string; arg?: ts.Expression }[] = [];

  /**
   * Visits nodes to locate register() call expressions.
   *
   * @param node - AST node to visit.
   * @returns Nothing.
   */
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propertyAccess = node.expression;
      if (propertyAccess.name.text === "register") {
        const receiver = ts.isIdentifier(propertyAccess.expression)
          ? propertyAccess.expression.text
          : undefined;
        candidates.push({ receiver, arg: node.arguments[0] });
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  if (candidates.length === 0) {
    return { tagName: null };
  }

  const primary = className
    ? (candidates.find((candidate) => candidate.receiver === className) ??
      candidates[0])
    : candidates[0];

  const { arg } = primary;
  if (!arg) {
    return {
      tagName: null,
      warning: "register() call did not include a tag name argument.",
    };
  }

  const literal = getLiteralValue(arg);
  if (typeof literal === "string") {
    return { tagName: literal };
  }

  if (ts.isIdentifier(arg)) {
    const resolved = resolveIdentifierValue(sourceFile, arg, componentDir);
    return {
      tagName: resolved,
      warning: resolved
        ? undefined
        : `Unable to resolve tag name identifier: ${arg.text}`,
    };
  }

  return {
    tagName: null,
    warning: `Unsupported register() tag expression: ${arg.getText(sourceFile)}`,
  };
};

/**
 * Resolves a tag name from a component index.ts file.
 *
 * @param componentDir - Component directory to search.
 * @param className - Optional class name to prioritize.
 * @returns Tag name and collected warnings.
 */
const resolveFromIndexFile = (
  componentDir: string,
  className?: string,
): { tagName: string | null; warnings: string[] } => {
  const indexPath = path.join(componentDir, "index.ts");
  const contents = readFileIfExists(indexPath);
  if (!contents) {
    return { tagName: null, warnings: [] };
  }

  const sourceFile = createSourceFile(indexPath, contents);
  const { tagName, warning } = resolveTagNameFromRegister(
    sourceFile,
    componentDir,
    className,
  );

  return { tagName, warnings: warning ? [warning] : [] };
};

/**
 * Resolves a tag name from the component file name.
 *
 * @param componentFilePath - Component file path to derive from.
 * @param componentDir - Component directory for namespace lookup.
 * @returns Derived tag name.
 */
const resolveFromFilename = (
  componentFilePath: string,
  componentDir: string,
): string => {
  const fileBase = path
    .basename(componentFilePath)
    .replace(/\.component\.(t|j)sx?$/, "")
    .replace(/\.(t|j)sx?$/, "");
  const derived = toKebabCase(fileBase);
  return applyNamespace(componentDir, derived);
};

/**
 * Resolves a component tag name using available discovery strategies.
 *
 * @param options - Resolution options including component paths and class info.
 * @returns Resolved tag name, source, and warnings.
 */
export const resolveTagName = (
  options: TagNameResolverOptions,
): TagNameResolution => {
  const warnings: string[] = [];

  const jsdocTagName = resolveFromJSDoc(
    options.classDeclaration,
    options.astData,
  );
  if (jsdocTagName) {
    return {
      tagName: jsdocTagName,
      source: TagNameSource.JSDoc,
      warnings,
    };
  }

  const indexResult = resolveFromIndexFile(
    options.componentDir,
    options.className,
  );
  if (indexResult.tagName) {
    return {
      tagName: indexResult.tagName,
      source: TagNameSource.IndexTs,
      warnings: warnings.concat(indexResult.warnings),
    };
  }

  warnings.push(...indexResult.warnings);

  return {
    tagName: resolveFromFilename(
      options.componentFilePath,
      options.componentDir,
    ),
    source: TagNameSource.Filename,
    warnings,
  };
};
