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
 * Command Registry
 *
 * Manages registration and retrieval of CLI commands.
 *
 * @module commands/registry
 */
import { Command } from 'commander';

import { connectCommand } from './connect';

type CommandInstance = InstanceType<typeof Command>;

type CommandFactory = () => CommandInstance;

const COMMAND_REGISTRY: ReadonlyMap<string, CommandFactory> = new Map([[connectCommand.name(), () => connectCommand]]);

/**
 * Returns the list of registered command names.
 *
 * @returns Array of command names in registry order.
 */
export const listCommandNames = (): string[] => [...COMMAND_REGISTRY.keys()];

/**
 * Registers all commands with the Commander program instance.
 *
 * @param program - Commander program instance to register commands with.
 * @returns Nothing.
 */
export function registerCommands(program: CommandInstance): void {
  Array.from(COMMAND_REGISTRY.values())
    .map((factory) => factory())
    .forEach((command) => program.addCommand(command));
}
