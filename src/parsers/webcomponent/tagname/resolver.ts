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
} from "@/src/parsers/webcomponent/types";
import { toKebabCase } from "@/src/utils/strings";
import { getJSDocTagText, getLiteralValue } from "@/src/utils/ts";

import ts from "typescript";
import type { IASTVisitorResult } from "../shared/ast-visitor";
import { resolveIdentifierValue } from "./export-resolution";
import { applyNamespace } from "./namespace";

const REGISTER_METHOD_NAME = "register";
const TAGNAME_JSDOC_TAG = "tagname";

interface IIndexResolution {
  readonly tagName: string | null;
  readonly warnings: readonly string[];
}

interface IRegisterCallCandidate {
  readonly receiver?: string;
  readonly arg?: ts.Expression;
}

interface IRegisterResolution {
  readonly tagName: string | null;
  readonly warning?: string;
}

/**
 * Creates a transient TypeScript source file for tag-name analysis.
 *
 * @param filePath - Virtual or on-disk file path used for the source file.
 * @param contents - File contents to parse.
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
 * Reads a file when it exists and is accessible.
 *
 * @param filePath - File path to read.
 * @returns File contents or `null` when the file cannot be read.
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
 * Derives a fallback tag name from the component source file name.
 *
 * @param componentFilePath - Component source file path.
 * @param componentDir - Component directory used for namespace resolution.
 * @returns Derived fallback tag name.
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
 * Resolves a tag name from `index.ts` register calls within the component directory.
 *
 * @param componentDir - Component directory containing `index.ts`.
 * @param className - Optional component class name used to match register receivers.
 * @returns Resolved tag name plus any warnings produced during analysis.
 */
const resolveFromIndexFile = (
  componentDir: string,
  className?: string,
): IIndexResolution => {
  const sourceFile = loadIndexSourceFile(componentDir);
  if (!sourceFile) {
    return { tagName: null, warnings: [] };
  }

  const { tagName, warning } = resolveTagNameFromRegister(
    sourceFile,
    componentDir,
    className,
  );

  return {
    tagName,
    warnings: warning ? [warning] : [],
  };
};

/**
 * Loads and parses the component `index.ts` file when available.
 *
 * @param componentDir - Component directory containing `index.ts`.
 * @returns Parsed source file or `null` when the file is missing or unreadable.
 */
function loadIndexSourceFile(componentDir: string): ts.SourceFile | null {
  const indexPath = path.join(componentDir, "index.ts");
  const contents = readFileIfExists(indexPath);
  if (!contents) {
    return null;
  }

  return createSourceFile(indexPath, contents);
}

/**
 * Resolves a tag name from a class-level `@tagname` JSDoc tag.
 *
 * @param classDeclaration - Class declaration to inspect.
 * @param astData - Optional pre-collected AST data containing cached JSDoc tags.
 * @returns Tag name from JSDoc or `null` when no tag is present.
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
 * Resolves the tag name for a component using JSDoc, index registration, and filename fallbacks.
 *
 * Resolution priority is:
 * 1. `@tagname` JSDoc
 * 2. `register(...)` calls in `index.ts`
 * 3. Component file name
 *
 * @param options - Tag-name resolver inputs for the component.
 * @returns Resolved tag name, source metadata, and any warnings.
 */
export const resolveTagName = (
  options: Readonly<ITagNameResolverOptions>,
): ITagNameResolution => {
  const jsdocTagName = resolveFromJSDoc(
    options.classDeclaration,
    options.astData,
  );
  if (jsdocTagName) {
    return createTagNameResolution(jsdocTagName, TagNameSource.JSDoc, []);
  }

  const indexResult = resolveFromIndexFile(
    options.componentDir,
    options.className,
  );
  if (indexResult.tagName) {
    return createTagNameResolution(
      indexResult.tagName,
      TagNameSource.IndexTs,
      indexResult.warnings,
    );
  }

  return createTagNameResolution(
    resolveFromFilename(options.componentFilePath, options.componentDir),
    TagNameSource.Filename,
    indexResult.warnings,
  );
};

/**
 * Creates the normalized tag-name resolution result.
 *
 * @param tagName - Resolved tag name.
 * @param source - Resolution source metadata.
 * @param warnings - Warning messages produced during resolution.
 * @returns Normalized tag-name resolution payload.
 */
function createTagNameResolution(
  tagName: string,
  source: Readonly<TagNameSource>,
  warnings: readonly string[],
): ITagNameResolution {
  return {
    tagName,
    source,
    warnings: [...warnings],
  };
}

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
): IRegisterResolution {
  const candidates = collectRegisterCandidates(sourceFile);

  if (candidates.length === 0) {
    return { tagName: null };
  }

  const primary = selectPrimaryRegisterCandidate(candidates, className);
  return resolveRegisterCandidate(primary, sourceFile, componentDir);
}

/**
 * Collects `register(...)` call candidates from a source file.
 *
 * @param sourceFile - Source file to inspect.
 * @returns Collected register-call candidates in source order.
 */
function collectRegisterCandidates(
  sourceFile: Readonly<ts.SourceFile>,
): readonly IRegisterCallCandidate[] {
  let candidates: readonly IRegisterCallCandidate[] = [];

  /**
   * Visits nodes in the index file and collects `register(...)` call candidates.
   *
   * @param node - AST node to inspect.
   * @returns Nothing.
   */
  const visit = (node: Readonly<ts.Node>): void => {
    const candidate = getRegisterCallCandidate(node);
    if (candidate) {
      candidates = [...candidates, candidate];
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return candidates;
}

/**
 * Builds a register-call candidate from a node when it matches `*.register(...)`.
 *
 * @param node - AST node to inspect.
 * @returns Register-call candidate or `undefined` when the node does not match.
 */
function getRegisterCallCandidate(
  node: Readonly<ts.Node>,
): IRegisterCallCandidate | undefined {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
    return undefined;
  }

  const propertyAccess = node.expression;
  if (propertyAccess.name.text !== REGISTER_METHOD_NAME) {
    return undefined;
  }

  return {
    receiver: ts.isIdentifier(propertyAccess.expression)
      ? propertyAccess.expression.text
      : undefined,
    arg: node.arguments[0],
  };
}

/**
 * Selects the preferred register-call candidate for resolution.
 *
 * Prefers a candidate whose receiver matches the provided class name and
 * otherwise falls back to the first candidate in source order.
 *
 * @param candidates - Register-call candidates collected from the source file.
 * @param className - Optional component class name to match.
 * @returns Primary candidate to resolve.
 */
function selectPrimaryRegisterCandidate(
  candidates: readonly IRegisterCallCandidate[],
  className?: string,
): IRegisterCallCandidate {
  if (!className) {
    return candidates[0];
  }

  return candidates.find(matchesReceiver.bind(undefined, className)) ?? candidates[0];
}

/**
 * Returns true when a register-call candidate receiver matches the class name.
 *
 * @param className - Component class name to match.
 * @param candidate - Candidate to inspect.
 * @returns True when the receiver matches the class name.
 */
function matchesReceiver(
  className: string,
  candidate: Readonly<IRegisterCallCandidate>,
): boolean {
  return candidate.receiver === className;
}

/**
 * Resolves a tag name from a selected register-call candidate.
 *
 * @param candidate - Selected register-call candidate.
 * @param sourceFile - Source file containing the candidate.
 * @param componentDir - Component directory used for identifier resolution.
 * @returns Resolved tag name with optional warning.
 */
function resolveRegisterCandidate(
  candidate: Readonly<IRegisterCallCandidate>,
  sourceFile: Readonly<ts.SourceFile>,
  componentDir: string,
): IRegisterResolution {
  const { arg } = candidate;
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
