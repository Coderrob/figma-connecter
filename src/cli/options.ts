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
 * CLI Options Module
 *
 * Provides helpers for reading global CLI options from Commander commands.
 *
 * @module cli/options
 */

import type { IGlobalCliOptions } from "@/src/cli/types";

import { Command } from "commander";

/** Commander Command instance type. */
type CommandInstance = InstanceType<typeof Command>;
type GlobalOptionValue = string | boolean | undefined;

/**
 * Retrieves global options for a command, falling back to parent options.
 *
 * This function handles option inheritance from parent commands, allowing
 * global options to be specified at any level of the command hierarchy.
 *
 * @param command - The Command instance to retrieve options from.
 * @returns The resolved global CLI options.
 */
export function getGlobalOptions(
  command?: Readonly<CommandInstance>,
): IGlobalCliOptions {
  const localOptions = command?.opts?.() ?? {};
  const parentOptions = command?.parent?.opts?.() ?? {};

  /**
   * Reads a single option, preferring local values over parent values.
   *
   * @param key - The option key to resolve.
   * @returns The resolved option value.
   */
  const pickOption = (
    key: keyof IGlobalCliOptions,
  ): GlobalOptionValue => {
    if (localOptions[key] !== undefined) {
      return getOptionValue(localOptions[key]);
    }
    return getOptionValue(parentOptions[key]);
  };

  return {
    verbose: Boolean(pickOption("verbose")),
    quiet: Boolean(pickOption("quiet")),
    dryRun: Boolean(pickOption("dryRun")),
    config: getStringOption(pickOption("config")),
  };
}

/**
 * Normalizes an unknown Commander option value into the supported scalar types.
 *
 * @param value - Raw option value returned by Commander.
 * @returns String/boolean values, otherwise undefined.
 */
function getOptionValue(value: unknown): GlobalOptionValue {
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }
  return undefined;
}

/**
 * Returns a string option value when the provided value is a string.
 *
 * @param value - Candidate option value.
 * @returns String value or undefined.
 */
function getStringOption(
  value: Readonly<GlobalOptionValue>,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}
