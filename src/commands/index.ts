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
 * Commands Index
 *
 * This module re-exports all CLI commands for easy registration
 * with the main program.
 *
 * @module commands
 *
 * ## Adding New Commands
 *
 * 1. Create a new folder under `./commands/<command-name>/`
 * 2. Create an `index.ts` file that exports a Commander `Command` instance
 * 3. Re-export the command from this file
 * 4. Register the command in `../cli/index.ts`
 *
 * ## Command Structure Convention
 *
 * ```
 * commands/
 *   <command-name>/
 *     index.ts        # Command definition and action handler
 *     types.ts        # Command-specific types (optional)
 *     helpers.ts      # Command-specific helpers (optional)
 * ```
 */

export * from './connect';
export { listCommandNames, registerCommands } from './registry';
