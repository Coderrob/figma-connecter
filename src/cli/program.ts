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
import { registerCommands } from "@/src/commands/registry";

import { DEFAULT_CONNECT_OPTIONS } from "@/src/core/constants";

import { nodeIoAdapter } from "@/src/io/adapter";
import { Command } from "commander";

/** Commander Command instance type. */
type CommandInstance = InstanceType<typeof Command>;

/** Package metadata loaded from package.json */
interface IPackageJson {
  description?: string;
  version?: string;
}

/**
 * Adds global options shared across all commands.
 *
 * @param program - The Commander program instance.
 */
export function addGlobalOptions(program: Readonly<CommandInstance>): void {
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

const { description = "Figma Connecter management tool", version = "1.0.0" } =
  getPackageMetadata();

/**
 * Creates and configures the main CLI program.
 *
 * Sets up the program with name, description, version, global options,
 * and help formatting. Commands are registered from the command registry.
 *
 * @param program - The Commander program instance.
 * @returns The configured Commander program instance.
 */
export function applyHelpFormatting(program: Readonly<CommandInstance>): void {
  program.configureHelp({
    sortSubcommands: true,
    sortOptions: false,
    /**
     * Formats the option flags for help output.
     *
     * @param option - Commander option metadata.
     * @returns Formatted option display string.
     */
    optionTerm: function formatOptionTerm(option) {
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

/**
 * Main entry point for the CLI.
 *
 * Parses command-line arguments and executes the appropriate command.
 *
 * @returns Configured Commander program instance.
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
 * Reads package metadata from package.json.
 *
 * @returns Package metadata object.
 */
function getPackageMetadata(): IPackageJson {
  try {
    // When built, this file is at dist/src/cli/program.js
    // package.json is at the package root (../../.. from dist/src/cli/)
    const packageJsonPath = path.resolve(__dirname, "../../../package.json");
    const content = nodeIoAdapter.readFile(packageJsonPath);
    const parsed: unknown = JSON.parse(content);
    return isPackageJson(parsed) ? parsed : {};
  } catch {
    return { description: "Figma Connecter management tool", version: "1.0.0" };
  }
}

/**
 * Returns true when an unknown value has the expected package.json shape.
 *
 * @param value - Parsed JSON value to validate.
 * @returns Whether the value matches the package metadata contract.
 */
function isPackageJson(value: unknown): value is IPackageJson {
  if (!value || typeof value !== "object") {
    return false;
  }

  const description = readProperty(value, "description");
  const version = readProperty(value, "version");
  return (
    (description === undefined || typeof description === "string") &&
    (version === undefined || typeof version === "string")
  );
}

/**
 * Reads a named property from an object-like unknown value.
 *
 * @param value - Object-like value to inspect.
 * @param key - Property name to read.
 * @returns Property value as unknown.
 */
function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key);
}

/**
 * Applies consistent help formatting for better readability.
 *
 * Configures option display formatting and adds usage examples.
 *
 * @param argv - Command-line arguments. Defaults to process.argv.
 */
export async function run(
  argv: readonly string[] = process.argv,
): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}
