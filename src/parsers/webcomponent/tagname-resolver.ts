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
import ts from "typescript";

import { TagNameSource } from "../../core/types";

import { nodeIoAdapter } from "../../io/adapter";
import type {
  TagNameResolution,
  TagNameResolverOptions,
} from "../../types/parsers-webcomponent";
import { toKebabCase } from "../../utils/strings";

import { getJSDocTagText, getLiteralValue } from "../../utils/ts";
import type { ASTVisitorResult } from "./ast-visitor";
import { resolveIdentifierValue } from "./tagname/export-resolution";
import { applyNamespace } from "./tagname/namespace";

const createSourceFile = (filePath: string, contents: string): ts.SourceFile =>
  ts.createSourceFile(
    filePath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

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

const resolveFromFilename = (
  componentFilePath: string,
  componentDir: string,
): string => {
  const fileBase = path
    .basename(componentFilePath)
    .replace(/\.component\.[tj]sx?$/, "")
    .replace(/\.[tj]sx?$/, "");
  const derived = toKebabCase(fileBase);
  return applyNamespace(componentDir, derived);
};

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

const resolveFromJSDoc = (
  classDeclaration?: ts.ClassDeclaration,
  astData?: ASTVisitorResult,
): string | null => {
  if (!classDeclaration) {
    return null;
  }

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

const resolveTagNameFromRegister = (
  sourceFile: ts.SourceFile,
  componentDir: string,
  className?: string,
): { tagName: string | null; warning?: string } => {
  const candidates: { receiver?: string; arg?: ts.Expression }[] = [];

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
