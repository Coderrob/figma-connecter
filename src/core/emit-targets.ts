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

import assert from "node:assert/strict";
import { EmitterTarget } from "./types";

const ALL_TARGETS = Object.values(EmitterTarget);

/**
 * Validates tokens against the allowed target set.
 *
 * @param tokens - Parsed user tokens.
 * @param normalizedTargets - Allowed targets for messaging.
 * @param allowed - Allowed target lookup set.
 * @returns Nothing.
 */
function assertValidTargetTokens(
  tokens: readonly string[],
  normalizedTargets: readonly EmitterTarget[],
  allowed: Readonly<Set<string>>,
): void {
  const invalid = tokens.filter(isInvalidTarget.bind(undefined, allowed));
  assert(
    invalid.length === 0,
    `Invalid emit targets: ${invalid.join(", ")}. Valid targets are: ${formatEmitTargetOptions(normalizedTargets)}.`,
  );
}

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
 * Returns true when a normalized token has content.
 *
 * @param token - Token to check.
 * @returns True when the token is non-empty.
 */
function hasContent(token: string): boolean {
  return Boolean(token);
}

/**
 * Returns true when a token is unsupported.
 *
 * @param allowed - Allowed target names.
 * @param token - Token to evaluate.
 * @returns True when the token is unsupported.
 */
function isInvalidTarget(
  allowed: Readonly<Set<string>>,
  token: string,
): boolean {
  return !allowed.has(token);
}

/**
 * Narrows a token to a known emit target.
 *
 * @param allowed - Allowed target names.
 * @param token - Token to evaluate.
 * @returns True when the token is allowed.
 */
function isKnownTarget(
  allowed: Readonly<Set<string>>,
  token: string,
): token is EmitterTarget {
  return allowed.has(token);
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
 * Normalizes allowed targets and ensures at least one exists.
 *
 * @param allowedTargets - Targets accepted by the parser.
 * @returns Deduplicated normalized targets.
 */
function normalizeAllowedTargets(
  allowedTargets: readonly EmitterTarget[],
): EmitterTarget[] {
  const normalizedTargets = Array.from(new Set(allowedTargets));
  assert(normalizedTargets.length > 0, "No emit targets registered.");
  return normalizedTargets;
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
  assert(raw.trim().length > 0, "Emit targets cannot be empty.");

  const normalizedTargets = normalizeAllowedTargets(allowedTargets);
  const tokens = parseTargetTokens(raw);

  if (tokens.includes("all")) {
    return normalizedTargets;
  }

  const allowed = new Set<string>(normalizedTargets);
  assertValidTargetTokens(tokens, normalizedTargets, allowed);
  return resolveUniqueTargets(tokens, allowed);
}

/**
 * Parses and normalizes raw target tokens.
 *
 * @param raw - Raw comma-separated target string.
 * @returns Non-empty normalized tokens.
 */
function parseTargetTokens(raw: string): string[] {
  return raw.split(",").map(normalizeToken).filter(hasContent);
}

/**
 * Returns deduplicated validated targets.
 *
 * @param tokens - Parsed user tokens.
 * @param allowed - Allowed target lookup set.
 * @returns Unique validated emit targets.
 */
function resolveUniqueTargets(
  tokens: readonly string[],
  allowed: Readonly<Set<string>>,
): EmitterTarget[] {
  const unique: EmitterTarget[] = [];
  for (const token of new Set(tokens)) {
    if (isKnownTarget(allowed, token)) {
      unique.push(token);
    }
  }
  assert(unique.length > 0, "No valid emit targets found.");
  return unique;
}
