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
 * String Formatting Utilities Module
 *
 * Provides utilities for string manipulation, indentation, and identifier handling.
 *
 * @module emitters/shared/formatting
 */

/**
 * Prefixes a line with indentation content.
 *
 * @param prefix - Indentation prefix to prepend.
 * @param line - Line content to indent.
 * @returns Indented line.
 */
function applyIndent(prefix: string, line: string): string {
  return `${prefix}${line}`;
}

/**
 * Formats a property accessor for generated props lookups.
 *
 * @param value - Property name to access.
 * @returns Dot notation for identifiers, otherwise bracket notation.
 */
export const formatPropAccessor = (value: string): string =>
  isValidIdentifier(value) ? `props.${value}` : `props['${value}']`;

/**
 * Formats a property key for generated object literals.
 *
 * @param value - Property name to emit.
 * @returns Unquoted identifier keys or quoted string keys.
 */
export const formatPropKey = (value: string): string =>
  isValidIdentifier(value) ? value : `'${value}'`;

/**
 * Formats one token for title-cased output.
 *
 * @param token - Token to capitalize.
 * @returns Capitalized token.
 */
function formatTitleToken(token: string): string {
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/**
 * Creates a repeated two-space indentation prefix.
 *
 * @param depth - Indentation depth in two-space units.
 * @returns Indentation string.
 */
export function indent(depth: number): string {
  return "  ".repeat(depth);
}

/**
 * Indents each line in a multi-line content block.
 *
 * @param content - Content block to indent.
 * @param depth - Indentation depth to apply.
 * @returns Indented content lines.
 */
export const indentBlock = (content: string, depth: number): string[] => {
  const prefix = indent(depth);
  const indentLine = applyIndent.bind(undefined, prefix);
  return content.split("\n").map(indentLine);
};

/**
 * Returns true when a value can be emitted as a JavaScript identifier.
 *
 * @param value - Candidate identifier.
 * @returns True when the value is a valid identifier.
 */
export function isValidIdentifier(value: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
}

/**
 * Converts identifier-like text into title case.
 *
 * @param value - Source text to transform.
 * @returns Title-cased text with separators normalized to spaces.
 */
export const toTitleCase = (value: string): string =>
  value
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(formatTitleToken)
    .join(" ");
