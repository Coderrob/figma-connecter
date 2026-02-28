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
 * CLI Program Module
 *
 * Provides the main CLI program factory and configuration utilities.
 *
 * @module cli/program
 */

import path from "node:path";
import { nodeIoAdapter } from "../io/adapter";

import { Command } from "commander";

import { registerCommands } from "../commands/registry";
import { DEFAULT_CONNECT_OPTIONS } from "../core/constants";

/** Commander Command instance type. */
type CommandInstance = InstanceType<typeof Command>;

/** Package metadata loaded from package.json */
interface PackageJson {
  description?: string;
  version?: string;
}

/**
 * Reads package.json from the package root.
 * @returns Package metadata.
 */
function getPackageMetadata(): PackageJson {
  try {
    // When built, this file is at dist/src/cli/program.js
    // package.json is at the package root (../../.. from dist/src/cli/)
    const packageJsonPath = path.resolve(__dirname, "../../../package.json");
    const content = nodeIoAdapter.readFile(packageJsonPath);
    return JSON.parse(content) as PackageJson;
  } catch {
    return { description: "Figma Connecter management tool", version: "1.0.0" };
  }
}

const { description = "Figma Connecter management tool", version = "1.0.0" } =
  getPackageMetadata();

/**
 * Creates and configures the main CLI program.
 *
 * Sets up the program with name, description, version, global options,
 * and help formatting. Commands are registered from the command registry.
 *
 * @returns The configured Commander program instance.
 */
export function createProgram(): CommandInstance {
  const program = new Command();

  program.name("figma-connecter").description(description).version(version);

  addGlobalOptions(program);
  applyHelpFormatting(program);
  registerCommands(program);

  return program;
}

/**
 * Main entry point for the CLI.
 *
 * Parses command-line arguments and executes the appropriate command.
 *
 * @param argv - Command-line arguments. Defaults to process.argv.
 */
export async function run(argv: string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

/**
 * Adds global options shared across all commands.
 *
 * @param program - The Commander program instance.
 */
export function addGlobalOptions(program: CommandInstance): void {
  program
    .option("-v, --verbose", "Enable verbose logging", false)
    .option("-q, --quiet", "Suppress non-error output", false)
    .option(
      "-d, --dry-run",
      "Preview changes without writing files",
      DEFAULT_CONNECT_OPTIONS.dryRun,
    )
    .option("-c, --config <path>", "Path to a config file");
}

/**
 * Applies consistent help formatting for better readability.
 *
 * Configures option display formatting and adds usage examples.
 *
 * @param program - The Commander program instance.
 */
export function applyHelpFormatting(program: CommandInstance): void {
  program.configureHelp({
    sortSubcommands: true,
    sortOptions: false,
    /**
     * Formats the option flags for help output.
     *
     * @param option - Commander option metadata.
     * @returns Formatted option display string.
     */
    optionTerm: (option) => {
      const flags = option.flags.replace(", ", " | ");
      const required = option.mandatory ? " (required)" : "";
      return `${flags}${required}`;
    },
  });

  program.addHelpText(
    "afterAll",
    [
      "",
      "Examples:",
      "  figma-connecter connect --path ./packages/components/src/components/button",
      "  figma-connecter connect --path ./packages/components/src/components --recursive",
      "  figma-connecter connect --path ./packages/components/src/components --emit webcomponent",
    ].join("\n"),
  );
}
