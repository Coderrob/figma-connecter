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
 * CLI Validators Module
 *
 * Provides validation functions for CLI options and arguments.
 *
 * @module cli/validators
 */

import fs from 'node:fs';
import path from 'node:path';

import type { GlobalCliOptions } from './types';

/**
 * Validates global options for incompatible combinations.
 *
 * @param options - The global CLI options to validate.
 * @throws Error if options contain incompatible combinations.
 */
export function validateGlobalOptions(options: GlobalCliOptions): void {
  if (options.verbose && options.quiet) {
    throw new Error('Cannot use --verbose and --quiet together.');
  }
}

/**
 * Validates and resolves the path option.
 *
 * @param value - The path value to validate.
 * @param optionName - The option name for error messages.
 * @returns The resolved absolute path.
 * @throws Error if the path is empty or does not exist.
 */
export function validatePathOption(value: string, optionName = '--path'): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required value for ${optionName}.`);
  }

  const resolved = path.resolve(process.cwd(), value);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Path not found: ${value}`);
  }

  return resolved;
}

/**
 * Validates and resolves a config file path if provided.
 *
 * @param value - The config path to validate.
 * @returns The resolved absolute path, or undefined if not provided.
 * @throws Error if the config file does not exist or is not a file.
 */
export function validateConfigPath(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const resolved = path.resolve(process.cwd(), value);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${value}`);
  }

  const stats = fs.statSync(resolved);
  if (!stats.isFile()) {
    throw new Error(`Config path is not a file: ${value}`);
  }

  return resolved;
}

// Emit target parsing lives in core to avoid duplicate logic.
