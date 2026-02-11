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
 * TypeScript AST Utilities Module
 *
 * Provides helpers for common TypeScript AST traversal and extraction.
 *
 * @module utils/ts
 */

import ts from 'typescript';

/**
 * Extracts the first JSDoc summary for a node.
 *
 * @param node - AST node to inspect.
 * @returns Summary text or null when missing.
 */
export const getJSDocSummary = (node: ts.Node): string | null => {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  if (docs.length === 0) {
    return null;
  }
  const { comment } = docs[0];
  if (!comment) {
    return null;
  }
  if (typeof comment === 'string') {
    return comment.trim();
  }
  return comment
    .map((part) => part.text)
    .join('')
    .trim();
};

/**
 * Extracts text from a JSDoc tag.
 *
 * @param tag - JSDoc tag to read.
 * @returns Tag text content.
 */
export const getJSDocTagText = (tag: ts.JSDocTag): string => {
  if (!tag.comment) {
    return '';
  }
  if (typeof tag.comment === 'string') {
    return tag.comment.trim();
  }
  return tag.comment
    .map((part) => part.text)
    .join('')
    .trim();
};

/**
 * Retrieves the options object for a decorator call expression.
 *
 * @param decorator - Decorator node to inspect.
 * @returns Object literal options or null when unavailable.
 */
export const getDecoratorOptions = (decorator: ts.Decorator): ts.ObjectLiteralExpression | null => {
  const { expression } = decorator;
  if (!ts.isCallExpression(expression)) {
    return null;
  }
  const [options] = expression.arguments;
  if (!options || !ts.isObjectLiteralExpression(options)) {
    return null;
  }
  return options;
};

/**
 * Extracts a literal value from an expression.
 *
 * @param node - Expression node to inspect.
 * @returns Literal value or null when not a supported literal.
 */
export const getLiteralValue = (node: ts.Expression | undefined): string | number | boolean | null => {
  if (!node) {
    return null;
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text);
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return null;
};
