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
 * Connect Command - Helper Functions
 *
 * @module commands/connect/helpers
 */
import type { CommandStages, GlobalCliOptions } from '../../cli';
import { LogLevel } from '../../core/logger';

/**
 * Resolves the log level based on global CLI options.
 *
 * @param options - The global CLI options.
 * @returns The resolved log level.
 */
export function resolveLogLevel(options: GlobalCliOptions): LogLevel {
  if (options.quiet) {
    return LogLevel.ERROR;
  }
  if (options.verbose) {
    return LogLevel.DEBUG;
  }
  return LogLevel.INFO;
}

/**
 * Runs a CLI command through validate -> execute -> report stages.
 *
 * @param command - Command stages to run.
 */
export async function runCommandStages<Context, Result>(command: CommandStages<Context, Result>): Promise<void> {
  const context = command.validate();

  try {
    const result = await command.execute(context);
    command.report(context, result);
  } catch (error) {
    command.onError?.(context, error);
    throw error;
  }
}
