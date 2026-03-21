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
 * Emit Target Parsing Module
 *
 * Provides normalization for emit target strings.
 *
 * @module core/emit-targets
 */

import { EmitterTarget } from "./types";

const ALL_TARGETS = Object.values(EmitterTarget);

/**
 * Formats the emit target list for CLI help text.
 *
 * @param targets - Emit targets to format for display.
 * @returns Comma-separated list of targets plus "all".
 */
export function formatEmitTargetOptions(
  targets: readonly EmitterTarget[] = listEmitTargets(),
): string {
  return [...targets, "all"].join(", ");
}

/**
 * Returns all registered emit targets.
 *
 * @returns Array of supported emit targets.
 */
export function listEmitTargets(): EmitterTarget[] {
  return [...ALL_TARGETS];
}

/**
 * Parses and validates emit targets from a comma-separated string.
 *
 * @param raw - The raw emit targets string (e.g., "webcomponent,react" or "all").
 * @param allowedTargets - Allowed emit targets to validate against.
 * @returns Array of validated emitter targets.
 * @throws Error if emit targets are empty or contain invalid values.
 */
export function parseEmitTargets(
  raw: string,
  allowedTargets: readonly EmitterTarget[] = listEmitTargets(),
): EmitterTarget[] {
  if (!raw || raw.trim().length === 0) {
    throw new Error("Emit targets cannot be empty.");
  }

  const normalizedTargets = Array.from(new Set(allowedTargets));
  if (normalizedTargets.length === 0) {
    throw new Error("No emit targets registered.");
  }

  /**
   * Normalizes a raw emit target token.
   *
   * @param token - Raw token from user input.
   * @returns Normalized token.
   */
  function normalizeToken(token: string): string {
    return token.trim().toLowerCase();
  }

  /**
   * Checks whether a token is non-empty after normalization.
   *
   * @param token - Normalized token.
   * @returns True when token is non-empty.
   */
  function hasContent(token: string): boolean {
    return Boolean(token);
  }

  const tokens = raw.split(",").map(normalizeToken).filter(hasContent);

  if (tokens.includes("all")) {
    return normalizedTargets;
  }

  const allowed = new Set<string>(normalizedTargets);

  /**
   * Checks whether a normalized token is unsupported.
   *
   * @param token - Normalized token to validate.
   * @returns True when token is not allowed.
   */
  function isInvalidToken(token: string): boolean {
    return !allowed.has(token);
  }

  const invalid = tokens.filter(isInvalidToken);

  if (invalid.length > 0) {
    throw new Error(
      `Invalid emit targets: ${invalid.join(", ")}. Valid targets are: ${formatEmitTargetOptions(normalizedTargets)}.`,
    );
  }

  const unique = [...new Set(tokens)] as EmitterTarget[];
  if (unique.length === 0) {
    throw new Error("No valid emit targets found.");
  }

  return unique;
}
