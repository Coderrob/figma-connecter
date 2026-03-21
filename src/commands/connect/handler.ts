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
 * Connect Command Handler
 *
 * Handles execution of the connect command.
 *
 * @module commands/connect/handler
 */
import path from "node:path";

import { Command } from "commander";

import { getGlobalOptions } from "../../cli/options";
import { createProgressIndicator } from "../../cli/progress";
import {
  validateConfigPath,
  validateGlobalOptions,
  validatePathOption,
} from "../../cli/validators";
import { DEFAULT_CONNECT_OPTIONS } from "../../core/constants";
import { parseEmitTargets } from "../../core/emit-targets";
import { Logger } from "../../core/logger";
import { formatReportSummary } from "../../core/report";
import { hasErrors, hasWarnings } from "../../core/result";
import type {
  ConnectOptions,
  EmitterTarget,
  GenerationReport,
} from "../../core/types";
import { runConnectPipeline } from "../../pipeline";
import type {
  CommandContext,
  CommandStages,
  GlobalCliOptions,
} from "../../types/cli";

import { ProgressStatus } from "../../types/cli";
import CommandBuilder from "../command-builder";
import { EMIT_TARGETS } from "./constants";
import { resolveLogLevel, runCommandStages } from "./helpers";
import type { ConnectCommandOptions } from "./types";

type PipelineReport = GenerationReport;

interface ResolvedConnectInputs {
  readonly inputPath: string;
  readonly configPath: string | undefined;
  readonly emitTargets: readonly EmitterTarget[];
  readonly dryRun: boolean;
}

type ConnectCommandBaseContext = CommandContext<
  ConnectCommandOptions,
  ResolvedConnectInputs
>;

type ConnectCommandContext = ConnectCommandBaseContext & {
  readonly connectOptions: ConnectOptions;
};

/**
 * Creates the connect command stage handlers.
 *
 * @param options - Parsed command options.
 * @param command - Commander command instance.
 * @param context
 * @returns Command stage handlers.
 */
function buildConnectOptions(
  context: ConnectCommandBaseContext,
): ConnectOptions {
  const { options, inputPath, configPath, emitTargets, dryRun } = context;
  return {
    inputPath,
    recursive: options.recursive,
    dryRun,
    emitTargets,
    strict: options.strict,
    tsconfigPath: configPath,
    continueOnError: options.continueOnError,
    baseImportPath: options.baseImportPath,
    force: options.force ?? DEFAULT_CONNECT_OPTIONS.force,
  };
}

/**
 * Executes the connect command logic with logging and progress reporting.
 *
 * @param options - Parsed command options.
 * @param command - Commander command instance.
 * @returns Nothing.
 */
const createConnectCommand = (
  options: ConnectCommandOptions,
  command: Command,
): CommandStages<ConnectCommandContext, PipelineReport> =>
  new CommandBuilder<ConnectCommandContext, PipelineReport>()
    .validate((): ConnectCommandContext => {
      const context = createConnectContext(options, command);
      return {
        ...context,
        connectOptions: buildConnectOptions(context),
      };
    })
    .execute(async (context) => {
      context.progress.start("Running connect pipeline");
      const report = await runConnectPipeline(
        context.connectOptions,
        context.logger,
      );
      const status = report.status as string;
      const pStatus =
        status === "error" ? ProgressStatus.Error : ProgressStatus.Success;
      context.progress.stop("Connect pipeline complete", pStatus);
      return report;
    })
    .report((context, report) => {
      logReportSummary(context.logger, report);
      logDryRunDetails(context.logger, report, context.dryRun);
      logReportDiagnostics(context.logger, report);

      const status = report.status as string;
      if (status === "error") {
        process.exitCode = 1;
      }
    })
    .onError((context) => {
      context.progress.stop("Connect failed", ProgressStatus.Error);
    })
    .build();

/**
 * Resolves and validates inputs for the connect command.
 *
 * @param options - Parsed command options.
 * @param command - Commander command instance.
 * @returns Resolved inputs and helpers for command execution.
 */
function createConnectContext(
  options: ConnectCommandOptions,
  command: Command,
): ConnectCommandBaseContext {
  const globalOptions = getGlobalOptions(command);
  validateGlobalOptions(globalOptions);
  const logger = new Logger(resolveLogLevel(globalOptions));
  const progress = createProgressIndicator({ enabled: !globalOptions.quiet });
  const dryRun = resolveDryRun(options, globalOptions);

  progress.start("Validating options");
  const inputPath = validatePathOption(options.path);
  const configPath = validateConfigPath(globalOptions.config);
  const emitTargets = parseEmitTargets(options.emit, EMIT_TARGETS);
  progress.stop("Options validated");

  logger.info("Connect command initialized.");
  logger.debug("Resolved options", {
    inputPath,
    recursive: options.recursive,
    dryRun,
    emitTargets,
    strict: options.strict,
    configPath,
    continueOnError: options.continueOnError,
    baseImportPath: options.baseImportPath,
    force: options.force,
  });

  if (dryRun) {
    logger.info("Dry run enabled. No files will be written.");
  }
  if (options.force) {
    logger.info("Force enabled. Connect files will be fully rewritten.");
  }

  return {
    options,
    globalOptions,
    inputPath,
    configPath,
    emitTargets,
    dryRun,
    logger,
    progress,
  };
}

/**
 * Resolves the dryRun flag from command options and global options.
 *
 * @param options - Command-specific options.
 * @param globalOptions - Global CLI options.
 * @param command
 * @param logger
 * @param report
 * @param dryRun
 * @returns The resolved dryRun boolean value.
 */
function logDryRunDetails(
  logger: Logger,
  report: PipelineReport,
  dryRun: boolean,
): void {
  if (!dryRun || !report.componentResults?.length) {
    return;
  }

  logger.info("");
  logger.info("=== Dry Run Details ===");

  for (const component of report.componentResults) {
    const name =
      component.componentName ??
      component.model?.className ??
      "UnknownComponent";
    const created = component.created.length;
    const updated = component.updated.length;
    const unchanged = component.unchanged.length;

    logger.info(
      `${name}: created ${created}, updated ${updated}, unchanged ${unchanged}`,
    );

    if (component.fileChanges && component.fileChanges.length > 0) {
      for (const change of component.fileChanges) {
        const relative =
          path.relative(process.cwd(), change.filePath) || change.filePath;
        logger.info(`  - ${relative}: ${change.status} (${change.reason})`);
      }
    }
  }
}

/**
 * Builds the connect options payload for the pipeline.
 *
 * @param context - Resolved connect command context.
 * @param options
 * @param globalOptions
 * @param command
 * @param logger
 * @param report
 * @returns Connect pipeline options.
 */
function logReportDiagnostics(logger: Logger, report: PipelineReport): void {
  if (hasWarnings(report)) {
    logger.warn(`Warnings: ${report.warnings.length}`);
    report.warnings.forEach((warning) => logger.warn(`  - ${warning}`));
  }
  if (hasErrors(report)) {
    logger.error(`Errors: ${report.errors.length}`);
    report.errors.forEach((error) => logger.error(`  - ${error}`));
  }
}

/**
 * Logs the summary block for a generation report.
 *
 * @param logger - Logger instance for output.
 * @param report - Generation report to summarize.
 * @param options
 * @param globalOptions
 * @param command
 * @returns Nothing.
 */
function logReportSummary(logger: Logger, report: PipelineReport): void {
  logger.info("");
  logger.info("=== Generation Summary ===");
  formatReportSummary(report)
    .split("\n")
    .forEach((line) => logger.info(line));
}

/**
 * Logs dry-run details for each component when enabled.
 *
 * @param logger - Logger instance for output.
 * @param report - Generation report to inspect.
 * @param dryRun - Whether dry-run mode is enabled.
 * @param options
 * @param globalOptions
 * @param command
 * @returns Nothing.
 */
function resolveDryRun(
  options: ConnectCommandOptions,
  globalOptions: GlobalCliOptions,
): boolean {
  return (
    options.dryRun ?? globalOptions.dryRun ?? DEFAULT_CONNECT_OPTIONS.dryRun
  );
}

/**
 * Logs warnings and errors from the report.
 *
 * @param logger - Logger instance for output.
 * @param report - Generation report to inspect.
 * @param options
 * @param globalOptions
 * @param command
 * @returns Nothing.
 */
export async function runConnectCommand(
  options: ConnectCommandOptions,
  command: Command,
): Promise<void> {
  await runCommandStages(createConnectCommand(options, command));
}
