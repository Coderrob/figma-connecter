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

import { getGlobalOptions } from "@/src/cli/options";

import { createProgressIndicator } from "@/src/cli/progress";
import {
  validateConfigPath,
  validateGlobalOptions,
  validatePathOption,
} from "@/src/cli/validators";
import CommandBuilder from "@/src/commands/command-builder";
import { DEFAULT_CONNECT_OPTIONS } from "@/src/core/constants";
import { parseEmitTargets } from "@/src/core/emit-targets";
import { Logger } from "@/src/core/logger";
import { formatReportSummary } from "@/src/core/report";
import { hasErrors, hasWarnings } from "@/src/core/result";
import type {
  IConnectOptions,
  EmitterTarget,
  IGenerationReport,
  IComponentResult,
  IFileChangeDetail,
} from "@/src/core/types";
import { GenerationStatus } from "@/src/core/types";
import { runConnectPipeline } from "@/src/pipeline";
import type {
  CommandContext,
  CommandStages,
  GlobalCliOptions,
} from "@/src/cli/types";
import { ProgressStatus } from "@/src/cli/types";
import { Command } from "commander";
import { EMIT_TARGETS } from "./constants";
import { resolveLogLevel, runCommandStages } from "./helpers";
import type { IConnectCommandOptions } from "./types";

type PipelineReport = IGenerationReport;
type PipelineComponentResult = IComponentResult;
type PipelineFileChange = IFileChangeDetail;

const FAILED_EXIT_CODE = 1;
const DRY_RUN_DETAILS_HEADER = "=== Dry Run Details ===";
const GENERATION_SUMMARY_HEADER = "=== Generation Summary ===";
const UNKNOWN_COMPONENT_NAME = "UnknownComponent";

interface IResolvedConnectInputs {
  readonly inputPath: string;
  readonly configPath: string | undefined;
  readonly emitTargets: readonly EmitterTarget[];
  readonly dryRun: boolean;
}

type ConnectCommandBaseContext = CommandContext<
  IConnectCommandOptions,
  IResolvedConnectInputs
>;

type ConnectCommandContext = ConnectCommandBaseContext & {
  readonly connectOptions: IConnectOptions;
};

/**
 * Builds normalized pipeline options from the validated command context.
 * @param context - Validated connect command context.
 * @returns Connect pipeline options derived from CLI inputs.
 */
function buildConnectOptions(
  context: Readonly<ConnectCommandBaseContext>,
): IConnectOptions {
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
  options: Readonly<IConnectCommandOptions>,
  command: Readonly<Command>,
): CommandStages<ConnectCommandContext, PipelineReport> =>
  new CommandBuilder<ConnectCommandContext, PipelineReport>()
    .validate(createValidateStage(options, command))
    .execute(executeConnectPipelineStage)
    .report(reportConnectPipelineStage)
    .onError(stopConnectProgressOnError)
    .build();

/**
 * Resolves and validates inputs for the connect command.
 *
 * @param options - Parsed command options.
 * @param command - Commander command instance.
 * @returns Resolved inputs and helpers for command execution.
 */
function createConnectContext(
  options: Readonly<IConnectCommandOptions>,
  command: Readonly<Command>,
): ConnectCommandBaseContext {
  const globalOptions = getGlobalOptions(command);
  validateGlobalOptions(globalOptions);
  const logger = new Logger(resolveLogLevel(globalOptions));
  const progress = createProgressIndicator({ enabled: !globalOptions.quiet });
  const dryRun = isDryRun(options, globalOptions);
  progress.start("Validating options");
  const inputPath = validatePathOption(options.path);
  const configPath = validateConfigPath(globalOptions.config);
  const emitTargets = parseEmitTargets(options.emit, EMIT_TARGETS);
  progress.stop("Options validated");
  logger.info("Connect command initialized.");
  logResolvedConnectOptions(logger, options, {
    configPath,
    dryRun,
    emitTargets,
    inputPath,
  });

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
 * Creates the validate stage used by the connect command builder.
 *
 * @param options - Parsed connect command options.
 * @param command - Commander command instance.
 * @returns Function that builds a fully resolved connect command context.
 */
function createValidateStage(
  options: Readonly<IConnectCommandOptions>,
  command: Readonly<Command>,
): () => ConnectCommandContext {
  /**
   * Builds and returns a fully resolved connect command context.
   *
   * @returns Validated connect command context.
   */
  const validate = (): ConnectCommandContext => {
    const context = createConnectContext(options, command);
    return {
      ...context,
      connectOptions: buildConnectOptions(context),
    };
  };
  return validate;
}

/**
 * Executes the connect pipeline and updates progress state.
 *
 * @param context - Validated connect command context.
 * @returns Generation report from the pipeline.
 */
async function executeConnectPipelineStage(
  context: Readonly<ConnectCommandContext>,
): Promise<PipelineReport> {
  context.progress.start("Running connect pipeline");
  const report = await runConnectPipeline(
    context.connectOptions,
    context.logger,
  );
  const pStatus = isErrorReport(report)
    ? ProgressStatus.Error
    : ProgressStatus.Success;
  context.progress.stop("Connect pipeline complete", pStatus);
  return report;
}

/**
 * Resolves the effective dry-run flag from command and global options.
 * @param options - Connect command options.
 * @param globalOptions - Global CLI options.
 * @returns Effective dry-run value for the current command execution.
 */
function isDryRun(
  options: Readonly<IConnectCommandOptions>,
  globalOptions: Readonly<GlobalCliOptions>,
): boolean {
  return (
    options.dryRun ?? globalOptions.dryRun ?? DEFAULT_CONNECT_OPTIONS.dryRun
  );
}

/**
 * Determines whether a pipeline report represents a failed run.
 *
 * @param report - Generation report to evaluate.
 * @returns True when the report status is `error`.
 */
function isErrorReport(report: Readonly<PipelineReport>): boolean {
  return report.status === GenerationStatus.Error;
}

/**
 * Logs per-component dry-run details from a pipeline report.
 * @param logger - Logger used for command output.
 * @param report - Pipeline report containing component-level details.
 * @returns Nothing.
 */
function logDryRunDetails(
  logger: Readonly<Logger>,
  report: Readonly<PipelineReport>,
): void {
  const componentResults = report.componentResults ?? [];
  if (componentResults.length === 0) {
    return;
  }

  logger.info("");
  logger.info(DRY_RUN_DETAILS_HEADER);
  for (const component of componentResults) {
    logComponentDryRunDetails(logger, component);
  }
}

/**
 * Logs warning and error diagnostics from a pipeline report.
 * @param logger - Logger used for command output.
 * @param report - Pipeline report containing diagnostics.
 * @returns Nothing.
 */
function logReportDiagnostics(
  logger: Readonly<Logger>,
  report: Readonly<PipelineReport>,
): void {
  if (hasWarnings(report)) {
    logger.warn(`Warnings: ${report.warnings.length}`);
    report.warnings.forEach(
      /**
       * Logs a single warning message.
       *
       * @param warning - Warning text to log.
       */
      (warning) => {
        logger.warn(`  - ${warning}`);
      },
    );
  }
  if (hasErrors(report)) {
    logger.error(`Errors: ${report.errors.length}`);
    report.errors.forEach(
      /**
       * Logs a single error message.
       *
       * @param error - Error text to log.
       */
      (error) => {
        logger.error(`  - ${error}`);
      },
    );
  }
}

/**
 * Logs dry-run summary and file changes for a single component result.
 * @param logger - Logger used for command output.
 * @param component - Component result to log.
 * @returns Nothing.
 */
function logComponentDryRunDetails(
  logger: Readonly<Logger>,
  component: Readonly<PipelineComponentResult>,
): void {
  logger.info(formatComponentDryRunSummary(component));
  for (const line of getDryRunChangeLines(component)) {
    logger.info(line);
  }
}

/**
 * Formats the dry-run summary line for a component result.
 * @param component - Component result to summarize.
 * @returns Summary line including name and created/updated/unchanged counts.
 */
function formatComponentDryRunSummary(
  component: Readonly<PipelineComponentResult>,
): string {
  const name = getComponentDisplayName(component);
  const created = component.created.length;
  const updated = component.updated.length;
  const unchanged = component.unchanged.length;
  return `${name}: created ${created}, updated ${updated}, unchanged ${unchanged}`;
}

/**
 * Returns the display name used for component-level logging.
 * @param component - Component result to inspect.
 * @returns Explicit component name, model class name, or a fallback label.
 */
function getComponentDisplayName(
  component: Readonly<PipelineComponentResult>,
): string {
  return (
    component.componentName ??
    component.model?.className ??
    UNKNOWN_COMPONENT_NAME
  );
}

/**
 * Builds the dry-run file-change lines for a component result.
 * @param component - Component result whose file changes should be logged.
 * @returns Formatted file-change lines.
 */
function getDryRunChangeLines(
  component: Readonly<PipelineComponentResult>,
): readonly string[] {
  return (component.fileChanges ?? []).map(formatDryRunChangeLine);
}

/**
 * Formats a single dry-run file-change line.
 * @param change - File change metadata to log.
 * @returns Formatted file-change line with a relative or absolute path.
 */
function formatDryRunChangeLine(
  change: Readonly<PipelineFileChange>,
): string {
  const relative = path.relative(process.cwd(), change.filePath) || change.filePath;
  return `  - ${relative}: ${change.status} (${change.reason})`;
}

/**
 * Logs the human-readable generation summary for a pipeline report.
 * @param logger - Logger used for command output.
 * @param report - Pipeline report to summarize.
 * @returns Nothing.
 */
function logReportSummary(
  logger: Readonly<Logger>,
  report: Readonly<PipelineReport>,
): void {
  logger.info("");
  logger.info(GENERATION_SUMMARY_HEADER);
  formatReportSummary(report)
    .split("\n")
    .forEach(
      /**
       * Logs a single line of the report summary.
       *
       * @param line - Summary line to log.
       */
      (line) => {
        logger.info(line);
      },
    );
}

/**
 * Logs resolved connect options and mode-specific messages.
 *
 * @param logger - Logger instance for output.
 * @param options - Parsed connect command options.
 * @param resolved - Resolved option values derived during validation.
 * @returns Nothing.
 */
function logResolvedConnectOptions(
  logger: Readonly<Logger>,
  options: Readonly<IConnectCommandOptions>,
  resolved: Readonly<{
    configPath?: string;
    dryRun: boolean;
    emitTargets: readonly EmitterTarget[];
    inputPath: string;
  }>,
): void {
  logger.debug("Resolved options", {
    inputPath: resolved.inputPath,
    recursive: options.recursive,
    dryRun: resolved.dryRun,
    emitTargets: resolved.emitTargets,
    strict: options.strict,
    configPath: resolved.configPath,
    continueOnError: options.continueOnError,
    baseImportPath: options.baseImportPath,
    force: options.force,
  });
  if (resolved.dryRun) {
    logger.info("Dry run enabled. No files will be written.");
  }
  if (options.force) {
    logger.info("Force enabled. Connect files will be fully rewritten.");
  }
}

/**
 * Reports pipeline output and updates process exit state.
 *
 * @param context - Validated connect command context.
 * @param report - Pipeline generation report.
 * @returns Nothing.
 */
function reportConnectPipelineStage(
  context: Readonly<ConnectCommandContext>,
  report: Readonly<PipelineReport>,
): void {
  reportPipelineOutcome(context, report);
}

/**
 * Executes the connect command stages and wraps stage errors consistently.
 * @param options - Parsed connect command options.
 * @param command - Commander command instance for the current invocation.
 * @returns Promise that resolves when command execution completes.
 */
export async function runConnectCommand(
  options: Readonly<IConnectCommandOptions>,
  command: Readonly<Command>,
): Promise<void> {
  await runCommandStages(createConnectCommand(options, command));
}

/**
 * Stops progress reporting when command execution fails.
 *
 * @param context - Validated connect command context.
 * @returns Nothing.
 */
function stopConnectProgressOnError(
  context: Readonly<ConnectCommandContext>,
): void {
  context.progress.stop("Connect failed", ProgressStatus.Error);
}

/**
 * Logs a pipeline report and applies any process-level side effects.
 * @param context - Validated connect command context.
 * @param report - Pipeline generation report.
 * @returns Nothing.
 */
function reportPipelineOutcome(
  context: Readonly<ConnectCommandContext>,
  report: Readonly<PipelineReport>,
): void {
  logReportSummary(context.logger, report);
  if (context.dryRun) {
    logDryRunDetails(context.logger, report);
  }
  logReportDiagnostics(context.logger, report);
  applyReportExitCode(report);
}

/**
 * Applies the process exit code for a pipeline report.
 * @param report - Pipeline generation report to evaluate.
 * @returns Nothing.
 */
function applyReportExitCode(report: Readonly<PipelineReport>): void {
  if (isErrorReport(report)) {
    Reflect.set(process, "exitCode", FAILED_EXIT_CODE);
  }
}
