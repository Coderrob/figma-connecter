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
 * Pipeline Runner
 *
 * Orchestrates the complete connect pipeline execution.
 *
 * @module pipeline/runner
 */
import type { Logger } from "@/src/core/logger";
import {
  createEmptyComponentResult,
  createEmptyReport,
  createReportTimer,
  reportReducer,
  type IReportTimer,
} from "@/src/core/report";
import {
  applyAggregateDiagnostics,
  applyDiagnostics,
  createResult,
  createResultWithDiagnostics,
  type IDiagnostics,
  type IResult,
} from "@/src/core/result";
import type {
  IComponentResult,
  IConnectOptions,
  IGenerationReport,
} from "@/src/core/types";
import { createEmitters } from "@/src/emitters/factory";
import type { IEmitter } from "@/src/emitters/types";
import { nodeIoAdapter } from "@/src/io/adapter";
import { discoverComponentFiles } from "@/src/io/file-discovery";
import { loadSourceProgram } from "@/src/io/source-loader";
import { createDefaultParser } from "@/src/parsers/factory";
import type { IParser } from "@/src/parsers/types";
import type { IDiscoveredFile, ISourceLoadResult } from "@/src/types/io";

import type { PipelineContextSeed } from "@/src/types/pipeline";
import { processComponentBatch } from "./batch";

interface IRunnerContext {
  readonly options: IConnectOptions;
  readonly logger: Readonly<Logger>;
  readonly timer: IReportTimer;
  readonly discovered: readonly IDiscoveredFile[];
  readonly emitters: readonly IEmitter[];
  readonly parser?: IParser;
  readonly pipelineSeed?: PipelineContextSeed;
  readonly sourceLoad?: ISourceLoadResult;
  readonly results: readonly IComponentResult[];
  readonly componentResults: readonly IComponentResult[];
  readonly stopEarly: boolean;
  readonly report?: IGenerationReport;
}

type RunnerStep = (state: IResult<IRunnerContext>) => IResult<IRunnerContext>;

interface IReportBuildOptions {
  readonly includeComponents: boolean;
}

/**
 * Appends a diagnostic-only component result to runner state.
 * @param state - Current runner state.
 * @param diagnostics - Diagnostics to convert into a component result entry.
 * @returns Updated runner state with the diagnostic result appended.
 */
const appendDiagnosticResult = (
  state: Readonly<IResult<IRunnerContext>>,
  diagnostics: Readonly<IDiagnostics>,
): IResult<IRunnerContext> => {
  const diagnosticResult = applyDiagnostics(
    createResultWithDiagnostics(createEmptyComponentResult(), diagnostics),
  );
  return appendRunnerResults(state, [diagnosticResult]);
};

/**
 * Appends component results to the runner state.
 * @param state - Current runner state.
 * @param results - Component results to append.
 * @returns Updated runner state.
 */
function appendRunnerResults(
  state: Readonly<IResult<IRunnerContext>>,
  results: readonly IComponentResult[],
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    results: [...state.value.results, ...results],
  });
}

/**
 * Builds the final generation report from collected component results.
 * @param results - Component results accumulated during the pipeline run.
 * @param timer - Timer used to calculate total pipeline duration.
 * @param options - Report-building flags.
 * @param options.includeComponents - Whether to include per-component details.
 * @param componentResults - Per-component results to attach when requested.
 * @returns Final generation report for the pipeline run.
 */
const buildReport = (
  results: readonly IComponentResult[],
  timer: Readonly<IReportTimer>,
  options: Readonly<IReportBuildOptions>,
  componentResults: readonly IComponentResult[],
): IGenerationReport => {
  const report = {
    ...results.reduce(reportReducer, createEmptyReport()),
    durationMs: timer.stop(),
  };

  return options.includeComponents ? { ...report, componentResults } : report;
};

/**
 * Creates the initial runner context for a pipeline invocation.
 * @param options - Connect command options.
 * @param logger - Logger used by the pipeline.
 * @returns Initial runner context.
 */
function createInitialRunnerContext(
  options: Readonly<IConnectOptions>,
  logger: Readonly<Logger>,
): IRunnerContext {
  return {
    options,
    logger,
    timer: createReportTimer(),
    discovered: [],
    emitters: [],
    parser: undefined,
    pipelineSeed: undefined,
    sourceLoad: undefined,
    results: [],
    componentResults: [],
    stopEarly: false,
    report: undefined,
  };
}

/**
 * Discovers component source files for the pipeline input path.
 * @param state - Current runner state.
 * @returns Updated runner state with discovered files or an early-stop warning.
 */
const discoverComponentsStep: RunnerStep = (state) => {
  const { logger, options } = state.value;
  logger.info("Discovering component files...", {
    inputPath: options.inputPath,
    recursive: options.recursive,
  });
  const discovered = discoverComponentFiles(options.inputPath, {
    recursive: options.recursive,
  });

  if (discovered.length === 0) {
    const next = appendDiagnosticResult(state, {
      warnings: [`No component files found at: ${options.inputPath}`],
    });
    return setDiscoveredFiles(next, discovered, true);
  }

  logger.info("Component files discovered.", {
    count: discovered.length,
  });

  return setDiscoveredFiles(state, discovered);
};

/**
 * Finalizes the pipeline report and stores it on runner state.
 * @param state - Current runner state.
 * @returns Updated runner state with the final report attached.
 */
const finalizeReportStep: RunnerStep = (state) => {
  const { componentResults, discovered, results, timer } = state.value;
  const reportWithComponents = buildReport(
    results,
    timer,
    { includeComponents: discovered.length > 0 },
    componentResults,
  );

  return setRunnerReport(state, reportWithComponents);
};

/**
 * Extracts file paths from discovered file metadata.
 * @param file - Discovered file metadata.
 * @returns Absolute or relative file path for source loading.
 */
function getDiscoveredFilePath(file: Readonly<IDiscoveredFile>): string {
  return file.filePath;
}

/**
 * Initializes parser, emitters, and shared pipeline context.
 * @param state - Current runner state.
 * @returns Updated runner state with initialized pipeline dependencies.
 */
const initializePipelineStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { options, logger } = state.value;
  const emitters = createEmitters({ targets: options.emitTargets });
  const parser = createDefaultParser();
  const pipelineSeed: PipelineContextSeed = {
    emitters,
    parser,
    dryRun: options.dryRun,
    strict: options.strict,
    logger,
    continueOnError: options.continueOnError,
    baseImportPath: options.baseImportPath,
    force: options.force ?? false,
    io: nodeIoAdapter,
  };

  return setInitializedPipeline(state, emitters, parser, pipelineSeed);
};

/**
 * Loads the TypeScript program and source files for discovered components.
 * @param state - Current runner state.
 * @returns Updated runner state with loaded source-program data.
 */
const loadSourcesStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { discovered, logger, options, pipelineSeed } = state.value;
  if (!pipelineSeed) {
    return state;
  }

  const sourceLoad = loadSourceProgram(discovered.map(getDiscoveredFilePath), {
    context: pipelineSeed,
    tsconfigPath: options.tsconfigPath,
    searchPath: options.inputPath,
  });

  logSourceLoadConfig(logger, sourceLoad);
  let next: IResult<IRunnerContext> = setSourceLoad(state, sourceLoad);

  if (sourceLoad.errors.length > 0) {
    next = appendDiagnosticResult(next, { errors: sourceLoad.errors });
  }

  return next;
};

/**
 * Logs the tsconfig path used to build the source program.
 * @param logger - Logger receiving debug output.
 * @param sourceLoad - Source load result to inspect.
 * @returns Nothing.
 */
function logSourceLoadConfig(
  logger: Readonly<Logger>,
  sourceLoad: Readonly<ISourceLoadResult>,
): void {
  if (!sourceLoad.configPath) {
    return;
  }

  logger.debug("Using tsconfig for TypeScript program.", {
    configPath: sourceLoad.configPath,
  });
}

/**
 * Builds the final report from the last runner state.
 * @param state - Final runner state.
 * @returns Final generation report.
 */
function resolveFinalReport(
  state: Readonly<IResult<IRunnerContext>>,
): IGenerationReport {
  if (state.value.report) {
    return state.value.report;
  }

  return buildReport(
    state.value.results,
    state.value.timer,
    { includeComponents: state.value.discovered.length > 0 },
    state.value.componentResults,
  );
}

/**
 * Parses and emits all discovered components using the loaded source context.
 * @param state - Current runner state.
 * @returns Updated runner state with per-component batch results.
 */
const runBatchStep: RunnerStep = (state) => {
  if (state.value.stopEarly) {
    return state;
  }

  const { discovered, sourceLoad } = state.value;
  if (!sourceLoad) {
    return state;
  }

  const aggregate = processComponentBatch(discovered, sourceLoad.context);
  const componentResults: IComponentResult[] =
    applyAggregateDiagnostics(aggregate);
  return setBatchResults(state, componentResults);
};

/**
 * Runs the full connect pipeline from discovery through report generation.
 * @param options - Connect command options controlling pipeline behavior.
 * @param logger - Logger used for pipeline progress and diagnostics.
 * @returns Promise resolving to the final generation report.
 */
export function runConnectPipeline(
  options: Readonly<IConnectOptions>,
  logger: Readonly<Logger>,
): Promise<IGenerationReport> {
  const finalState = runSteps(
    createResult(createInitialRunnerContext(options, logger)),
    [
      discoverComponentsStep,
      initializePipelineStep,
      loadSourcesStep,
      warnOnMissingEmittersStep,
      runBatchStep,
      finalizeReportStep,
    ],
  );

  return Promise.resolve(resolveFinalReport(finalState));
}

/**
 * Executes a single runner step within `Array.prototype.reduce`.
 * @param state - Accumulated runner state.
 * @param step - Pipeline step to execute.
 * @returns Updated runner state.
 */
function runRunnerStep(
  state: Readonly<IResult<IRunnerContext>>,
  step: RunnerStep,
): IResult<IRunnerContext> {
  return step(state);
}

/**
 * Runs pipeline steps in order and returns the final state.
 *
 * @param state - Current runner state.
 * @param steps - Steps to execute.
 * @returns Updated runner state.
 */
function runSteps(
  state: Readonly<IResult<IRunnerContext>>,
  steps: readonly RunnerStep[],
): IResult<IRunnerContext> {
  return steps.reduce(runRunnerStep, state);
}

/**
 * Stores batch output on runner state.
 * @param state - Current runner state.
 * @param componentResults - Results produced by batch processing.
 * @returns Updated runner state.
 */
function setBatchResults(
  state: Readonly<IResult<IRunnerContext>>,
  componentResults: readonly IComponentResult[],
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    componentResults,
    results: [...state.value.results, ...componentResults],
  });
}

/**
 * Stores discovered files on the runner state.
 * @param state - Current runner state.
 * @param discovered - Discovered component files.
 * @param stopEarly - Whether pipeline execution should stop after discovery.
 * @returns Updated runner state.
 */
function setDiscoveredFiles(
  state: Readonly<IResult<IRunnerContext>>,
  discovered: readonly IDiscoveredFile[],
  stopEarly = false,
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    discovered,
    stopEarly,
  });
}

/**
 * Stores initialized pipeline dependencies on runner state.
 * @param state - Current runner state.
 * @param emitters - Emitter instances for the pipeline run.
 * @param parser - Parser used for component parsing.
 * @param pipelineSeed - Shared pipeline seed passed to source loading.
 * @returns Updated runner state.
 */
function setInitializedPipeline(
  state: Readonly<IResult<IRunnerContext>>,
  emitters: readonly IEmitter[],
  parser: Readonly<IParser>,
  pipelineSeed: Readonly<PipelineContextSeed>,
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    emitters,
    parser,
    pipelineSeed,
  });
}

/**
 * Attaches the final report to runner state.
 * @param state - Current runner state.
 * @param report - Final generation report.
 * @returns Updated runner state.
 */
function setRunnerReport(
  state: Readonly<IResult<IRunnerContext>>,
  report: Readonly<IGenerationReport>,
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    report,
  });
}

/**
 * Replaces the runner context value while preserving accumulated diagnostics.
 * @param state - Current runner state.
 * @param value - Next runner context value.
 * @returns Updated runner state.
 */
function setRunnerValue(
  state: Readonly<IResult<IRunnerContext>>,
  value: Readonly<IRunnerContext>,
): IResult<IRunnerContext> {
  return {
    ...state,
    value,
  };
}

/**
 * Stores source-program load results on runner state.
 * @param state - Current runner state.
 * @param sourceLoad - Source program load result.
 * @returns Updated runner state.
 */
function setSourceLoad(
  state: Readonly<IResult<IRunnerContext>>,
  sourceLoad: Readonly<ISourceLoadResult>,
): IResult<IRunnerContext> {
  return setRunnerValue(state, {
    ...state.value,
    sourceLoad,
  });
}

/**
 * Adds a warning when no emitters are selected.
 *
 * @param state - Current runner state.
 * @returns Updated runner state.
 */
function warnOnMissingEmittersStep(
  state: Readonly<IResult<IRunnerContext>>,
): IResult<IRunnerContext> {
  if (state.value.stopEarly) {
    return state;
  }

  if (state.value.emitters.length === 0) {
    return appendDiagnosticResult(state, {
      warnings: ["No emitters selected. Use --emit to specify targets."],
    });
  }

  return state;
}
