/**
 * Tag-name namespace helpers.
 */

import path from "node:path";

import { nodeIoAdapter } from "@/src/io/adapter";
import { toKebabCase } from "@/src/utils/strings";

/**
 * Applies namespace prefix/separator to a derived tag name when configured.
 *
 * @param componentDir - Component directory path.
 * @param value - Un-namespaced tag name value.
 * @returns Namespaced, kebab-cased tag name.
 */
export function applyNamespace(componentDir: string, value: string): string {
  const namespace = resolveNamespaceFromConstants(componentDir);
  const normalized = toKebabCase(value);
  if (!namespace) {
    return normalized;
  }
  return `${namespace.prefix}${namespace.separator}${normalized}`;
}

/**
 * Reads file contents when the path exists.
 *
 * @param filePath - Absolute file path.
 * @returns File contents or null when missing/unreadable.
 */
function readFileIfExists(filePath: string): string | null {
  try {
    if (!nodeIoAdapter.exists(filePath)) {
      return null;
    }
    return nodeIoAdapter.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Resolves namespace prefix/separator from shared tag-name constants.
 *
 * @param componentDir - Component directory path.
 * @returns Namespace configuration or null when unavailable.
 */
function resolveNamespaceFromConstants(
  componentDir: string,
): { prefix: string; separator: string } | null {
  const constantsPath = path.resolve(
    componentDir,
    "../../utils/tag-name/constants.ts",
  );
  const contents = readFileIfExists(constantsPath);
  if (!contents) {
    return null;
  }

  const prefixMatch = /PREFIX:\s*['"]([^'"]+)['"]/.exec(contents);
  const separatorMatch = /SEPARATOR:\s*['"]([^'"]+)['"]/.exec(contents);
  if (!prefixMatch || !separatorMatch) {
    return null;
  }

  return {
    prefix: prefixMatch[1],
    separator: separatorMatch[1],
  };
}
