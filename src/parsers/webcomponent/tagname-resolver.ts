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
import { TagNameSource } from "@/src/core/types";

import { nodeIoAdapter } from "@/src/io/adapter";

import type {
  ITagNameResolution,
  ITagNameResolverOptions,
} from "@/src/types/parsers-webcomponent";
import { toKebabCase } from "@/src/utils/strings";
import { getJSDocTagText, getLiteralValue } from "@/src/utils/ts";

import ts from "typescript";
import type { IASTVisitorResult } from "./ast-visitor";
import { resolveIdentifierValue } from "./tagname/export-resolution";
import { applyNamespace } from "./tagname/namespace";

const REGISTER_METHOD_NAME = "register";
const TAGNAME_JSDOC_TAG = "tagname";

/**
 * createSourceFile TODO: describe.
 * @param filePath TODO: describe parameter
 * @param contents TODO: describe parameter
 * @returns TODO: describe return value
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
 * readFileIfExists TODO: describe.
 * @param filePath TODO: describe parameter
 * @returns TODO: describe return value
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
 * resolveFromFilename TODO: describe.
 * @param componentFilePath TODO: describe parameter
 * @param componentDir TODO: describe parameter
 * @returns TODO: describe return value
 */
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

/**
 * resolveFromIndexFile TODO: describe.
 * @param componentDir TODO: describe parameter
 * @param className TODO: describe parameter
 * @returns TODO: describe return value
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
 * resolveFromJSDoc TODO: describe.
 * @param classDeclaration TODO: describe parameter
 * @param astData TODO: describe parameter
 * @returns TODO: describe return value
 */
const resolveFromJSDoc = (
  classDeclaration?: Readonly<ts.ClassDeclaration>,
  astData?: Readonly<IASTVisitorResult>,
): string | null => {
  if (!classDeclaration) {
    return null;
  }

  const tags =
    astData?.classJSDocTags.get(classDeclaration) ??
    ts.getJSDocTags(classDeclaration);
  const tag = tags.find(
    /**
     * Finds the first event tag by name.
     *
     * @param item - JSDoc tag candidate.
     * @returns True when the tag name matches.
     */
    (item) => item.tagName.text === TAGNAME_JSDOC_TAG,
  );
  if (!tag) {
    return null;
  }

  const text = getJSDocTagText(tag);
  return text || null;
};

/**
 * resolveTagName TODO: describe.
 * @param options TODO: describe parameter
 * @returns TODO: describe return value
 */
export const resolveTagName = (
  options: Readonly<ITagNameResolverOptions>,
): ITagNameResolution => {
  const jsdocTagName = resolveFromJSDoc(options.classDeclaration, options.astData);
  if (jsdocTagName) {
    return { tagName: jsdocTagName, source: TagNameSource.JSDoc, warnings: [] };
  }

  const indexResult = resolveFromIndexFile(options.componentDir, options.className);
  if (indexResult.tagName) {
    return {
      tagName: indexResult.tagName,
      source: TagNameSource.IndexTs,
      warnings: [...indexResult.warnings],
    };
  }

  return {
    tagName: resolveFromFilename(options.componentFilePath, options.componentDir),
    source: TagNameSource.Filename,
    warnings: [...indexResult.warnings],
  };
};

/**
 * Resolves a tag name from `register(...)` calls in an index file.
 *
 * @param sourceFile - Source file to inspect.
 * @param componentDir - Component directory path.
 * @param className - Optional class name to match register receiver.
 * @returns Resolved tag name with optional warning.
 */
function resolveTagNameFromRegister(
  sourceFile: Readonly<ts.SourceFile>,
  componentDir: string,
  className?: string,
): { tagName: string | null; warning?: string } {
  let candidates: { receiver?: string; arg?: ts.Expression }[] = [];

  /**
   * visit TODO: describe.
   * @param node TODO: describe parameter
   * @returns TODO: describe return value
   */
  const visit = (node: Readonly<ts.Node>): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const propertyAccess = node.expression;
      if (propertyAccess.name.text === REGISTER_METHOD_NAME) {
        const receiver = ts.isIdentifier(propertyAccess.expression)
          ? propertyAccess.expression.text
          : undefined;
        candidates = [...candidates, { receiver, arg: node.arguments[0] }];
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  if (candidates.length === 0) {
    return { tagName: null };
  }

  const primary = className
    ? (candidates.find(
        /**
         * Finds the register candidate matching the component class name.
         *
         * @param candidate - Register call candidate.
         * @returns True when receiver matches the class name.
         */
        (candidate) => candidate.receiver === className,
      ) ?? candidates[0])
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
}
