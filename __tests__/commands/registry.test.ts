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
 * @fileoverview Tests for command registry.
 */

import { Command } from 'commander';

import { listCommandNames, registerCommands } from '../../src/commands/registry';

describe('command registry', () => {
  it('should list registered command names', () => {
    const names = listCommandNames();
    expect(names).toContain('connect');
  });

  it('should register commands on a program instance', () => {
    const program = new Command('figma-connecter');

    registerCommands(program);

    const commandNames = program.commands.map((command) => command.name());
    expect(commandNames).toContain('connect');
  });
});
