/**
 * Tag-name namespace helpers.
 */

import path from "node:path";

import { nodeIoAdapter } from "../../../io/adapter";
import { toKebabCase } from "../../../utils/strings";

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

  const prefixMatch = /PREFIX:\s*['\"]([^'\"]+)['\"]/.exec(contents);
  const separatorMatch = /SEPARATOR:\s*['\"]([^'\"]+)['\"]/.exec(contents);
  if (!prefixMatch || !separatorMatch) {
    return null;
  }

  return {
    prefix: prefixMatch[1],
    separator: separatorMatch[1],
  };
};

export const applyNamespace = (componentDir: string, value: string): string => {
  const namespace = resolveNamespaceFromConstants(componentDir);
  const normalized = toKebabCase(value);
  if (!namespace) {
    return normalized;
  }
  return `${namespace.prefix}${namespace.separator}${normalized}`;
};
